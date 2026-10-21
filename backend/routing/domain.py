from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import IntEnum
from math import asin, cos, radians, sin, sqrt
from typing import Iterable


METERS_PER_MILE = 1609.344


class Risk(IntEnum):
    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4

    @property
    def label(self) -> str:
        return self.name.replace("_", " ").title()


@dataclass(frozen=True)
class WeatherReading:
    wind_mph: float
    rain_in_hr: float
    snow_in_hr: float


def _threshold(value: float, bounds: tuple[float, float, float, float]) -> Risk:
    if value < bounds[0]:
        return Risk.LOW
    if value < bounds[1]:
        return Risk.MODERATE
    if value < bounds[2]:
        return Risk.HIGH
    if value < bounds[3]:
        return Risk.SEVERE
    return Risk.NO_TRAVEL


def classify_weather(reading: WeatherReading, load_lbs: int) -> tuple[Risk, dict[str, Risk]]:
    """Apply the assessment thresholds and the two load-sensitive wind overrides."""
    components = {
        "wind": _threshold(reading.wind_mph, (25, 35, 45, 55)),
        "rain": _threshold(reading.rain_in_hr, (0.10, 0.25, 0.50, 1.00)),
        "snow": _threshold(reading.snow_in_hr, (0.5, 1.0, 2.0, 3.0)),
    }
    wind_risk = components["wind"]
    if reading.wind_mph >= 55 or (reading.wind_mph >= 45 and load_lbs > 30_000):
        wind_risk = Risk.NO_TRAVEL
    elif reading.wind_mph >= 35 and load_lbs > 40_000:
        wind_risk = max(wind_risk, Risk.SEVERE)
    components["wind"] = wind_risk
    return max(components.values()), components


def haversine_miles(a: tuple[float, float], b: tuple[float, float]) -> float:
    lon1, lat1 = map(radians, a)
    lon2, lat2 = map(radians, b)
    dlon, dlat = lon2 - lon1, lat2 - lat1
    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * 3958.7613 * asin(sqrt(h))


def sample_line(coordinates: list[list[float]], interval_miles: int) -> list[dict]:
    """Interpolate checkpoints at a fixed along-line distance, always including both ends."""
    if len(coordinates) < 2:
        raise ValueError("A route must have at least two coordinates")

    cumulative = [0.0]
    for start, end in zip(coordinates, coordinates[1:]):
        cumulative.append(cumulative[-1] + haversine_miles(tuple(start), tuple(end)))

    total = cumulative[-1]
    targets: list[float] = []
    cursor = 0.0
    while cursor < total:
        targets.append(cursor)
        cursor += interval_miles
    if not targets or total - targets[-1] > 0.01:
        targets.append(total)

    checkpoints = []
    segment = 0
    for target in targets:
        while segment < len(cumulative) - 2 and cumulative[segment + 1] < target:
            segment += 1
        start_d, end_d = cumulative[segment], cumulative[segment + 1]
        fraction = 0.0 if end_d == start_d else (target - start_d) / (end_d - start_d)
        start, end = coordinates[segment], coordinates[segment + 1]
        checkpoints.append(
            {
                "longitude": start[0] + (end[0] - start[0]) * fraction,
                "latitude": start[1] + (end[1] - start[1]) * fraction,
                "distance_miles": target,
            }
        )
    return checkpoints


def parse_departure(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("departure_time must be a valid ISO-8601 datetime") from exc
    if parsed.tzinfo is None:
        raise ValueError("departure_time must include a UTC offset")
    parsed = parsed.astimezone(timezone.utc)
    now = datetime.now(timezone.utc)
    if parsed < now:
        raise ValueError("departure_time cannot be in the past")
    if (parsed - now).total_seconds() > 48 * 3600:
        raise ValueError("departure_time must be within the next 48 hours")
    return parsed


def route_rank(summary: dict) -> tuple[float, float, float, float]:
    """Assessment-defined lexicographic ordering; no hidden weighted score."""
    return (
        summary["severe_miles"],
        summary["high_miles"],
        summary["average_risk"],
        summary["duration_minutes"],
    )


def summarize(checkpoints: Iterable[dict], total_miles: float, duration_seconds: float) -> dict:
    points = list(checkpoints)
    severe_miles = high_miles = weighted_risk = 0.0
    no_travel = False
    for index, point in enumerate(points):
        start = point["distance_miles"]
        end = points[index + 1]["distance_miles"] if index + 1 < len(points) else total_miles
        miles = max(0.0, end - start)
        risk = Risk(point["risk"]["level"])
        weighted_risk += risk.value * miles
        if risk >= Risk.SEVERE:
            severe_miles += miles
        if risk == Risk.HIGH:
            high_miles += miles
        no_travel = no_travel or risk == Risk.NO_TRAVEL
    return {
        "distance_miles": round(total_miles, 1),
        "duration_minutes": round(duration_seconds / 60),
        "severe_miles": round(severe_miles, 1),
        "high_miles": round(high_miles, 1),
        "average_risk": round(weighted_risk / total_miles if total_miles else 0, 2),
        "no_travel": no_travel,
    }

