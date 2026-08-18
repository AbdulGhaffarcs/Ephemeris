import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnomalyPoint } from "../lib/types";
import { AnomalyEvent, eclipseBands } from "../lib/events";
import { LEVEL_HEX, absC, clock, severityLevel } from "../lib/format";
import ChartTooltip from "./ChartTooltip";
import Panel, { LegendKey } from "./ui/Panel";

/** Shared with the residual strip so the two plots stay pixel-aligned on x. */
export const CHART_MARGIN = { top: 8, right: 16, bottom: 0, left: 0 };
export const Y_AXIS_WIDTH = 56;

/**
 * Flagged samples get a marker on the observed line. This is the secondary
 * encoding that keeps "is this sample anomalous?" answerable without relying on
 * hue — a reader in greyscale still sees the ringed dots.
 */
export function FlaggedDot(props: any) {
  const { cx, cy, payload } = props as { cx?: number; cy?: number; payload: AnomalyPoint };
  if (cx == null || cy == null || !payload?.flagged) return null;
  const fill = LEVEL_HEX[severityLevel(payload.severity)];
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3.5}
      fill={fill}
      stroke="var(--panel)"
      strokeWidth={2}
    />
  );
}

/** Selection is chrome, not data. It is drawn in ink rather than a status hue
 *  because the serious/critical oranges sit close enough to the observed series
 *  to be misread as a third line. */
const SELECTION_FILL = "var(--ink)";
const SELECTION_STROKE = "var(--dim)";

function ValueKey({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span
        aria-hidden
        className="inline-block translate-y-[-3px]"
        style={{ background: color, width: 12, height: 2 }}
      />
      <span className="tabular font-semibold text-ink">{value}</span>
      <span className="text-muted">{label}</span>
    </span>
  );
}

export default function PredictedVsActual({
  points,
  selected,
  onSelectIndex,
  stale,
  subsystem,
}: {
  points: AnomalyPoint[];
  selected: AnomalyEvent | null;
  onSelectIndex: (index: number) => void;
  stale?: boolean;
  subsystem: string;
}) {
  const bands = useMemo(() => eclipseBands(points), [points]);
  const last = points.length - 1;

  const legend = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <LegendKey color="var(--predicted)" label="Physics prediction" />
      <LegendKey color="var(--observed)" label="Observed" />
      <LegendKey color="var(--night)" label="Eclipse" kind="fill" />
      <LegendKey color={LEVEL_HEX.critical} label="Flagged sample" kind="fill" />
    </div>
  );

  if (!points.length) {
    return (
      <Panel title={`Predicted vs. observed — ${subsystem.replace(/_/g, " ")}`} aside={legend}>
        <div className="flex h-[300px] items-center justify-center text-sm text-muted">
          No telemetry loaded. Pick a scenario to begin.
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title={`Predicted vs. observed — ${subsystem.replace(/_/g, " ")}`}
      subtitle="Shaded spans are orbital night. The gap between the two lines is the residual."
      aside={legend}
      bodyClassName="pb-2 pr-2"
    >
      <div
        className={stale ? "stale" : undefined}
        role="img"
        aria-label={`Line chart of predicted and observed temperature over ${points.length} samples. Full values are in the table view below.`}
      >
        <ResponsiveContainer width="100%" height={320}>
          <LineChart
            data={points}
            margin={CHART_MARGIN}
            onClick={(e: any) => {
              const i = e?.activeTooltipIndex;
              if (typeof i === "number") onSelectIndex(i);
            }}
          >
            {/* Eclipse first, so night sits behind every mark. */}
            {bands.map((b) => (
              <ReferenceArea
                key={b.from}
                x1={b.from}
                x2={b.to}
                fill="var(--night)"
                fillOpacity={1}
                stroke="none"
                ifOverflow="extendDomain"
              />
            ))}

            {selected && (
              <ReferenceArea
                x1={points[selected.from].t}
                x2={points[selected.to].t}
                fill={SELECTION_FILL}
                fillOpacity={0.05}
                stroke={SELECTION_STROKE}
                strokeOpacity={0.4}
                ifOverflow="extendDomain"
              />
            )}

            <CartesianGrid stroke="var(--grid)" strokeWidth={1} vertical={false} />

            <XAxis
              dataKey="t"
              tickFormatter={clock}
              stroke="var(--grid)"
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickLine={false}
              minTickGap={44}
              height={28}
            />
            <YAxis
              stroke="var(--grid)"
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={Y_AXIS_WIDTH}
              unit="°C"
              tickCount={6}
            />

            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
              isAnimationActive={false}
            />

            {selected && (
              <ReferenceLine
                x={points[selected.peakIndex].t}
                stroke={SELECTION_STROKE}
                strokeWidth={1}
              />
            )}

            <Line
              type="monotone"
              dataKey="predicted_c"
              name="Physics prediction"
              stroke="var(--predicted)"
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--panel)" }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="observed_c"
              name="Observed"
              stroke="var(--observed)"
              strokeWidth={2}
              strokeLinecap="round"
              dot={<FlaggedDot />}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--panel)" }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* The two lines converge at the right edge often enough that end-labels
          collide there, so the latest value for each series is read out here
          instead — keyed by its stroke, never by coloured text. */}
      <div className="mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-1 px-1 text-xs">
        <span className="text-muted">Latest sample</span>
        <ValueKey
          color="var(--observed)"
          label="observed"
          value={absC(points[last].observed_c)}
        />
        <ValueKey
          color="var(--predicted)"
          label="predicted"
          value={absC(points[last].predicted_c)}
        />
        <span className="text-muted">
          Click the plot to explain any moment.
        </span>
      </div>
    </Panel>
  );
}
