# Lokalny zbiór turystycznych POI Krakowa

[Spis dokumentacji](README.md). Ten plik dotyczy wyłącznie źródła, zawartości,
transformacji i utrzymania danych. Modele HTTP są w [API.md](API.md), a filtrowanie
POI przez planer i indeksowanie w [OPIS_API.md](OPIS_API.md).

## Snapshot dostarczony z serwisem

- **3090 obiektów OSM**, 16 głównych kategorii.
- Pobranie: **2026-10-03 11:47:45 UTC**.
- Data bazy zgłoszona przez Overpass: **2026-10-03 11:46:02 UTC**.
- Źródło: `https://overpass-api.de/api/interpreter`.
- Granica miasta: [relacja OSM 449696](https://www.openstreetmap.org/relation/449696).
- Plik: `krakow_pois.geojson`. Metadane są również dostępne przez `GET /dataset`.

| Kategoria | Liczba |
|---|---:|
| historic | 1734 |
| artwork | 290 |
| attraction | 266 |
| park | 233 |
| place_of_worship | 206 |
| museum | 91 |
| viewpoint | 63 |
| cave_entrance | 38 |
| gallery | 38 |
| nature_reserve | 37 |
| theatre | 32 |
| arts_centre | 31 |
| garden | 22 |
| theme_park | 7 |
| planetarium | 1 |
| zoo | 1 |

Liczby dotyczą tego eksportu. Po odświeżeniu wiążące są metadane nowego pliku.

## Co oznacza zakres „wszystkie miejsca”

Eksport pobiera **wszystkie obiekty zwrócone przez poniższe zapytanie**, bez limitu
liczby rekordów i bez ręcznego wyboru kilku najpopularniejszych miejsc. Obejmuje
muzea, galerie, atrakcje, punkty widokowe, sztukę w przestrzeni publicznej, obiekty
historyczne, świątynie, teatry, centra sztuki, parki, rezerwaty, wybrane ogrody i jaskinie.
Nie obejmuje automatycznie hoteli, restauracji, sklepów ani zwykłych nienazwanych ogrodów.

To nie jest gwarancja kompletności wszystkich realnych atrakcji. OSM jest aktualizowane
społecznościowo: obiekty mogą nie mieć tagów turystycznych, być nieopisane, nieaktualne,
czasowo zamknięte albo występować jako kilka osobnych obiektów. Sam fakt występowania
w OSM nie potwierdza dostępności turystycznej. Definicja atrakcji jest tu jawnie oparta
na tagach; można poszerzyć selekcję w importerze i ponowić eksport.

## Zapytanie Overpass

`3600449696` to identyfikator obszaru utworzonego z relacji miasta `449696`.
Wybór według granicy administracyjnej obejmuje Kraków, a nie prostokąt z okolicznymi gminami.

```overpass
[out:json][timeout:180];
area(3600449696)->.city;
(
  nwr(area.city)["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|theme_park|aquarium|artwork)$"];
  nwr(area.city)["historic"]["historic"!="no"];
  nwr(area.city)["amenity"~"^(place_of_worship|theatre|arts_centre|planetarium)$"];
  nwr(area.city)["leisure"~"^(park|nature_reserve)$"];
  nwr(area.city)["leisure"="garden"]["name"];
  nwr(area.city)["leisure"="garden"]["garden:type"~"^(botanical|arboretum)$"];
  nwr(area.city)["natural"="cave_entrance"];
);
out center tags;
```

Sposób selekcji obiektów przecinających granicę wynika z semantyki `area` w Overpass.
Środek większego obiektu/relacji nie musi być wejściem ani leżeć na dostępnej ścieżce.

## Konwersja do punktów i kategorie

- ID zachowuje typ i numer OSM, np. `way-123`. Duplikaty dokładnie tego samego ID
  w odpowiedzi są scalane. Różne ID nie są automatycznie łączone po nazwie.
- Węzły (`node`) zachowują oryginalną lokalizację.
- Drogi/poligony (`way`) i relacje używają `center` zwróconego przez Overpass:
  środka prostokąta obwiedni. To punkt reprezentacyjny, nie środek geometryczny
  powierzchni ani potwierdzone wejście. Oznacza go `coordinate_source=bounds_center`.
- Nazwa pochodzi z `name:pl`, potem `name`. Brak obu tworzy nazwę kategorii z ID.
- Pierwszeństwo kategorii: pasujący `tourism`, następnie `historic`, wybrane `amenity`,
  następnie `leisure` i jaskinia. Oryginalne tagi pozostają w `properties.tags`.

Tagi nie są potwierdzeniem aktualnych godzin otwarcia, warunków wstępu lub pełnej
dostępności. Brak tagu o schodach albo wózku nie dowodzi braku bariery. Reguły wyboru
POI i zależność od profilu grafu opisuje [architektura](OPIS_API.md).

## Trzy odrębne źródła geometrii

- `krakow_pois.geojson` zawiera punkty atrakcji, a nie sieć chodników i ulic.
- Przebieg trasy, manewry i dopasowane punkty pochodzą z grafu wybranego backendu OSRM.
  Mogą mieć inną datę aktualizacji niż lokalny katalog POI. Odświeżenie POI nie przebudowuje grafu.
- `hardcoded-zgloszenie/data/rynek_wawel_routes.json` przechowuje dwa wcześniej
  pobrane warianty demo; nie jest źródłem tras głównego planera.

Własne grafy bez schodów i dla wózka muszą zawierać reguły dla odcinków i barier;
sam plik turystycznych POI nie wystarcza do ich przygotowania. API raportuje
dopasowanie pozycji do sieci zgodnie z [kontraktem](API.md); nie potwierdza wejścia
na teren atrakcji ani możliwości pokonania przestrzeni pomiędzy markerem i waypointem.

## Aktualizacja i własne dane

```powershell
uv run python scripts/import_pois.py
```

Można wskazać `--endpoint` oraz `--output`. Import jest operacją ręczną, niezależną
od startu serwisu. Odpowiedź z `remark` (np. timeout części zapytania), pustą listą lub
brakującą geometrią jest odrzucana. Najpierw zapisywany jest plik tymczasowy, a dopiero
po sukcesie podmieniany docelowy. Po zmianie danych zrestartuj API, aby przebudować RAM.

Własny plik musi być `FeatureCollection` z tablicą `features`. Każdy obiekt wymaga
`type=Feature`, `geometry.type=Point`, dwóch poprawnych współrzędnych `[lon,lat]`
i niepustego `properties.category`. `name`, `id`, tagi i metadane są opcjonalne.
Bez ID nadawany jest indeks w tablicy, ale stabilne ID są zalecane. Powtarzające się
ID, geometrie inne niż Point i niepoprawne zakresy współrzędnych blokują start serwisu.

## Atrybucja

Dane © OpenStreetMap contributors, [Open Database License](https://www.openstreetmap.org/copyright).
Zachowuj atrybucję i metadane przy dalszym udostępnianiu pliku. Na mapie użytkownika
pokaż atrybucję OSM; serwer routingu wymaga również linku do
[poprawiania mapy](https://www.openstreetmap.org/fixthemap).
Dokumentacja selekcji: [Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL).
