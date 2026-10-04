"""Testy logiki scrappera. Odpowiedzi Commons są w formacie MediaWiki (formatversion=2),
podstawione przez httpx.MockTransport, więc testy nie wymagają sieci."""

import json
from pathlib import Path

import httpx
import pytest

import scraper
from scraper import Candidate, Place


def make_page(title, width=2000, height=1300, license="CC BY-SA 4.0", author="<a href='x'>Jan Kowalski</a>",
              desc="", cats="", mime="image/jpeg", index=None):
    page = {
        "pageid": abs(hash(title)) % 10_000,
        "ns": 6,
        "title": title,
        "imageinfo": [
            {
                "thumburl": f"https://upload.wikimedia.org/thumb/{title.split(':', 1)[1].replace(' ', '_')}/1280px-x.jpg",
                "url": f"https://upload.wikimedia.org/{title.split(':', 1)[1].replace(' ', '_')}",
                "descriptionurl": f"https://commons.wikimedia.org/wiki/{title.replace(' ', '_')}",
                "width": width,
                "height": height,
                "mime": mime,
                "extmetadata": {
                    "LicenseShortName": {"value": license},
                    "LicenseUrl": {"value": "https://creativecommons.org/licenses/by-sa/4.0"},
                    "Artist": {"value": author},
                    "ImageDescription": {"value": desc},
                    "Categories": {"value": cats},
                },
            }
        ],
    }
    if index is not None:
        page["index"] = index
    return page


def cand(title="File:Wawel.jpg", **kw):
    c = scraper.parse_page(make_page(title, **kw))
    assert c is not None
    return c


# ── tekst ──


def test_normalize_polish_letters():
    assert scraper.normalize("Zamek Królewski na Wawelu") == "zamek krolewski na wawelu"
    assert scraper.normalize("Łódź") == "lodz"


def test_strip_html():
    assert scraper.strip_html("<a href='x'>Jan &amp; Anna</a>  Nowak") == "Jan & Anna Nowak"


@pytest.mark.parametrize(
    "lic,ok",
    [
        ("CC BY-SA 4.0", True), ("CC BY 2.0", True), ("CC0", True), ("Public domain", True),
        ("PD-old", True), ("CC BY-NC 4.0", False), ("CC BY-ND 2.0", False),
        ("GFDL", False), ("", False), ("All rights reserved", False),
    ],
)
def test_license_ok(lic, ok):
    assert scraper.license_ok(lic) is ok


def test_match_ratio_prefix_and_variants():
    haystack = scraper.normalize("File:Wawel Castle.jpg Royal castle")
    assert scraper.match_ratio([scraper.name_tokens("Zamek Królewski na Wawelu")], haystack) == pytest.approx(1 / 3)
    # alias po angielsku wygrywa jako najlepszy wariant
    variants = [scraper.name_tokens("Zamek Królewski na Wawelu"), scraper.name_tokens("Wawel Castle")]
    assert scraper.match_ratio(variants, haystack) == 1.0


# ── parsowanie i filtry ──


def test_parse_page_extracts_metadata():
    c = cand("File:Sukiennice.jpg", desc="<b>Cloth Hall</b> in Kraków")
    assert c.author == "Jan Kowalski"
    assert c.license == "CC BY-SA 4.0"
    assert c.url.startswith("https://") and c.width == 2000
    assert "cloth hall" in c.text


def test_parse_page_without_imageinfo():
    assert scraper.parse_page({"title": "File:X.jpg"}) is None


@pytest.mark.parametrize(
    "kw",
    [
        dict(width=500, height=400),  # za mały
        dict(width=4000, height=900),  # panorama
        dict(license="CC BY-NC 4.0"),
        dict(mime="image/svg+xml"),
        dict(mime="image/tiff"),
    ],
)
def test_acceptable_rejects(kw):
    assert not scraper.acceptable(cand("File:Wawel.jpg", **kw))


def test_acceptable_rejects_bad_title_words():
    assert not scraper.acceptable(cand("File:Wawel map.jpg"))
    assert not scraper.acceptable(cand("File:Wawel logo.png"))
    assert scraper.acceptable(cand("File:Wawel Castle.jpg"))


def test_select_requires_name_match_or_proximity():
    place = Place(id="p", name="Sukiennice", latitude=0, longitude=0)
    good = cand("File:Sukiennice w Krakowie.jpg")
    unrelated = cand("File:Random street.jpg")
    unrelated.dist = 120.0  # blisko, ale nie dość blisko, żeby zaufać
    trusted = cand("File:Anonymous building.jpg")
    trusted.dist = 20.0
    out = scraper.select_photos([unrelated, trusted, good], place, per_place=5, radius=300, geo_trust_m=40)
    titles = [c.title for c in out]
    assert "File:Random street.jpg" not in titles
    assert set(titles) == {"File:Sukiennice w Krakowie.jpg", "File:Anonymous building.jpg"}
    assert titles[0] == "File:Sukiennice w Krakowie.jpg"  # dopasowanie nazwy ma wyższy wynik


