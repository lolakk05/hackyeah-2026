# User story i granice produktu

[Spis dokumentacji](README.md). Tutaj utrzymujemy wymagania i kryteria ukończenia.
Nazwy pól, przykłady requestów i limity należą do [API.md](API.md).

## Historia użytkownika

Użytkownik chce wykorzystać dostępny czas na zwiedzanie Krakowa. W zewnętrznej
aplikacji wybiera długość podróży, początek w bieżącej lokalizacji albo na Rynku
i niezależne preferencje: poruszanie się na wózku oraz unikanie schodów.

Aplikacja przesyła wybór do Route Finder. Serwis zwraca trasę z kolejnymi POI,
przewidywanym czasem oraz danymi nawigacyjnymi. Aplikacja przedstawia punkty jako
roadmapę i pokazuje trasę na mapie. Użytkownik odwiedza miejsca, oznacza postęp,
zdobywa punkty i rozwija poziom w systemie aplikacji.

## Odpowiedzialności

| Część produktu | Odpowiada za |
|---|---|
| Route Finder | Dobór POI, kolejność odwiedzania, budżet podróży, komunikację z routingiem i odpowiedź z danymi trasy. |
| Zewnętrzna aplikacja | Formularz, GPS, roadmapę, rysowanie mapy, prezentację manewrów i interakcję z użytkownikiem. |
| Warstwa postępu aplikacji | Konta, historię podróży, odhaczanie miejsc, punkty i levele. |
| Backend routingu i dane mapowe | Przebieg po sieci oraz ograniczenia odcinków dla wybranego sposobu poruszania się. |

W tym repozytorium powstaje wyłącznie API. Nie ma frontendu produktu ani
mechanizmu ciągłego śledzenia lokalizacji. Zwrócenie planu kończy dane żądanie;
prowadzenie użytkownika na żywo jest zadaniem klienta.

## Kryteria akceptacji

| Wymaganie | Co uznajemy za poprawne zachowanie |
|---|---|
| Wybór czasu | Plan mieści się w budżecie przemieszczania; krótszy wynik jest jawnie oznaczony. Zwiedzanie i postoje są osobnym czasem. |
| Start od użytkownika | Trasa uwzględnia przejście od początku dopasowanego do sieci do pierwszej atrakcji; przesunięcie GPS do sieci jest ujawnione. |
| Domyślny start | Po wyborze Rynku użytkownik otrzymuje jednoznaczny początek planu. |
| Preferencje dostępności | Używany jest odpowiedni graf; brak jego konfiguracji nie powoduje cichego zastosowania zwykłej trasy. Wózek implikuje unikanie schodów. |
| Więcej atrakcji | Planer potrafi uwzględniać dodatkowe POI w ramach budżetu i opublikowanych limitów. Maksimum nie oznacza gwarantowanej liczby. |
| Roadmapa | Kolejność miejsc i ich identyfikatory są jednoznaczne; każde miejsce jest powiązane z punktem sieci. |
| Mapa i prowadzenie | Wynik zawiera ciągłą trasę, odcinki oraz manewry pozwalające klientowi prowadzić po kolejnych etapach. |
| Uczciwy komunikat | Brak trasy, awaria i niewystarczająca konfiguracja są odróżniane od sukcesu. Nie deklarujemy terenowo potwierdzonej dostępności. |

## Stan realizacji i granice zapewnień

Obecny kod obsługuje nowe warianty startu, obie flagi, rozszerzony limit POI,
odcinek dojścia oraz dane do nawigacji. Parametry i odpowiedzi są opisane w
[kontrakcie](API.md); nie są już jedynie propozycją przyszłych pól.

Obsługa preferencji dostępności jest **zależna od infrastruktury**. Domyślne
wdrożenie nie zawiera przygotowanych grafów bez schodów i dla wózka. Do ukończenia
tego elementu od strony operacyjnej potrzebne są ich przygotowanie, podłączenie
i testy na rzeczywistych barierach — szczegóły w [utrzymaniu](OPIS_API.md).
Sama obecność flag i przejście testów z mockami nie potwierdzają tej części user story.

Dane mapowe mogą nie wskazywać wejścia do budynku, nawierzchni, krawężnika lub
czasowej blokady. Nie traktujemy geometrycznego dotarcia do waypointu jako dowodu
odwiedzenia atrakcji ani gwarancji jej dostępności. To ograniczenia wyniku,
które klient powinien komunikować zgodnie z [integracją frontendu](FRONTEND_INTEGRATION.md).

Symulacja z folderu `hardcoded-zgloszenie` pozostaje osobnym scenariuszem demonstracyjnym.
Nie stanowi wdrożenia zgłoszeń przeszkód dla całego miasta ani dowodu działania
ograniczonych profili głównego planera.
