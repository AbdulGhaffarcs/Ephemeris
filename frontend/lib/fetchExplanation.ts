import { API_BASE, AnomalyPoint, Explanation, Sourced } from "./types";

const LIVE_TIMEOUT_MS = 30000; // watsonx round-trip plus one grounding retry

/** Send the divergence window around a flagged point, not the whole run. */
async function live(
  window: AnomalyPoint[],
  subsystem: string,
  signal: AbortSignal
) {
  const res = await fetch(`${API_BASE}/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ window, subsystem }),
    signal,
  });
  if (!res.ok) throw new Error(`backend returned ${res.status}`);
  return (await res.json()) as Explanation;
}

async function fixture() {
  const res = await fetch("/api/fixtures/explain");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `fixture unavailable (${res.status})`);
  }
  return (await res.json()) as Explanation;
}

export async function fetchExplanation(
  window: AnomalyPoint[],
  subsystem = "thermal_panel_a"
): Promise<Sourced<Explanation>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIVE_TIMEOUT_MS);
  try {
    return { data: await live(window, subsystem, ctrl.signal), origin: "live" };
  } catch (e) {
    const why = e instanceof Error && e.name === "AbortError"
      ? "explanation timed out"
      : e instanceof Error
      ? e.message
      : "backend unreachable";
    // The canned fixture describes one specific heater fault. Labelling it as a
    // fixture is what stops it being read as a diagnosis of the selected event.
    return { data: await fixture(), origin: "fixture", note: why };
  } finally {
    clearTimeout(timer);
  }
}

/** Grab N samples either side of the index, clamped to the array.
 *  /explain requires at least 3 samples, so widen rather than return a stub. */
export function windowAround(
  points: AnomalyPoint[],
  index: number,
  span = 20
): AnomalyPoint[] {
  if (points.length <= 3) return points;
  const lo = Math.max(0, index - span);
  const hi = Math.min(points.length, index + span);
  return points.slice(lo, hi);
}

/** The window covering a whole flagged event, plus context either side. */
export function windowForRange(
  points: AnomalyPoint[],
  from: number,
  to: number,
  pad = 15
): AnomalyPoint[] {
  if (points.length <= 3) return points;
  return points.slice(Math.max(0, from - pad), Math.min(points.length, to + 1 + pad));
}
