# Ephemeris

A physics-grounded digital-twin anomaly detector for spacecraft telemetry.

IBM Bob AI Builders Challenge — Space Exploration Theme
Team: Abdul Ghaffar (Track B) & Eman (Track A) · Deadline: 31 Aug 2026

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

## IBM Bob usage

IBM Bob is a required primary development tool for this challenge. Before
submission, replace this paragraph with a truthful, team-specific account of
how Abdul and Eman used IBM Bob—for example, the prompts or workflows used for
planning, code generation, debugging, tests, and documentation. Do not claim
usage that the team cannot substantiate.

## Repo layout

    backend/            FastAPI + physics core        (Track A — Abdul)
      physics/          propagation, predictor, simulator, detector
      api/              /predict, /anomaly, /explain
      fixtures/         committed sample responses for Track B
    frontend/           Next.js dashboard             (Track B — Eman)
      components/       chart, alert feed, explanation panel
      lib/              typed API clients

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
| `explain.py` | Abdul (table) / Eman (watsonx) | complete — deterministic fallback; Granite enabled with credentials |
| frontend | Abdul | complete — responsive telemetry dashboard with live/fixture fallback |
