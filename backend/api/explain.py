"""
Ephemeris — /explain
Structured divergence data -> Granite -> operator-facing explanation.

Design contract:
  1. Granite NEVER free-invents a cause. It selects from a closed candidate
     list produced by a deterministic pre-classifier.
  2. Granite receives derived FEATURES (residual statistics, orbital-phase
     correlation, slope, duration) -- never raw telemetry rows.
  3. Every number in the output is validated against the input payload.
     Ungrounded numerics -> one retry -> template fallback.
  4. "Model error, not spacecraft fault" is a first-class allowed verdict.

Confirm the watsonx endpoint + model id against the challenge docs before
demo day; the call is isolated in _call_granite() so it is a one-line swap.
"""

from __future__ import annotations

import os
import re
import json
import hashlib
import statistics
from dataclasses import dataclass, asdict, field
from typing import Any, Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

# ----------------------------------------------------------------------------
# 1. FAULT SIGNATURE TABLE
# ----------------------------------------------------------------------------
# This is the knowledge base. Granite may only choose a `cause` that appears
# here. Edit the wording freely -- it is quoted almost verbatim into the
# prompt, so it is also the tuning surface for explanation quality.

Shape = Literal[
    "spike", "step_up", "step_down", "drift_up", "drift_down",
    "oscillation", "flatline", "phase_locked", "nominal",
]


@dataclass
class FaultSignature:
    id: str
    shape: Shape
    phase_note: str            # what orbital phase correlation to expect
    causes: list[str]          # ranked, most likely first
    discriminator: str         # what would confirm/deny this hypothesis
    action: str                # operator-facing recommendation
    is_model_error: bool = False


