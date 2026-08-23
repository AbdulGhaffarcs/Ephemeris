"""Divergence scoring: residual -> z-score, CUSUM, severity, shape.

Two detectors, because they catch different things:
  * rolling z-score  -> spikes and step changes
  * CUSUM            -> slow drift, which a threshold alone will miss

Drift is the failure mode the pitch is built on, so CUSUM is not optional.

The thresholds keep nominal runs clear while detecting the injected spike,
slow drift, and sustained heater-fault scenarios.
"""

from __future__ import annotations

import statistics

WINDOW = 30        # samples in the rolling baseline
BURN_IN = 15       # samples before the baseline is trustworthy
Z_FLAG = 4.2
CUSUM_K = 0.6      # slack, in residual units
CUSUM_FLAG = 5.5
# A CUSUM excursion alone can be caused by the twin's small, phase-dependent
# nominal mismatch.  Require a material absolute residual too, so that pattern
# is not promoted to an operator alert while genuine drift still accumulates.
CUSUM_MIN_RESIDUAL_C = 1.5


def score(predicted: list[float], observed: list[float]) -> list[dict]:
    if len(predicted) != len(observed):
        raise ValueError("predicted and observed series must have the same length")
    residuals = [round(o - p, 3) for p, o in zip(predicted, observed)]
    out, cusum_hi, cusum_lo = [], 0.0, 0.0

    for i, r in enumerate(residuals):
        base = residuals[max(0, i - WINDOW):i] or [0.0]
        mu = statistics.fmean(base)
        sigma = statistics.pstdev(base) if len(base) > 2 else 1.0
        sigma = max(sigma, 0.25)                     # noise floor
        z = (r - mu) / sigma

        cusum_hi = max(0.0, cusum_hi + (r - mu) - CUSUM_K)
        cusum_lo = min(0.0, cusum_lo + (r - mu) + CUSUM_K)
        cusum = cusum_hi if abs(cusum_hi) >= abs(cusum_lo) else cusum_lo

        cusum_alert = (
            abs(cusum) > CUSUM_FLAG and abs(r) >= CUSUM_MIN_RESIDUAL_C
        )
        flagged = i >= BURN_IN and (abs(z) > Z_FLAG or cusum_alert)
        severity = min(1.0, max(abs(z) / (Z_FLAG * 2), abs(cusum) / (CUSUM_FLAG * 2)))
        if abs(cusum) > CUSUM_FLAG:
            cusum_hi, cusum_lo = 0.0, 0.0        # reset so the alert does not latch

        out.append({
            "residual": r,
            "zscore": round(z, 3),
            "cusum": round(cusum, 3),
            "flagged": flagged,
            "severity": round(severity, 3),
        })

    return out
