import { API_BASE, AnomalyPoint, Scenario } from "./types";

export async function fetchAnomalies(
  scenario: Scenario = "nominal",
  hours = 3,
  stepS = 60,
  noradId = 25544
): Promise<AnomalyPoint[]> {
  const qs = new URLSearchParams({
    norad_id: String(noradId),
    hours: String(hours),
    step_s: String(stepS),
    scenario,
  });
  const res = await fetch(`${API_BASE}/anomaly?${qs}`);
  if (!res.ok) throw new Error(`Telemetry unavailable (${res.status})`);
  return res.json();
}
