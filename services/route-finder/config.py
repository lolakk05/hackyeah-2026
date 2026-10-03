"""Configuration resolved once during application startup."""

import os
from pathlib import Path

from pydantic import BaseModel, Field, HttpUrl


class Settings(BaseModel):
    poi_file: Path = Path(__file__).with_name("krakow_pois.geojson")
    osrm_base_url: HttpUrl = HttpUrl("https://routing.openstreetmap.de/routed-foot")
    osrm_step_free_base_url: HttpUrl | None = None
    osrm_wheelchair_base_url: HttpUrl | None = None
    origin_snap_radius_m: float = Field(default=25, gt=0, le=100, allow_inf_nan=False)
    osrm_timeout_s: float = Field(default=8.0, gt=0, allow_inf_nan=False)
    osrm_cooldown_s: float = Field(default=60.0, ge=1, allow_inf_nan=False)
    walking_speed_m_s: float = Field(default=1.4, gt=0, allow_inf_nan=False)
    candidate_limit: int = Field(default=24, ge=2, le=40)
    route_attempts: int = Field(default=3, ge=1, le=5)
    plan_timeout_s: float = Field(default=40, gt=0, allow_inf_nan=False)
    cache_ttl_s: float = Field(default=3600, gt=0, allow_inf_nan=False)
    cache_size: int = Field(default=128, ge=1, le=1000)

    @classmethod
    def from_env(cls) -> "Settings":
        names = {
            "POI_FILE": "poi_file",
            "OSRM_BASE_URL": "osrm_base_url",
            "OSRM_STEP_FREE_BASE_URL": "osrm_step_free_base_url",
            "OSRM_WHEELCHAIR_BASE_URL": "osrm_wheelchair_base_url",
            "ORIGIN_SNAP_RADIUS_M": "origin_snap_radius_m",
            "OSRM_TIMEOUT_S": "osrm_timeout_s",
            "OSRM_COOLDOWN_S": "osrm_cooldown_s",
            "WALKING_SPEED_M_S": "walking_speed_m_s",
            "CANDIDATE_LIMIT": "candidate_limit",
            "ROUTE_ATTEMPTS": "route_attempts",
            "PLAN_TIMEOUT_S": "plan_timeout_s",
            "CACHE_TTL_S": "cache_ttl_s",
            "CACHE_SIZE": "cache_size",
        }
        return cls.model_validate(
            {field: os.environ[name] for name, field in names.items() if name in os.environ}
        )
