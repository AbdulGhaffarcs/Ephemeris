import { AnomalyPoint } from "../lib/types";

function severityColor(s: number) {
  if (s > 0.66) return "text-alarm";
  if (s > 0.33) return "text-observed";
  return "text-muted";
}

export default function AlertFeed({
  points,
  onSelect,
}: {
  points: AnomalyPoint[];
  onSelect: (index: number) => void;
}) {
  const flagged = points
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.flagged);

  return (
    <div className="rounded-lg border border-edge bg-panel p-4">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink">
        Alerts <span className="text-muted">({flagged.length})</span>
      </h2>

      {flagged.length === 0 ? (
        <p className="text-sm text-muted">
          Observed telemetry is tracking the prediction. Nothing to review.
        </p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {flagged.map(({ p, i }) => (
            <li key={p.t}>
              <button
                onClick={() => onSelect(i)}
                className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-edge focus:outline-none focus-visible:ring-2 focus-visible:ring-predicted"
              >
                <span className="tabular text-muted">{p.t.slice(11, 19)}</span>
                <span className={`ml-3 tabular ${severityColor(p.severity)}`}>
                  {p.residual > 0 ? "+" : ""}{p.residual.toFixed(2)}°C
                </span>
                <span className="ml-3 text-xs text-muted">z {p.zscore.toFixed(1)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
