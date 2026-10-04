# Integracja aplikacji klienckiej

[Spis dokumentacji](README.md). Ten dokument określa **zachowanie frontendu**:
ekrany, stany, mapę i prowadzenie. Typy, zakresy, przykłady JSON i kody błędów
utrzymujemy wyłącznie w [API.md](API.md). Kontekst produktu: [USER_STORY.md](USER_STORY.md).

## Przygotowanie połączenia

Adres bazowy API trzymaj w konfiguracji aplikacji. Backend obsługuje CORS,
przeglądarkowe preflight `OPTIONS` oraz odczyt `Retry-After`. Do tego serwisu wysyłaj
zapytania bez cookies (`credentials: "omit"`); nie wymaga sesji użytkownika.
Dozwolone originy ustawia backend zgodnie z [konfiguracją](OPIS_API.md).
Origin zawiera protokół, host i port frontendu, bez ścieżki API.

```javascript
const response = await fetch(`${apiBase}/routes/plan`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "omit",
  body: JSON.stringify(formRequest),
});
const result = await response.json();
```

Zawartość `formRequest` określa [kontrakt](API.md). `no-cors` nie pozwala odczytać
odpowiedzi i nie rozwiązuje integracji. Otworzenie URL planera w pasku adresu
wykonuje GET, więc 405 jest wtedy poprawne. W DevTools → Network sprawdź metodę:
preflight OPTIONS powinien przejść, a właściwy request powinien być POST.
Jeśli OPTIONS wciąż zwraca 405 po wdrożeniu poprawki, sprawdź adres serwisu,
uruchomioną wersję oraz czy proxy nie blokuje tej metody.

Po wejściu do formularza pobierz capabilities oraz kategorie. Capabilities służy
do ustawienia limitów kontrolek i dostępności opcji profilu. Włączona konfiguracja
nie jest gwarancją, że routing odpowie; nadal potrzebna jest obsługa błędów.

## Ekran „Zaplanuj podróż”

| Kontrolka | Powiązanie z API | Zachowanie klienta |
|---|---|---|
| Czas podróży | `duration_minutes` | Suwak/pole liczbowe; wyjaśnij, że chodzi o przemieszczanie, bez postojów. |
| Radio „Rynek / Moja lokalizacja” | `start_mode`, `user_location` | Przy GPS pobierz pozycję urządzenia; przy Rynku wyczyść lokalizację z payloadu. |
| Wybór „Polski / English” | `language` | Wysyłaj język aplikacji. Pokazuj zwrócone nazwy i ostrzeżenia; nazwy bez tłumaczenia mogą pozostać oryginalne. |
| Opcjonalnie „Wybierz miejsce” | `start_mode`, `start_poi_id` | Otwórz katalog; wstaw ID wybranego miejsca. |
| „Jeżdżę na wózku” | `wheelchair` | Pozwól wybrać tylko przy skonfigurowanym profilu dla wózka. |
| „Nie chcę schodów” | `avoid_stairs` | Bez wózka wymaga profilu bez schodów. Przy wózku pokaż, że jest uwzględniane automatycznie. |
| Kategoria | `category` | Etykiety można tłumaczyć; wysyłaj oryginalny klucz z listy kategorii. „Dowolne” pomija pole. |
| Maksymalna liczba przystanków | `max_intermediate_stops` | Użyj limitu z capabilities; to maksimum, a nie liczba gwarantowana. |
| Dopuszczalne skrócenie | `tolerance_percent` | Opcja zaawansowana; nie przedstawiaj jej jako zgody na dłuższą podróż. |
| Przycisk „Losuj inną trasę” | `randomize` | Wyślij dotychczasowe parametry z włączonym losowaniem; zachowaj start i preferencje. |

Request buduj jawnie z obsługiwanych pól. Nie wysyłaj całego stanu komponentu.
Puste pola opcjonalne pomijaj, liczby konwertuj z inputów, przełączniki wysyłaj jako
wartości logiczne. Przy zmianie trybu usuń dane poprzedniego startu. Nowy frontend
powinien korzystać z `user_location`, nie ze starszego aliasu.

Gdy użytkownik odmówi dostępu do lokalizacji lub GPS się nie powiedzie, pozostaw
wybór Rynku/katalogu. Nie zmieniaj startu automatycznie bez informacji.
Przy braku skonfigurowanego profilu wyłącz odpowiednią opcję z wyjaśnieniem.
Nie usuwaj zaznaczonej preferencji po błędzie, aby wymusić pozorny sukces.

## Okno wyboru POI

