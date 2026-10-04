# Smart-city: zgłoszenia przeszkód i zmiana trasy

Scenariusz na prezentację: **Rynek Główny → Wawel / Podzamcze**. Użytkownik
zgłasza blokadę drogi albo schody bez podjazdu. API wybiera wariant omijający
symulowany obszar na Grodzkiej. To osobna aplikacja: zgłoszenia wpływają na jej
`POST /demo/routes`. Dotychczasowe `/routes/plan` i `/route` są w głównym serwisie,
uruchamianym osobno. Główne API nie ładuje plików demo ani jego endpointów.

## Uruchomienie i pokaz

Polecenia wykonuj z katalogu `services/route-finder`, o jeden poziom wyżej niż
ten folder. Demo korzysta z zależności wspólnego `pyproject.toml`. Główne API można
uruchomić równocześnie na porcie 8000 przez `uv run python -m uvicorn main:app --reload`.

```powershell
uv sync --group dev
uv run python -m uvicorn demo_app:app --app-dir hardcoded-zgloszenie --port 8010 --reload
```

To API bez frontendu. Gotowe żądania znajdują się w `test_main.http`, a kontrakt
w <http://127.0.0.1:8010/openapi.json>. Zapisane trasy są dostępne offline.

1. `POST /demo/routes` z `{}`: Grodzka, **934,1 m, 747,4 s (12:27)**.
2. `POST /demo/reports` z `{"kind":"stairs"}`: dodanie symulowanych schodów.
3. `POST /demo/routes` z `{"mobility":"wheelchair"}`: zachodnie Planty,
   **1633,8 m, 1307,4 s (21:47)**, czyli +699,7 m i +560 s.
4. Zgłoszenie `{"kind":"blocked_road"}` wymusza obejście dla obu profili.
5. `POST /demo/reset` usuwa zgłoszenia. Kolejne żądanie trasy zwraca wariant podstawowy.

To **symulacja**: nie twierdzimy, że w tym miejscu rzeczywiście są schody lub remont.
Omijanie jednego zgłoszenia nie potwierdza dostępności całej trasy dla wózka.
Meta jest w okolicy Podzamcza, poza wnętrzem zamku. Czas obu wariantów pochodzi
z profilu pieszego OSRM, a nie z modelu ruchu na wózku.

## Jak działa wybór i liczenie

Oba warianty zostały wcześniej pobrane przez `/route/v1/foot/` i zapisane
w `data/rynek_wawel_routes.json`. Przy starcie `SmartCityDemo.load()` wczytuje
plik do RAM i sprawdza geometrię. W trakcie prezentacji API nie kontaktuje się
z OSRM, więc jego awaria lub 429 nie zatrzymuje tego scenariusza.

Symulowana przeszkoda to koło o promieniu **35 m**, ze środkiem
`latitude=50.0584`, `longitude=19.9380`. Testujemy odległość środka koła od
**całych odcinków** LineString, nie tylko od wierzchołków. W lokalnej projekcji
metrycznej długość geograficzna jest skalowana przez `R*cos(latitude)`, a szerokość
przez `R`. Dla odcinka A→B rzut środka na odcinek jest ograniczany do `[0,1]`;
odległość do tego rzutu nie większa niż promień oznacza kolizję.

| Zgłoszenia | `walking` | `wheelchair` |
|---|---|---|
| Brak | Grodzka | Grodzka |
| Tylko `stairs` | Grodzka; zgłoszenia w `ignored_reports` | Planty |
| Co najmniej jedno `blocked_road` | Planty | Planty |

Objazd musi omijać wszystkie istotne zgłoszenia. W tym demo wszystkie dotyczą
tego samego obszaru. Usunięcie jednego z kilku zgłoszeń nie przywraca trasy,
jeśli inne nadal ją blokuje. Nie generujemy dowolnych nowych tras ani punktów przeszkód.