SIGNATURES: list[FaultSignature] = [
    FaultSignature(
        id="THERM-SPK-01",
        shape="spike",
        phase_note="no correlation with eclipse state; duration under ~3 min",
        causes=[
            "transient heater latch-up",
            "single-event upset on the temperature sensor ADC",
            "short-duration payload load dump",
        ],
        discriminator="Check whether adjacent sensors on the same panel moved together. "
                      "A single-sensor excursion favours an ADC upset; a correlated one favours a real thermal event.",
        action="Log and monitor. Escalate only if the spike repeats within one orbit.",
    ),
    FaultSignature(
        id="THERM-STU-01",
        shape="step_up",
        phase_note="offset persists across both sunlit and eclipse phases",
        causes=[
            "survival heater stuck ON",
            "thermostat failed closed",
            "radiator surface partially obstructed or degraded",
        ],
        discriminator="If the offset is constant in both phases, suspect a heater or thermostat. "
                      "If it grows in sunlight only, suspect the radiator or optical coating.",
        action="Command the heater circuit OFF and confirm the residual collapses. "
               "If it does not, isolate the thermostat.",
    ),
    FaultSignature(
        id="THERM-STD-01",
        shape="step_down",
        phase_note="offset persists across both phases, deepest during eclipse",
        causes=[
            "survival heater failed OFF",
            "thermostat failed open",
            "loss of a heater power channel",
        ],
        discriminator="Cross-check heater current draw. Zero current with a commanded-ON state "
                      "confirms a failed element or open channel.",
        action="Switch to the redundant heater string before the next eclipse entry. "
               "Verify the component stays above its survival limit.",
    ),
    FaultSignature(
        id="THERM-DRU-01",
        shape="drift_up",
        phase_note="slow monotonic rise over multiple orbits, sunlit phase steepest",
        causes=[
            "radiator or optical solar reflector degradation",
            "MLI blanket degradation increasing absorbed flux",
            "temperature sensor calibration drift (bias, not physical)",
        ],
        discriminator="A real thermal drift steepens with sun exposure; a sensor calibration drift "
                      "is flat across phases. Compare the sunlit-only slope against the eclipse-only slope.",
        action="Trend over the next 20 orbits. If the sunlit slope exceeds the eclipse slope, "
               "plan a duty-cycle reduction for the affected component.",
    ),
    FaultSignature(
        id="THERM-DRD-01",
        shape="drift_down",
        phase_note="slow monotonic fall, roughly equal in both phases",
        causes=[
            "temperature sensor calibration drift",
            "gradual decline in available heater power",
            "progressive loss of thermal isolation to a cold interface",
        ],
        discriminator="If the drift is phase-independent and the heater duty cycle is unchanged, "
                      "sensor calibration is the leading hypothesis.",
        action="Schedule a sensor recalibration against the redundant probe. "
               "Do not command heater changes on this evidence alone.",
    ),
    FaultSignature(
        id="THERM-OSC-01",
        shape="oscillation",
        phase_note="periodic residual at a frequency unrelated to the orbital period",
        causes=[
            "thermostat cycling near its setpoint",
            "control-loop instability after a gain change",
        ],
        discriminator="Compare the residual period against the thermostat deadband crossing time. "
                      "A match confirms setpoint hunting.",
        action="Widen the thermostat deadband or retune the loop. Not urgent unless the "
               "cycle count threatens relay life.",
    ),
    FaultSignature(
        id="THERM-FLT-01",
        shape="flatline",
        phase_note="observed value frozen while the prediction continues to vary",
        causes=[
            "temperature sensor failed and latched at last value",
            "telemetry frame stale or dropped",
        ],
        discriminator="If other channels in the same frame are also static, the frame is stale "
                      "and the sensor is fine.",
        action="Verify frame counters before declaring a sensor failure. "
               "Switch to the redundant probe if the frame is live.",
    ),
    FaultSignature(
        id="MODEL-ECX-01",
        shape="phase_locked",
        phase_note="residual appears only within ~10 min of eclipse exit, then decays",
        causes=[
            "model error: solar absorptivity constant mismatched",
            "attitude or sun-vector error feeding the wrong incident flux",
        ],
        discriminator="If the residual is repeatable at every eclipse exit and returns to zero "
                      "in between, this is a modelling gap, not a spacecraft fault.",
        action="No spacecraft action. Recalibrate the absorptivity term, or verify the "
               "attitude solution against the sun sensor.",
        is_model_error=True,
    ),
    FaultSignature(
        id="MODEL-ECN-01",
        shape="phase_locked",
        phase_note="negative residual only at eclipse entry, decaying exponentially",
        causes=[
            "model error: thermal mass underestimated, predictor cools too fast",
        ],
        discriminator="Fit the decay constant. If it is consistent every orbit, it is a fixed "
                      "thermal-capacitance error in the predictor.",
        action="No spacecraft action. Increase the lumped thermal capacitance in the model.",
        is_model_error=True,
    ),
]

SIGNATURE_BY_ID = {s.id: s for s in SIGNATURES}


# ----------------------------------------------------------------------------
# 2. FEATURE EXTRACTION  (raw window -> bounded, quotable numbers)
# ----------------------------------------------------------------------------

class AnomalyPoint(BaseModel):
    t: str
    predicted_c: float
    observed_c: float
    residual: float
    zscore: float
    cusum: float
    eclipse: bool
    sun_angle_deg: float
    flagged: bool
    severity: float


class ExplainRequest(BaseModel):
    window: list[AnomalyPoint] = Field(..., min_length=3)
    subsystem: str = "thermal_panel_a"
    norad_id: int | None = None


@dataclass
class Features:
    """Everything Granite is allowed to see, and the only numbers it may cite."""
    subsystem: str
    duration_min: float
    peak_residual_c: float
    mean_residual_c: float
    residual_slope_c_per_hr: float
    peak_zscore: float
    peak_severity: float
    sunlit_mean_residual_c: float
    eclipse_mean_residual_c: float
    phase_correlation: str
    sample_count: int
    shape: Shape
    candidate_ids: list[str] = field(default_factory=list)


def _slope(xs: list[float], ys: list[float]) -> float:
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    denom = sum((x - mx) ** 2 for x in xs) or 1e-9
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / denom


