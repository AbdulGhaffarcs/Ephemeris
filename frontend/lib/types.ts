// Mirrors the backend contract exactly. If this file and the FastAPI response
// disagree, the contract has drifted — fix it in the same commit as the fixture.

export type Scenario = "nominal" | "spike" | "drift" | "fault";

export const SCENARIOS: { id: Scenario; label: string; blurb: string }[] = [
  { id: "nominal", label: "Nominal", blurb: "No injected fault" },
  { id: "spike", label: "Thermal spike", blurb: "Short transient excursion" },
  { id: "drift", label: "Sensor drift", blurb: "Slow monotonic bias" },
  { id: "fault", label: "Heater fault", blurb: "Sustained step offset" },
];

export interface PredictionPoint {
  t: string;
  sun_angle_deg: number;
  eclipse: boolean;
  predicted_c: number;
}

export interface AnomalyPoint extends PredictionPoint {
  observed_c: number;
  residual: number;
  zscore: number;
  cusum: number;
  flagged: boolean;
  severity: number;
}

/** Shape names the deterministic pre-classifier in api/explain.py can emit. */
export type Shape =
  | "spike"
  | "step_up"
  | "step_down"
  | "drift_up"
  | "drift_down"
  | "oscillation"
  | "flatline"
  | "phase_locked"
  | "nominal";

/** The derived numbers /explain computes and lets the model quote. Returned
 *  alongside every explanation — showing them is what makes the answer auditable
 *  rather than something to take on faith. */
export interface Features {
  subsystem: string;
  duration_min: number;
  peak_residual_c: number;
  mean_residual_c: number;
  residual_slope_c_per_hr: number;
  peak_zscore: number;
  peak_severity: number;
  sunlit_mean_residual_c: number;
  eclipse_mean_residual_c: number;
  phase_correlation: string;
  sample_count: number;
  shape: Shape;
  candidate_ids: string[];
}

/** granite = live model · template/rule = deterministic fallback · cached = replayed. */
export type ExplanationSource = "granite" | "template" | "rule" | "cached";

export interface Explanation {
  headline: string;
  reasoning: string;
  likely_cause: string | null;
  signature_id: string | null;
  is_model_error: boolean;
  confidence: number;
  recommended_action: string;
  source: ExplanationSource | string;
  features?: Features;
  cached?: boolean;
}

/** Where the data on screen actually came from. Never let a fixture read as live. */
export type Origin = "live" | "fixture";

export interface Sourced<T> {
  data: T;
  origin: Origin;
  /** Set when the live backend was tried and refused. */
  note?: string;
}

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