def test_select_respects_limit_and_order():
    place = Place(id="p", name="Barbakan", latitude=0, longitude=0)
    cands = [cand(f"File:Barbakan {i}.jpg", width=1000 + i * 100) for i in range(8)]
    for i, c in enumerate(cands):
        c.rank = i
    out = scraper.select_photos(cands, place, per_place=3, radius=300, geo_trust_m=40)
    assert len(out) == 3
    assert [c.title for c in out] == ["File:Barbakan 0.jpg", "File:Barbakan 1.jpg", "File:Barbakan 2.jpg"]


# ── cały przebieg z mockiem HTTP ──


def build_client(patches):
    barbakan_pages = [
        make_page("File:Barbakan Kraków.jpg", index=1),
        make_page("File:Barbakan map.jpg", index=2),  # odpada: mapa
        make_page("File:Barbakan niska jakość.jpg", width=400, height=300, index=3),  # odpada: mały
        make_page("File:Barbakan NC.jpg", license="CC BY-NC 4.0", index=4),  # odpada: licencja
    ]
    geo_hits = [{"title": "File:Brama przy Barbakanie.jpg", "dist": 25.0}]

    def handler(request: httpx.Request) -> httpx.Response:
        url = request.url
        if url.host == "commons.wikimedia.org":
            q = dict(url.params)
            if q.get("generator") == "search":
                return httpx.Response(200, json={"query": {"pages": barbakan_pages}})
            if q.get("list") == "geosearch":
                return httpx.Response(200, json={"query": {"geosearch": geo_hits}})
            if "titles" in q:
                return httpx.Response(200, json={"query": {"pages": [make_page("File:Brama przy Barbakanie.jpg")]}})
        if url.path == "/places" and request.method == "GET":
            return httpx.Response(200, json=[])
        if url.path == "/landmarks":
            return httpx.Response(200, json=[
                {"id": "barbican", "name": "Barbakan", "photos": [], "coordinates": {"latitude": 50.0655, "longitude": 19.9418}},
                {"id": "has-photos", "name": "Wawel", "photos": ["https://x/y.jpg"], "coordinates": {"latitude": 50.05, "longitude": 19.93}},
            ])
        if request.method == "PATCH":
            patches.append((url.path, json.loads(request.content)))
            return httpx.Response(200, json={})
        return httpx.Response(404)

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_run_end_to_end_with_push(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(scraper.time, "sleep", lambda s: None)
    patches: list = []
    out = tmp_path / "photos.json"
    args = scraper.parse_args(["--api", "http://api.test", "--push", "--out", str(out), "--delay", "0"])
    assert scraper.run(args, client=build_client(patches)) == 0

    data = json.loads(out.read_text(encoding="utf-8"))
    assert [p["id"] for p in data["places"]] == ["barbican"]  # 'has-photos' pominięty bez --force
    titles = [ph["title"] for ph in data["places"][0]["photos"]]
    # trafienie z geosearch (25 m) i pasującą nazwą ma wyższy wynik niż samo wyszukiwanie tekstowe
    assert titles == ["File:Brama przy Barbakanie.jpg", "File:Barbakan Kraków.jpg"]
    assert data["places"][0]["photos"][0]["attribution"] == "Jan Kowalski, CC BY-SA 4.0, via Wikimedia Commons"

    assert len(patches) == 1
    path, body = patches[0]
    assert path == "/admin/landmarks/barbican"
    assert len(body["photos"]) == 2 and all(u.startswith("https://") for u in body["photos"])


def test_run_without_push_does_not_patch(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(scraper.time, "sleep", lambda s: None)
    patches: list = []
    args = scraper.parse_args(["--api", "http://api.test", "--out", str(tmp_path / "o.json"), "--delay", "0"])
    scraper.run(args, client=build_client(patches))
    assert patches == []


def test_api_get_retries_then_fails(monkeypatch):
    monkeypatch.setattr(scraper.time, "sleep", lambda s: None)
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(503)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(scraper.ScraperError):
        scraper.api_get(client, {"list": "geosearch"}, delay=0, retries=3)
    assert calls["n"] == 3


def test_api_get_raises_on_api_error_payload(monkeypatch):
    monkeypatch.setattr(scraper.time, "sleep", lambda s: None)
    client = httpx.Client(
        transport=httpx.MockTransport(lambda r: httpx.Response(200, json={"error": {"code": "badvalue", "info": "x"}}))
    )
    with pytest.raises(scraper.ScraperError, match="badvalue"):
        scraper.api_get(client, {}, delay=0)