def classify(window: list[AnomalyPoint]) -> Shape:
    """Deterministic pre-classifier. Granite does not do this step."""
    res = [p.residual for p in window]
    n = len(res)
    mins = [i for i in range(n)]  # index proxy for time; step is uniform
    peak = max(res, key=abs)
    mean = statistics.fmean(res)
    slope = _slope([float(i) for i in mins], res)

    observed = [p.observed_c for p in window]
    if max(observed) - min(observed) < 0.05:
        return "flatline"

    flagged_frac = sum(1 for p in window if p.flagged) / n
    if flagged_frac < 0.05:
        return "nominal"

    # phase-locked: flagged points cluster on one side of an eclipse boundary
    boundary_hits = sum(
        1 for i, p in enumerate(window)
        if p.flagged and i > 0 and window[i - 1].eclipse != p.eclipse
    )
    if flagged_frac < 0.35 and boundary_hits > 0:
        return "phase_locked"

    if flagged_frac < 0.15 and abs(peak) > 3 * abs(mean or 1e-9):
        return "spike"

    sign_changes = sum(1 for a, b in zip(res, res[1:]) if a * b < 0)
    if sign_changes > n * 0.3:
        return "oscillation"

    if abs(slope) * n > abs(mean) * 0.5:
        return "drift_up" if slope > 0 else "drift_down"

    return "step_up" if mean > 0 else "step_down"


def extract(req: ExplainRequest) -> Features:
    w = req.window
    res = [p.residual for p in w]
    sunlit = [p.residual for p in w if not p.eclipse]
    eclipsed = [p.residual for p in w if p.eclipse]
    step_min = 1.0  # minutes per sample; wire to your /anomaly step_s
    slope = _slope([float(i) * step_min / 60 for i in range(len(res))], res)

    s_mean = round(statistics.fmean(sunlit), 2) if sunlit else 0.0
    e_mean = round(statistics.fmean(eclipsed), 2) if eclipsed else 0.0
    if not sunlit or not eclipsed:
        phase = "insufficient coverage of both phases in this window"
    elif abs(s_mean - e_mean) < 0.3:
        phase = "residual is phase-independent (similar in sunlight and eclipse)"
    elif abs(s_mean) > abs(e_mean):
        phase = "residual is stronger in sunlight"
    else:
        phase = "residual is stronger in eclipse"

    shape = classify(w)
    candidates = [s.id for s in SIGNATURES if s.shape == shape]

    return Features(
        subsystem=req.subsystem,
        duration_min=round(len(w) * step_min, 1),
        peak_residual_c=round(max(res, key=abs), 2),
        mean_residual_c=round(statistics.fmean(res), 2),
        residual_slope_c_per_hr=round(slope, 3),
        peak_zscore=round(max((p.zscore for p in w), key=abs), 2),
        peak_severity=round(max(p.severity for p in w), 2),
        sunlit_mean_residual_c=s_mean,
        eclipse_mean_residual_c=e_mean,
        phase_correlation=phase,
        sample_count=len(w),
        shape=shape,
        candidate_ids=candidates,
    )


# ----------------------------------------------------------------------------
# 3. PROMPT
# ----------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are the explanation layer of Ephemeris, a spacecraft telemetry monitor.

A physics model predicts what a subsystem should be doing from orbital state
(sun angle, eclipse timing, orbital position). A detector has measured the gap
between that prediction and observed telemetry. You explain that gap to a
mission operator.

Hard rules:
1. Choose your explanation ONLY from the candidate causes supplied. Never
   introduce a cause that is not in the list.
2. Cite ONLY numbers that appear in the divergence data given to you. Do not
   compute new figures, do not estimate, do not round differently.
3. If the candidates include a model-error hypothesis and the evidence fits it,
   say so plainly. A modelling gap is a legitimate finding, not a failure.
4. If the evidence does not clearly favour any candidate, set
   likely_cause to "indeterminate" and say what additional data would resolve it.
5. Write for an operator on console: direct, specific, no hedging filler and no
   restating of the input.

