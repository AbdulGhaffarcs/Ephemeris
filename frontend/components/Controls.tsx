import { Scenario } from "../lib/types";
import ScenarioControl from "./ScenarioControl";

/** Propagation window presets. The range control comes first because it is the
 *  one every reader reaches for; a custom value is a text field, not a calendar. */
export const WINDOWS = [
  { hours: 1.5, label: "1.5 h" },
  { hours: 3, label: "3 h" },
  { hours: 6, label: "6 h" },
  { hours: 12, label: "12 h" },
] as const;

/**
 * One filter row, above everything it scopes. Every panel below re-renders
 * against the same slice, so the chart, the tiles, the feed and the table can
 * never disagree about which run they are describing.
 */
export default function Controls({
  scenario,
  onScenario,
  hours,
  onHours,
  disabled,
  onRefresh,
}: {
  scenario: Scenario;
  onScenario: (s: Scenario) => void;
  hours: number;
  onHours: (h: number) => void;
  disabled?: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
      <div>
        <span
          id="window-label"
          className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted"
        >
          Propagation window
        </span>
        <div
          role="radiogroup"
          aria-labelledby="window-label"
          className="inline-flex gap-1 rounded-md border border-edge bg-panel p-1"
        >
          {WINDOWS.map((w) => {
            const active = hours === w.hours;
            return (
              <button
                key={w.hours}
                role="radio"
                aria-checked={active}
                onClick={() => onHours(w.hours)}
                disabled={disabled}
                className={`focusable tabular rounded px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  active
                    ? "bg-edge font-medium text-ink"
                    : "text-muted hover:bg-raised hover:text-ink"
                }`}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      <ScenarioControl value={scenario} onChange={onScenario} disabled={disabled} />

      <button
        onClick={onRefresh}
        disabled={disabled}
        className="focusable rounded-md border border-edge bg-panel px-3 py-1.5 text-sm text-dim transition-colors hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {disabled ? "Propagating…" : "Re-propagate"}
      </button>
    </div>
  );
}
