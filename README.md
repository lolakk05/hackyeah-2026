# Spacer.io - HackYeah 2026

**Zwiedzaj Kraków bez barier.** Aplikacja mobilna, która układa spacer po mieście na zadany czas,
pokazuje, które miejsca są dostępne dla osób na wózku i z ograniczoną mobilnością, i zamienia
zwiedzanie w grę: za odwiedziny i zgłoszenia dostępności dostajesz XP, poziomy i monety
wymienialne na zniżki w komunikacji miejskiej.

Kategoria: **Smart City**.

## Co robi

- **Planer spaceru.** Wybierasz czas (5–360 min) i start (Rynek albo Twoja lokalizacja), a serwis dobiera
  miejsca (start, przystanki pośrednie, cel), kolejność zwiedzania i trasę pieszą ([Route Finder](services/route-finder/README.md)).
- **Mapa 3D i roadmapa.** Trasa na mapie z modelami 3D znanych zabytków (Sukiennice, Bazylika Mariacka,
  Barbakan, Wawel) i kartami miejsc ze zdjęciami, opisem i informacjami o dostępności.
- **Profile dostępności.** Wózek, brak schodów, osoby niewidome i słabowidzące (audioprzewodniki),
  osoby niesłyszące i słabosłyszące (pętle indukcyjne, opisy tekstowe).
- **Crowdsourcing.** Po dotarciu do miejsca aplikacja pyta tak/nie o dostępność (np. czy jest podjazd).
  Za takie odpowiedzi użytkownik dostaje najwięcej XP, a serwer ma je przyjmować jako zgłoszenia (`POST /reports`).
- **Grywalizacja.** XP, poziomy, ranking, osiągnięcia i nagrody (zasady poniżej).
- **Przewodnik AI.** Lokalny model (Ollama) odpowiada po polsku na pytania o zabytki Krakowa.
- **Panel administratora** ("Spacer.io Kraków"). Mapa miejsc, edycja ich danych i dostępności.
- **Zdjęcia miejsc.** Skrypty zbierające zdjęcia z Wikimedia Commons razem z autorem i licencją.


| Część | Katalog | Technologie | Domyślny port |
|---|---|---|---|
| Aplikacja mobilna | [`frontend/`](frontend) | Expo SDK 57, React Native 0.86, Expo Router, three.js | Metro 8081 |
| Panel administratora | [`frontend-web/`](frontend-web) | React 19, Vite, TypeScript | Vite (domyślnie 5173) |
| Główne API | [`services/api/`](services/api) | NestJS 11, Prisma 7, PostgreSQL, Better Auth | 3000 |
| Planer tras | [`services/route-finder/`](services/route-finder) | FastAPI, SciPy KDTree, OSRM | 8000 |
| Przewodnik AI | [`services/ai-service/`](services/ai-service) | FastAPI, Ollama | 8001 |
| Zdjęcia i geokodowanie | [`services/photo-scraper/`](services/photo-scraper) | Python, httpx | n/d |

## Wymagania

