# Architektura, obliczenia i utrzymanie

[Spis dokumentacji](README.md). Ten dokument opisuje wnętrze serwisu, konfigurację
i pliki. Kontrakt HTTP jest w [API.md](API.md), źródła danych w [DATA.md](DATA.md).

## Start i cykl życia procesu

`main.create_app()` rejestruje FastAPI i lifespan. Przy starcie odczytywane są
ustawienia, a `POIIndex.load()` wczytuje i waliduje lokalny GeoJSON. Powstają:
lista POI, słownik po ID, wspólny KDTree oraz drzewa dla poszczególnych kategorii.
Następnie tworzony jest jeden `httpx.AsyncClient`, `OSRMRouter` i `Planner`.
Obiekty są przechowywane w `app.state`; po zakończeniu lifespan klient HTTP jest zamykany.

Operacje plikowe, tworzenie indeksu i wybrane obliczenia planera wykonują się przez
`asyncio.to_thread()`. Komunikacja z OSRM jest asynchroniczna. Zmiana pliku danych
wymaga restartu. Błędny lub brakujący plik blokuje start; poprawny pusty zbiór jest
dozwolony. Główna aplikacja nie ładuje osobnego demo zgłoszeń.

## Indeks przestrzenny

KDTree przechowuje punkty na sferze jednostkowej, nie surowe stopnie:

```text
x = cos(latitude) * cos(longitude)
y = cos(latitude) * sin(longitude)
z = sin(latitude)
distance_m = 2 * R * asin(chord / 2)
R = 6 371 008.8 m
```

Funkcje trygonometryczne otrzymują radiany. Dzięki tej reprezentacji odległości
uwzględniają szerokość geograficzną i przejście przez antypołudnik. Promień
służy do wyboru kandydatów; odległość spaceru pochodzi później z sieci OSRM.

## Wybór trasy

1. Model normalizuje tryb startu i starszy alias lokalizacji. Router sprawdza,
   czy istnieje konfiguracja żądanego profilu.
2. Planer szuka poprawnego cache, a przy jego braku rezerwuje blokadę nowego planowania.
3. Pierwszy POI pochodzi z podanego ID albo wyszukiwania blisko punktu wejściowego.
   POI z `access=private/no` lub `foot=no` są pomijane. Dla wózka dodatkowo odrzucane
   są `wheelchair=no/limited`; oba ograniczone profile odrzucają POI z `highway=steps`.
   To tylko filtr POI — wykluczanie odcinków ulic należy do grafu wybranego backendu.
4. Promień kandydatów wynosi `min(50000, duration_minutes * 60 * 2)` metrów.
   Odrzucane są identyczne ID i cele bliższe niż 20 m od pierwszego POI. Jeśli zbiór
   jest większy od limitu, wybierana jest próbka z całego uporządkowanego zakresu.
5. Gdy wejściowy start różni się współrzędnymi od pierwszego POI, staje się osobnym
   pierwszym węzłem obliczeń. Obowiązkowy początek ścieżki to wtedy origin → pierwszy POI.
6. OSRM Table dostarcza macierz czasów dla wszystkich wybranych węzłów w tym samym
   profilu, który będzie później użyty do finalnej trasy. Koszt dojścia jest częścią budżetu.
7. Ograniczone przeszukiwanie typu beam search rozbudowuje ścieżki bez powtarzania
   węzłów. Na każdym poziomie przechowuje maksymalnie 256 ścieżek do rozbudowy:
   przy większej liczbie zachowuje 128 najkrótszych i 128 najdłuższych pod budżetem.
   Osobno przechowywane są najwyżej 256 najlepiej ocenionych wyników.
8. Ranking preferuje wariant w tolerancji, potem większą liczbę POI, potem dłuższy
   czas. Poza tolerancją preferuje najdłuższy wariant mieszczący się w budżecie.
9. Ograniczona liczba najlepszych wariantów trafia do OSRM Route z `steps=true`,
   `overview=full`, `geometries=geojson`. Akceptowany jest dodatni czas nieprzekraczający budżetu.
10. Planer buduje odcinki z geometrii kroków, przypisuje waypointy do POI,
    wylicza przyjazdy do kolejnych miejsc, obwiednię mapy i metadane wyniku.