Katalog obsługuje tekst wyszukiwania, kategorię i paginację według
[kontraktu katalogu](API.md). Resetuj stronę po zmianie filtrów. Puste wyszukiwanie
pomijaj; parametry koduj jako query URL. Ogranicz częstotliwość zapytań podczas
pisania i ignoruj spóźnione wyniki poprzedniego tekstu.

Lista jest uporządkowana po ID, nie według odległości. Wybrany rekord zachowaj
razem z ID. Pusta lista to stan „Nie znaleziono miejsc”, a nie awaria serwisu.
Po wyborze POI planer może jeszcze odrzucić jego dostępność — sam katalog nie jest
listą zweryfikowanych wejść. Karta szczegółów korzysta z danych obiektu;
opcjonalne tagi i brak linku źródłowego nie powinny blokować renderowania.

## Oczekiwanie na wynik

Po sukcesie sprawdź `start.fallback_reason`. Dla `user_too_far_from_market`
pokaż komunikat z `warnings` o zmianie początku na Rynek. Rysuj trasę od
zwróconego `start.snapped_location`; nie dodawaj łącznika od GPS użytkownika.
Wyjaśnij, że pokazany czas nie obejmuje dotarcia na Rynek. Warunek zmiany startu
i znaczenie pól są opisane w [kontrakcie](API.md).

Przycisk planowania rozpoczyna jedno żądanie, kończące się planem albo błędem.
Zablokuj wielokrotne kliknięcia. Nie pokazuj procentowego postępu, którego backend
nie dostarcza, i nie odpytuj planera w pętli. Timeout klienta uzgodnij z limitem
serwera opisanym w [konfiguracji](OPIS_API.md), dodając zapas na sieć.

Zachowaj formularz i dotychczasową trasę do czasu otrzymania nowego wyniku.
Po zmianie danych formularza nie przypisuj spóźnionej odpowiedzi do nowego wyboru.
Cache jest zwykłym sukcesem; nie wymaga osobnego ekranu ani dodatkowego requestu.

Przycisk losowania uruchamia kolejne planowanie. Zachowaj poprzednią trasę do
otrzymania sukcesu i nie wysyłaj wielu losowań jednocześnie. Nowy wynik może
powtórzyć wcześniejsze miejsca; nie obiecuj użytkownikowi gwarantowanej unikalności.
Przy awarii pokaż błąd i pozostaw poprzednią trasę, bez przedstawiania jej jako
nowego losowania. Zasady cache i zakres pola określa [kontrakt](API.md).

## Roadmapa i podsumowanie podróży

Podstawą roadmapy jest tablica `stops`, w kolejności zwróconej przez API.
Wyświetl nazwę i kategorię z zagnieżdżonego POI. Nie sortuj punktów według nazwy
ani odległości i nie usuwaj miejsc tylko dlatego, że mają podobne nazwy.

Początek podróży i pierwsza atrakcja mogą być różnymi punktami. Pokaż osobno
miejsce rozpoczęcia z `start`, a następnie pierwsze miejsce do odwiedzenia.
Jeśli występuje odcinek dojścia, przedstaw go jako część podróży, nie dodatkowy POI.

Czas całości prezentuj z rzeczywistego wyniku, nie z wybranego budżetu. Przy
wyniku poza tolerancją pokaż, że plan jest krótszy, i umożliw zmianę parametrów.
Narastające czasy i dystanse w `stops` opisują dotarcie bez postojów; nie są
godzinami odwiedzin ani czasem spędzonym na zwiedzaniu.

Oznaczanie „odwiedzone”, historia, punkty i levele mają osobny stan klienta/usług
aplikacji. ID miejsca nie jest ID podróży. Route Finder nie otrzymuje zmian tego
stanu i nie potwierdza fizycznego odwiedzenia atrakcji.

## Rysowanie mapy

1. Narysuj `geometry` jako główną trasę. Dopasuj widok na podstawie `bbox`.
2. Dodaj markery POI z `stops`. Użyj powiązania `waypoint_index`, aby odnaleźć
   punkt trasy odpowiadający danemu miejscu.
3. Odróżnij marker obiektu od miejsca dopasowania do sieci. Różnica jest istotna
   np. dla punktu reprezentującego cały budynek — nie dorysowuj przez ścianę łącznika.
4. Dla początku pokaż wejściową pozycję i dopasowanie zgodnie z informacją `start`.
   Nie oznaczaj przesunięcia do sieci jako zweryfikowanej ścieżki.
5. Aktywny etap możesz wyróżnić przez jego `legs[i].geometry`.
6. Wyświetl atrybucję i informacje źródłowe według [DATA.md](DATA.md).

