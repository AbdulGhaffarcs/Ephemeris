"""GET /anomaly — predicted vs. observed, with divergence scoring."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Query

from physics.orbit_propagation import propagate
from physics.thermal_model import predict
from physics.telemetry_sim import simulate, SCENARIOS
from physics.detector import score

router = APIRouter()


@router.get("/anomaly")
def get_anomalies(
    norad_id: int = Query(25544),
    start: str | None = Query(None),
    hours: float = Query(3.0, ge=0.1, le=48),
    step_s: int = Query(60, ge=10, le=600),
    scenario: str = Query("nominal", description=f"one of {SCENARIOS}"),
):
    t0 = datetime.fromisoformat(start) if start else datetime.now(timezone.utc)
    states = propagate(t0, hours, step_s)
    predicted = predict(states, step_s)
    observed = simulate(states, step_s, scenario)
    scored = score(predicted, observed)

    return [
        {
            "t": s["t"],
            "sun_angle_deg": s["sun_angle_deg"],
            "eclipse": s["eclipse"],
            "predicted_c": p,
            "observed_c": o,
            **sc,
        }
        for s, p, o, sc in zip(states, predicted, observed, scored)
    ]
