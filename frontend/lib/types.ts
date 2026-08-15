// Mirrors the backend contract exactly. If this file and the FastAPI response
// disagree, the contract has drifted — fix it in the same commit as the fixture.

export type Scenario = "nominal" | "spike" | "drift" | "fault";

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

export interface Explanation {
  headline: string;
  reasoning: string;
  likely_cause: string | null;
  signature_id: string | null;
  is_model_error: boolean;
  confidence: number;
  recommended_action: string;
  /** granite | template | rule | cached — surface this during rehearsal. */
  source: string;
}

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
