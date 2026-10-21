from .http import ProviderError, get_json


NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


def search_places(query: str, limit: int = 5) -> list[dict]:
    payload = get_json(
        NOMINATIM_URL,
        params={"q": query, "format": "jsonv2", "limit": limit, "addressdetails": 1, "countrycodes": "us,ca"},
    )
    if not isinstance(payload, list):
        raise ProviderError("Geocoder returned an unexpected response")
    return [
        {
            "id": item["place_id"],
            "label": item["display_name"],
            "latitude": float(item["lat"]),
            "longitude": float(item["lon"]),
        }
        for item in payload
    ]

