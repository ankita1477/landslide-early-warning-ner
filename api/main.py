"""Landslide early warning API."""

from __future__ import annotations

import logging
import os
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import risk
from api.schemas.risk import Health
from api.store import RiskStore, get_store_optional

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

app = FastAPI(
    title="Landslide Early Warning API",
    version="0.1.0",
    description=(
        "Risk for the NH-10 corridor. Scores come from the fused pipeline: "
        "susceptibility x trigger probability x deformation modifier x exposure. "
        "Tier thresholds are calibrated per corridor and served by /risk/tiers "
        "rather than hard-coded by clients."
    ),
)
# The dashboard reaches the API through a dev-server proxy, so it needs nothing
# here. A browser client that calls the API directly does — the citizen app's
# web build is served from another port and was silently blocked until this was
# added. Native builds are unaffected; CORS is a browser rule.
#
# Origins are listed rather than wildcarded. "*" would let any page on the
# internet read a logged-in user's responses, and this API will carry subscriber
# data once alerting is live.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:4173,http://localhost:8081,"
        "http://localhost:8082",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(risk.router, prefix="/api/v1")


@app.get("/api/v1/health", response_model=Health, tags=["meta"])
def health(store: Annotated[RiskStore | None, Depends(get_store_optional)]) -> Health:
    """Reports whether the pipeline outputs are actually present.

    A health check that returns 200 without touching the data would go on saying
    the service is fine after the pipeline stopped producing scores.
    """
    if store is None:
        return Health(status="degraded", segments_loaded=0, tiers_calibrated=False)
    return Health(
        status="ok",
        segments_loaded=len(store.segments),
        tiers_calibrated=bool(store.thresholds),
    )
