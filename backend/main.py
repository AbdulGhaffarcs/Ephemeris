"""Ephemeris backend entrypoint.

    uvicorn main:app --reload --port 8000
"""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.predict import router as predict_router
from api.anomaly import router as anomaly_router
from api.explain import router as explain_router

app = FastAPI(
    title="Ephemeris",
    description="Physics-grounded digital-twin anomaly detector for spacecraft telemetry",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict_router, tags=["physics"])
app.include_router(anomaly_router, tags=["detection"])
app.include_router(explain_router, tags=["ai"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "ephemeris"}