Respond with a single JSON object and nothing else. No markdown, no backticks.
Schema:
{
  "headline": "one sentence, under 20 words, states the physical gap",
  "reasoning": "2-4 sentences: what the residual shape and phase behaviour imply",
  "likely_cause": "exact string from the candidate causes, or 'indeterminate'",
  "signature_id": "the id of the signature you selected, or null",
  "is_model_error": true or false,
  "confidence": 0.0 to 1.0,
  "recommended_action": "one or two sentences, concrete and commandable"
}"""


def build_user_prompt(f: Features) -> str:
    lines = [
        f"SUBSYSTEM: {f.subsystem}",
        "",
        "DIVERGENCE DATA (observed minus physics prediction):",
        f"  window duration:        {f.duration_min} min ({f.sample_count} samples)",
        f"  peak residual:          {f.peak_residual_c} C",
        f"  mean residual:          {f.mean_residual_c} C",
        f"  residual slope:         {f.residual_slope_c_per_hr} C/hr",
        f"  peak z-score:           {f.peak_zscore}",
        f"  peak severity:          {f.peak_severity}",
        f"  mean residual sunlit:   {f.sunlit_mean_residual_c} C",
        f"  mean residual eclipse:  {f.eclipse_mean_residual_c} C",
        f"  orbital phase pattern:  {f.phase_correlation}",
        f"  detected shape:         {f.shape}",
        "",
        "CANDIDATE SIGNATURES:",
    ]
    for sid in f.candidate_ids:
        s = SIGNATURE_BY_ID[sid]
        lines.append(f"  [{s.id}] expected pattern: {s.phase_note}")
        for c in s.causes:
            lines.append(f"      cause: {c}")
        lines.append(f"      discriminator: {s.discriminator}")
        lines.append(f"      standard action: {s.action}")
        lines.append(f"      model error rather than spacecraft fault: {s.is_model_error}")
        lines.append("")
    if not f.candidate_ids:
        lines.append("  (none matched — return likely_cause 'indeterminate')")
    return "\n".join(lines)


# ----------------------------------------------------------------------------
# 4. GROUNDING VALIDATOR
# ----------------------------------------------------------------------------

_NUM = re.compile(r"-?\d+\.?\d*")


def allowed_numbers(f: Features) -> set[str]:
    vals = [
        f.duration_min, f.peak_residual_c, f.mean_residual_c,
        f.residual_slope_c_per_hr, f.peak_zscore, f.peak_severity,
        f.sunlit_mean_residual_c, f.eclipse_mean_residual_c, f.sample_count,
    ]
    out: set[str] = set()
    for v in vals:
        out.add(str(v))
        out.add(str(abs(v)))
        out.add(str(round(abs(v))))
        out.add(str(int(abs(v))))
    return out


def is_grounded(text: str, f: Features) -> tuple[bool, list[str]]:
    """Reject any numeric the model did not receive. This is the anti-narration guard."""
    ok = allowed_numbers(f)
    bad = [n for n in _NUM.findall(text) if n.lstrip("-") not in ok and n.lstrip("-") not in {"0", "1", "2"}]
    return (not bad), bad


# ----------------------------------------------------------------------------
# 5. GRANITE CALL + FALLBACK
# ----------------------------------------------------------------------------

WATSONX_URL = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
WATSONX_MODEL = os.getenv("WATSONX_MODEL", "ibm/granite-3-8b-instruct")
WATSONX_PROJECT = os.getenv("WATSONX_PROJECT_ID", "")
WATSONX_KEY = os.getenv("WATSONX_API_KEY", "")

_CACHE: dict[str, dict[str, Any]] = {}


def _cache_key(f: Features) -> str:
    blob = f"{f.shape}|{f.subsystem}|{round(f.peak_residual_c,1)}|{round(f.peak_severity,1)}"
    return hashlib.sha1(blob.encode()).hexdigest()[:16]


async def _call_granite(system: str, user: str) -> str:
    payload = {
        "model_id": WATSONX_MODEL,
        "project_id": WATSONX_PROJECT,
        "input": f"{system}\n\n{user}\n\nJSON:",
        "parameters": {
            "decoding_method": "greedy",
            "max_new_tokens": 400,
            "stop_sequences": ["\n\n\n"],
        },
    }
    headers = {"Authorization": f"Bearer {WATSONX_KEY}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=25) as client:
        r = await client.post(
            f"{WATSONX_URL}/ml/v1/text/generation?version=2024-05-31",
            json=payload, headers=headers,
        )
        r.raise_for_status()
        return r.json()["results"][0]["generated_text"]


def _parse(raw: str) -> dict[str, Any]:
    cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object in model output")
    return json.loads(cleaned[start:end + 1])


def template_explanation(f: Features) -> dict[str, Any]:
    """Deterministic fallback. The demo must never show an empty panel."""
    if not f.candidate_ids:
        return {
            "headline": f"Observed {f.subsystem} deviates from prediction with no matching signature.",
            "reasoning": f"Peak residual {f.peak_residual_c} C at z={f.peak_zscore}. {f.phase_correlation}. "
                         "The pattern does not match a catalogued signature.",
            "likely_cause": "indeterminate",
            "signature_id": None,
            "is_model_error": False,
            "confidence": 0.2,
            "recommended_action": "Extend the observation window across a full orbit before acting.",
            "source": "template",
        }
    s = SIGNATURE_BY_ID[f.candidate_ids[0]]
    return {
        "headline": f"{f.subsystem} runs {f.peak_residual_c} C off the physics prediction ({f.shape}).",
        "reasoning": f"{f.phase_correlation}. Peak z-score {f.peak_zscore} over {f.duration_min} min. "
                     f"{s.discriminator}",
        "likely_cause": s.causes[0],
        "signature_id": s.id,
        "is_model_error": s.is_model_error,
        "confidence": 0.5,
        "recommended_action": s.action,
        "source": "template",
    }


# ----------------------------------------------------------------------------
# 6. ROUTE
# ----------------------------------------------------------------------------

@router.post("/explain")
async def explain(req: ExplainRequest) -> dict[str, Any]:
    f = extract(req)

    if f.shape == "nominal":
        return {
            "headline": "Observed telemetry tracks the physics prediction.",
            "reasoning": f"Mean residual {f.mean_residual_c} C across {f.duration_min} min. No flagged divergence.",
            "likely_cause": None, "signature_id": None, "is_model_error": False,
            "confidence": 0.95, "recommended_action": "No action required.",
            "source": "rule", "features": asdict(f),
        }

    key = _cache_key(f)
    if key in _CACHE:
        return {**_CACHE[key], "features": asdict(f), "cached": True}

    if not WATSONX_KEY:
        return {**template_explanation(f), "features": asdict(f)}

    user = build_user_prompt(f)
    for attempt in range(2):
        try:
            raw = await _call_granite(SYSTEM_PROMPT, user)
            out = _parse(raw)
            prose = f"{out.get('headline','')} {out.get('reasoning','')} {out.get('recommended_action','')}"
            grounded, bad = is_grounded(prose, f)
            valid_cause = (
                out.get("likely_cause") == "indeterminate"
                or any(out.get("likely_cause") in SIGNATURE_BY_ID[c].causes for c in f.candidate_ids)
            )
            if grounded and valid_cause:
                out["source"] = "granite"
                _CACHE[key] = out
                return {**out, "features": asdict(f)}
            if attempt == 0:
                problems = []
                if not grounded:
                    problems.append(f"you cited numbers not in the data: {bad}")
                if not valid_cause:
                    problems.append("likely_cause was not one of the supplied candidate causes")
                user += "\n\nYour previous answer was rejected because " + "; ".join(problems) + ". Retry."
        except Exception:
            break

    return {**template_explanation(f), "features": asdict(f)}


# Wire into main.py:
#   from api.explain import router as explain_router
#   app.include_router(explain_router)
