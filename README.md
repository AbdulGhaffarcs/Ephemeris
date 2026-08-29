# Ephemeris

A physics-grounded digital-twin anomaly detector for spacecraft telemetry.

IBM Bob AI Builders Challenge — Space Exploration Theme
Team: Eman (Track A) & Abdul Ghaffar (Track B)

---

## What this is

A physics model predicts what a spacecraft subsystem *should* be doing from
orbital state (sun angle, eclipse timing). Live telemetry is compared against
that prediction. The residual — not the raw signal — is what gets scored for
anomalies, and what the AI layer explains.

## Challenge theme

**Advance Space Exploration with AI.** Ephemeris supports safer spacecraft
operations by converting orbital conditions and temperature telemetry into a
clear, ranked explanation for an operator. It is designed around the theme's
goal of moving mission operations from data-heavy monitoring to insight-driven
decision support.

## Problem statement

Satellite operators receive dense streams of telemetry but must decide quickly
whether a temperature change is expected orbital behaviour, a sensor issue, a
thermal-control fault, or a flaw in their own model. Threshold alerts on raw
temperature cannot make that distinction and create noise at eclipse entry and
exit.

## Solution

Ephemeris is a physics-grounded digital twin for a spacecraft thermal panel.
It propagates the ISS orbit, derives illumination and eclipse state, predicts
the expected panel temperature, and scores the **residual** between predicted
and observed values. The dashboard groups flagged samples into operator-sized
events, visualises the evidence, and provides a bounded explanation with a
recommended next action.

## AI approach and architecture

```text
ISS TLE → SGP4/Skyfield propagation → sun angle + eclipse state
                                      │
                                      ├→ thermal predictor → expected temperature
simulated/observed telemetry ────────┘
                 │
                 ▼
       residual (observed − predicted)
                 │
        rolling z-score + CUSUM
                 │
      event grouping + feature extraction
                 │
    fault-signature classifier → Granite or deterministic fallback
                 │
                 ▼
       Next.js operator dashboard and recommended action
```

The physics layer makes the AI explanation auditable: the language model sees
derived, bounded features instead of unrestricted raw telemetry, can select
only from a closed signature catalog, and has every numerical claim validated.
When watsonx credentials are not configured, the same contract is served by a
deterministic explanation template so the prototype remains usable offline.

## Eman's contribution — Track A: Physics & Detection

- **`orbit_propagation.py`** — Replaced the initial circular-orbit placeholder
  with real SGP4/Skyfield propagation against a cached ISS TLE. Computes sun
  angle, eclipse state, and orbit phase, with an offline TLE fallback. Eclipse
  timing was cross-validated against real published ISS pass data (N2YO).

- **`telemetry_sim.py`** — The richer, "ground truth" simulator that models
  what the predictor deliberately doesn't: longer thermal lag, phase-dependent
  albedo, sensor noise, small per-orbit variation, and three injectable fault
  types (spike, drift, hard-fault) for testing the detector.

- **`detector.py`** — Combines a rolling z-score (catches sudden spikes and
  step changes) with CUSUM (catches slow gradual drift that a threshold alone
  would miss). Thresholds were tuned and stress-tested across multiple time
  windows (2–12 hours) to eliminate false alarms on nominal data while keeping
  all three injected fault types reliably detectable.

- **`explain.py` (signature table, above the seam)** — Built the fault-signature
  catalog and pre-classification logic that turns a detected residual shape
  into a bounded set of candidate explanations for the AI layer to choose from.

- **API contract & validation** — `/predict` and `/anomaly` endpoints, including
  input validation (e.g. proper 404s on unsupported satellite IDs instead of
  silently returning wrong data).

## My contribution — Abdul (Track B: Dashboard & AI Experience)

- **Operator dashboard** — Built the responsive Next.js telemetry dashboard,
  including the anomaly chart, alert feed, and explanation panel used to turn
  detector output into an operator-ready view.

- **Thermal model (`thermal_model.py`)** — Developed the single-node
  lumped-capacitance predictor that estimates panel temperature from sun angle,
  eclipse state, equilibrium temperatures, and thermal time constants.

- **Live data integration** — Connected the frontend to the backend's typed
  `/predict`, `/anomaly`, and `/explain` API responses, with fixture fallback
  so the interface remains usable during offline development.

- **AI explanation experience** — Integrated the watsonx/Granite explanation
  flow and the deterministic fallback so explanations and recommended actions
  remain available when credentials are not configured.

- **Completion, debugging & verification** — Verified the frontend production
  build and the dashboard's live telemetry flow across nominal, spike, drift,
  and fault scenarios.

## IBM Bob usage

We used IBM Bob throughout development on both tracks.

On the physics/detection side (Track A — Eman), Bob was used to
[describe: e.g. scaffold the SGP4/Skyfield integration, debug the
eclipse-fraction and CUSUM-latching bugs found during testing, iterate on
detector threshold tuning across test scenarios].

On the platform side (Track B — Abdul), Bob was used to
[describe: e.g. scaffold the Next.js dashboard components, wire the watsonx
Granite integration, debug frontend data fetching against the live backend].

Exported chat sessions are included under `bob-sessions/` as supporting
evidence.

## Repo layout

    backend/            FastAPI + physics core        (Track A — Eman)
      physics/          propagation, predictor, simulator, detector
      api/              /predict, /anomaly, /explain
      fixtures/         committed sample responses for Track B
    frontend/           Next.js dashboard             (Track B — Abdul)
      components/       chart, alert feed, explanation panel
      lib/              typed API clients
    Sessions/           exported IBM Bob chat history (evidence of tool usage)

## The one rule that governs both tracks

`telemetry_sim.py` must stay **richer** than `thermal_model.py` — extra physics
terms, sensor noise, deliberately mismatched constants. If both sides share one
model the residual is zero except where a fault was injected, and the detector
is only rediscovering its own injections.

## Run the backend

    cd backend
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env          # add watsonx credentials
    uvicorn main:app --reload --port 8000

Open http://localhost:8000/docs

## Run the frontend

    cd frontend
    npm install
    cp .env.local.example .env.local
    npm run dev

Open http://localhost:3000

Until the backend is live, the dashboard falls back to `backend/fixtures/`.
Track B is never blocked.

For the three-minute problem, architecture, and live walkthrough, see
[`DEMO_SCRIPT.md`](DEMO_SCRIPT.md).

## Status

The application is ready to run locally. It combines TLE-based ISS propagation,
a deliberately simpler physics predictor, richer simulated telemetry, residual
anomaly detection, and a typed dashboard with live/fixture fallback.

| Module | Owner | State |
|---|---|---|
| `orbit_propagation.py` | Eman | complete — SGP4/Skyfield propagation with eclipse detection and cache fallback |
| `thermal_model.py` | Abdul | complete — single-node thermal predictor |
| `telemetry_sim.py` | Eman | complete — albedo, thermal lag, per-orbit variation, noise, and fault injection |
| `detector.py` | Eman | complete — rolling z-score plus CUSUM |
| `explain.py` | Eman (table) / Abdul (watsonx) | complete — deterministic fallback; Granite enabled with credentials |
| frontend | Abdul | complete — responsive telemetry dashboard with live/fixture fallback |
