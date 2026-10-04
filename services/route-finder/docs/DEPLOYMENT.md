# Docker i wdrożenie na VPS

[Spis dokumentacji](README.md). Ten plik opisuje kontener i jego obsługę.
Ustawienia samego API znajdują się w [OPIS_API.md](OPIS_API.md).

Komendy pierwszego uruchomienia, testy HTTP, aktualizacje i rozwiązywanie problemów
są w [docker.md](../docker.md). Ten dokument utrzymuje szczegóły konfiguracji.
API wymaga wyjściowego HTTPS do OSRM. Budowanie wymaga dostępu do rejestrów
Docker Hub/GHCR i PyPI. Kontener nie pobiera zależności ani POI przy uruchamianiu.

## Konfiguracja kontenera

Compose wczytuje opcjonalny `.env` i przekazuje go do kontenera. Plik nie trafia
do obrazu. Zmienne środowiskowe są odczytywane przy starcie aplikacji.

| Zmienna Compose | Domyślnie | Działanie |
|---|---|---|
| `ROUTE_FINDER_BIND` | `0.0.0.0` | Adres hosta udostępniający API. |
| `ROUTE_FINDER_PORT` | `8000` | Port hosta; wewnątrz kontenera zawsze 8000. |
| `ROUTE_FINDER_MEMORY_LIMIT` | `512m` | Twardy limit pamięci kontenera; dodatkowy swap wyłączony. |

Compose ustawia `CACHE_SIZE=32`, podczas gdy bez Compose aplikacja domyślnie
przechowuje do 128 planów. Pozostałe ustawienia API, w tym CORS i URL OSRM,
opisuje [konfiguracja serwisu](OPIS_API.md). Dla profili dostępności nie wpisuj
pustych URL ani zwykłego backendu pieszego; zostaw je nieustawione do czasu
podłączenia właściwych grafów.

Dla frontendu działającego przez HTTPS wystaw API również przez HTTPS za reverse
proxy. Jeśli proxy działa bezpośrednio na hoście VPS, ustaw
`ROUTE_FINDER_BIND=127.0.0.1`. Proxy w osobnym kontenerze powinno korzystać ze
wspólnej sieci Docker i adresu `route-finder:8000`. Konfiguracja domeny i TLS
należy do infrastruktury VPS. CORS musi odpowiadać originowi frontendu.

## Pamięć, proces i dane

Obraz uruchamia jeden proces Uvicorn, bez reloadu. Biblioteki numeryczne mają
ograniczoną liczbę wątków. Nie zwiększaj liczby workerów ani replik przy publicznym
OSRM: limity zapytań i cache są lokalne dla procesu.

Limit 512 MB jest punktem startowym dla VPS z 2 GB RAM, nie pomiarem zapotrzebowania
pod każdym obciążeniem. Monitoruj `docker stats`; pozostałe usługi i system też
potrzebują pamięci. Budowanie obrazu nie podlega limitowi pamięci usługi Compose.

Kontener działa jako użytkownik 10001, ma system plików tylko do odczytu oraz
mały tymczasowy `/tmp`. Dane POI są częścią obrazu i są ładowane do RAM przy starcie.
Nie wymaga bazy danych ani wolumenów. Cache znika po restarcie. Zmiana GeoJSON
w repo wymaga przebudowania obrazu. Osobne demo `hardcoded-zgloszenie` nie jest
kopiowane ani uruchamiane.

## Cykl życia i diagnostyka

Restart po awarii procesu i po restarcie Dockera zapewnia `unless-stopped`.
Samo oznaczenie `unhealthy` nie powoduje automatycznego restartu. Healthcheck
działa co 30 s; logi mają rotację 3 × 10 MB. Compose daje procesowi do 60 s na
zamknięcie. Stan `healthy` potwierdza lokalną gotowość API, nie dostępność OSRM.

## Pliki wdrożenia

- `Dockerfile`: instalacja przypiętych zależności z `uv.lock` w osobnym etapie,
  następnie kopiowanie runtime bez uv i narzędzi developerskich. Używa gotowych
  wheels NumPy/SciPy; nie kompiluje ich na VPS.
- `.dockerignore`: dopuszcza do kontekstu budowania tylko wymagane pliki.
  Nowy moduł runtime dodaj również tutaj i do instrukcji `COPY` w Dockerfile.
- `compose.yaml`: porty, limity zasobów, restart, logowanie i `.env`.
- `.env.example`: przykładowa konfiguracja do skopiowania.

Wzorce budowania: [uv w Dockerze](https://docs.astral.sh/uv/guides/integration/docker/).
Znaczenie opcji runtime: [referencja usług Compose](https://docs.docker.com/reference/compose-file/services/).
