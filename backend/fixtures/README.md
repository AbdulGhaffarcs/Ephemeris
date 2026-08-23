# Fixtures

Contract-shaped fallback responses for the dashboard when the live backend is
unavailable.

Track B develops against these until integration checkpoint 1 (22 Aug), so the
frontend is never blocked on the physics core.

| File | Endpoint |
|---|---|
| `predict.json` | `GET /predict` |
| `anomaly.nominal.json` | `GET /anomaly?scenario=nominal` |
| `anomaly.spike.json` | `GET /anomaly?scenario=spike` |
| `anomaly.drift.json` | `GET /anomaly?scenario=drift` |
| `anomaly.fault.json` | `GET /anomaly?scenario=fault` |
| `explain.json` | `POST /explain` |

Regenerate after any contract change — and commit the regenerated fixture in
the **same commit** as the change, so the two tracks never disagree silently.
