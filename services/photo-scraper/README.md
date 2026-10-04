# photo-scraper

Uzupełnia pole `photos` miejsc zdjęciami z **Wikimedia Commons** (oficjalne API, bez klucza,
jawne licencje). Wyniki z atrybucją trafiają do `output/photos.json`, a z flagą `--push`
także do API.

## Uruchomienie

```bash
cd services/photo-scraper
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# NestJS API musi działać (domyślnie http://localhost:3000)
python scraper.py                 # podgląd: tylko output/photos.json
python scraper.py --push          # + zapis zdjęć w API
```

Przydatne opcje: `--only wawel`, `--force` (nadpisz miejsca, które mają już zdjęcia),
`--per-place 8`, `--radius 500`, `--api http://host:3000` (albo zmienna `API_URL`),
`--source file --input miejsca.json` (bez API; plik: `[{"name","latitude","longitude","aliases":[]}]`).

## Jak wybiera zdjęcia

1. Szuka plików po `"<nazwa> Kraków"` (i po aliasach) oraz po współrzędnych (geosearch, domyślnie 300 m).
2. Odrzuca: licencje NC/ND i inne niż CC BY / CC BY-SA / CC0 / domena publiczna, pliki poniżej 800×500,
   panoramy i pionowe paski, SVG/TIFF oraz tytuły zawierające m.in. *map, plan, logo, flag, herb*.
3. Zostawia tylko zdjęcia, których tytuł/opis/kategorie pasują do nazwy miejsca **albo** leżą
   ≤ 40 m od współrzędnych. Lepiej brak zdjęcia niż zdjęcie sąsiedniego budynku.
4. Sortuje po wyniku (dopasowanie nazwy, bliskość, trafność wyszukiwania, rozdzielczość) i bierze top N.

URL-e wskazują miniatury 1280 px z `upload.wikimedia.org`.

## Uwagi

- **Atrybucja.** Licencje CC BY wymagają podania autora. Dane są w `output/photos.json`
  (`attribution`, `author`, `license`, `page`). Warto pokazać je w apce, np. pod karuzelą.
- **Zabytki z seeda są w pamięci API** (`app.service.ts`), więc po restarcie API wracają
  z pustym `photos`. Po restarcie uruchom `--push --force` ponownie albo wklej URL-e z
  `output/photos.json` do seeda. Miejsca z tabeli Prisma (`/places`) zapisują się trwale.
- `--source auto` bierze `/places`; gdy tabela jest pusta, przechodzi na `/landmarks`.
- Zdjęcia nie są pobierane do MinIO, tylko linkowane. Commons toleruje hotlinking miniatur,
  ale jeśli zależy Wam na niezależności od niego, to kolejny krok.

## Testy

```bash
python -m pytest -q
```

Testy działają na odpowiedziach w formacie MediaWiki podstawionych przez mock HTTP (bez sieci).
