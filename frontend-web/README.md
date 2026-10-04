# Panel webowy — Spacer.io Kraków

Panel webowy pobiera miejsca z usługi API i pozwala edytować dane obsługiwane
przez jej punkt `/places`.

## Uruchomienie lokalne

1. Uruchom backend z `services/api` albo użyj skonfigurowanego tunelu:

   ```bash
   cd services/api
   npm install
   ```

   Skopiuj `.env.example` do `.env`, uruchom lokalną bazę poleceniem
   `docker compose up -d db`, ustaw `DATABASE_URL` dla tej bazy i uruchom API
   poleceniem `npm run start:dev`. API domyślnie działa pod adresem
   `http://localhost:3000`.

2. W drugim terminalu uruchom panel:

   ```bash
   cd frontend-web
   npm install
   npm run dev
   ```

Podczas pracy Vite przekazuje logowanie do `/api/auth/`, a operacje na miejscach
pod `/places` na serwerze `https://easeful-sulphate-lethargic.ngrok-free.dev`.
Panel loguje się przez
istniejące konto (e-mail i hasło); API wymaga zalogowania do zarządzania
miejscami. Jeśli chcesz użyć lokalnego backendu albo innego adresu, ustaw
`VITE_API_URL` w
`frontend-web/.env.local`:

```env
VITE_API_URL=https://easeful-sulphate-lethargic.ngrok-free.dev
```

Po zmianie adresu uruchom ponownie serwer panelu.

W środowisku produkcyjnym serwer WWW powinien przekazywać zapytania `/api/*` do
NestJS API.

## Obsługa miejsc

Panel pobiera miejsca przez `GET /places` i zapisuje zmiany przez
`PATCH /places/:id`. Nowe miejsce można dodać przez `POST /places`. Edytowalne są
dane dostępne w tym zasobie: nazwa, opisy, adres, cena, czas zwiedzania,
położenie, zdjęcia oraz podstawowe informacje o dostępności. W formularzu adres
i współrzędne są wzajemnie uzupełniane przez Nominatim; wyszukiwanie uruchamia
się po opuszczeniu edytowanego pola lub wybraniu punktu na mapie.
Geokodowanie © OpenStreetMap contributors.

Usługa nie udostępnia zestawienia zgłoszeń dostępności w tym zasobie; widok
„Zgłoszenia” informuje o tym zamiast wyświetlać zmyślone liczniki.
