import json
import os
import re
import time
from functools import lru_cache
from unicodedata import normalize
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import HTTPException, status


NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


def geocode_address(address: str, neighborhood: str | None = None) -> tuple[float, float]:
    for index, query in enumerate(candidate_queries(address, neighborhood)):
        if index:
            time.sleep(1)
        try:
            result = _fetch_coordinates(query)
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nao foi possivel localizar este endereco. Confira o texto informado.",
            ) from exc
        if result is not None:
            return result
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Endereco nao encontrado. Informe rua, numero, bairro e cidade.",
    )


def candidate_queries(address: str, neighborhood: str | None = None) -> list[str]:
    queries = [build_query(address, neighborhood)]
    if neighborhood:
        queries.append(build_query(address, None))
        queries.append(build_query(neighborhood, None))
    return list(dict.fromkeys(queries))


def build_query(address: str, neighborhood: str | None = None) -> str:
    parts = [address.strip()]
    normalized = normalize_text(address)
    if neighborhood and normalize_text(neighborhood) not in normalized:
        parts.append(neighborhood.strip())
    if "palhoca" not in normalized:
        parts.append("Palhoca")
    if not has_state_reference(normalized):
        parts.append("SC")
    if "brasil" not in normalized and "brazil" not in normalized:
        parts.append("Brasil")
    return ", ".join(part for part in parts if part)


def normalize_text(value: str) -> str:
    return normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()


def has_state_reference(value: str) -> bool:
    return "santa catarina" in value or re.search(r"(^|[^a-z])sc([^a-z]|$)", value) is not None


@lru_cache(maxsize=256)
def _fetch_coordinates(query: str) -> tuple[float, float] | None:
    params = urlencode(
        {
            "format": "jsonv2",
            "limit": "1",
            "countrycodes": "br",
            "q": query,
        }
    )
    user_agent = os.getenv("GEOCODER_USER_AGENT", "HydroSysAcademicDemo/1.0")
    request = Request(
        f"{NOMINATIM_URL}?{params}",
        headers={
            "User-Agent": user_agent,
            "Accept": "application/json",
            "Accept-Language": "pt-BR,pt;q=0.9",
        },
    )
    with urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not payload:
        return None
    return float(payload[0]["lat"]), float(payload[0]["lon"])
