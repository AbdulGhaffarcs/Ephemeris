import { Origin } from "../lib/types";
import { RunStats } from "../lib/events";
import { duration } from "../lib/format";

/**
 * The masthead. Its whole job is that nobody ever mistakes fixture data for a
 * live spacecraft link — the origin badge is text plus colour, never colour alone,
 * and it says what failed when it falls back.
 */
export default function StatusBar({
  origin,
  note,
  loading,
  stats,
  noradId,
  subsystem,
}: {
  origin: Origin;
  note?: string;
  loading: boolean;
  stats: RunStats;
  noradId: number;
  subsystem: string;
}) {
  const live = origin === "live";

  return (
    <header className="border-b border-edge bg-panel/60">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-6 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            Ephemeris
          </h1>
          <p className="hidden text-sm text-muted sm:block">
            Know what your spacecraft should be doing — and why it isn&apos;t.
          </p>
        </div>

        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <Field label="Vehicle" value={`NORAD ${noradId}`} />
          <Field label="Subsystem" value={subsystem.replace(/_/g, " ")} capitalize />
          <Field
            label="Window"
            value={stats.sampleCount ? duration(stats.spanMin) : "—"}
          />

          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className={`inline-block h-2 w-2 rounded-full ${
                live ? "bg-good" : "bg-caution"
              } ${loading ? "animate-breathe" : ""}`}
            />
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                live ? "text-good" : "text-caution"
              }`}
            >
              {loading ? "Syncing" : live ? "Live backend" : "Fixture data"}
            </span>
          </div>
        </dl>
      </div>

      {!live && note && !loading && (
        <p className="mx-auto max-w-[1400px] px-6 pb-3 text-xs text-muted">
          Serving committed fixtures from <code className="text-dim">backend/fixtures/</code>{" "}
          — {note}. Start the API on port 8000 for live physics.
        </p>
      )}
    </header>
  );
}

function Field({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className={`tabular text-dim ${capitalize ? "capitalize" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
