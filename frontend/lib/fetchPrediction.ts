import { API_BASE, PredictionPoint } from "./types";

export async function fetchPrediction(
  hours = 3,
  stepS = 60,
  noradId = 25544
): Promise<PredictionPoint[]> {
  const qs = new URLSearchParams({
    norad_id: String(noradId),
    hours: String(hours),
    step_s: String(stepS),
  });
  const res = await fetch(`${API_BASE}/predict?${qs}`);
  if (!res.ok) throw new Error(`Prediction unavailable (${res.status})`);
  return res.json();
}