Liczba rozszerzeń jest ograniczona w przybliżeniu przez liczbę przystanków ×
szerokość beam × liczbę kandydatów. Dzięki temu zwiększenie liczby POI nie wymusza
enumerowania wszystkich permutacji. To heurystyka, bez gwarancji globalnego optimum.
Kolejność miejsc nie gwarantuje też braku nakładających się odcinków geometrii.

## Obliczenia odpowiedzi

```text
budget_s = duration_minutes * 60
unused_duration_s = budget_s - route.duration
matches_target = unused_duration_s <= budget_s * tolerance_percent / 100
arrival_duration_s(k) = suma czasów odcinków przed waypointem k
arrival_distance_m(k) = suma dystansów odcinków przed waypointem k
bbox = [min(longitude), min(latitude), max(longitude), max(latitude)]
```

Położenie wejściowe jest dopasowywane do sieci; serwis nie rysuje fikcyjnego
łącznika od GPS. Koszt tego przesunięcia nie wchodzi do budżetu. Pierwszy waypoint
ma konfigurowany promień dopasowania, kolejne POI korzystają z promienia 100 m.
Jeśli dojście jest dodane, przesuwa indeks pierwszego POI o jeden.

## Komunikacja z OSRM i mechanizmy awaryjne

Wszystkie profile korzystają ze wspólnego klienta, blokady, odstępu co najmniej
sekundy między początkami żądań i cooldownu po 429. `Retry-After` upstream może
być liczbą sekund albo datą HTTP; niepoprawna wartość uruchamia domyślny cooldown.

Jeśli Table zwraca brak dopasowania/trasy lub błąd obsługi HTTP, planer może
sprawdzić ograniczoną liczbę wariantów bez pośrednich POI. Ranking tych celów
korzysta z heurystyki `budget_s * WALKING_SPEED_M_S / 1.3`, ale finalny czas i geometria
nadal muszą pochodzić z OSRM Route. Dojście i wybrany profil pozostają zachowane.

429, timeouty i wadliwe odpowiedzi nie powodują szybkiej pętli ponowień. Walidacja
wyniku sprawdza liczby, rozmiar macierzy, waypointy, liczbę odcinków, zgodność sum
czasu i dystansu, obecność kroków, ich sumy i ciągłość geometrii względem waypointów.
Oszacowane komórki Table nie są traktowane jako czasy potwierdzonej trasy.

Legacy `/route` ma osobny fallback: dystans sferyczny i czas `distance / WALKING_SPEED_M_S`.
Sposób oznaczania tej odpowiedzi i statusy błędów określa [kontrakt](API.md).

Cache udanych planów ma ograniczoną pojemność, TTL i klucz znormalizowanego requestu,
w tym flagi profilu. Działa też podczas czasowej awarii OSRM, ale nie używa wygasłych
wpisów. Nowy plan powstaje jeden na proces; odczyty katalogu i trafienia cache nie
muszą czekać na jego zakończenie. Wszystkie te mechanizmy są lokalne dla procesu.

## Konfiguracja

Zmienne są czytane przy starcie. `.env` nie jest ładowany automatycznie.
Ścieżka domyślnego pliku POI jest liczona względem kodu; własna względna ścieżka
jest liczona od katalogu procesu.

| Zmienna | Domyślnie | Znaczenie / zakres |
|---|---|---|
| `POI_FILE` | `krakow_pois.geojson` obok `config.py` | Lokalny zbiór POI. |
| `OSRM_BASE_URL` | `https://routing.openstreetmap.de/routed-foot` | Backend zwykłego profilu pieszego. |
| `OSRM_STEP_FREE_BASE_URL` | brak | Backend z grafem wykluczającym schody. |
| `OSRM_WHEELCHAIR_BASE_URL` | brak | Backend z grafem przeznaczonym dla wózków, również bez schodów. |
| `ORIGIN_SNAP_RADIUS_M` | 25 | Promień dopasowania pierwszego waypointu, >0 i <=100 m. |
| `OSRM_TIMEOUT_S` | 8 | Timeout operacji HTTPX, >0 s. |
| `OSRM_COOLDOWN_S` | 60 | Cooldown bez poprawnego Retry-After, >=1 s. |
| `WALKING_SPEED_M_S` | 1.4 | Heurystyka awaryjnych kandydatów i legacy estimate, >0. |
| `CANDIDATE_LIMIT` | 24 | Limit kandydatów, 2–40; poza pierwszym POI i ewentualnym origin. |
| `ROUTE_ATTEMPTS` | 3 | Maksimum finalnie sprawdzanych wariantów, 1–5. |
| `PLAN_TIMEOUT_S` | 40 | Limit nowego planowania, >0 s. |
| `CACHE_TTL_S` | 3600 | Ważność cache, >0 s. |
| `CACHE_SIZE` | 128 | Pojemność cache, 1–1000. |

