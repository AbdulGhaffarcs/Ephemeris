# Ephemeris

A physics-grounded digital-twin anomaly detector for spacecraft telemetry.

IBM Bob AI Builders Challenge — Space Exploration Theme
Team: Abdul Ghaffar (Track A) & Eman (Track B) · Deadline: 31 Aug 2026

---

## What this is

A physics model predicts what a spacecraft subsystem *should* be doing from
orbital state (sun angle, eclipse timing). Live telemetry is compared against
that prediction. The residual — not the raw signal — is what gets scored for
anomalies, and what the AI layer explains.

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

Every module below is a working stub — it runs and returns contract-shaped data,
but the physics is placeholder. Search for `TODO` to find the real work.

| Module | Owner | State |
|---|---|---|
| `orbit_propagation.py` | Abdul/Eman | stub — circular orbit, needs SGP4/Skyfield |
| `thermal_model.py` | Abdul/Eman | stub — single node, needs tuning |
| `telemetry_sim.py` | Abdul/Eman | stub — needs albedo + lag to outgrow the predictor |
| `detector.py` | Abdul/Eman | stub — z-score works, CUSUM needs thresholds |
| `explain.py` | Abdul (table) / Eman (watsonx) | complete, needs credentials |
| frontend | Abdul/Eman | stub — layout and clients wired, styling open |
