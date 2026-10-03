# Krakow Route Finder

Asynchroniczne API FastAPI do planowania spacerów **POI → opcjonalne POI → POI**
według budżetu czasu. Lokalny `krakow_pois.geojson` jest wczytywany raz przy starcie
do RAM i indeksowany przez SciPy KDTree. Dane POI nie są pobierane podczas żądań.
OSRM z profilem pieszym dostarcza czasy przejścia, dystanse i geometrię trasy.

Projekt obejmuje wyłącznie API. Zewnętrzna aplikacja wyświetla roadmapę z POI
i obsługuje odhaczanie miejsc, punkty oraz levele. Docelowe wejście (czas, tryb startu,
wózek, unikanie schodów), odpowiedź i aktualny stan realizacji opisuje
[docs/USER_STORY.md](docs/USER_STORY.md).

## Uruchomienie

Wymagania: Python 3.12+ oraz `uv`. Polecenia wykonuj w `services/route-finder`:

```powershell
uv sync --group dev
uv run python -m uvicorn main:app --reload
```

- Swagger UI: <http://127.0.0.1:8000/docs>
- ReDoc: <http://127.0.0.1:8000/redoc>
- Schemat OpenAPI: <http://127.0.0.1:8000/openapi.json>
- **Opis całego API, obliczeń i każdego pliku:** [docs/OPIS_API.md](docs/OPIS_API.md).
- **Pełny opis wszystkich endpointów:** [docs/API.md](docs/API.md).
- **Dla frontendowca — ekrany, formularze i requesty:** [docs/FRONTEND_INTEGRATION.md](docs/FRONTEND_INTEGRATION.md).
- Rzeczywista odpowiedź OSRM dla 30 minut: [docs/example-plan.json](docs/example-plan.json).
- Gotowe żądania do klienta HTTP w IDE: [test_main.http](test_main.http).

Przykład w PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/routes/plan' `
  -ContentType 'application/json' -Body '{"duration_minutes":30}'
