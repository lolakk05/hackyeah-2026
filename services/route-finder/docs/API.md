# Kontrakt HTTP API

[Spis dokumentacji](README.md). Ten plik jest jedyną referencją endpointów, pól,
limitów, przykładów żądań i błędów **głównego API**. Opis algorytmu i konfigurację
znajdziesz w [OPIS_API.md](OPIS_API.md), a sposób prezentacji w
[FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md).

## Konwencje

Baza lokalna: `http://127.0.0.1:8000`. Brak uwierzytelniania w obecnym serwisie.
POST wymaga `Content-Type: application/json`; GET używa query/path, bez body.
JSON jest kodowany w UTF-8. Nieznane pola modeli żądań są odrzucane.

- Współrzędne: WGS84. Obiekty lokalizacji mają `latitude`, `longitude`;
  tablice geometrii i dopasowanych pozycji mają kolejność **[longitude, latitude]**.
- Dystanse: metry. Czasy odpowiedzi: sekundy. Budżet wejściowy: minuty.
- GeoJSON trasy: `LineString`, nie `FeatureCollection`.
- Odpowiedź 200 planera oznacza potwierdzoną trasę OSRM lub jej cache, nigdy linię prostą.

## Endpointy

| Metoda | Ścieżka | Funkcja |
|---|---|---|
| POST | `/routes/plan` | Plan podróży według czasu i preferencji. |
| OPTIONS | `/routes/plan` | Preflight CORS obsługiwany przez middleware. |
| GET | `/capabilities` | Konfiguracja profili i limity formularza. |
| GET | `/pois` | Katalog z filtrowaniem i paginacją. |
| GET | `/pois/{poi_id}` | Jeden POI. |
| GET | `/categories` | Dostępne kategorie. |
| GET | `/dataset` | Metadane zbioru. |
| GET | `/route` | Pomocnicza trasa do najbliższego POI. |
| GET | `/health` | Gotowość procesu. |
| GET | `/` | Informacje o serwisie. |
| GET | `/openapi.json` | Schemat kontraktu generowany z kodu. |
| GET | `/docs`, `/redoc` | Dokumentacja developerska FastAPI. |
| GET | `/docs/oauth2-redirect` | Techniczny callback Swaggera. |

## POST `/routes/plan`

Endpoint wymaga POST. GET (np. po wpisaniu URL w pasku przeglądarki) zwraca 405.
Preflight OPTIONS z `Origin` i `Access-Control-Request-Method` zwraca tekst `OK`
ze statusem 200 dla dozwolonego originu i metody. Odrzucony preflight daje 400.
Obsługa przeglądarki: [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md).

### Żądanie

| Pole | Typ i domyślnie | Reguły |
|---|---|---|
| `duration_minutes` | number, wymagane | Skończona liczba 5–360 (do 6 godzin); dopuszcza ułamki. |
| `language` | `pl` / `en`, domyślnie `pl` | Akceptuje także `polish` / `english`; odpowiedź używa `pl` / `en`. |
| `start_mode` | `market` / `user` / `poi` / null, domyślnie null | Bez wartości tryb jest wywnioskowany z pól startu. |
| `user_location` | Location/null, domyślnie null | Wymagane dla `user`. |
| `start_poi_id` | string/null, domyślnie null | ID z katalogu, 1–100 znaków; wymagane dla `poi`. |
| `start_location` | Location/null, domyślnie null | Starszy alias `user_location`; nie podawaj obu. |
| `wheelchair` | boolean, domyślnie false | Wybiera profil `wheelchair`, także przy `avoid_stairs=false`. |
| `avoid_stairs` | boolean, domyślnie false | Bez wózka wybiera profil `step_free`. |
| `category` | string/null, domyślnie null | 1–100 znaków po obcięciu spacji; filtruje cele i przystanki, nie pierwszy POI. |
| `max_intermediate_stops` | integer, domyślnie 8 | **0–10**, maksimum dodatkowych POI między pierwszym a ostatnim. |
| `tolerance_percent` | number, domyślnie 15 | Skończona liczba 0–50; dozwolony niedobór czasu, nie przekroczenie budżetu. |
| `randomize` | boolean, domyślnie true | Losowy dobór kandydatów i podobnie ocenionych wariantów; omija odczyt i zapis cache. |

`Location` wymaga skończonych liczb: `latitude` −90..90, `longitude` −180..180.
Bool wysyłaj jako `true`/`false`; Pydantic akceptuje również liczby 0/1.

**Wybór startu:**

