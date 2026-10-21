from __future__ import annotations

from math import cos, radians

from .http import ProviderError, get_json


OSRM_URL = "https://router.project-osrm.org/route/v1/driving"


def _request(points: list[tuple[float, float]], alternatives: int | bool) -> list[dict]:
    coordinate_path = ";".join(f"{lon:.6f},{lat:.6f}" for lon, lat in points)
    payload = get_json(
        f"{OSRM_URL}/{coordinate_path}",
        params={
            "alternatives": str(alternatives).lower(),
            "overview": "full",
            "geometries": "geojson",
            "steps": "false",
        },
        timeout=30,
    )
    if not isinstance(payload, dict) or payload.get("code") != "Ok":
        raise ProviderError("Routing provider could not calculate this trip")
    return payload.get("routes", [])


def _detour_point(origin: tuple[float, float], destination: tuple[float, float], offset_miles: float) -> tuple[float, float]:
    mid_lon = (origin[0] + destination[0]) / 2
    mid_lat = (origin[1] + destination[1]) / 2
    dx, dy = destination[0] - origin[0], destination[1] - origin[1]
    length = max((dx * cos(radians(mid_lat))) ** 2 + dy**2, 1e-9) ** 0.5
    offset_lat = offset_miles / 69.0
    return (
        mid_lon - (dy / length) * offset_lat / max(cos(radians(mid_lat)), 0.2),
        mid_lat + (dx * cos(radians(mid_lat)) / length) * offset_lat,
    )


def get_routes(origin: tuple[float, float], destination: tuple[float, float]) -> list[dict]:
    routes = _request([origin, destination], alternatives=3)
    direct_miles = max((routes[0]["distance"] / 1609.344) if routes else 0, 1)

    # OSRM may return fewer than three genuinely distinct alternatives. Ask the
    # routing engine for routes through opposite, modest corridor offsets.
    for sign in (1, -1, 2, -2):
        if len(routes) >= 3:
            break
        via = _detour_point(origin, destination, sign * min(28, max(6, direct_miles * 0.08)))
        try:
            candidate = _request([origin, via, destination], alternatives=False)[0]
        except (ProviderError, IndexError):
            continue
        signature = tuple(tuple(point) for point in candidate["geometry"]["coordinates"][:: max(1, len(candidate["geometry"]["coordinates"]) // 20)])
        existing = {
            tuple(tuple(point) for point in route["geometry"]["coordinates"][:: max(1, len(route["geometry"]["coordinates"]) // 20)])
            for route in routes
        }
        if signature not in existing:
            routes.append(candidate)
    if len(routes) < 3:
        raise ProviderError("The routing provider found fewer than three viable road routes")
    return routes[:3]

