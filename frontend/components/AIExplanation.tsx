import { Explanation } from "../lib/types";

export default function AIExplanation({
  explanation,
  loading,
  error,
}: {
  explanation: Explanation | null;
  loading: boolean;
  error?: string | null;
}) {
  return (
    <div className="rounded-lg border border-edge bg-panel p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink">Diagnosis</h2>
        {explanation && (
          // Never mistake template fallback for a live model response.
          <span className="tabular text-[11px] uppercase tracking-wider text-muted">
            {explanation.source}
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-muted">Reading the divergence…</p>}

      {error && !loading && (
        <p className="text-sm text-alarm">
          {error} — check that the backend is running on port 8000.
        </p>
      )}

      {!loading && !error && !explanation && (
        <p className="text-sm text-muted">
          Select an alert to see what the physics gap implies.
        </p>
      )}

      {!loading && explanation && (
        <div className="space-y-3">
          <p className="text-base leading-snug text-ink">{explanation.headline}</p>
          <p className="text-sm leading-relaxed text-muted">{explanation.reasoning}</p>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Likely cause</dt>
            <dd className="text-ink">{explanation.likely_cause ?? "indeterminate"}</dd>
            <dt className="text-muted">Signature</dt>
            <dd className="tabular text-ink">{explanation.signature_id ?? "—"}</dd>
            <dt className="text-muted">Confidence</dt>
            <dd className="tabular text-ink">{(explanation.confidence * 100).toFixed(0)}%</dd>
          </dl>

          {explanation.is_model_error && (
            <p className="rounded border-l-2 border-predicted bg-hull px-3 py-2 text-sm text-muted">
              Assessed as a modelling gap, not a spacecraft fault. No command action.
            </p>
          )}

          <p className="border-t border-edge pt-3 text-sm text-ink">
            <span className="text-muted">Recommended: </span>
            {explanation.recommended_action}
          </p>
        </div>
      )}
    </div>
  );
}
