import { API_BASE, AnomalyPoint, Scenario, Sourced } from "./types";

export interface AnomalyQuery {
  scenario?: Scenario;
  hours?: number;
  stepS?: number;
  noradId?: number;
}

/** Abandon the live backend quickly — a hung port 8000 must not stall the demo. */
const LIVE_TIMEOUT_MS = 4000;

async function live(q: Required<AnomalyQuery>, signal: AbortSignal) {
  const qs = new URLSearchParams({
    norad_id: String(q.noradId),
    hours: String(q.hours),
    step_s: String(q.stepS),
    scenario: q.scenario,
  });
  const res = await fetch(`${API_BASE}/anomaly?${qs}`, { signal });
  if (!res.ok) throw new Error(`backend returned ${res.status}`);
  return (await res.json()) as AnomalyPoint[];
}

async function fixture(scenario: Scenario) {
  const res = await fetch(`/api/fixtures/anomaly.${scenario}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `fixture unavailable (${res.status})`);
  }
  return (await res.json()) as AnomalyPoint[];
}

/**
 * Live backend first, committed fixture second. The caller is always told which
 * one it got — a fixture curve rendered as if it were live telemetry is the one
 * failure mode this dashboard cannot have.
 */
export async function fetchAnomalies(
  query: AnomalyQuery = {}
): Promise<Sourced<AnomalyPoint[]>> {
  const q: Required<AnomalyQuery> = {
    scenario: query.scenario ?? "nominal",
    hours: query.hours ?? 3,
    stepS: query.stepS ?? 60,
    noradId: query.noradId ?? 25544,
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIVE_TIMEOUT_MS);
  try {
    return { data: await live(q, ctrl.signal), origin: "live" };
  } catch (e) {
    const why = e instanceof Error && e.name === "AbortError"
      ? "backend did not answer in time"
      : e instanceof Error
      ? e.message
      : "backend unreachable";
    return { data: await fixture(q.scenario), origin: "fixture", note: why };
  } finally {
    clearTimeout(timer);
  }
}
