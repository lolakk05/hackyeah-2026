# Wybrane atrakcje ścisłego centrum Krakowa

[Spis dokumentacji](README.md). Tutaj utrzymujemy zakres zbioru, reguły selekcji,
pochodzenie i import. Modele HTTP są w [API.md](API.md), indeksowanie i wybór trasy
w [OPIS_API.md](OPIS_API.md).

## Aktualny zbiór

`krakow_pois.geojson` zawiera **116 POI** wybranych z wcześniejszych 3090 obiektów OSM.
Każdy zapisany punkt leży **najwyżej 1500 m od środka Rynku Głównego**:
`latitude=50.0617`, `longitude=19.9373`. Najdalszy punkt jest oddalony o około 1497,34 m.

| Kategoria | Liczba |
|---|---:|
| museum | 41 |
| place_of_worship | 45 |
| historic | 27 |
| theatre | 2 |
| cave_entrance | 1 |

Pozostają m.in. Sukiennice, Wawel, Bazylika Mariacka, Barbakan, Brama Floriańska,
Rynek Podziemny, Smok Wawelski i Smocza Jama. Nie ma kategorii parków, ogrodów,
przypadkowych galerii ani ogólnej kolekcji dzieł sztuki. Wybrane rozpoznawalne rzeźby
trafiają do `historic`, np. Smok i Eros spętany; ich oryginalne tagi OSM są zachowane.

Limit dotyczy **odległości sferycznej punktu POI**, nie długości spaceru. Nie ogranicza
pozycji użytkownika ani całej geometrii wyliczonej przez OSRM. Trasa może wychodzić
poza koło, mimo że jej atrakcje znajdują się wewnątrz.

## Reguły selekcji

Jedyną implementacją reguł jest [scripts/import_pois.py](../scripts/import_pois.py).
Selekcja ma wersję `central-attractions-v1` i obowiązuje zarówno przy pobieraniu
z Overpass, jak i czyszczeniu lokalnego GeoJSON.

1. Odrzuć współrzędne poza promieniem; sprawdź również centra poligonów i relacji.
   Żaden wyjątek redakcyjny nie może ominąć tego warunku.
2. Wymagaj niepustego `name:pl` lub `name`. Usuń obiekty z `access=private/no`,
   `foot=no`, `closed=yes`, `disused=yes`, `abandoned=yes` lub `demolished=yes`.
3. Wyklucz parki, ogrody, rezerwaty, malowidła, graffiti oraz tablice pamiątkowe.
4. Zachowaj wybrane rodzaje obiektów:
   - muzea z odnośnikiem `wikidata` lub `wikipedia` oraz jawnie wskazane wyjątki;
   - świątynie z takim odnośnikiem i dodatkowym oznaczeniem zabytku, atrakcji,
     katedry lub synagogi;
   - zamki, bramy, wieże, ruiny i stanowiska archeologiczne z odnośnikiem;
   - historyczne budynki oznaczone jednocześnie jako atrakcja i obiekt dziedzictwa;
   - pomniki z wybranymi identyfikatorami `MONUMENT_WIKIDATA`;
   - konkretne atrakcje z `CURATED_POIS`, m.in. Sukiennice, Smok, dwa teatry i Smocza Jama.
5. Usuń powtórzone ID. Scal bliskie reprezentacje tego samego miejsca: wspólny
   `wikidata`/`wikipedia` do 100 m albo ta sama nazwa do 50 m. Preferuj obiekt
   budynku, następnie relację. Oddalone oddziały i odrębne wystawy pozostają osobne.

W pierwszym czyszczeniu odrzucono 2064 obiekty poza promieniem, 909 niespełniających
selekcji i jeden dodatkowy marker Wawelu. Kategorie są nadawane ponownie na podstawie
tagów; stara kategoria nie pozwala obejść filtrów.

Odnośnik do Wikipedii/Wikidanych jest sygnałem pomocniczym, a nie obiektywną oceną
atrakcyjności. To selekcja oparta na jawnych regułach i wyjątkach, nie lista wszystkich
atrakcji ani ranking popularności. Aby dopuścić ważne miejsce z niepełnymi tagami,
dodaj wpis do `CURATED_POIS` i odpowiedni test. Nie rozszerzaj przy tym promienia.
Po zmianie reguł zaktualizuj `SELECTION_VERSION` i ponownie uruchom import.

