import { Scenario, SCENARIOS } from "../lib/types";

export default function ScenarioControl({
  value,
  onChange,
  disabled,
}: {
  value: Scenario;
  onChange: (s: Scenario) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <span
        id="scenario-label"
        className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted"
      >
        Injected scenario
      </span>
      <div
        role="radiogroup"
        aria-labelledby="scenario-label"
        className="inline-flex flex-wrap gap-1 rounded-md border border-edge bg-panel p-1"
      >
        {SCENARIOS.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              role="radio"
              aria-checked={active}
              title={o.blurb}
              onClick={() => onChange(o.id)}
              disabled={disabled}
              className={`focusable rounded px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                  ? "bg-edge font-medium text-ink"
                  : "text-muted hover:bg-raised hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
