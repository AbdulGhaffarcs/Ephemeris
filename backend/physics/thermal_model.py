"""The predictor. Deliberately simple.

Single-node lumped-capacitance model: the panel relaxes toward an equilibrium
temperature set by incident solar flux, with one time constant.

This model does NOT know about albedo, Earth IR, or sensor behaviour. That is
the point — see telemetry_sim.py. Keeping the predictor simpler than reality is
what gives the residual real structure.

The constants intentionally remain close to, but distinct from, the simulator
so nominal residuals are structured without resembling injected faults.
"""

from __future__ import annotations

import math

T_HOT_C = 28.0      # equilibrium in full sun
T_COLD_C = -25.0    # equilibrium in eclipse
TAU_S = 1050.0      # thermal time constant, seconds
EARTH_IR_GAIN_C = 5.0   # coarse approximation of Earth-reflected warming


def equilibrium_c(sun_angle_deg: float, eclipse: bool) -> float:
    """The predictor's flat Earth-IR term is deliberately cruder than the
    phase-dependent albedo in telemetry_sim — that mismatch is the residual."""
    base = T_COLD_C
    if not eclipse:
        illumination = max(0.0, math.cos(math.radians(sun_angle_deg)))
        base += (T_HOT_C - T_COLD_C) * illumination
    return base + EARTH_IR_GAIN_C * 0.7


def predict(states: list[dict], step_s: int, t0_c: float | None = None) -> list[float]:
    """Integrate the single-node model over a list of orbital states.

    Seeds at the first equilibrium so the run does not open with a startup
    transient the detector would read as a fault.
    """
    if not states:
        return []
    temps = []
    t_c = t0_c if t0_c is not None else equilibrium_c(
        states[0]["sun_angle_deg"], states[0]["eclipse"])
    alpha = step_s / TAU_S
    for s in states:
        t_eq = equilibrium_c(s["sun_angle_deg"], s["eclipse"])
        t_c += alpha * (t_eq - t_c)
        temps.append(round(t_c, 3))
    return temps