Kolejność współrzędnych, jednostki i przypadek jednopunktowego kroku przyjazdu
określa [kontrakt geometrii i nawigacji](API.md). Nie rysuj każdego kroku jako
oddzielnej linii bez sprawdzenia jego geometrii. Do pełnego podglądu używaj linii trasy.

## Prowadzenie między POI

Stan nawigacji klienta powinien wskazywać aktywny odcinek i aktywny krok w jego
tablicy `steps`. Powiązania odcinka z waypointami i docelowym POI pochodzą z odpowiedzi.

- Z `maneuver` zbuduj ikonę i tekst instrukcji. Zachowaj obsługę nieznanego typu
  manewru, zamiast przerywać prowadzenie. Nazwa ulicy może być pusta.
- Kolejny krok wybieraj na podstawie postępu wzdłuż geometrii aktywnego odcinka,
  kierunku ruchu i dokładności GPS. Sama odległość od dowolnego POI jest niewystarczająca
  przy powrotach, skrzyżowaniach i nakładających się fragmentach trasy.
- Przy słabym sygnale nie przeskakuj automatycznie przez wiele etapów; pozwól
  użytkownikowi sprawdzić i skorygować bieżący punkt.
- Nie oznaczaj zwiedzenia miejsca tylko dlatego, że GPS znalazł się przy waypointcie.
  Prowadzenie do punktu sieci i potwierdzenie odwiedzin to różne działania.
- Po zejściu z trasy pokaż możliwość ponownego planowania. Nowy plan od bieżącej
  lokalizacji może wybrać inne POI: obecne API nie przyjmuje listy pozostałych punktów
  i nie gwarantuje zachowania starej roadmapy.

Backend zwraca dane potrzebne do implementacji nawigacji, ale nie wykonuje ciągłego
map matching GPS, syntezy mowy, wykrywania zejścia z trasy ani utrzymywania sesji podróży.
Testy klienta muszą objąć te zachowania oraz realną jakość sygnału.

## Stany błędów w interfejsie

Pełne statusy i kody są w [API.md](API.md). Tutaj obowiązuje mapowanie na zachowanie UI:

| Rodzaj sytuacji | Reakcja aplikacji |
|---|---|
| Błąd konkretnego pola | Zaznacz kontrolkę wskazaną przez ścieżkę walidacji. |
| Sprzeczne dane startu | Komunikat nad sekcją startu, zachowanie pozostałych wyborów. |
| Brak pasującego startu/celu | Zaproponuj zmianę lokalizacji lub kategorii. |
| Brak wariantu w budżecie | Pozwól zmienić czas, start lub kategorię; nie twierdź, że żadna trasa nie istnieje. |
| Nieskonfigurowany profil | Wyjaśnij niedostępność tej opcji; odśwież capabilities. Bez automatycznego wyłączania flag. |
| Zajętość lub ograniczenie zapytań | Zastosuj wskazane oczekiwanie, pokaż możliwość ponowienia po jego upływie. |
| Awaria routingu | Zachowaj formularz i wcześniejszy wynik. |
| Brak odpowiedzi HTTP | Komunikat o połączeniu; nie przedstawiaj go jako braku atrakcji. |

Parser błędów musi rozróżniać listę walidacji od obiektu błędu domenowego. Brak
Retry-After nie oznacza gotowości do natychmiastowej pętli ponowień.
Skrócona, ale poprawna trasa jest stanem sukcesu z informacją, a nie ekranem błędu.

## Oddzielne funkcje i test integracyjny klienta

Pomocniczy endpoint najbliższej atrakcji ma inny model i może zwrócić oznaczone
oszacowanie linią prostą; klient nie może używać takiego wyniku do prowadzenia.
Szczegóły są w [kontrakcie](API.md).

Opcjonalna symulacja zgłoszeń jest osobną aplikacją i wymaga osobnego adresu bazowego
oraz adaptera odpowiedzi. Nie podstawiaj jej danych do głównego `PlanResponse`.
Jej jedyna referencja to [README demo](../hardcoded-zgloszenie/README.md).

Przed integracją sprawdź: przełączenie wszystkich trybów startu, brak GPS,
wybór dostępnego/niedostępnego profilu, wielopunktową roadmapę, odcinek dojścia,
zerowy krok przyjazdu, częściowe dane POI, krótszy wynik, opóźnioną odpowiedź,
awarię oraz ponowienie z odczekaniem. Przykłady body pochodzą z `API.md`;
status zapisanego wcześniej JSON-a jest opisany w [spisie dokumentacji](README.md).