- `market`: stałe współrzędne `(50.0617, 19.9373)`, bez lokalizacji ani ID w body.
- `user`: `user_location` albo alias `start_location`, bez ID.
- `poi`: `start_poi_id`, bez lokalizacji.
- Pominięcie/null trybu: ID → `poi`, lokalizacja → `user`, brak obu → `market`.
- Sprzeczne dane lub brak pola wymaganego dla jawnego trybu dają 422.

**Użytkownik poza centrum:** jeśli poprawna lokalizacja w trybie `user` jest
**ponad 1500 m w linii prostej od Rynku** `(50.0617, 19.9373)`, API pomija ją
i planuje od Rynku. Przy dokładnie 1500 m lokalizacja pozostaje. Reguła działa
także dla `start_location` i wywnioskowanego trybu `user`; nie zmienia jawnego wyboru POI.
Budżet, kategoria, język i preferencje dostępności pozostają bez zmian.
Udane planowanie zwraca 200, `start.mode="market"`,
`start.fallback_reason="user_too_far_from_market"` i ostrzeżenie w wybranym języku.
Dotarcie użytkownika na Rynek nie jest częścią czasu, geometrii ani nawigacji.
Pozostałe błędy planowania nadal obowiązują — zmiana startu nie gwarantuje sukcesu OSRM.

Dla Rynku i użytkownika pierwszy POI jest wybierany w promieniu
`min(50000, duration_minutes * 60 * 2)` metrów od startu. To filtr przestrzenny,
nie szacowany czas przejścia. OSRM musi potwierdzić zmieszczenie całej trasy w budżecie.
Odcinek od startu dopasowanego do sieci do tego POI jest częścią planu. Odległość
od surowej pozycji GPS do sieci nie jest dodawana jako sztuczny odcinek.
`max_intermediate_stops=10` pozwala na do 12 POI; start użytkownika nie jest POI.
Nie ma gwarancji uzyskania maksymalnej liczby miejsc ani powrotu do początku.
W `stops` każde ID występuje tylko raz. Planer pomija też rozpoznane bliskie
duplikaty tej samej atrakcji w OSM; reguły rozpoznawania opisuje [algorytm](OPIS_API.md).
To nie wyklucza ponownego przejścia tą samą ulicą.

**Język:** obejmuje `warnings`, domenowe `detail.message` planera oraz nazwy POI
we wszystkich polach odpowiedzi planu. Nazwa pochodzi z `name:pl` lub `name:en`
w tagach OSM; jeśli tłumaczenia brak, pozostaje oryginalna. Nie zmienia kategorii,
ID, tagów ani kodów manewrów i nazw ulic z OSRM. Błędy walidacji FastAPI (422),
błędy metod/CORS i pozostałe endpointy zachowują dotychczasowy język.

**Losowanie (domyślne):** pominięcie pola lub `randomize=true` wykonuje nowe planowanie
również dla identycznego requestu. Początek, kategoria, limity i preferencje dostępności
pozostają zachowane.
Udany wynik tego trybu ma `source=osrm`. Powtórzenie trasy jest możliwe, szczególnie
przy małej liczbie dostępnych wariantów; nie prowadzimy historii poprzednich losowań.
Żądanie wymaga dostępnego OSRM i nadal podlega limiterowi oraz błędom 503.
Przy `randomize=false` identyczne żądania mogą korzystać z cache.

Wyłączenie losowania i korzystanie z cache:

```json
{"duration_minutes":45,"randomize":false}
```

**Wybór profilu:**

| `wheelchair` | `avoid_stairs` | `routing_profile` |
|---|---|---|
| false | false | `walking` |
| false | true | `step_free` |
| true | false lub true | `wheelchair` |

Profile ograniczone wymagają osobnych skonfigurowanych backendów. Bez konfiguracji
żądanie przechodzi walidację, ale planowanie zwraca 503 `routing_profile_not_configured`.
Nie ma automatycznego przejścia na inny profil.

### Przykłady poprawnych body

Rynek, standardowy spacer:

```json
{"duration_minutes":30,"start_mode":"market","language":"polish"}
```

Lokalizacja przy Tauron Arenie: odpowiedź po angielsku, automatyczna trasa od Rynku:

```json
{
  "duration_minutes": 90,
  "start_mode": "user",
  "user_location": {"latitude": 50.0668889, "longitude": 19.9905833},
  "language": "english",
  "wheelchair": false,
  "avoid_stairs": false,
  "max_intermediate_stops": 8
}
```

