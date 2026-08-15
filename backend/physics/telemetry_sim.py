"""The simulator. Deliberately richer than the predictor.

Extra physics the predictor does not have:
  * a longer thermal time constant (more mass than the model assumes)
  * an Earth-albedo / IR term that warms the panel even in eclipse
  * sensor noise

Extra behaviour the predictor cannot know about:
  * injectable faults

TODO (Abdul): add a small orbit-to-orbit variation so nominal runs are not
identical, and check that the nominal residual has visible structure rather
than sitting flat at zero.
"""

from __future__ import annotations

import math
import random

from physics.thermal_model import T_HOT_C, T_COLD_C, equilibrium_c

TAU_S = 1150.0          # the real panel is heavier than the model assumes
ALBEDO_GAIN_C = 6.0     # Earth-reflected + IR warming
NOISE_SIGMA_C = 0.35

SCENARIOS = ("nominal", "spike", "drift", "fault")


def _equilibrium_c(sun_angle_deg: float, eclipse: bool, orbit_phase: float) -> float:
    if eclipse:
        base = T_COLD_C
    else:
        illumination = max(0.0, math.cos(math.radians(sun_angle_deg)))
        base = T_COLD_C + (T_HOT_C - T_COLD_C) * illumination
    # Earth is a warm disc below the spacecraft in every phase
    albedo = ALBEDO_GAIN_C * (0.35 + 0.65 * math.cos(2 * math.pi * orbit_phase) ** 2)
    return base + albedo


def _fault_offset(scenario: str, i: int, n: int) -> float:
    """Anomaly injection. Faults start at 45% through the window."""
    onset = int(n * 0.45)
    if i < onset:
        return 0.0
    if scenario == "spike":
        return 14.0 if i < onset + 4 else 0.0
    if scenario == "drift":
        return 0.055 * (i - onset)          # slow monotonic climb
    if scenario == "fault":
        clear = int(n * 0.85)               # heater stuck ON, then recovers
        return 9.0 if i < clear else 0.0
    return 0.0


def simulate(states: list[dict], step_s: int, scenario: str = "nominal",
             t0_c: float | None = None, seed: int = 7) -> list[float]:
    if scenario not in SCENARIOS:
        raise ValueError(f"unknown scenario {scenario!r}; expected one of {SCENARIOS}")
    if not states:
        return []

    rng = random.Random(seed)
    alpha = step_s / TAU_S
    n = len(states)
    if t0_c is None:
        t0_c = equilibrium_c(states[0]["sun_angle_deg"], states[0]["eclipse"])
    temps, t_c = [], t0_c

    for i, s in enumerate(states):
        t_eq = _equilibrium_c(s["sun_angle_deg"], s["eclipse"], s["orbit_phase"])
        t_c += alpha * (t_eq - t_c)
        observed = t_c + _fault_offset(scenario, i, n) + rng.gauss(0, NOISE_SIGMA_C)
        temps.append(round(observed, 3))

    return temps