`distance_m`, `duration_s` i `geometry` pochodzą bezpośrednio z wybranego snapshotu.
`additional_distance_m = wybrany_dystans - dystans_Grodzka`; analogicznie liczymy
`additional_duration_s`. Opcjonalny budżet to `duration_minutes * 60`, a
`within_budget = duration_s <= requested_duration_s`. Bez budżetu oba pola są `null`.
Jeśli budżet jest za mały, zwracamy wybraną trasę i `within_budget=false` oraz
ostrzeżenie. Nie skracamy zapisanej trasy ani czasu. To inna reguła niż ścisły
limit budżetu w turystycznym `/routes/plan`.

## Endpointy

Adres bazowy: `http://127.0.0.1:8010`. JSON, czasy w sekundach, dystanse w metrach,
geometria WGS84 w kolejności `[longitude, latitude]`. Wszystkie POST z JSON
wymagają `Content-Type: application/json`. Nieznane pola modeli żądań dają 422.

### GET `/` i GET `/health`

`GET /` zwraca JSON z `service="hardcoded-zgloszenie"`, `is_demo=true` oraz
adresami `routes`, `reports`, `docs`, `openapi`. `GET /health` zwraca
`{"status":"ok","is_demo":true}` po załadowaniu snapshotu. `/docs`, `/redoc`
i `/openapi.json` dokumentują wyłącznie API demonstracyjne. Dawna strona
`GET /demo` została usunięta i zwraca 404.

### GET `/demo/scenario`

Bez parametrów. 200: `snapshot`, `is_demo=true`, `supported_report_kinds`,
`active_reports` i `report_revision`.
Snapshot zawiera `scenario_id`, `recorded_at`, `osrm_base_url`, `start`, `end`,
`obstacle`, `variants` i `attribution`. Każdy wariant ma `id`, `name`,
`distance_m`, `duration_s`, `geometry` i `via_coordinates`. Oba warianty mogą
służyć do porównania na mapie; sam snapshot nie zmienia się po dodaniu zgłoszenia.

### POST `/demo/reports`

```json
{"kind":"stairs","obstacle_id":"grodzka","description":"Schody bez podjazdu — symulacja"}
```

`kind` wymagane: `stairs` albo `blocked_road`. `obstacle_id` domyślnie `grodzka`
i tylko ta wartość jest obsługiwana. `description` domyślnie pusty, maks. 500 znaków.
201 zwraca obiekt zgłoszenia:

- `id`: wygenerowany UUID;
- `kind`, `description`: dane żądania;
- `obstacle`: `id`, `name`, `location` z latitude/longitude i `radius_m`;
- `created_at`: czas UTC;
- `is_demo`: zawsze `true`.

Limit 100 aktywnych zgłoszeń daje 409 `demo_report_limit`; niepoprawne dane — 422.
Dodanie zgłoszenia zwiększa numer rewizji. Zmiana trasy jest widoczna przy kolejnym
żądaniu `/demo/routes`, nie przez automatyczny push do pozostałych klientów.

### GET `/demo/reports`

200: lista obiektów zgłoszenia w kolejności dodania, albo `[]`.
Opcjonalny filtr: `?kind=stairs` lub `?kind=blocked_road`. Nieznany typ daje 422.

### DELETE `/demo/reports/{report_id}`

Usuwa jedno zgłoszenie, zwiększa rewizję i zwraca 204 **bez treści**.
Nieznane ID daje 404 `demo_report_not_found`. Nie usuwa danych POI ani wariantów tras.

### POST `/demo/reset`

Bez ciała żądania. Usuwa wszystkie aktywne zgłoszenia, zwiększa rewizję.
200: `{"removed_reports":1,"report_revision":2}`; liczby zależą od stanu.
Reset zmienia wyłącznie stan tej osobnej aplikacji.

### POST `/demo/routes` — trasa po uwzględnieniu zgłoszeń

```json
{"mobility":"wheelchair","duration_minutes":20}
```

`mobility` domyślnie `walking`, dopuszcza też `wheelchair`. Jest to profil reguł
demo, nie osobny profil OSRM. `duration_minutes` opcjonalne/null; skończona liczba
5–240. Puste `{}` również jest poprawnym żądaniem. Para start–meta jest ustalona.

200 zwraca wszystkie poniższe pola:

| Pole | Znaczenie |
|---|---|
| `scenario_id`, `is_demo` | `rynek_wawel`, `true`. |
| `accessibility_verified` | Zawsze `false`; nie zweryfikowano pełnej dostępności. |
| `mobility` | Profil wybrany w żądaniu. |
| `start`, `end` | `name`, `latitude`, `longitude` stałych punktów prezentacji. |
| `route_id`, `route_name` | `direct` / `planty` i nazwa wybranego wariantu. |
| `rerouted` | Czy wybrano obejście zamiast trasy podstawowej. |
| `distance_m`, `duration_s` | Dystans i czas profilu foot wybranego wariantu. |
| `additional_distance_m`, `additional_duration_s` | Różnica względem Grodzkiej; zero dla podstawowej. |
| `geometry` | Gotowy GeoJSON LineString wybranej trasy. |
| `original_geometry` | GeoJSON LineString Grodzkiej, np. do przerywanej linii na mapie. |
| `avoided_reports` | Pełne obiekty zgłoszeń, które wymusiły obejście. |
| `ignored_reports` | Zgłoszenia schodów ignorowane dla profilu pieszego. |
| `report_revision` | Numer stanu zgłoszeń wykorzystanego do tej odpowiedzi. |
| `requested_duration_s`, `within_budget` | Przeliczony budżet i wynik porównania, albo `null`. |
| `source`, `snapshot_recorded_at` | `osrm_snapshot` i data pobrania tras. |
| `warnings`, `attribution` | Ograniczenia symulacji, ewentualne przekroczenie budżetu i źródło. |

Przy schodach i powyższym żądaniu otrzymamy `route_id="planty"`, `rerouted=true`,
`duration_s=1307.4`, `requested_duration_s=1200`, `within_budget=false`.
422 oznacza błędne żądanie. 409 `no_demo_detour` oznacza brak wariantu omijającego
przeszkody; dołączony, walidowany snapshot ma prawidłowe obejście.
Błędy domenowe mają format `{"detail":{"code":"...","message":"..."}}`.

## Pliki, konfiguracja i weryfikacja

- `smart_city.py`: modele, stan zgłoszeń w RAM, test kolizji geometrii, wybór i router HTTP.
- `data/rynek_wawel_routes.json`: dwie rzeczywiste odpowiedzi tras OSRM, data i atrybucja.
- `prepare_smart_city_demo.py`: odtwarza snapshot z publicznego pieszego OSRM;
  pobiera warianty przez zadane waypointy, waliduje i zapisuje atomowo.
- `tests/test_smart_city.py`: profile, blokady, usuwanie, reset, limity, budżet,
  walidacja snapshotu i przecięcie całego odcinka z przeszkodą.
- `demo_app.py`: osobna aplikacja FastAPI, lifespan, ścieżka snapshotu i router. Nie ładuje katalogu POI ani turystycznego planera.
- `test_main.http`: gotowe żądania do API symulacji.

Wspólne typy GeoJSON i stała promienia Ziemi są importowane z nadrzędnych
`models.py` i `spatial.py`. Skrypt odświeżający używa też wspólnego klienta
`routing.py` i ustawień `config.py`. Zależność biegnie od demo do kodu bazowego;
główna aplikacja nie importuje demo.

`DEMO_ROUTES_FILE` domyślnie wskazuje plik `data/rynek_wawel_routes.json` obok kodu;
nadpisana ścieżka względna liczona jest od katalogu procesu. Brak lub wadliwy snapshot
przerywa start. Odświeżenie (wymaga internetu) i testy:

```powershell
uv run python -m hardcoded-zgloszenie.prepare_smart_city_demo
uv run pytest hardcoded-zgloszenie/tests -q
uv run ruff check .
uv run ruff format --check .
```

Zgłoszenia są wspólne dla klientów jednego procesu, znikają po restarcie i nie mają
trwałego zapisu, moderacji ani logowania użytkownika. Uruchom pokaz z jednym workerem.
To przygotowany scenariusz: rozszerzenie na całe miasto wymaga trwałych zgłoszeń,
weryfikacji barier i silnika routingu obsługującego wykluczanie odcinków grafu.