```

Wystarczy podać czas. Domyślny start to najbliższy dostępny POI w okolicy Rynku
Głównego. Można też wskazać `start_poi_id` z `/pois` albo `start_location`.
Budżet obejmuje **sam marsz między punktami sieci OSRM**, bez zwiedzania i dojścia
do startu. API nie przedłuża czasu sztucznie: zwraca rzeczywisty szacunek OSRM,
niewykorzystany czas oraz `matches_target`. Maksymalnie dwa pośrednie POI są opcjonalne.

## Jak działa dobór trasy

1. Wybór startowego POI z RAM; dla lokalizacji limit odległości wynosi 2 km.
2. Wyszukiwanie kandydatów w promieniu `min(50000, czas_w_sekundach * 2)` metrów.
   Odrzucane są cele bliższe niż 20 m od startu oraz `access=private/no`, `foot=no`.
3. Próbkowanie do 24 celów z całego zakresu odległości, aby ograniczyć koszt publicznego API.
4. Jedno zapytanie `/table/v1/foot/` o macierz czasów pieszych.
5. Ocena kolejności z 0–2 przystankami, bez powtarzania ID. Preferowane są warianty
   mieszczące się w tolerancji, następnie więcej POI, następnie dłuższy marsz.
6. Potwierdzenie finalnego czasu i geometrii przez `/route/v1/foot/`; domyślnie do 3 prób.
   Czas zaakceptowanej trasy nie przekracza budżetu.

OSRM wyznacza trasę między zadanymi punktami; to nasz planer dobiera punkty do czasu.
Wyszukiwanie jest ograniczoną heurystyką, więc 404 nie dowodzi braku jakiejkolwiek
możliwej trasy w całym Krakowie. Czas jest szacunkiem profilu OSRM, nie gwarancją tempa użytkownika.

## Dane POI i ich kompletność

Plik zawiera wybrane atrakcje centrum, wszystkie w promieniu maksymalnie 1,5 km
od środka Rynku. Importer odrzuca m.in. parki, malowidła i tablice pamiątkowe.
Reguły selekcji, statystyki oraz pochodzenie danych: [docs/DATA.md](docs/DATA.md).
Punkty reprezentujące budynki nie są zweryfikowanymi wejściami; limit dotyczy
lokalizacji POI, a nie całego przebiegu trasy OSRM.

Odświeżenie pliku (ręcznie, następnie restart API):

```powershell
uv run python scripts/import_pois.py
# Alternatywny publiczny serwer, gdy główny jest przeciążony:
uv run python scripts/import_pois.py --endpoint https://overpass.kumi.systems/api/interpreter
```

Importer nie zastępuje pliku pustą lub częściową odpowiedzią i zapisuje wynik atomowo.
Dane: © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).

## Konfiguracja

Zmienne środowiskowe są czytane przy starcie. Plik `.env` nie jest ładowany automatycznie.

| Zmienna | Domyślna wartość | Znaczenie |
|---|---|---|
| `POI_FILE` | `krakow_pois.geojson` obok `config.py` | Plik lokalny; ścieżka względna jest liczona od katalogu procesu. |
| `OSRM_BASE_URL` | `https://routing.openstreetmap.de/routed-foot` | Backend z danymi dla ruchu pieszego. |
| `OSRM_TIMEOUT_S` | `8` | Timeout operacji sieciowej HTTPX, w sekundach. |
| `OSRM_COOLDOWN_S` | `60` | Przerwa po 429 bez poprawnego `Retry-After`. |
| `WALKING_SPEED_M_S` | `1.4` | Heurystyka awaryjnego doboru par; także estymacja starszego GET `/route`. |
| `CANDIDATE_LIMIT` | `24` | Liczba kandydatów, 2–40, plus start. |
| `ROUTE_ATTEMPTS` | `3` | Limit weryfikowanych wariantów, 1–5. |
| `PLAN_TIMEOUT_S` | `40` | Łączny limit czasu pojedynczego planowania. |
| `CACHE_TTL_S` | `3600` | Ważność planu w cache RAM. |
| `CACHE_SIZE` | `128` | Maksymalna liczba planów w cache, 1–1000. |

Klient rozdziela początki wywołań OSRM co najmniej sekundą i respektuje `Retry-After`
(sekundy lub HTTP-date). Nie wykonuje natychmiastowych ponowień po 429. Udany plan
jest odtwarzany z cache dla identycznego żądania bez losowania. Domyślne losowanie
opisuje [kontrakt API](docs/API.md). Brak potwierdzonej trasy po awarii
OSRM daje 503. Tylko starszy GET `/route` ma fallback w linii prostej.

Uruchamiaj **jeden worker** przy korzystaniu z publicznego OSRM: limit, kolejka planera
i cache są lokalne dla procesu. Więcej procesów/instancji wymaga wspólnego limitera
albo własnego backendu. [Zasady serwera](https://routing.openstreetmap.de/about.html)
obejmują maksymalnie 1 zapytanie/s i brak intensywnego użycia. Frontend wyświetlający
trasę powinien pokazywać atrybucję OSM oraz [link do poprawiania mapy](https://www.openstreetmap.org/fixthemap).

## Sprawdzanie zmian

```powershell
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
# Opcjonalny test z prawdziwym OSRM; wykonuje żądania sieciowe:
uv run python -m scripts.smoke_plan --minutes 30
```

Testy automatyczne korzystają z `httpx.MockTransport`; sprawdzają dopasowanie czasu,
przystanki, cache, 429, timeouty, walidację danych i geometrię sferyczną indeksu.
`scripts/smoke_plan.py` uruchamia lifespan i endpoint w procesie, ale pyta prawdziwy OSRM.


## Osobna demonstracja zgłoszeń

Hardkodowany pokaz smart-city ma własną aplikację w [hardcoded-zgloszenie/](hardcoded-zgloszenie/README.md). Uruchomienie i wszystkie endpointy opisano w dokumentacji tego folderu.
