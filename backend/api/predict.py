"""GET /predict — physics-predicted subsystem curve from orbital state."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from physics.orbit_propagation import propagate
from physics.thermal_model import predict

router = APIRouter()


def parse_start(start: str | None) -> datetime:
    """Parse an optional ISO 8601 timestamp into a route-friendly error."""
    if not start:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(start.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail="start must be an ISO 8601 timestamp",
        ) from exc


@router.get("/predict")
def get_prediction(
    norad_id: int = Query(25544, description="Satellite catalog number"),
    start: str | None = Query(None, description="ISO 8601 start time; defaults to now"),
    hours: float = Query(3.0, ge=0.1, le=48),
    step_s: int = Query(60, ge=10, le=600),
):
    t0 = parse_start(start)
    try:
        states = propagate(t0, hours, step_s, norad_id=norad_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    temps = predict(states, step_s)

    return [
        {
            "t": s["t"],
            "sun_angle_deg": s["sun_angle_deg"],
            "eclipse": s["eclipse"],
            "predicted_c": c,
        }
        for s, c in zip(states, temps)
    ]
