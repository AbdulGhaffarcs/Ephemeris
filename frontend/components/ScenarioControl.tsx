import { Scenario } from "../lib/types";

const OPTIONS: { id: Scenario; label: string }[] = [
  { id: "nominal", label: "Nominal" },
  { id: "spike", label: "Thermal spike" },
  { id: "drift", label: "Sensor drift" },
  { id: "fault", label: "Heater fault" },
];

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
    <div className="flex gap-1 rounded-md border border-edge bg-panel p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          disabled={disabled}
          className={`px-3 py-1.5 text-sm rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-predicted ${
            value === o.id ? "bg-edge text-ink" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