- Node.js 20+ i npm
- Python 3.12+ oraz [`uv`](https://docs.astral.sh/uv/) (Route Finder, serwis AI)
- Docker (tylko dla lokalnej bazy PostgreSQL)
- [Ollama](https://ollama.com/) z modelem `llama3.2` (tylko dla przewodnika AI)
- Telefon z [Expo Go](https://expo.dev/go) w tej samej sieci Wi-Fi co komputer albo emulator

## Szybki start

W repo nie ma jednego `docker-compose.yml` dla całości. Każdą część uruchamia się osobno,
a do działania aplikacji wystarczy **Route Finder**.

### 1. Route Finder (port 8000)

```bash
cd services/route-finder
uv sync --group dev
uv run python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Swagger: <http://127.0.0.1:8000/docs>. Serwis korzysta z publicznego OSRM, więc potrzebuje internetu
i trzyma limit 1 zapytania na sekundę. Uruchamiaj **jeden worker**.

### 2. Aplikacja mobilna

```bash
cd frontend
npm install
cp .env.example .env     # ustaw EXPO_PUBLIC_API_URL na adres IP komputera w LAN, np. http://192.168.0.12:8000
npx expo start -c
```

Zeskanuj kod QR w Expo Go. Nie używaj `localhost`, bo telefon to inne urządzenie. Bez `EXPO_PUBLIC_API_URL`
aplikacja działa na danych demonstracyjnych. Adres jest wczytywany przy starcie, więc po zmianie
`.env` uruchom `npx expo start -c`.

### 3. Główne API i baza (port 3000)

```bash
docker compose -f services/api/docker-compose.yml up -d     # PostgreSQL 15: user/password/mydb
cd services/api
cp .env.example .env                                        # DATABASE_URL pasuje do powyższej bazy
npm ci
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

Swagger: <http://localhost:3000/api/docs>. Konta, miejsca, osiągnięcia i zgłoszenia są trzymane
w PostgreSQL (schemat: [`prisma/schema.prisma`](services/api/prisma/schema.prisma)).

### 4. Panel administratora

```bash
cd frontend-web
npm install
npm run dev
```

Adres API ustawisz w `frontend-web/.env.local` (`VITE_API_URL=http://localhost:3000`). Szczegóły i logowanie:
[`frontend-web/README.md`](frontend-web/README.md).

### 5. Przewodnik AI (port 8001)

```bash
ollama pull llama3.2
cd services/ai-service
uv sync --group dev
uv run uvicorn main:app --reload --port 8001
```

```bash
curl -X POST http://127.0.0.1:8001/guide -H 'Content-Type: application/json' \
  -d '{"question":"Czym są Sukiennice?"}'
```

Zmienne `OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_SECONDS` serwis czyta ze środowiska powłoki
(plik `.env` nie jest wczytywany automatycznie). Porty 8000 i 8001 są różne, żeby oba serwisy mogły działać naraz.

### 6. Zdjęcia miejsc (opcjonalnie)

```bash
cd services/photo-scraper
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python geocode.py --input krakow_pois.json     # współrzędne dla listy POI -> miejsca.json
python scraper.py --source file --input miejsca.json
```

Zasady doboru zdjęć, atrybucja i opcje: [`services/photo-scraper/README.md`](services/photo-scraper/README.md).

## Grywalizacja

Zasady żyją w [`frontend/src/game/progression.ts`](frontend/src/game/progression.ts), a backend ma je liczyć tak samo.

| Zdarzenie | XP |
|---|---|
| Odpowiedź tak/nie o dostępności | 50 |
| Zgłoszenie problemu (zablokowana droga, zepsuta winda) | 20 |
| Dotarcie do miejsca | 5 + 1 za każde 100 m drogi |
| Ukończenie trasy | 20 + 10 za każdy km |

Każdy punkt XP daje 0,5 monety. Poziom 2 wymaga 100 XP, a każdy kolejny o 50 XP więcej (łącznie 100, 250, 450, 700, 1000…).
Monety wymienia się na nagrody (zniżki w komunikacji miejskiej). Kody w trybie demo zaczynają się od `DEMO-` i nie są prawdziwymi biletami.

## Dokumentacja

| Dokument | Zawartość |
|---|---|
| [`services/route-finder/docs/`](services/route-finder/docs/README.md) | API planera, opis algorytmu, dane POI, integracja z frontendem, user story |
| [`frontend/src/api/README.md`](frontend/src/api/README.md) | Kontrakt aplikacji z backendem: trasy, konta, XP, ranking, nagrody, kody błędów |
| [`frontend-web/README.md`](frontend-web/README.md) | Panel administratora |
| [`services/photo-scraper/README.md`](services/photo-scraper/README.md) | Geokodowanie i zdjęcia z Wikimedia Commons |

## Testy

```bash
cd services/route-finder && uv run pytest -q && uv run ruff check .
cd services/ai-service    && uv run pytest -q
cd services/photo-scraper && python -m pytest -q
cd services/api           && npm test
cd frontend               && npx tsc --noEmit
```

Testy Route Finder i serwisu AI używają atrap HTTP (bez sieci i bez Ollamy).

## Znane ograniczenia

- Planer opiera się na publicznym OSRM (limit 1 zapytanie/s) i lokalnym pliku POI z centrum Krakowa
  (do 1,5 km od Rynku). Przy przeciążeniu OSRM zwraca 503.
- Dostępność miejsc pochodzi z danych OpenStreetMap i zgłoszeń użytkowników, a nie z audytu na miejscu.
  Aplikacja nie deklaruje terenowo potwierdzonej dostępności.
- Przewodnik AI działa na małym lokalnym modelu i może się mylić. Prompt każe mu nie zmyślać faktów
  i nie podawać cen ani godzin otwarcia.
- Zdjęcia z Wikimedia Commons mają licencje CC BY / CC BY-SA, więc wymagają podania autora (dane są w `output/photos.json`).
  Dane map: © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).
- `auth.ts` w API importuje klienta Prisma z `generated/prisma`, a `schema.prisma` nie ustawia `output`. Jeśli `npm run start:dev`
  zgłosi brak tego modułu, dodaj `output = "../generated/prisma"` w bloku `generator` i uruchom `npx prisma generate`.
