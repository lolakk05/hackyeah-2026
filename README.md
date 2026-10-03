# 🚀 HackYeah 2026 — Setup Guide

## Wymagania
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — zainstalowany i uruchomiony (zielona ikona wieloryba w trayu)
- [Node.js 20+](https://nodejs.org/) — do frontendu i API (lokalnie)
- [Git](https://git-scm.com/)

---

## 1. Klonowanie repo

```bash
git clone https://github.com/<WASZ-ORG>/hackyeah-2026.git
cd hackyeah-2026
```

---

## 2. Odpalenie backendu (Docker)

```bash
docker compose up -d
```

To odpali **wszystko** jedną komendą:

| Serwis | URL | Info |
|---|---|---|
| 🟢 **NestJS API** | http://localhost:3000 | Główny backend |
| 🤖 **FastAPI AI** | http://localhost:8000 | Serwis AI/ML |
| 📄 **Swagger (AI)** | http://localhost:8000/docs | Dokumentacja API AI |
| 🐘 **PostgreSQL** | `localhost:5432` | user: `postgres`, pass: `hackyeah`, db: `hackyeah` |
| ⚡ **Redis** | `localhost:6379` | Cache / kolejki |
| 📦 **MinIO (S3)** | http://localhost:9001 | Storage zdjęć — login: `minioadmin` / `minioadmin` |

---

## 3. Frontend (React Native)

```bash
cd frontend
npm install
npx expo start
```

Skanuj QR kod w terminalu aplikacją **Expo Go** (Android/iOS).

---

## 4. Przydatne komendy

```bash
# Status kontenerów
docker compose ps

# Logi na żywo (wszystkie serwisy)
docker compose logs -f

# Logi konkretnego serwisu
docker compose logs -f api
docker compose logs -f ai-service

# Restart jednego serwisu
docker compose restart api

# Zatrzymanie wszystkiego
docker compose down

# Nuclear option — zatrzymaj + usuń dane (bazy, redis, minio)
docker compose down -v

# Przebuduj kontenery (po zmianie Dockerfile/dependencies)
docker compose up -d --build
```

---

## 5. Zmienne środowiskowe

Wszystko skonfigurowane w `docker-compose.yml` — **nie musicie tworzyć `.env`**.

Gdybyście chcieli nadpisać coś lokalnie, stwórzcie `docker-compose.override.yml` (jest w `.gitignore`).

---

## 6. Troubleshooting

**Docker nie działa / "daemon is not running"**
→ Uruchomcie Docker Desktop i poczekajcie na zieloną ikonę wieloryba

**Port zajęty**
→ `docker compose down` i spróbujcie ponownie, albo zamknijcie apkę która używa tego portu

**Chcę przebudować od zera**
```bash
docker compose down -v
docker compose up -d --build
```

**Nie widzę zmian w kodzie**
→ Hot reload powinien działać automatycznie. Jeśli nie — `docker compose restart <serwis>`