### Gotowość profili dostępności

Kod wybiera osobny URL dla każdego profilu. Wszystkie wywołania mają końcówkę
`/{service}/v1/foot/...`; faktyczne ograniczenia zależą od grafu przygotowanego
na danym serwerze. Zmiana napisu w URL ani samo filtrowanie tagów POI nie zmienia grafu.

Domyślnie skonfigurowany jest tylko zwykły profil. **W repozytorium nie ma jeszcze
gotowej procedury budowania grafów `step_free` i `wheelchair`.** Nie należy ustawiać
tych zmiennych na zwykły publiczny backend i uznawać ograniczeń za wdrożone.
Przed produkcyjnym użyciem trzeba przygotować właściwe grafy, ustawić URL,
zweryfikować działanie obu usług Table/Route oraz przetestować znane bariery.
`/capabilities` potwierdza ustawienie konfiguracji, nie przeprowadza takiego testu.

## Uruchomienie i sprawdzanie

Polecenia z katalogu `services/route-finder`, Python 3.12+ i `uv`:

```powershell
uv sync --group dev
uv run python -m uvicorn main:app --reload
```

Przy publicznym OSRM uruchamiaj jeden worker. Wiele procesów wymaga wspólnego
limitera/cache lub infrastruktury routingu przygotowanej na taki ruch.
Zmienne URL profili ustaw w środowisku procesu przed uruchomieniem aplikacji.

```powershell
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
```

Testy automatyczne wykorzystują MockTransport i lokalne dane. Nie potwierdzają
dostępności terenu ani konfiguracji zewnętrznego grafu. Opcjonalny smoke test
odpytuje rzeczywisty backend i może zapisać odpowiedź aktualnego kontraktu:

```powershell
uv run python -m scripts.smoke_plan --minutes 30 --output docs/current-plan.json
```

Ten smoke test wybiera zwykły profil; nie zastępuje sprawdzenia obu profili
ograniczonych. Znaczenie historycznego przykładu opisuje [spis dokumentacji](README.md).

## Odpowiedzialność plików

| Plik / katalog | Rola |
|---|---|
| `main.py` | Fabryka aplikacji, lifespan, rejestracja endpointów. |
| `models.py` | Modele requestów, odpowiedzi, geometrii i nawigacji; normalizacja startu. |
| `config.py` | Walidowane ustawienia i mapowanie zmiennych środowiskowych. |
| `spatial.py` | Wczytanie POI, indeksy i odległości sferyczne. |
| `planner.py` | Wybór startu i profilu, beam search, budżet, budowanie planu i cache. |
| `routing.py` | Table/Route, ograniczanie ruchu, walidacja OSRM, fallback legacy. |
| `krakow_pois.geojson` | Lokalny zbiór opisany w `DATA.md`. |
| `scripts/import_pois.py` | Ręczny importer OSM opisany w `DATA.md`. |
| `scripts/smoke_plan.py` | Opcjonalny test planera z żywym OSRM. |
| `tests/conftest.py` | Tymczasowe POI i odpowiedzi transportu testowego. |
| `tests/test_api.py` | Integracja HTTP, routing, budżet, cache, błędy i współbieżność. |
| `tests/test_spatial.py` | Odległości, walidacja zbioru, ścieżki i import danych. |
| `tests/__init__.py` | Oznaczenie pakietu testów. |
| `hardcoded-zgloszenie/` | Niezależne API symulacji; własną strukturę opisuje jego README. |
| `pyproject.toml`, `uv.lock` | Zależności, konfiguracja narzędzi i przypięte wersje. |
| `test_main.http` | Ręczne żądania HTTP. |
| `AGENTS.md` | Zasady pracy nad serwisem. |
| `README.md` | Szybkie wejście do repozytorium. |
| `docs/` | Podział tematów i artefaktów określa `docs/README.md`. |

`.venv`, `__pycache__`, `.pytest_cache` i `.ruff_cache` są plikami generowanymi
lokalnie, nie elementami logiki aplikacji.
