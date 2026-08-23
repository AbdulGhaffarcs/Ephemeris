"""The simulator. Deliberately richer than the predictor.

Extra physics the predictor does not have:
  * a longer thermal time constant (more mass than the model assumes)
  * an Earth-albedo / IR term that warms the panel even in eclipse
  * sensor noise
  * small per-orbit variation (beta-angle drift, attitude jitter)

Extra behaviour the predictor cannot know about:
  * injectable faults
"""

from __future__ import annotations

import math
import random

from physics.thermal_model import T_HOT_C, T_COLD_C, equilibrium_c

TAU_S = 1150.0          # the real panel is heavier than the model assumes
ALBEDO_GAIN_C = 6.0     # Earth-reflected + IR warming
NOISE_SIGMA_C = 0.35

SCENARIOS = ("nominal", "spike", "drift", "fault")


def _equilibrium_c(
    sun_angle_deg: float,
    eclipse: bool,
    orbit_phase: float,
    albedo_offset_c: float = 0.0,
) -> float:
    if eclipse:
        base = T_COLD_C
    else:
        illumination = max(0.0, math.cos(math.radians(sun_angle_deg)))
        base = T_COLD_C + (T_HOT_C - T_COLD_C) * illumination
    # Earth is a warm disc below the spacecraft in every phase.
    # albedo_offset_c is a per-orbit jitter that makes successive orbits subtly
    # different (models beta-angle drift / attitude variation the predictor lacks).
    albedo = (ALBEDO_GAIN_C + albedo_offset_c) * (
        0.35 + 0.65 * math.cos(2 * math.pi * orbit_phase) ** 2
    )
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


# Maximum magnitude of the per-orbit albedo jitter (°C).  Kept well below the
# detector's noise floor (NOISE_SIGMA_C=0.35, Z_FLAG=4.2) so nominal runs never
# trip the anomaly detector, but large enough to produce visible orbit structure
# in the residual plot.
ORBIT_JITTER_C = 0.4


def simulate(states: list[dict], step_s: int, scenario: str = "nominal",
             t0_c: float | None = None, seed: int = 7) -> list[float]:
    if scenario not in SCENARIOS:
        raise ValueError(f"unknown scenario {scenario!r}; expected one of {SCENARIOS}")
    if not states:
        return []

    # Two independent RNGs from the same seed so that adding orbit jitter does
    # not perturb the per-sample noise sequence (keeps nominal runs identical
    # to the pre-jitter baseline and preserves all scenario flag counts).
    rng_noise = random.Random(seed)           # per-sample Gaussian noise
    rng_orbit = random.Random(seed ^ 0xABCD)  # per-orbit jitter draws only

    alpha = step_s / TAU_S
    n = len(states)
    if t0_c is None:
        t0_c = equilibrium_c(states[0]["sun_angle_deg"], states[0]["eclipse"])
    temps, t_c = [], t0_c

    # --- per-orbit jitter setup -------------------------------------------------
    # Detect orbit boundaries: orbit_phase wraps from ≥0.9 back to <0.1.
    # At each wrap we draw ONE new offset from rng_orbit (fully reproducible).
    # Using a separate RNG keeps rng_noise's sequence unchanged vs. pre-jitter.
    prev_phase = states[0]["orbit_phase"]
    orbit_offset = rng_orbit.uniform(-ORBIT_JITTER_C, ORBIT_JITTER_C)
    # ---------------------------------------------------------------------------

    for i, s in enumerate(states):
        phase = s["orbit_phase"]
        # New orbit starts when phase wraps (≥0.9 → <0.1)
        if prev_phase >= 0.9 and phase < 0.1:
            orbit_offset = rng_orbit.uniform(-ORBIT_JITTER_C, ORBIT_JITTER_C)
        prev_phase = phase

        t_eq = _equilibrium_c(s["sun_angle_deg"], s["eclipse"], phase, orbit_offset)
        t_c += alpha * (t_eq - t_c)
        observed = t_c + _fault_offset(scenario, i, n) + rng_noise.gauss(0, NOISE_SIGMA_C)
        temps.append(round(observed, 3))

    return temps