Współrzędne okolic parkingu przy arenie pochodzą z
[serwisu miasta Krakowa](https://www.krakow.pl/instcbi/260498/inst/54386/2261/ul-Stanislawa-Lema-7.html).
W aplikacji używaj rzeczywistej pozycji GPS. W tym przykładzie przekroczony jest
limit odległości od Rynku, więc 90 minut dotyczy spaceru od Rynku. Sam brak
dopasowania GPS do sieci w dozwolonym promieniu nie uruchamia tej zmiany startu.

Ponowne losowanie atrakcji dla spaceru z Rynku:

```json
{"duration_minutes":45,"start_mode":"market","randomize":true}
```

Pozycja użytkownika, więcej miejsc po drodze:

```json
{
  "duration_minutes":45,
  "start_mode":"user",
  "user_location":{"latitude":50.0547,"longitude":19.9346},
  "max_intermediate_stops":8
}
```

Godzina z muzeami jako celami:

```json
{"duration_minutes":60,"category":"museum","max_intermediate_stops":5}
```

Bez przystanków pośrednich, początek z wybranego katalogu:

```json
{"duration_minutes":20,"start_mode":"poi","start_poi_id":"way-23256528","max_intermediate_stops":0}
```

ID w przykładzie oznacza Sukiennice w dołączonym zbiorze. Klient powinien używać ID
z bieżącego katalogu. Następne przykłady wymagają konfiguracji odpowiedniego profilu:

```json
{"duration_minutes":45,"start_mode":"market","avoid_stairs":true,"max_intermediate_stops":5}
```

```json
{
  "duration_minutes":30,
  "start_mode":"user",
  "user_location":{"latitude":50.0617,"longitude":19.9373},
  "wheelchair":true,
  "avoid_stairs":false,
  "max_intermediate_stops":5
}
```

Poprawna walidacja nie gwarantuje znalezienia trasy ani dostępności serwera OSRM.

### Odpowiedź 200: `PlanResponse`

| Pole | Zawartość |
|---|---|
| `start` | `RouteStart`: rzeczywisty początek żądania i jego dopasowanie do sieci. |
| `start_poi`, `end_poi` | Pierwszy i ostatni POI, o różnych ID. |
| `intermediate_pois` | POI między nimi, w kolejności przejścia. |
| `stops` | `RouteStop[]`: uporządkowane POI z czasami dotarcia; zalecane źródło roadmapy. |
| `requested_duration_s` | Budżet w sekundach. |
| `duration_s`, `distance_m` | Łączny czas i dystans po sieci, wraz z odcinkiem dojścia, jeśli występuje. |
| `unused_duration_s` | Niewykorzystany budżet; nieujemny. |
| `matches_target` | Czy skrócenie mieści się w tolerancji. False nadal oznacza sukces. |
| `geometry` | Pełna geometria trasy. |
| `bbox` | `[west, south, east, north]`, obwiednia geometrii. |
| `legs` | `RouteLeg[]`: odcinki z geometrią i krokami nawigacji. |
| `snapped_waypoints` | Punkty dopasowane do sieci, w kolejności trasy. |
| `accessibility` | Wybrane preferencje i informacja o użytym profilu. |
| `source` | `osrm` albo `cache`. |
| `warnings` | Tablica informacji o ograniczeniach wyniku. |
| `language` | Znormalizowany język odpowiedzi: `pl` albo `en`. |
| `candidates_considered` | Liczba kandydatów bez pierwszego POI; nie liczba odwiedzanych miejsc. |
| `attribution` | Informacja o źródle danych i routingu. |

#### `RouteStart`

`mode` jest faktycznym trybem startu. `requested_location` zawiera współrzędne
wybrane do routingu przed dopasowaniem do sieci: lokalizację użytkownika, POI lub
Rynek (również po automatycznej zmianie startu). `snapped_location` wskazuje punkt
sieci, `distance_to_network_m` podaje
przesunięcie. `approach_included` oznacza dodanie odcinka przed pierwszym POI.
`fallback_reason` to `user_too_far_from_market` po pominięciu odległej lokalizacji,
w pozostałych przypadkach null. Nie interpretuj `approach_included` jako dojścia
od pominiętej lokalizacji: po zmianie startu oznacza dojście od Rynku do pierwszego POI.
Limit dopasowania pierwszej lokalizacji podaje `/capabilities`; pozostałe POI
są dopasowywane do 100 m. W trybie `poi` nie ma dodatkowego odcinka dojścia.

#### `RouteStop`

`sequence` to numer od zera, `waypoint_index` odsyła do `snapped_waypoints`,
`role` przyjmuje `start`, `intermediate`, `end`. `poi` zawiera pełny obiekt POI,
`snapped_location` jest punktem sieci. `arrival_distance_m` i `arrival_duration_s`
to wartości narastające od początku trasy do tego miejsca, bez postojów.

#### `RouteLeg` i `NavigationStep`

Odcinek ma `from_poi_id`, `to_poi_id`, `from_waypoint_index`, `to_waypoint_index`,
`kind`, `distance_m`, `duration_s`, `geometry`, `steps`.
`kind=approach` opisuje dojście od startu do pierwszego POI, wtedy `from_poi_id=null`.
Pozostałe mają `kind=between_pois`. Dla N POI zwykle jest N−1 odcinków;
dodatkowe dojście zwiększa tę liczbę o jeden.

Każdy krok ma pola OSRM: `distance` (metry), `duration` (sekundy), `name`, `mode`,
`geometry`, `maneuver`, `intersections`. Dodatkowe pola OSRM są zachowywane.
`name` może być pusty. Nie ma gotowego polskiego tekstu ani nagrania instrukcji.

`maneuver` zawiera `type`, opcjonalny `modifier`, `location`, `bearing_before`,
`bearing_after`, opcjonalny `exit` i dodatkowe właściwości OSRM. Krok przyjazdu
może mieć zerowy czas/dystans i tylko jeden punkt w `geometry.coordinates`.
Pełna trasa i geometria odcinka zawsze mają co najmniej dwa punkty.

#### `SnappedWaypoint`

`poi_id` wiąże waypoint z POI; dla dodatkowego początku ma null.
`location` to pozycja na sieci. `distance_from_poi_m` zachowuje nazwę dla zgodności;
dla początku z `poi_id=null` oznacza odległość od wejściowej pozycji użytkownika/Rynku.

#### `Accessibility`

`wheelchair` i `avoid_stairs` odzwierciedlają request. `effective_avoid_stairs`
uwzględnia implikację wózka. `routing_profile` wskazuje wybrany profil.
`constraints_applied=true` oznacza użycie skonfigurowanego backendu ograniczonego,
nie niezależny audyt jego grafu. `accessibility_verified` jest zawsze false.

## GET `/capabilities`

Bez parametrów. 200 zawiera `max_intermediate_stops`, `default_intermediate_stops`,
`duration_minutes={min,max}`, `origin_snap_radius_m`, `navigation_steps` i
`profiles={walking:{configured},step_free:{configured},wheelchair:{configured}}`.
`configured` mówi wyłącznie o ustawieniu URL, nie o działaniu serwera czy jakości danych.
Adresy backendów nie są ujawniane. Przy domyślnych ustawieniach dwa ograniczone profile
mają `configured=false`.

## Katalog i model POI

### `POI`

Obiekt zawiera `id`, `name`, `category`, `latitude`, `longitude`, `osm_url` (może być
null), `coordinate_source` i `tags` (słownik stringów, może być pusty).
Interpretację pochodzenia i jakości współrzędnych opisuje [DATA.md](DATA.md).

### GET `/pois`

| Query | Domyślnie | Reguły |
|---|---|---|
| `q` | pominięte | Fragment nazwy, 1–200 znaków; bez rozróżniania wielkości liter. |
| `category` | pominięte | Dokładna kategoria, 1–100 znaków; ignoruje wielkość liter i skrajne spacje. |
| `limit` | 50 | Liczba całkowita 1–200. |
| `offset` | 0 | Liczba całkowita >=0. |

Przykład: `GET /pois?q=Muzeum&category=museum&limit=20&offset=0`.
200: `{total,offset,limit,items}`, gdzie `items` to POI w kolejności ID.
`total` dotyczy wyniku po filtrach, przed paginacją. Pusty wynik daje 200 z `items=[]`.
Nie ma sortowania według odległości ani filtrowania dostępności w tym endpointcie.

### GET `/pois/{poi_id}` i GET `/categories`

ID jest tekstem 1–100 znaków z katalogu; wielkość liter ma znaczenie.
Szczegóły zwracają 200 z POI albo 404 `poi_not_found`.
Kategorie zwracają 200 z posortowaną tablicą stringów, bez parametrów.

### GET `/dataset`

Bez parametrów. 200: `{loaded_count,metadata}`. Pierwsze pole to liczba obiektów
w RAM; drugie przechowuje metadane pliku i może być puste dla własnych danych.
Zawartość dołączonego zbioru opisuje wyłącznie [DATA.md](DATA.md).

## GET `/route` — pomocnicze wyszukiwanie najbliższego POI

Wymagane query: `latitude`, `longitude` o zakresach jak Location oraz `category`
(1–100 znaków po obcięciu spacji). `radius_m` domyślnie 2000, musi być >0 i <=50000;
oznacza promień w linii prostej. Endpoint nie przyjmuje budżetu ani flag dostępności.

```http
GET /route?latitude=50.0617&longitude=19.9373&category=museum&radius_m=2000
```

200: `poi`, `poi_distance_m`, `distance_m`, `duration_s`, `geometry`, `source`,
`is_estimate`, `fallback_reason`, `warning`, `attribution`.
`poi_distance_m` jest odległością sferyczną. Przy sukcesie routingu `source=osrm`,
`is_estimate=false`, a powód/ostrzeżenie są null. Przy awarii `source=straight_line`,
`is_estimate=true` i geometria jest dwupunktową linią prostą, niezdatną do nawigacji.
To inny model odpowiedzi niż `PlanResponse`; nie zawiera `stops` ani manewrów.

## Endpointy techniczne

- `GET /`: 200 z `service`, `docs`, `redoc`, `openapi`, `planner`.
- `GET /health`: 200 z `status="ok"`, `poi_count`; potwierdza start procesu,
  nie testuje OSRM. Poprawny pusty zbiór daje liczbę 0.
- `/openapi.json`: 200 z aktualnym schematem. `/docs` i `/redoc`: HTML dokumentacji,
  którego zasoby UI korzystają z CDN. Nie są frontendem produktu.
- `/docs/oauth2-redirect`: techniczna strona Swaggera. Brak skonfigurowanego logowania OAuth2.

## Błędy

Walidacja FastAPI: `detail` jest tablicą z `loc`, `msg`, `type` i ewentualnymi
dodatkowymi polami. Błędy domenowe: `detail` jest obiektem z `code`, `message`
i czasem `retry_after_s`. Nie zakładaj jednego typu `detail` dla wszystkich 422.

| HTTP | Kod / rodzaj | Znaczenie |
|---|---|---|
| 405 | `detail="Method Not Allowed"` | Niewłaściwa metoda, np. GET zamiast POST planera. |
| 422 | tablica walidacji | Nieznane pola, złe zakresy lub sprzeczne dane startu. |
| 422 | `poi_access_restricted` | Pierwszy POI wskazany przez ID nie spełnia filtrów dostępu/profilu. |
| 404 | `poi_not_found` | Nieznane ID. |
| 404 | `no_start_poi` | Brak kwalifikującego się pierwszego POI w promieniu wyszukiwania zależnym od budżetu. |
| 404 | `no_candidate_pois` | Brak innych celów w kategorii i obszarze wyszukiwania. |
| 404 | `no_route_within_budget` | Żaden sprawdzony wariant nie został zaakceptowany. |
| 503 | `routing_profile_not_configured` | Wybrany profil nie ma ustawionego backendu; nie zawiera Retry-After. |
| 503 | `planner_busy`, `osrm_busy` | Trwa inne planowanie lub zajęty jest klient OSRM. |
| 503 | `planning_timeout`, `osrm_timeout` | Przekroczenie limitu czasu. |
| 503 | `osrm_rate_limited` | Odpowiedź 429 upstream przetłumaczona na 503. |
| 503 | `osrm_unavailable` | Błąd sieci albo 5xx upstream. |
| 503 | `osrm_invalid_response` | Wadliwe dane, niespójne odcinki, brak lub błędne kroki nawigacji. |
| 503 | `osrm_http_error` | Inny błąd HTTP/protokołu upstream. |

Poza brakiem konfiguracji błędy 503 planera zawierają nagłówek `Retry-After`
w sekundach i `detail.retry_after_s`. Przy braku znalezionego wariantu nie ma dowodu,
że żadna możliwa trasa nie istnieje — wyszukiwanie jest ograniczone.

Pomocniczy `/route` ma dodatkowo 404 `no_matching_category` z `available_categories`
oraz 404 `no_poi_in_radius` z `radius_m`, `nearest_poi`, `nearest_distance_m`,
`suggested_radius_m`. Sugestia nie zwiększa promienia automatycznie.

## Oddzielne demo

Endpointy `/demo/*` należą do osobnej aplikacji i nie są rejestrowane w głównym API.
Ich kontrakt utrzymujemy wyłącznie w
[hardcoded-zgloszenie/README.md](../hardcoded-zgloszenie/README.md).
