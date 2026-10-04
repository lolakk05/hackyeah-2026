# Panel administratora — dostępny Kraków

Panel webowy do przeglądania miejsc na mapie Krakowa, edycji ich danych i
sprawdzania zgłoszeń o dostępności dla osób poruszających się na wózku.

## Uruchomienie

W osobnych terminalach, z katalogów `services/api` i `frontend-web`:

```bash
npm install
npm run start:dev
```

```bash
npm install
npm run dev
```

Panel domyślnie łączy się z API pod `http://localhost:3000`. Inny adres można
ustawić przez zmienną `VITE_API_URL`, np. w pliku `.env.local`:

```env
VITE_API_URL=http://localhost:3000
```

## Dane i zgłoszenia

Lista miejsc korzysta z identyfikatorów używanych przez aplikację mapową.
Edycja nazwy, opisu, współrzędnych i informacji o dostępności jest zapisywana
przez `PATCH /admin/landmarks/:id`. Aplikacja mobilna może pobrać te same dane
przez `GET /landmarks` po ustawieniu `EXPO_PUBLIC_API_URL`; domyślnie korzysta
jednak z własnych danych demonstracyjnych.

Zgłoszenia z aplikacji są przyjmowane przez `POST /reports`. Podsumowanie
zlicza odpowiedzi kategorii `wheelchair` dla miejsca docelowego zgłoszenia,
oddzielnie dla odpowiedzi dostępne/niedostępne. Zgłoszenia oraz edycje są
przechowywane w pamięci procesu API i wracają do danych demonstracyjnych po
jego ponownym uruchomieniu. Do wdrożenia produkcyjnego należy podłączyć trwałą
bazę danych i autoryzację administratora.
