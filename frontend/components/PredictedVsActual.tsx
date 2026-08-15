import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea,
} from "recharts";
import { AnomalyPoint } from "../lib/types";

/** Contiguous eclipse spans, so orbital night can be shaded behind the curves.
 *  This shading is what makes the physics visible rather than asserted. */
function eclipseBands(points: AnomalyPoint[]) {
  const bands: { from: string; to: string }[] = [];
  let start: string | null = null;
  points.forEach((p, i) => {
    if (p.eclipse && start === null) start = p.t;
    if ((!p.eclipse || i === points.length - 1) && start !== null) {
      bands.push({ from: start, to: p.t });
      start = null;
    }
  });
  return bands;
}

const clock = (t: string) => t.slice(11, 16);

export default function PredictedVsActual({
  points,
  onSelectPoint,
}: {
  points: AnomalyPoint[];
  onSelectPoint?: (index: number) => void;
}) {
  if (!points.length) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border border-edge bg-panel text-muted">
        No telemetry loaded. Pick a scenario to begin.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-edge bg-panel p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink">
          Predicted vs. observed — thermal panel A
        </h2>
        <div className="flex gap-4 text-xs text-muted">
          <span><span className="mr-1.5 inline-block h-2 w-3 bg-predicted" />Physics prediction</span>
          <span><span className="mr-1.5 inline-block h-2 w-3 bg-observed" />Observed</span>
          <span><span className="mr-1.5 inline-block h-2 w-3 bg-night" />Eclipse</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={points}
          onClick={(e: any) =>
            onSelectPoint && e?.activeTooltipIndex != null && onSelectPoint(e.activeTooltipIndex)
          }
        >
          {eclipseBands(points).map((b, i) => (
            <ReferenceArea key={i} x1={b.from} x2={b.to} fill="#1B2440" fillOpacity={0.9} />
          ))}
          <CartesianGrid stroke="#1E2B42" vertical={false} />
          <XAxis dataKey="t" tickFormatter={clock} stroke="#8296B4" fontSize={11} minTickGap={40} />
          <YAxis stroke="#8296B4" fontSize={11} unit="°C" width={52} />
          <Tooltip
            contentStyle={{ background: "#111A2B", border: "1px solid #1E2B42", borderRadius: 6 }}
            labelFormatter={clock}
          />
          <Line type="monotone" dataKey="predicted_c" stroke="#4DD8E6" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="observed_c" stroke="#F2A93B" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>

      {/* TODO (Eman): mark flagged samples on the observed line. */}
    </div>
  );
}
