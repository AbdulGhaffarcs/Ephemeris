import { API_BASE, AnomalyPoint, Explanation } from "./types";

/** Send the divergence window around a flagged point, not the whole run. */
export async function fetchExplanation(
  window: AnomalyPoint[],
  subsystem = "thermal_panel_a"
): Promise<Explanation> {
  const res = await fetch(`${API_BASE}/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ window, subsystem }),
  });
  if (!res.ok) throw new Error(`Explanation unavailable (${res.status})`);
  return res.json();
}

/** Grab N samples either side of the index, clamped to the array. */
export function windowAround(points: AnomalyPoint[], index: number, span = 20) {
  const lo = Math.max(0, index - span);
  return points.slice(lo, Math.min(points.length, index + span));
}
