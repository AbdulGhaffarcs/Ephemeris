"""Divergence scoring: residual -> z-score, CUSUM, severity, shape.

Two detectors, because they catch different things:
  * rolling z-score  -> spikes and step changes
  * CUSUM            -> slow drift, which a threshold alone will miss

Drift is the failure mode the pitch is built on, so CUSUM is not optional.

TODO (Abdul): tune WINDOW / Z_FLAG / CUSUM_K / CUSUM_FLAG per scenario so
nominal runs stay clean and all three injected faults trip.
"""

from __future__ import annotations

import statistics

WINDOW = 30        # samples in the rolling baseline
BURN_IN = 15       # samples before the baseline is trustworthy
Z_FLAG = 4.2
CUSUM_K = 0.6      # slack, in residual units
CUSUM_FLAG = 5.5


def score(predicted: list[float], observed: list[float]) -> list[dict]:
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

        flagged = i >= BURN_IN and (abs(z) > Z_FLAG or abs(cusum) > CUSUM_FLAG)
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
