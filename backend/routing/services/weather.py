from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from .http import ProviderError, get_json


OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
HOURLY_FIELDS = "wind_speed_10m,precipitation,rain,snowfall"


def _chunks(values: list, size: int):
    for index in range(0, len(values), size):
        yield values[index : index + size]


def _fetch_chunk(points: list[dict]) -> list[dict]:
    payload = get_json(
        OPEN_METEO_URL,
        params={
            "latitude": ",".join(f"{point['latitude']:.5f}" for point in points),
            "longitude": ",".join(f"{point['longitude']:.5f}" for point in points),
            "hourly": HOURLY_FIELDS,
            "temperature_unit": "fahrenheit",
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",
            "timezone": "UTC",
            "forecast_days": 3,
        },
        timeout=30,
    )
    responses = payload if isinstance(payload, list) else [payload]
    if len(responses) != len(points):
        raise ProviderError("Weather provider returned incomplete checkpoint data")
    return responses


def fetch_forecasts(points: list[dict]) -> list[dict]:
    batches = list(_chunks(points, 40))
    with ThreadPoolExecutor(max_workers=min(4, len(batches) or 1)) as executor:
        nested = list(executor.map(_fetch_chunk, batches))
    return [item for batch in nested for item in batch]


def normalize_forecast(payload: dict) -> list[dict]:
    hourly = payload.get("hourly", {})
    required = ("time", "wind_speed_10m", "rain", "snowfall")
    if any(field not in hourly for field in required):
        raise ProviderError("Weather provider omitted required forecast fields")
    rows = []
    for index, time_value in enumerate(hourly["time"]):
        rows.append(
            {
                "time": datetime.fromisoformat(time_value).replace(tzinfo=timezone.utc),
                "wind_mph": float(hourly["wind_speed_10m"][index] or 0),
                "rain_in_hr": float(hourly["rain"][index] or 0),
                "snow_in_hr": float(hourly["snowfall"][index] or 0),
            }
        )
    return rows


def nearest_hour(rows: list[dict], target: datetime) -> dict:
    return min(rows, key=lambda row: abs((row["time"] - target).total_seconds()))

