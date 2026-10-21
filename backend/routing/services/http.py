from __future__ import annotations

import requests


SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "HaulSafe assessment app (github.com/Kartikbokadia23/weather-aware-truck-routing)"})


class ProviderError(RuntimeError):
    pass


def get_json(url: str, *, params: dict, timeout: int = 20) -> dict | list:
    try:
        response = SESSION.get(url, params=params, timeout=timeout)
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError) as exc:
        raise ProviderError(f"Upstream provider request failed: {exc}") from exc

