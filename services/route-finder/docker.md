# Uruchomienie Route Finder na VPS

Instrukcja dla osoby wdrażającej API. Polecenia wykonuj na VPS z Linuksem przez
SSH. Usługa zawiera API i bazę atrakcji Krakowa; OSRM działa na zewnętrznym serwerze.

## 1. Przygotuj serwer

Potrzebujesz Git, curl oraz Docker Engine z pluginem Docker Compose **2.24+**.
Python i uv są już w procesie budowania obrazu — nie instaluj ich na VPS.
Jeśli Dockera jeszcze nie ma, użyj oficjalnej instrukcji dla swojego systemu:
[Ubuntu](https://docs.docker.com/engine/install/ubuntu/) lub
[Debian](https://docs.docker.com/engine/install/debian/).

```bash
ssh UZYTKOWNIK@ADRES_VPS
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
```

Zastąp `UZYTKOWNIK` i `ADRES_VPS` prawdziwymi wartościami. Dalsze polecenia
zakładają konto z dostępem do `sudo`.

## 2. Pobierz kod

```bash
git clone https://github.com/lolakk05/hackyeah-2026.git
cd hackyeah-2026
git fetch origin
git switch NAZWA_GALEZI
cd services/route-finder
ls Dockerfile compose.yaml .env.example krakow_pois.geojson
```

`NAZWA_GALEZI` zastąp gałęzią zawierającą zatwierdzone i wypchnięte pliki Dockera;
po ich scaleniu może to być `main`. Dla prywatnego repo potrzebny jest dostęp
do GitHub. Jeśli repo jest już sklonowane, przejdź do niego zamiast klonować drugi raz.
**Wszystkie dalsze polecenia wykonuj z `services/route-finder`.**

## 3. Ustaw konfigurację

Przy pierwszym wdrożeniu:

```bash
cp -n .env.example .env
nano .env
```

Domyślne ustawienia wystarczą do startu na porcie 8000. Na VPS z 2 GB RAM zostaw
limit kontenera 512 MB i cache 32 planów. Jeśli port jest zajęty, zmień
`ROUTE_FINDER_PORT` i używaj nowego portu również w poniższych adresach.
`CORS_ALLOW_ORIGINS` może zawierać adres frontendu, np. `https://app.example.com`.
Pełne znaczenie ustawień i wariant HTTPS opisuje [konfiguracja wdrożenia](docs/DEPLOYMENT.md).

## 4. Zbuduj i uruchom

```bash
sudo docker compose config --quiet
sudo docker compose up -d --build --wait --wait-timeout 120
sudo docker compose ps
```

Pierwsze budowanie pobierze obrazy i zależności. Poczekaj na stan `healthy`.
Opcja `-d` zostawia API uruchomione po zamknięciu SSH. Kontener ma automatyczny
restart po awarii procesu i restarcie Dockera; nie uruchamiaj dodatkowych workerów.

## 5. Sprawdź API

Na VPS:

```bash
curl --fail http://127.0.0.1:8000/health
curl --fail-with-body http://127.0.0.1:8000/routes/plan \
  -H 'Content-Type: application/json' \
  -d '{"duration_minutes":30,"start_mode":"market","language":"pl"}'
```

Pierwsze żądanie powinno zwrócić `{"status":"ok","poi_count":116}` dla obecnej
bazy. Drugie zwraca plan, POI i geometrię; wymaga dostępnego OSRM.

Z komputera/telefonu otwórz `http://ADRES_VPS:8000/docs`. Domyślnie API jest
publiczne na porcie TCP 8000. Sprawdź dostęp do niego w panelu sieciowym operatora
VPS. Dla frontendu HTTPS użyj domeny i reverse proxy z TLS zgodnie z dokumentacją
wdrożenia — sam CORS nie umożliwia wywoływania HTTP ze strony HTTPS.

## 6. Logi, aktualizacja i zatrzymanie

```bash
# Logi; Ctrl+C kończy ich podgląd, nie zatrzymuje API.
sudo docker compose logs --tail=100 -f route-finder
# Faktyczne zużycie pamięci kontenerów.
sudo docker stats --no-stream
```

Aktualizacja kodu i bazy POI na aktualnie wybranej gałęzi:

```bash
git pull --ff-only
sudo docker compose up -d --build --wait --wait-timeout 120
```

Po samej zmianie `.env` również wykonaj powyższe `up`; `restart` nie wczytuje
nowej konfiguracji kontenera. Okresowo odśwież bazowy obraz Pythona:

```bash
sudo docker compose build --pull
sudo docker compose up -d --wait --wait-timeout 120
```

Zatrzymanie usługi i usunięcie jej kontenera oraz sieci:

```bash
sudo docker compose down
```

## Gdy coś nie działa

| Objaw | Co sprawdzić |
|---|---|
| `Cannot connect to the Docker daemon` | `sudo systemctl status docker`; uruchom usługę Docker. |
| `port is already allocated` | Zmień port hosta w `.env` i ponownie wykonaj `up`. |
| Działa lokalnie na VPS, nie działa z zewnątrz | Adres VPS, opublikowany port i reguły sieciowe operatora; dla dostępu bezpośredniego `ROUTE_FINDER_BIND=0.0.0.0`. |
| `unhealthy` lub pętla restartów | Logi kontenera; sprawdź konfigurację i obecność GeoJSON. |
| `/health` daje 200, plan daje 503 | Odczytaj `detail.code`; dla problemów OSRM sprawdź wyjściowy HTTPS i respektuj `Retry-After`. |
| Przeglądarka pokazuje 405 | Plan wymaga POST z JSON; wpisanie `/routes/plan` w pasek adresu wysyła GET. |
| Proces znika przy obciążeniu | Sprawdź `docker stats`, logi i wolną pamięć VPS; limit kontenera opisuje konfiguracja wdrożenia. |

Opis endpointów i pozostałych błędów: [docs/API.md](docs/API.md).
