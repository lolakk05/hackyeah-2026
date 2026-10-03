"""Bounded time-budget search over local POIs and OSRM walking durations."""

import asyncio
import time
from collections import OrderedDict

from fastapi import HTTPException

from config import Settings
from models import (
    POI,
    Accessibility,
    LineString,
    Location,
    PlanRequest,
    PlanResponse,
    RouteLeg,
    RouteStart,
    RouteStop,
    SnappedWaypoint,
)
from routing import OSRMRouter, RoutingUnavailable
from spatial import POIIndex


def fail(status: int, code: str, message: str):
    raise HTTPException(status_code=status, detail={"code": code, "message": message})


class Planner:
    def __init__(self, index: POIIndex, router: OSRMRouter, settings: Settings):
        self.index = index
        self.router = router
        self.settings = settings
        self._lock = asyncio.Lock()
        self._cache: OrderedDict[str, tuple[float, PlanResponse]] = OrderedDict()

    @staticmethod
    def _eligible(poi: POI, request: PlanRequest) -> bool:
        if not poi.route_eligible:
            return False
        if request.wheelchair and poi.tags.get("wheelchair") in {"no", "limited"}:
            return False
        return not (
            (request.wheelchair or request.avoid_stairs) and poi.tags.get("highway") == "steps"
        )

    def _start(self, request: PlanRequest) -> POI:
        if request.start_poi_id is not None:
            poi = self.index.by_id.get(request.start_poi_id)
            if poi is None:
                fail(404, "poi_not_found", "Startowy POI nie istnieje. Sprawdź GET /pois.")
            if not self._eligible(poi, request):
                fail(
                    422,
                    "poi_access_restricted",
                    "Dane OSM oznaczają startowy POI jako niedostępny.",
                )
            return poi
        lat, lon = (
            (request.user_location.latitude, request.user_location.longitude)
            if request.user_location
            else (50.0617, 19.9373)
        )
        nearby = self.index.within(lat, lon, 2000)
        for poi, _ in nearby:
            if self._eligible(poi, request):
                return poi
        fail(404, "no_start_poi", "Brak dostępnego startowego POI w promieniu 2 km.")

    def _candidates(self, start: POI, request: PlanRequest) -> list[POI]:
        radius = min(50_000, request.duration_minutes * 60 * 2)
        nearby = self.index.within(start.latitude, start.longitude, radius, request.category)
        pool = [
            poi
            for poi, distance in nearby
            if poi.id != start.id and distance >= 20 and self._eligible(poi, request)
        ]
        if not pool:
            fail(
                404,
                "no_candidate_pois",
                "Brak innych dostępnych POI dla podanej kategorii i obszaru.",
            )
        limit = self.settings.candidate_limit
        if len(pool) > limit:
            pool = [pool[round(i * (len(pool) - 1) / (limit - 1))] for i in range(limit)]
        return [start, *pool]

    @staticmethod
    def _paths(
        matrix: list[list[float | None]],
        request: PlanRequest,
        prefix: tuple[int, ...] = (0,),
    ) -> list[tuple[int, ...]]:
        """Bounded beam search: O(stops * beam * candidates), not factorial enumeration."""
        budget = request.duration_minutes * 60
        minimum = budget * (1 - request.tolerance_percent / 100)
        initial = 0.0
        for a, b in zip(prefix, prefix[1:]):
            if matrix[a][b] is None:
                return []
            initial += matrix[a][b]
        if initial > budget:
            return []
        beam = [(prefix, initial)]
        ranked = []
        for _ in range(request.max_intermediate_stops + 1):
            expanded = []
            for path, duration in beam:
                for next_index in range(1, len(matrix)):
                    leg = matrix[path[-1]][next_index]
                    if (
                        next_index not in path
                        and leg is not None
                        and leg > 0
                        and duration + leg <= budget
                    ):
                        expanded.append(((*path, next_index), duration + leg))
            if not expanded:
                break
            for path, duration in expanded:
                fits = duration >= minimum
                ranked.append(((fits, len(path) if fits else 0, duration), path))
            # Retain both short extendable routes and near-budget routes at each depth.
            expanded.sort(key=lambda item: (item[1], item[0]))
            beam = expanded if len(expanded) <= 256 else expanded[:128] + expanded[-128:]
            ranked.sort(key=lambda item: item[0], reverse=True)
            ranked = ranked[:256]
        ranked.sort(key=lambda item: item[0], reverse=True)
        return [path for _, path in ranked]

    async def plan(self, request: PlanRequest) -> PlanResponse:
        try:
            self.router.profile_url(request.routing_profile)
        except RoutingUnavailable as exc:
            fail(
                503,
                exc.reason,
                f"Profil {request.routing_profile} wymaga konfiguracji backendu. "
                "Sprawdź GET /capabilities; nie użyto zastępczej trasy pieszej.",
            )
        key = request.model_dump_json()
        cached = self._cache.get(key)
        if cached and time.monotonic() - cached[0] < self.settings.cache_ttl_s:
            self._cache.move_to_end(key)
            return cached[1].model_copy(update={"source": "cache"}, deep=True)
        if cached:
            del self._cache[key]
        if self._lock.locked():
            raise HTTPException(
                503,
                detail={
                    "code": "planner_busy",
                    "message": "Trwa inne planowanie. Ponów żądanie za chwilę.",
                    "retry_after_s": 2,
                },
                headers={"Retry-After": "2"},
            )
        async with self._lock:
            try:
                async with asyncio.timeout(self.settings.plan_timeout_s):
                    result = await self._plan(request)
            except TimeoutError as exc:
                raise HTTPException(
                    503,
                    detail={
                        "code": "planning_timeout",
                        "message": "Przekroczono limit czasu planowania.",
                        "retry_after_s": 2,
                    },
                    headers={"Retry-After": "2"},
                ) from exc
            except RoutingUnavailable as exc:
                raise HTTPException(
                    503,
                    detail={
                        "code": exc.reason,
                        "message": "Nie można potwierdzić trasy pieszej w OSRM. "
                        "Spróbuj ponownie później.",
                        "retry_after_s": exc.retry_after_s,
                    },
                    headers={"Retry-After": str(exc.retry_after_s)},
                ) from exc
        self._cache[key] = (time.monotonic(), result)
        while len(self._cache) > self.settings.cache_size:
            self._cache.popitem(last=False)
        return result

    async def _plan(self, request: PlanRequest) -> PlanResponse:
        start = await asyncio.to_thread(self._start, request)
        pois = await asyncio.to_thread(self._candidates, start, request)
        origin = request.user_location or (
            Location(latitude=start.latitude, longitude=start.longitude)
            if request.start_mode == "poi"
            else Location(latitude=50.0617, longitude=19.9373)
        )
        approach = (origin.longitude, origin.latitude) != (start.longitude, start.latitude)
        nodes = [origin, *pois] if approach else pois
        prefix = (0, 1) if approach else (0,)
        radiuses = [self.settings.origin_snap_radius_m] + [100] * (len(nodes) - 1)
        profile = request.routing_profile
        warnings = ["Czas podróży nie uwzględnia zwiedzania!"]
        if profile != "walking":
            warnings.append(
                "Ograniczenia uwzględniono w profilu grafu OSM; nie zweryfikowano "
                "terenowo kompletności barier i dostępności wejść."
            )
        try:
            matrix = await self.router.table(nodes, profile=profile, radiuses=radiuses)
            paths = await asyncio.to_thread(self._paths, matrix, request, prefix)
        except RoutingUnavailable as exc:
            if exc.reason not in {"osrm_no_route", "osrm_http_error"}:
                raise
            warnings.append(
                "Tabela OSRM niedostępna; sprawdzono ograniczoną liczbę tras bez przystanków."
            )
            nearby_distances = await asyncio.to_thread(
                self.index.within, start.latitude, start.longitude, 50_000, request.category
            )
            distances = {poi.id: distance for poi, distance in nearby_distances}
            target_m = request.duration_minutes * 60 * self.settings.walking_speed_m_s / 1.3
            paths = [
                (*prefix, i + (1 if approach else 0))
                for i in sorted(
                    range(1, len(pois)), key=lambda i: abs(distances[pois[i].id] - target_m)
                )
            ]
        if not paths:
            fail(
                404,
                "no_route_within_budget",
                "Żadna sprawdzona trasa nie mieści się w budżecie. "
                "Zwiększ czas albo zmień punkt startowy/kategorię.",
            )
        budget = request.duration_minutes * 60
        for path in paths[: self.settings.route_attempts]:
            ordered_nodes = [nodes[i] for i in path]
            ordered = ordered_nodes[1:] if approach else ordered_nodes
            try:
                route, waypoints = await self.router.route_points(
                    [(p.longitude, p.latitude) for p in ordered_nodes],
                    profile=profile,
                    navigation=True,
                    radiuses=[radiuses[i] for i in path],
                )
            except RoutingUnavailable as exc:
                if exc.reason == "osrm_no_route":
                    continue
                raise
            if route.duration <= 0 or route.duration > budget:
                continue
            matches = budget - route.duration <= budget * request.tolerance_percent / 100
            if not matches:
                warnings.append(
                    "Znaleziono krótszą trasę; niedobór czasu przekracza zadaną tolerancję."
                )
            legs = []
            for i, leg in enumerate(route.legs):
                coordinates = []
                for step in leg.steps:
                    for point in step.geometry.coordinates:
                        if not coordinates or point != coordinates[-1]:
                            coordinates.append(point)
                if len(coordinates) == 1:
                    coordinates.append(coordinates[0])
                legs.append(
                    RouteLeg(
                        from_poi_id=None if approach and i == 0 else ordered_nodes[i].id,
                        to_poi_id=ordered_nodes[i + 1].id,
                        from_waypoint_index=i,
                        to_waypoint_index=i + 1,
                        kind="approach" if approach and i == 0 else "between_pois",
                        duration_s=leg.duration,
                        distance_m=leg.distance,
                        geometry=LineString(coordinates=coordinates),
                        steps=leg.steps,
                    )
                )
            stops = []
            for i, poi in enumerate(ordered):
                waypoint_index = i + int(approach)
                stops.append(
                    RouteStop(
                        sequence=i,
                        waypoint_index=waypoint_index,
                        role="start"
                        if i == 0
                        else "end"
                        if i == len(ordered) - 1
                        else "intermediate",
                        poi=poi,
                        snapped_location=waypoints[waypoint_index].location,
                        arrival_distance_m=sum(l.distance for l in route.legs[:waypoint_index]),
                        arrival_duration_s=sum(l.duration for l in route.legs[:waypoint_index]),
                    )
                )
            xs, ys = zip(*route.geometry.coordinates)
            return PlanResponse(
                start=RouteStart(
                    mode=request.start_mode,
                    requested_location=origin,
                    snapped_location=waypoints[0].location,
                    distance_to_network_m=waypoints[0].distance,
                    approach_included=approach,
                ),
                stops=stops,
                bbox=(min(xs), min(ys), max(xs), max(ys)),
                accessibility=Accessibility(
                    wheelchair=request.wheelchair,
                    avoid_stairs=request.avoid_stairs,
                    effective_avoid_stairs=profile != "walking",
                    routing_profile=profile,
                    constraints_applied=profile != "walking",
                ),
                start_poi=start,
                end_poi=ordered[-1],
                intermediate_pois=ordered[1:-1],
                requested_duration_s=budget,
                duration_s=route.duration,
                distance_m=route.distance,
                unused_duration_s=budget - route.duration,
                matches_target=matches,
                geometry=route.geometry,
                source="osrm",
                warnings=warnings,
                candidates_considered=len(pois) - 1,
                legs=legs,
                snapped_waypoints=[
                    SnappedWaypoint(
                        poi_id=None if approach and i == 0 else poi.id,
                        location=point.location,
                        distance_from_poi_m=point.distance,
                    )
                    for i, (poi, point) in enumerate(zip(ordered_nodes, waypoints, strict=True))
                ],
            )
        fail(
            404,
            "no_route_within_budget",
            "Nie udało się potwierdzić trasy w budżecie po "
            "sprawdzeniu ograniczonej liczby wariantów. Zmień czas, kategorię lub start.",
        )
