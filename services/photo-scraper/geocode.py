#!/usr/bin/env python3
"""Zamienia listę POI (nazwa + kategoria) na miejsca.json ze współrzędnymi.

Geokodowanie: Nominatim (OpenStreetMap), ograniczone do okolic Krakowa.
Wynik ma format, który rozumie `scraper.py --source file --input miejsca.json`.

Przykłady:
    python geocode.py --input krakow_pois.json --out miejsca.json
    python geocode.py --input krakow_pois.json --dry-run    # tylko pokaż zapytania

Poprawki ręczne w pliku wejściowym (dla pozycji z output/geocode-missing.json):
    {"name": "Adam Mickiewicz", "category": "historic", "query": "Pomnik Adama Mickiewicza, Kraków"}
    {"name": "Pies Dżok", "category": "historic", "latitude": 50.0536, "longitude": 19.9358}
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

import httpx

from scraper import normalize

NOMINATIM = "https://nominatim.openstreetmap.org/search"
DEFAULT_UA = "HackYeah2026-Geocoder/0.1 (https://github.com/lolakk05/hackyeah-2026)"
# lewy,górny,prawy,dolny (lon,lat): okolice Krakowa
VIEWBOX = "19.78,50.14,20.23,49.95"
LON_MIN, LAT_MIN, LON_MAX, LAT_MAX = 19.78, 49.95, 20.23, 50.14

# Nazwy, które same wskazują na obiekt, więc nie dopisujemy im "Pomnik".
OBJECT_PREFIX = re.compile(
    r"^(Pomnik|Brama|Pałac|Palac|Collegium|Zamek|Wieża|Arsenał|Kamienica|Dom|Kościół|Cerkiew|Synagoga|"
    r"Bazylika|Kaplica|Muzeum|Galeria|Teatr|Narodowy|Skarbiec|Ulica|Rynek|Bunkier|Celestat|Wawel|Żydowskie|"
    r"Żywe|Domek|Dawny|Smocza|Smok|Pies|Eros)\b"
)


class GeocodeError(RuntimeError):
    pass


def in_bbox(lat: float, lon: float) -> bool:
    return LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX


def slugify(name: str, taken: set[str]) -> str:
    base = normalize(name).replace(" ", "-")[:60].strip("-") or "miejsce"
    slug, n = base, 2
    while slug in taken:
        slug, n = f"{base}-{n}", n + 1
    taken.add(slug)
    return slug


def _genitive_first(word: str) -> str:
    return word[:-1] + "ego" if word.endswith("y") else word + "a"  # Ignacy -> Ignacego, Jan -> Jana


def _genitive_last(word: str) -> str:
    if re.search(r"(ski|cki|zki)$", word):
        return word + "ego"  # Wyspiański, Paderewski, Skrzynecki
    if word.endswith(("ko", "go")):
        return word[:-1] + "i"  # Matejko -> Matejki
    if word.endswith(("ka", "ga")):
        return word[:-1] + "i"  # Skarga -> Skargi
    if word.endswith("a"):
        return word[:-1] + "y"
    return word + "a"  # Mickiewicz -> Mickiewicza, Kopernik -> Kopernika


def person_genitive(name: str) -> str | None:
    """'Adam Mickiewicz' -> 'Adama Mickiewicza'. Heurystyka dla polskich nazwisk męskich."""
    words = name.split()
    if len(words) < 2 or any(not w[:1].isupper() for w in words) or words[0].endswith("a"):
        return None
    return " ".join([*(_genitive_first(w) for w in words[:-1]), _genitive_last(words[-1])])


def query_variants(entry: dict[str, Any], city: str = "Kraków") -> list[str]:
    """Kolejne wersje zapytania, od najbardziej dosłownej. Ręczne `query` ma pierwszeństwo."""
    if entry.get("query"):
        return [entry["query"]]
    name = entry["name"].strip()
    no_pw = re.sub(r"\bpw\.\s*", "", name).strip()
    short = re.sub(r"\b(Świętego|Świętej|Świętych)\b", "św.", no_pw)
    variants = [name, no_pw, short]
    if entry.get("category") == "historic" and not OBJECT_PREFIX.match(name):
        # nazwy osób to pomniki, a w OSM mają dopełniacz: "Pomnik Adama Mickiewicza"
        genitive = person_genitive(name)
        if genitive:
            variants = [f"Pomnik {genitive}", *variants]
        else:
            variants.append(f"Pomnik {name}")
    seen: list[str] = []
    for v in variants:
        if v not in seen:
            seen.append(v)
    return [f"{v}, {city}" if city else v for v in seen]


def search(client: httpx.Client, query: str, delay: float, cache: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    if query in cache:
        return cache[query]
    params = {
        "q": query,
        "format": "jsonv2",
        "limit": "5",
        "countrycodes": "pl",
        "viewbox": VIEWBOX,
        "bounded": "1",
    }
    last = "nieznany błąd"
    for attempt in range(4):
        try:
            resp = client.get(NOMINATIM, params=params)
        except httpx.HTTPError as exc:
            last = str(exc)
            time.sleep(3.0 * (attempt + 1))
            continue
        if resp.status_code in (429, 500, 502, 503, 504):
            last = f"HTTP {resp.status_code}"
            time.sleep(5.0 * (attempt + 1))
            continue
        resp.raise_for_status()
        results = [
            {
                "lat": float(r["lat"]),
                "lon": float(r["lon"]),
                "display_name": r.get("display_name", ""),
                "osm": f"{r.get('osm_type', '')}/{r.get('osm_id', '')}",
            }
            for r in resp.json()
            if "lat" in r and "lon" in r and in_bbox(float(r["lat"]), float(r["lon"]))
        ]
        cache[query] = results
        time.sleep(delay)  # polityka Nominatim: maks. 1 zapytanie na sekundę
        return results
    raise GeocodeError(f"Nominatim nie odpowiada ({last})")


def distinct(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Wyniki różniące się o więcej niż ok. 100 m."""
    out: list[dict[str, Any]] = []
    seen: set[tuple[float, float]] = set()
    for r in results:
        key = (round(r["lat"], 3), round(r["lon"], 3))
        if key not in seen:
            seen.add(key)
            out.append(r)
    return out


