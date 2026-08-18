import { AnomalyEvent } from "../lib/events";
import {
  LEVEL_BG,
  LEVEL_LABEL,
  LEVEL_TEXT,
  clockS,
  duration,
  severityLevel,
  signed,
} from "../lib/format";
import Panel from "./ui/Panel";
import { StatusGlyph } from "./SummaryTiles";

const PHASE_NOTE: Record<AnomalyEvent["phase"], string> = {
  sunlit: "sunlit only",
  eclipse: "eclipse only",
  spanning: "spans terminator",
};

/**
 * The feed lists divergence *events*, not flagged samples. A single heater fault
 * produces dozens of consecutive flags; listing each one buries the operator and
 * makes four separate faults look identical to one long one.
 */
export default function AlertFeed({
  events,
  selectedId,
  onSelect,
  loading,
}: {
  events: AnomalyEvent[];
  selectedId: string | null;
  onSelect: (e: AnomalyEvent) => void;
  loading?: boolean;
}) {
  return (
    <Panel
      title={
        <>
          Divergence events{" "}
          <span className="font-normal text-muted">({events.length})</span>
        </>
      }
      subtitle="Contiguous flagged samples, collapsed."
      bodyClassName="p-2"
    >
      {loading && !events.length ? (
        <ul className="space-y-1 p-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-14 animate-pulse rounded bg-raised" />
          ))}
        </ul>
      ) : !events.length ? (
        <p className="px-2 py-6 text-center text-sm text-muted">
          Observed telemetry is tracking the prediction.
          <br />
          Nothing to review.
        </p>
      ) : (
        <ul className="scroll-slim max-h-[420px] space-y-1 overflow-y-auto pr-1">
          {events.map((e) => {
            const level = severityLevel(e.peakSeverity);
            const active = e.id === selectedId;
            return (
              <li key={e.id}>
                <button
                  onClick={() => onSelect(e)}
                  aria-current={active}
                  className={`focusable w-full rounded-md border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-edge bg-raised"
                      : "border-transparent hover:bg-raised/60"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={`text-xs font-semibold ${LEVEL_TEXT[level]}`}>
                      <StatusGlyph level={level} /> {LEVEL_LABEL[level]}
                    </span>
                    <span className="tabular text-[11px] text-muted">
                      {clockS(e.startT)} → {clockS(e.endT)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="figure text-lg font-semibold leading-none text-ink">
                      {signed(e.peakResidual)}
                      <span className="ml-0.5 text-xs font-normal text-muted">°C</span>
                    </span>
                    <span className="text-xs text-dim">
                      {e.direction === "hot" ? "hotter" : "colder"} than predicted
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                    <span className="tabular">{duration(e.durationMin)}</span>
                    <span className="tabular">z {signed(e.peakZ, 1)}</span>
                    <span>{PHASE_NOTE[e.phase]}</span>
                  </div>

                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-edge">
                    <div
                      className={`h-full rounded-full ${LEVEL_BG[level]}`}
                      style={{ width: `${Math.max(e.peakSeverity, 0.04) * 100}%` }}
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
