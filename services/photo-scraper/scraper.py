#!/usr/bin/env python3
"""Scrapper zdjęć dla miejsc z HackYeah 2026 (Wikimedia Commons).

Dla każdego miejsca szuka na Commons zdjęć po nazwie i po współrzędnych,
odrzuca pliki o nieodpowiedniej licencji / rozdzielczości / tytule, wybiera
najlepsze i (opcjonalnie) wpisuje ich URL-e do API w polu `photos`.
Atrybucję (autor, licencja, strona pliku) zapisuje do pliku JSON.

Przykłady:
    python scraper.py                      # podgląd: tylko zapis output/photos.json
    python scraper.py --push               # + PATCH do API
    python scraper.py --only wawel --force # jedno miejsce, nawet jeśli ma zdjęcia
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
DEFAULT_UA = "HackYeah2026-PhotoScraper/0.1 (https://github.com/lolakk05/hackyeah-2026)"

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MIN_WIDTH = 800
MIN_HEIGHT = 500
MIN_RATIO, MAX_RATIO = 0.75, 2.2  # szerokość / wysokość

# Słowa w tytule pliku, które zwykle oznaczają coś innego niż zdjęcie miejsca.
BAD_TITLE_WORDS = {
    "map", "mapa", "plan", "logo", "flag", "flaga", "herb", "coat", "arms",
    "diagram", "schemat", "scheme", "poster", "plakat", "stamp", "znaczek",
    "banknote", "coin", "moneta", "drawing", "rysunek", "engraving", "icon",
    "ikona", "screenshot", "cover", "okladka", "sticker", "locator", "portrait",
    "portret", "qr", "svg",
}
NAME_STOPWORDS = {"krakow", "cracow", "krakowie", "krakowa", "ulica", "plac", "miasto", "the", "and"}

EXTMETADATA_KEYS = "LicenseShortName|LicenseUrl|Artist|ImageDescription|Categories"

_TRANSLATE = str.maketrans({"ł": "l", "Ł": "L", "đ": "d", "Đ": "D", "ø": "o", "Ø": "O"})


class ScraperError(RuntimeError):
    pass


@dataclass
class Place:
    id: str
    name: str
    latitude: float
    longitude: float
    photos: list[str] = field(default_factory=list)
    aliases: list[str] = field(default_factory=list)
    kind: str = "file"  # places | landmarks | file


@dataclass
class Candidate:
    title: str
    url: str
    page: str
    width: int
    height: int
    mime: str
    author: str
    license: str
    license_url: str
    text: str  # znormalizowany tytuł + opis + kategorie, do dopasowania nazwy
    dist: float | None = None
    rank: int | None = None
    match: float = 0.0
    score: float = 0.0


# ───────────────────────── tekst ─────────────────────────


def strip_html(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", value or ""))).strip()


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", (text or "").translate(_TRANSLATE))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def name_tokens(name: str) -> list[str]:
    tokens: list[str] = []
    for word in normalize(name).split():
        if len(word) >= 4 and word not in NAME_STOPWORDS and word not in tokens:
            tokens.append(word)
    return tokens


def match_ratio(variants: list[list[str]], haystack: str) -> float:
    """Jaka część słów z nazwy (najlepszego wariantu) występuje w tekście.

    Porównujemy po przedrostku 5 znaków, żeby 'Wawelu' pasowało do 'Wawel'.
    """
    words = haystack.split()
    best = 0.0
    for tokens in variants:
        if not tokens:
            continue
        hits = sum(1 for t in tokens if any(w.startswith(t[:5]) for w in words))
        best = max(best, hits / len(tokens))
    return best


def license_ok(short_name: str) -> bool:
    s = re.sub(r"[\s\-_]+", " ", (short_name or "").strip().lower())
    if not s or re.search(r"\b(nc|nd)\b", s):
        return False
    return bool(re.match(r"(pd\b|public domain|cc0|cc by)", s))


# ───────────────────────── Commons API ─────────────────────────


def api_get(client: httpx.Client, params: dict[str, Any], delay: float, retries: int = 4) -> dict[str, Any]:
    query = {"action": "query", "format": "json", "formatversion": "2", **params}
    last_error = "nieznany błąd"
    for attempt in range(retries):
        try:
            resp = client.get(COMMONS_API, params=query)
            if resp.status_code in (429, 500, 502, 503, 504):
                last_error = f"HTTP {resp.status_code}"
                wait = float(resp.headers.get("Retry-After", 0) or 0) or 2.0 * (attempt + 1)
                time.sleep(wait)
                continue
            resp.raise_for_status()
            data = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            last_error = str(exc)
            time.sleep(2.0 * (attempt + 1))
            continue
        if "error" in data:
            code = data["error"].get("code", "")
            last_error = f"{code}: {data['error'].get('info', '')}"
            if code in ("ratelimited", "maxlag"):
                time.sleep(3.0 * (attempt + 1))
                continue
            raise ScraperError(f"Commons API: {last_error}")
        time.sleep(delay)
        return data
    raise ScraperError(f"Commons API nie odpowiada ({last_error})")


def _pages(data: dict[str, Any]) -> list[dict[str, Any]]:
    pages = data.get("query", {}).get("pages", [])
    return list(pages.values()) if isinstance(pages, dict) else list(pages)


IMAGEINFO = {
    "prop": "imageinfo",
    "iiprop": "url|size|mime|extmetadata",
    "iiurlwidth": "1280",
    "iiextmetadatafilter": EXTMETADATA_KEYS,
    "iiextmetadatalanguage": "en",
}


def search_files(client: httpx.Client, query: str, limit: int, delay: float) -> list[dict[str, Any]]:
    data = api_get(
        client,
        {"generator": "search", "gsrsearch": query, "gsrnamespace": "6", "gsrlimit": str(limit), **IMAGEINFO},
        delay,
    )
    # generator=search zwraca strony z polem `index` (kolejność trafności)
    return sorted(_pages(data), key=lambda p: p.get("index", 0))


def geosearch(client: httpx.Client, lat: float, lon: float, radius: int, delay: float) -> list[dict[str, Any]]:
    data = api_get(
        client,
        {
            "list": "geosearch",
            "gscoord": f"{lat}|{lon}",
            "gsradius": str(radius),
            "gsnamespace": "6",
            "gslimit": "50",
        },
        delay,
    )
    return data.get("query", {}).get("geosearch", [])


def fetch_titles(client: httpx.Client, titles: list[str], delay: float) -> list[dict[str, Any]]:
    pages: list[dict[str, Any]] = []
    for i in range(0, len(titles), 50):
        data = api_get(client, {"titles": "|".join(titles[i : i + 50]), **IMAGEINFO}, delay)
        pages.extend(_pages(data))
    return pages


def parse_page(page: dict[str, Any]) -> Candidate | None:
    infos = page.get("imageinfo") or []
    if not infos:
        return None
    info = infos[0]
    meta = info.get("extmetadata") or {}

    def field_value(key: str) -> str:
        raw = meta.get(key)
        if isinstance(raw, dict):
            raw = raw.get("value", "")
        return strip_html(str(raw or ""))

    url = info.get("thumburl") or info.get("url") or ""
    title = page.get("title", "")
    if not url.startswith("https://") or not title:
        return None
    text = normalize(" ".join([title, field_value("ImageDescription"), field_value("Categories")]))
    return Candidate(
        title=title,
        url=url,
        page=info.get("descriptionurl", ""),
        width=int(info.get("width") or 0),
        height=int(info.get("height") or 0),
        mime=info.get("mime", ""),
        author=field_value("Artist"),
        license=field_value("LicenseShortName"),
        license_url=field_value("LicenseUrl"),
        text=text,
    )


# ───────────────────────── wybór zdjęć ─────────────────────────


def acceptable(c: Candidate, min_width: int = MIN_WIDTH, min_height: int = MIN_HEIGHT) -> bool:
    if c.mime not in ALLOWED_MIME or c.width < min_width or c.height < min_height:
        return False
    if not (MIN_RATIO <= c.width / c.height <= MAX_RATIO):
        return False
    if not license_ok(c.license):
        return False
    return not (set(normalize(c.title).split()) & BAD_TITLE_WORDS)


def select_photos(
    candidates: list[Candidate],
    place: Place,
    per_place: int,
    radius: int,
    geo_trust_m: float,
) -> list[Candidate]:
    variants = [name_tokens(n) for n in [place.name, *place.aliases]]
    chosen: list[Candidate] = []
    for c in candidates:
        if not acceptable(c):
            continue
        c.match = match_ratio(variants, c.text)
        near = c.dist is not None and c.dist <= geo_trust_m
        if c.match < 0.5 and not near:
            continue  # lepiej brak zdjęcia niż zdjęcie innego budynku
        c.score = (
            4.0 * c.match
            + (3.0 * max(0.0, 1 - c.dist / radius) if c.dist is not None else 0.0)
            + (max(0.0, 2.0 - 0.1 * c.rank) if c.rank is not None else 0.0)
            + min(c.width, 3000) / 3000
        )
        chosen.append(c)
    chosen.sort(key=lambda c: (-c.score, c.title))
    return chosen[:per_place]


def collect_candidates(
    client: httpx.Client, place: Place, city: str, radius: int, delay: float, search_limit: int = 30
) -> list[Candidate]:
    pool: dict[str, Candidate] = {}

    for name in [place.name, *place.aliases]:
        query = f"{name} {city}".strip()
        for rank, page in enumerate(search_files(client, query, search_limit, delay)):
            c = parse_page(page)
            if c is None:
                continue
            existing = pool.get(c.title)
            if existing is None:
                c.rank = rank
                pool[c.title] = c
            elif existing.rank is None or rank < existing.rank:
                existing.rank = rank

    hits = geosearch(client, place.latitude, place.longitude, radius, delay)
    dist_by_title = {h["title"]: float(h.get("dist", radius)) for h in hits if "title" in h}
    missing = [t for t in dist_by_title if t not in pool]
    for page in fetch_titles(client, missing, delay) if missing else []:
        c = parse_page(page)
        if c is not None:
            pool[c.title] = c
    for title, dist in dist_by_title.items():
        if title in pool:
            pool[title].dist = dist

    return list(pool.values())


def to_record(c: Candidate) -> dict[str, Any]:
    author = c.author or "nieznany autor"
    return {
        "url": c.url,
        "page": c.page,
        "title": c.title,
        "author": c.author,
        "license": c.license,
        "licenseUrl": c.license_url,
        "width": c.width,
        "height": c.height,
        "attribution": f"{author}, {c.license}, via Wikimedia Commons",
    }


# ───────────────────────── API aplikacji ─────────────────────────


def load_places(client: httpx.Client, api: str, source: str, input_file: str | None) -> list[Place]:
    if source == "file":
        if not input_file:
            raise ScraperError("--source file wymaga --input plik.json")
        raw = json.loads(Path(input_file).read_text(encoding="utf-8"))
        return [
            Place(
                id=str(p.get("id") or normalize(p["name"]).replace(" ", "-")),
                name=p["name"],
                latitude=float(p["latitude"]),
                longitude=float(p["longitude"]),
                photos=p.get("photos") or [],
                aliases=p.get("aliases") or [],
                kind="file",
            )
            for p in raw
        ]

    if source in ("auto", "places"):
        rows = client.get(f"{api}/places")
        rows.raise_for_status()
        places = [
            Place(
                id=p["placeId"],
                name=p["name"],
                latitude=p["latitude"],
                longitude=p["longitude"],
                photos=p.get("photos") or [],
                kind="places",
            )
            for p in rows.json()
        ]
        if places or source == "places":
            return places

    rows = client.get(f"{api}/landmarks")
    rows.raise_for_status()
    return [
        Place(
            id=l["id"],
            name=l["name"],
            latitude=l["coordinates"]["latitude"],
            longitude=l["coordinates"]["longitude"],
            photos=l.get("photos") or [],
            kind="landmarks",
        )
        for l in rows.json()
    ]


def push_photos(client: httpx.Client, api: str, place: Place, urls: list[str]) -> None:
    if place.kind == "places":
        path = f"/places/{quote(place.id, safe='')}"
    elif place.kind == "landmarks":
        path = f"/admin/landmarks/{quote(place.id, safe='')}"
    else:
        raise ScraperError("Miejsca z pliku nie mają odpowiednika w API, użyj --source places/landmarks.")
    resp = client.patch(f"{api}{path}", json={"photos": urls})
    resp.raise_for_status()


# ───────────────────────── uruchomienie ─────────────────────────


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Scrapper zdjęć miejsc z Wikimedia Commons")
    p.add_argument("--api", default=os.environ.get("API_URL", "http://localhost:3000"), help="adres NestJS API")
    p.add_argument("--source", choices=["auto", "places", "landmarks", "file"], default="auto")
    p.add_argument("--input", help="plik JSON z miejscami (dla --source file)")
    p.add_argument("--city", default="Kraków", help="dopisywane do zapytań tekstowych ('' = wyłącz)")
    p.add_argument("--per-place", type=int, default=5, help="ile zdjęć na miejsce")
    p.add_argument("--radius", type=int, default=300, help="promień geosearch w metrach (10-10000)")
    p.add_argument("--geo-trust", type=float, default=40, help="zdjęcia bliżej niż tyle metrów przechodzą bez dopasowania nazwy")
    p.add_argument("--only", help="tylko miejsca, których nazwa zawiera ten tekst")
    p.add_argument("--force", action="store_true", help="także miejsca, które już mają zdjęcia")
    p.add_argument("--push", action="store_true", help="wpisz wyniki do API (bez tego tylko plik JSON)")
    p.add_argument("--out", default="output/photos.json")
    p.add_argument("--delay", type=float, default=0.3, help="przerwa między zapytaniami do Commons (s)")
    return p.parse_args(argv)


def run(args: argparse.Namespace, client: httpx.Client | None = None) -> int:
    api = args.api.rstrip("/")
    owns_client = client is None
    if client is None:
        client = httpx.Client(
            headers={"User-Agent": os.environ.get("SCRAPER_USER_AGENT", DEFAULT_UA)},
            timeout=20.0,
            follow_redirects=True,
        )
    try:
        places = load_places(client, api, args.source, args.input)
        if args.only:
            places = [p for p in places if args.only.lower() in p.name.lower()]
        if not places:
            print("Brak miejsc do przetworzenia.")
            return 0
        print(f"Miejsc: {len(places)} ({places[0].kind}). Tryb: {'PUSH do API' if args.push else 'podgląd (bez --push)'}")

        results: list[dict[str, Any]] = []
        for place in places:
            if place.photos and not args.force:
                print(f"- {place.name}: pomijam (ma już {len(place.photos)} zdjęć, użyj --force)")
                continue
            try:
                candidates = collect_candidates(client, place, args.city, args.radius, args.delay)
                chosen = select_photos(candidates, place, args.per_place, args.radius, args.geo_trust)
            except ScraperError as exc:
                print(f"- {place.name}: BŁĄD {exc}")
                continue
            print(f"- {place.name}: {len(chosen)} zdjęć (z {len(candidates)} kandydatów)")
            results.append({"id": place.id, "name": place.name, "kind": place.kind, "photos": [to_record(c) for c in chosen]})
            if args.push and chosen:
                try:
                    push_photos(client, api, place, [c.url for c in chosen])
                except (httpx.HTTPError, ScraperError) as exc:
                    print(f"  ! nie udało się zapisać w API: {exc}")

        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "source": "wikimedia-commons",
            "places": results,
        }
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Zapisano {out}")
        return 0
    finally:
        if owns_client:
            client.close()


def main() -> None:
    try:
        sys.exit(run(parse_args()))
    except (httpx.HTTPError, ScraperError, OSError, KeyError) as exc:
        print(f"Błąd: {exc}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