def geocode_entries(
    entries: list[dict[str, Any]], client: httpx.Client | None, delay: float, cache: dict[str, list[dict[str, Any]]]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    found: list[dict[str, Any]] = []
    missing: list[dict[str, Any]] = []
    taken: set[str] = set()
    occurrences: dict[str, int] = {}

    for entry in entries:
        name = entry["name"].strip()
        record: dict[str, Any] = {
            "id": entry.get("id") or slugify(name, taken),
            "name": name,
            "category": entry.get("category", ""),
            "aliases": entry.get("aliases") or [],
        }
        if entry.get("id"):
            taken.add(record["id"])

        if "latitude" in entry and "longitude" in entry:  # ręczna współrzędna z pliku wejściowego
            record.update(latitude=float(entry["latitude"]), longitude=float(entry["longitude"]), geocoded={"manual": True})
            found.append(record)
            continue

        k = occurrences.get(normalize(name), 0)  # n-te wystąpienie tej samej nazwy -> n-ty różny wynik
        occurrences[normalize(name)] = k + 1

        chosen: dict[str, Any] | None = None
        used_query = ""
        note = ""
        for query in query_variants(entry):
            candidates = distinct(search(client, query, delay, cache))
            if candidates:
                used_query = query
                if k < len(candidates):
                    chosen = candidates[k]
                else:
                    chosen = candidates[-1]
                    note = "powtórzona nazwa, brak osobnego wyniku (sprawdź ręcznie)"
                break

        if chosen is None:
            missing.append({"name": name, "category": entry.get("category", ""), "tried": query_variants(entry)})
            continue
        record.update(
            latitude=round(chosen["lat"], 6),
            longitude=round(chosen["lon"], 6),
            geocoded={"query": used_query, "displayName": chosen["display_name"], "osm": chosen["osm"], **({"note": note} if note else {})},
        )
        found.append(record)
    return found, missing


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Geokodowanie listy POI do miejsca.json (Nominatim)")
    p.add_argument("--input", required=True, help="JSON: [{name, category, (query|latitude+longitude)}]")
    p.add_argument("--out", default="miejsca.json")
    p.add_argument("--missing", default="output/geocode-missing.json")
    p.add_argument("--cache", default="output/geocode-cache.json")
    p.add_argument("--delay", type=float, default=1.1, help="przerwa między zapytaniami (s), min. ~1")
    p.add_argument("--dry-run", action="store_true", help="tylko pokaż zapytania, bez sieci")
    return p.parse_args(argv)


def run(args: argparse.Namespace, client: httpx.Client | None = None) -> int:
    entries = json.loads(Path(args.input).read_text(encoding="utf-8"))
    if args.dry_run:
        for e in entries:
            print(f"{e['name']!r:70} -> {query_variants(e)}")
        print(f"\n{len(entries)} pozycji, bez zapytań do sieci (--dry-run).")
        return 0

    cache_path = Path(args.cache)
    cache: dict[str, list[dict[str, Any]]] = {}
    if cache_path.exists():
        cache = json.loads(cache_path.read_text(encoding="utf-8"))

    owns = client is None
    if client is None:
        client = httpx.Client(
            headers={"User-Agent": os.environ.get("GEOCODER_USER_AGENT", DEFAULT_UA)}, timeout=20.0, follow_redirects=True
        )
    try:
        try:
            found, missing = geocode_entries(entries, client, args.delay, cache)
        finally:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")  # wznowienie po przerwaniu
    finally:
        if owns:
            client.close()

    Path(args.out).write_text(json.dumps(found, ensure_ascii=False, indent=2), encoding="utf-8")
    miss_path = Path(args.missing)
    miss_path.parent.mkdir(parents=True, exist_ok=True)
    miss_path.write_text(json.dumps(missing, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Znaleziono: {len(found)}, bez wyniku: {len(missing)} z {len(entries)}")
    print(f"Zapisano {args.out}" + (f" i {miss_path} (do ręcznej poprawki)" if missing else ""))
    for m in missing:
        print(f"  ? {m['name']}")
    return 0


def main() -> None:
    try:
        sys.exit(run(parse_args()))
    except (httpx.HTTPError, GeocodeError, OSError, KeyError, ValueError) as exc:
        print(f"Błąd: {exc}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
