from __future__ import annotations

import json
from datetime import timedelta

from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET, require_POST

from .domain import METERS_PER_MILE, Risk, WeatherReading, classify_weather, parse_departure, route_rank, sample_line, summarize
from .services.geocoding import search_places
from .services.http import ProviderError
from .services.routing import get_routes
from .services.weather import fetch_forecasts, nearest_hour, normalize_forecast


def _error(message: str, status: int) -> JsonResponse:
    return JsonResponse({"error": message}, status=status)


@require_GET
def health(_: HttpRequest) -> JsonResponse:
    return JsonResponse({"status": "ok"})


@require_GET
def geocode(request: HttpRequest) -> JsonResponse:
    query = request.GET.get("q", "").strip()
    if len(query) < 3:
        return _error("Enter at least three characters", 400)
    try:
        return JsonResponse({"results": search_places(query)})
    except ProviderError as exc:
        return _error(str(exc), 502)


def _coordinates(value: object, field: str) -> tuple[float, float]:
    if not isinstance(value, dict):
        raise ValueError(f"{field} is required")
    try:
        latitude = float(value["latitude"])
        longitude = float(value["longitude"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"{field} must contain numeric latitude and longitude") from exc
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise ValueError(f"{field} coordinates are outside valid bounds")
    return longitude, latitude


@require_POST
def plan_routes(request: HttpRequest) -> JsonResponse:
    try:
        body = json.loads(request.body)
        origin = _coordinates(body.get("origin"), "origin")
        destination = _coordinates(body.get("destination"), "destination")
        departure = parse_departure(str(body.get("departure_time", "")))
        interval = int(body.get("sample_interval_miles"))
        load_lbs = int(body.get("load_lbs"))
        if interval not in (10, 25, 50):
            raise ValueError("sample_interval_miles must be 10, 25, or 50")
        if not (0 < load_lbs <= 80_000):
            raise ValueError("load_lbs must be between 1 and 80,000")
        if origin == destination:
            raise ValueError("origin and destination must be different")
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        return _error(str(exc), 400)

    try:
        provider_routes = get_routes(origin, destination)
        prepared = []
        all_points = []
        for route in provider_routes:
            checkpoints = sample_line(route["geometry"]["coordinates"], interval)
            if len(checkpoints) > 400:
                raise ValueError("This route creates more than 400 checkpoints; choose a wider sample interval")
            prepared.append((route, checkpoints))
            all_points.extend(checkpoints)

        forecasts = fetch_forecasts(all_points)
        forecast_cursor = 0
        response_routes = []
        for index, (route, checkpoints) in enumerate(prepared):
            total_miles = route["distance"] / METERS_PER_MILE
            for checkpoint in checkpoints:
                rows = normalize_forecast(forecasts[forecast_cursor])
                forecast_cursor += 1
                progress = checkpoint["distance_miles"] / total_miles if total_miles else 0
                eta = departure + timedelta(seconds=route["duration"] * progress)
                eta_weather = nearest_hour(rows, eta)
                risk, components = classify_weather(
                    WeatherReading(eta_weather["wind_mph"], eta_weather["rain_in_hr"], eta_weather["snow_in_hr"]),
                    load_lbs,
                )
                slider_rows = []
                for hour in range(49):
                    reading = nearest_hour(rows, departure + timedelta(hours=hour))
                    slider_risk, _ = classify_weather(
                        WeatherReading(reading["wind_mph"], reading["rain_in_hr"], reading["snow_in_hr"]), load_lbs
                    )
                    slider_rows.append(slider_risk.value)
                checkpoint.update(
                    {
                        "eta": eta.isoformat(),
                        "weather": {
                            "wind_mph": round(eta_weather["wind_mph"], 1),
                            "rain_in_hr": round(eta_weather["rain_in_hr"], 2),
                            "snow_in_hr": round(eta_weather["snow_in_hr"], 2),
                        },
                        "risk": {
                            "level": risk.value,
                            "label": risk.label,
                            "drivers": [name for name, value in components.items() if value == risk],
                        },
                        "forecast_risk": slider_rows,
                    }
                )

            summary = summarize(checkpoints, total_miles, route["duration"])
            response_routes.append(
                {
                    "id": f"route-{index + 1}",
                    "name": f"Route {index + 1}",
                    "geometry": route["geometry"],
                    "checkpoints": checkpoints,
                    "summary": summary,
                }
            )

        ranked = sorted(response_routes, key=lambda item: route_rank(item["summary"]))
        recommended_id = ranked[0]["id"]
        for route in response_routes:
            route["recommended"] = route["id"] == recommended_id
        return JsonResponse(
            {
                "routes": response_routes,
                "recommended_route_id": recommended_id,
                "generated_at": departure.isoformat(),
                "risk_scale": [{"level": risk.value, "label": risk.label} for risk in Risk],
            }
        )
    except ValueError as exc:
        return _error(str(exc), 400)
    except ProviderError as exc:
        return _error(str(exc), 502)
    except Exception:
        return _error("The route plan could not be completed. Please try again.", 500)