## Pochodzenie i metadane

Obecny plik został **przefiltrowany lokalnie**, bez nowego pobrania danych:

- oryginalny eksport OSM: 2026-10-03 11:47:45 UTC;
- data bazy podana przez Overpass: 2026-10-03 11:46:02 UTC;
- źródło: `https://overpass-api.de/api/interpreter`;
- pierwotny obszar źródłowy: granica Krakowa, relacja OSM 449696.

`fetched_at` i `osm_base_timestamp` zachowują datę źródła. `filtered_at` oznacza
czas zastosowania selekcji. `source_query` i `source_boundary` opisują dawny eksport,
a nie obecny zakres. Środek, promień, wersja reguł, statystyki i odrzucone rekordy
znajdują się w `metadata`, dostępnym także przez endpoint zbioru.

Przy nowym imporcie zapytanie `QUERY` pobiera kandydatów przez Overpass `around`
oraz jawne ID wyjątków. Dokładne zapytanie trafia do `metadata.query`. Ostateczny
warunek promienia jest zawsze liczony lokalnie, również dla wyjątków i środków
obiektów powierzchniowych. Nie opieramy gwarancji promienia wyłącznie na Overpass.

## Pobranie i ponowne filtrowanie

Z katalogu serwisu, pobranie aktualnych kandydatów z OSM i zastosowanie selekcji:

```powershell
uv run python scripts/import_pois.py
```

Czyszczenie istniejącego zbioru bez dostępu do sieci:

```powershell
uv run python scripts/import_pois.py --input krakow_pois.geojson
```

Zapis do osobnego pliku do przeglądu:

```powershell
uv run python scripts/import_pois.py --input krakow_pois.geojson --output preview.geojson
```

`--endpoint` zmienia serwer Overpass w trybie pobierania; `--output` wskazuje cel
w obu trybach. Nie ma flagi powiększającej promień. Tryb lokalny nie odzyska obiektów
usuniętych wcześniej — po rozszerzeniu selekcji pobierz dane ponownie.

Importer odrzuca częściową odpowiedź z `remark`, brak geometrii, nieprawidłowe
współrzędne i pusty wynik selekcji. Walidacja kończy się przed zapisem; plik docelowy
jest podmieniany dopiero po utworzeniu kompletnego pliku tymczasowego.
**Po zmianie pliku zrestartuj API**, aby odświeżyć indeks w RAM i cache planera.

## Współrzędne i ograniczenia danych

ID zachowuje typ i numer OSM. Węzły mają oryginalne położenie; `way` i `relation`
używają środka prostokąta obwiedni zwróconego przez Overpass, oznaczonego jako
`coordinate_source=bounds_center`. To punkt reprezentacyjny, nie zweryfikowane wejście.
Promień jest sprawdzany dla tego punktu, nie całego obrysu budynku.

Plik POI nie zawiera sieci ulic. Przebieg i manewry pochodzą z osobnego grafu OSRM;
odświeżenie POI nie przebudowuje grafu. Osobne demo zgłoszeń ma własny snapshot tras.
Brak informacji o schodach lub zamknięciu nie dowodzi braku bariery. Godziny otwarcia
i dostępność nie zostały zweryfikowane terenowo.

Własny zbiór ładowany przez API wymaga `FeatureCollection`, obiektów `Feature`
z geometrią `Point`, współrzędnych `[longitude, latitude]` i niepustej kategorii.
Nazwa, ID, tagi i metadane są opcjonalne dla samego loadera; bez ID nadawany jest
indeks. Importer jest bardziej restrykcyjny i wymaga nazw oraz tagów potrzebnych
do selekcji. Ustawienie `POI_FILE` na inny, nieprzefiltrowany plik omija politykę
importu — loader API sam nie nakłada ograniczenia do centrum.

## Atrybucja

Dane © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).
Zachowuj metadane i atrybucję przy udostępnianiu. Na mapie pokaż atrybucję OSM
i link do [poprawiania mapy](https://www.openstreetmap.org/fixthemap).
