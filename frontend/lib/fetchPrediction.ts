import { API_BASE, PredictionPoint, Sourced } from "./types";

const LIVE_TIMEOUT_MS = 4000;

/** Physics prediction alone, with no observed channel — used by views that show
 *  what the twin expects before any telemetry is overlaid. */
export async function fetchPrediction(
  hours = 3,
  stepS = 60,
  noradId = 25544
): Promise<Sourced<PredictionPoint[]>> {
  const qs = new URLSearchParams({
    norad_id: String(noradId),
    hours: String(hours),
    step_s: String(stepS),
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIVE_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/predict?${qs}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`backend returned ${res.status}`);
    return { data: (await res.json()) as PredictionPoint[], origin: "live" };
  } catch (e) {
    const res = await fetch("/api/fixtures/predict");
    if (!res.ok) throw new Error("Prediction unavailable — backend and fixture both failed");
    return {
      data: (await res.json()) as PredictionPoint[],
      origin: "fixture",
      note: e instanceof Error ? e.message : "backend unreachable",
    };
  } finally {
    clearTimeout(timer);
  }
}
