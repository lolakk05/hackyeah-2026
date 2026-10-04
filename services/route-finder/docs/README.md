# Dokumentacja Route Finder

Dokumenty opisują aktualny kod API, które w OpenAPI deklaruje wersję `0.3.0`.
Każdy temat ma jedno miejsce utrzymania; pozostałe pliki odsyłają do niego.

| Dokument | Odbiorca i zakres | Tutaj aktualizuj |
|---|---|---|
| [USER_STORY.md](USER_STORY.md) | Produkt: przepływ użytkownika, odpowiedzialności i kryteria ukończenia. | Wymagania i stan realizacji. |
| [API.md](API.md) | Integrator: endpointy, walidacja, przykłady JSON, modele odpowiedzi i błędy. | Kontrakt HTTP i limity pól. |
| [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md) | Frontend: ekrany, stany, mapa, roadmapa, prowadzenie i prezentacja błędów. | Zachowanie klienta. |
| [OPIS_API.md](OPIS_API.md) | Backend i utrzymanie: architektura, algorytmy, konfiguracja, uruchomienie i pliki. | Obliczenia oraz ustawienia procesu. |
| [DATA.md](DATA.md) | Dane: źródło POI, zakres eksportu, transformacje, odświeżanie i licencja. | Informacje o zbiorze. |

## Zasady utrzymania

- Pełne requesty, tabele pól, wartości domyślne i kody błędów są tylko w `API.md`.
- Zmienne środowiskowe i polecenia uruchomienia są tylko w `OPIS_API.md`;
  import POI jest opisany w `DATA.md`.
- Opis ekranu może wskazać nazwę pola, ale odsyła do kontraktu po jego zakres i typ.
- Zmiana funkcjonalności wymaga aktualizacji dokumentu odpowiedzialnego za ten temat,
  a nie kopiowania całego opisu do pozostałych plików.
- Odróżniamy obsługę w kodzie od skonfigurowanego i sprawdzonego wdrożenia.

## Dokumenty poza tym katalogiem

- [README serwisu](../README.md): wejście do projektu.
- [AGENTS.md](../AGENTS.md): zasady pracy nad repozytorium.
- [API symulowanych zgłoszeń](../hardcoded-zgloszenie/README.md): osobny kontrakt demo.

## Status zapisanego przykładu

[example-plan.json](example-plan.json) jest **historyczną odpowiedzią poprzedniego
kontraktu**. Nie zawiera wszystkich obecnych pól, w szczególności `start`, `stops`,
`accessibility`, `bbox` i rozszerzonych odcinków nawigacji. Nie używaj go jako
kompletnego mocka aktualnego `PlanResponse`. Zawiera też POI usunięte przy selekcji
atrakcji centrum opisanej w `DATA.md`. Aktualne typy opisuje `API.md` i
generowany `/openapi.json`; sposób pozyskania nowej odpowiedzi podaje `OPIS_API.md`.
