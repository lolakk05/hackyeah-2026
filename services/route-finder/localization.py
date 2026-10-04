"""Localized planner messages and OSM names; identifiers remain language independent."""

from models import POI, Language

MESSAGES = {
    "poi_not_found": (
        "Startowy POI nie istnieje. Sprawdź GET /pois.",
        "The starting POI does not exist. Check GET /pois.",
    ),
    "poi_access_restricted": (
        "Dane OSM oznaczają startowy POI jako niedostępny.",
        "OSM data marks the starting POI as inaccessible.",
    ),
    "no_start_poi": (
        "Brak dostępnego startowego POI w obszarze wyszukiwania dla podanego czasu.",
        "No eligible starting POI in the search area for the requested duration.",
    ),
    "no_candidate_pois": (
        "Brak innych dostępnych POI dla podanej kategorii i obszaru.",
        "No other eligible POIs for the selected category and area.",
    ),
    "profile_unavailable": (
        "Profil {profile} wymaga konfiguracji backendu. "
        "Sprawdź GET /capabilities; nie użyto zastępczej trasy pieszej.",
        "The {profile} profile requires backend configuration. "
        "Check GET /capabilities; no substitute walking route was used.",
    ),
    "planner_busy": (
        "Trwa inne planowanie. Ponów żądanie za chwilę.",
        "Another route is being planned. Please retry shortly.",
    ),
    "planning_timeout": (
        "Przekroczono limit czasu planowania.",
        "Route planning timed out.",
    ),
    "routing_unavailable": (
        "Nie można potwierdzić trasy pieszej w OSRM. Spróbuj ponownie później.",
        "OSRM could not confirm the walking route. Please try again later.",
    ),
    "sightseeing": (
        "Czas podróży nie uwzględnia zwiedzania!",
        "Travel time does not include sightseeing!",
    ),
    "accessibility": (
        "Ograniczenia uwzględniono w profilu grafu OSM; nie zweryfikowano "
        "terenowo kompletności barier i dostępności wejść.",
        "Restrictions are applied through the OSM routing profile; barrier data "
        "completeness and entrance accessibility have not been verified on site.",
    ),
    "table_unavailable": (
        "Tabela OSRM niedostępna; sprawdzono ograniczoną liczbę tras bez przystanków.",
        "The OSRM table is unavailable; a limited number of routes without "
        "intermediate stops were checked.",
    ),
    "no_route_within_budget": (
        "Żadna sprawdzona trasa nie mieści się w budżecie. "
        "Zwiększ czas albo zmień punkt startowy/kategorię.",
        "No checked route fits the time budget. "
        "Increase the duration or change the starting point/category.",
    ),
    "short_route": (
        "Znaleziono krótszą trasę; niedobór czasu przekracza zadaną tolerancję.",
        "A shorter route was found; the time shortfall exceeds the requested tolerance.",
    ),
    "route_attempts_exhausted": (
        "Nie udało się potwierdzić trasy w budżecie po "
        "sprawdzeniu ograniczonej liczby wariantów. Zmień czas, kategorię lub start.",
        "No route within the time budget could be confirmed after checking a limited "
        "number of alternatives. Change the duration, category or starting point.",
    ),
}


def message(key: str, language: Language, **values: str) -> str:
    return MESSAGES[key][language == "en"].format(**values)


def localized_poi(poi: POI, language: Language) -> POI:
    name = poi.tags.get(f"name:{language}", "").strip() or poi.name
    return poi.model_copy(update={"name": name}, deep=True)
