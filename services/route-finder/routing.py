"""Shared asynchronous client for the foot OSRM route and table services."""

import asyncio
import math
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Annotated

import httpx
from pydantic import BaseModel, Field, FiniteFloat, TypeAdapter, ValidationError

from config import Settings
from models import POI, Coordinates, LineString, Location, NavigationStep, RouteResponse

NonNegative = Annotated[FiniteFloat, Field(ge=0)]


class RoutingUnavailable(Exception):
    def __init__(self, reason: str, retry_after_s: int = 1):
        self.reason = reason
        self.retry_after_s = retry_after_s
        super().__init__(reason)


class OSRMLeg(BaseModel):
    distance: NonNegative
    duration: NonNegative
    steps: list[NavigationStep] = Field(default_factory=list)


class OSRMRoute(OSRMLeg):
    geometry: LineString
    legs: list[OSRMLeg]


class OSRMWaypoint(BaseModel):
    location: Coordinates
    distance: Annotated[FiniteFloat, Field(ge=0, le=100.01)]


class OSRMRouter:
    def __init__(self, client: httpx.AsyncClient, settings: Settings):
        self.client = client
        self.settings = settings
        self._lock = asyncio.Lock()
        self._next_request_at = 0.0
        self._blocked_until = 0.0

    def _retry_after(self, header: str | None) -> float:
        if header:
            try:
                seconds = float(header)
            except ValueError:
                try:
                    date = parsedate_to_datetime(header)
                    if date.tzinfo is None:
                        date = date.replace(tzinfo=timezone.utc)
                    seconds = (date - datetime.now(timezone.utc)).total_seconds()
                except (ValueError, TypeError, OverflowError):
                    seconds = self.settings.osrm_cooldown_s
            if math.isfinite(seconds) and seconds > 0:
                return max(1.0, seconds)
        return self.settings.osrm_cooldown_s

    def _check_cooldown(self):
        remaining = self._blocked_until - time.monotonic()
        if remaining > 0:
            raise RoutingUnavailable("osrm_rate_limited", math.ceil(remaining))

    def profile_url(self, profile: str) -> str:
        url = {
            "walking": self.settings.osrm_base_url,
            "step_free": self.settings.osrm_step_free_base_url,
            "wheelchair": self.settings.osrm_wheelchair_base_url,
        }[profile]
        if url is None:
            raise RoutingUnavailable("routing_profile_not_configured")
        return str(url).rstrip("/")

    async def _request(
        self,
        service: str,
        coordinates: list[Coordinates],
        params: dict,
        *,
        profile: str = "walking",
        radiuses: list[float] | None = None,
    ) -> dict:
        base = self.profile_url(profile)
        self._check_cooldown()
        try:
            await asyncio.wait_for(self._lock.acquire(), timeout=2)
        except TimeoutError as exc:
            raise RoutingUnavailable("osrm_busy", 2) from exc
        try:
            self._check_cooldown()
            await asyncio.sleep(max(0.0, self._next_request_at - time.monotonic()))
            self._next_request_at = time.monotonic() + 1
            points = ";".join(f"{lon},{lat}" for lon, lat in coordinates)
            try:
                response = await self.client.get(
                    f"{base}/{service}/v1/foot/{points}",
                    params={
                        **params,
                        "radiuses": ";".join(
                            str(r) for r in (radiuses or [100] * len(coordinates))
                        ),
                        "generate_hints": "false",
                    },
                    timeout=self.settings.osrm_timeout_s,
                )
            except httpx.TimeoutException as exc:
                raise RoutingUnavailable("osrm_timeout") from exc
            except httpx.RequestError as exc:
                raise RoutingUnavailable("osrm_unavailable") from exc
            if response.status_code == 429:
                cooldown = self._retry_after(response.headers.get("Retry-After"))
                self._blocked_until = time.monotonic() + cooldown
                raise RoutingUnavailable("osrm_rate_limited", math.ceil(cooldown))
            if response.status_code >= 500:
                raise RoutingUnavailable("osrm_unavailable")
            try:
                data = response.json()
                if not isinstance(data, dict):
                    raise ValueError("OSRM response must be an object")
            except ValueError as exc:
                raise RoutingUnavailable("osrm_invalid_response") from exc
            if data.get("code") in ("NoRoute", "NoSegment", "NoTable"):
                raise RoutingUnavailable("osrm_no_route")
            if response.status_code != 200 or data.get("code") == "NotImplemented":
                raise RoutingUnavailable("osrm_http_error")
            if data.get("code") != "Ok":
                raise RoutingUnavailable("osrm_invalid_response")
            return data
        finally:
            self._lock.release()

    async def table(
        self,
        pois: list[POI | Location],
        *,
        profile: str = "walking",
        radiuses: list[float] | None = None,
    ) -> list[list[float | None]]:
        data = await self._request(
            "table",
            [(p.longitude, p.latitude) for p in pois],
            {"annotations": "duration"},
            profile=profile,
            radiuses=radiuses,
        )
        try:
            matrix = TypeAdapter(list[list[NonNegative | None]]).validate_python(data["durations"])
            if len(matrix) != len(pois) or any(len(row) != len(pois) for row in matrix):
                raise ValueError("Wrong duration matrix shape")
            if data.get("fallback_speed_cells"):
                raise ValueError("Estimated table cells cannot be used as verified walking times")
            return matrix
        except (ValidationError, KeyError, ValueError, TypeError) as exc:
            raise RoutingUnavailable("osrm_invalid_response") from exc

    async def route_points(
        self,
        coordinates: list[Coordinates],
        *,
        profile: str = "walking",
        navigation: bool = False,
        radiuses: list[float] | None = None,
    ) -> tuple[OSRMRoute, list[OSRMWaypoint]]:
        data = await self._request(
            "route",
            coordinates,
            {
                "geometries": "geojson",
                "overview": "full",
                "steps": "true" if navigation else "false",
                "continue_straight": "false",
            },
            profile=profile,
            radiuses=radiuses,
        )
        try:
            route = OSRMRoute.model_validate(data["routes"][0])
            waypoints = TypeAdapter(list[OSRMWaypoint]).validate_python(data["waypoints"])
            if len(waypoints) != len(coordinates) or len(route.legs) != len(coordinates) - 1:
                raise ValueError("Wrong waypoint / leg count")
            if abs(sum(leg.duration for leg in route.legs) - route.duration) > 1:
                raise ValueError("Inconsistent leg duration")
            if abs(sum(leg.distance for leg in route.legs) - route.distance) > 1:
                raise ValueError("Inconsistent leg distance")
            if radiuses and any(
                w.distance > radius + 0.01 for w, radius in zip(waypoints, radiuses, strict=True)
            ):
                raise ValueError("Snapping exceeded requested radius")
            if navigation:
                for i, leg in enumerate(route.legs):
                    if not leg.steps:
                        raise ValueError("Missing navigation steps")
                    if abs(sum(s.duration for s in leg.steps) - leg.duration) > max(
                        1, len(leg.steps) * 0.11
                    ):
                        raise ValueError("Inconsistent step duration")
                    if abs(sum(s.distance for s in leg.steps) - leg.distance) > max(
                        1, len(leg.steps) * 0.11
                    ):
                        raise ValueError("Inconsistent step distance")
                    # OSRM coordinates can be rounded; never invent a connector across a gap.
                    previous = waypoints[i].location
                    for step in leg.steps:
                        if not self._near(previous, step.geometry.coordinates[0]):
                            raise ValueError("Disconnected navigation geometry")
                        previous = step.geometry.coordinates[-1]
                    if not self._near(previous, waypoints[i + 1].location):
                        raise ValueError("Navigation does not reach waypoint")
            return route, waypoints
        except (ValidationError, KeyError, ValueError, IndexError, TypeError) as exc:
            raise RoutingUnavailable("osrm_invalid_response") from exc

    @staticmethod
    def _near(a: Coordinates, b: Coordinates) -> bool:
        # At most ~2 m in either axis, sufficient for OSRM's coordinate precision.
        return abs(a[0] - b[0]) <= 0.00002 and abs(a[1] - b[1]) <= 0.00002

    async def route(
        self, latitude: float, longitude: float, poi: POI, distance_m: float
    ) -> RouteResponse:
        """Compatibility endpoint: explicitly marked straight-line fallback on upstream failure."""
        coordinates = [(longitude, latitude), (poi.longitude, poi.latitude)]
        try:
            route, _ = await self.route_points(coordinates)
            return RouteResponse(
                poi=poi,
                poi_distance_m=distance_m,
                distance_m=route.distance,
                duration_s=route.duration,
                geometry=route.geometry,
                source="osrm",
                is_estimate=False,
            )
        except RoutingUnavailable as exc:
            return RouteResponse(
                poi=poi,
                poi_distance_m=distance_m,
                distance_m=distance_m,
                duration_s=distance_m / self.settings.walking_speed_m_s,
                geometry=LineString(coordinates=coordinates),
                source="straight_line",
                is_estimate=True,
                fallback_reason=exc.reason,
                warning="Straight-line estimate only, not a navigable walking route. "
                "Ignores roads, barriers and access restrictions.",
            )
