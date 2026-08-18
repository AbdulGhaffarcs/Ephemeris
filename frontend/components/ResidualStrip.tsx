import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnomalyPoint } from "../lib/types";
import { AnomalyEvent, eclipseBands } from "../lib/events";
import { LEVEL_HEX, clock } from "../lib/format";
import ChartTooltip from "./ChartTooltip";
import Panel, { LegendKey } from "./ui/Panel";
import { CHART_MARGIN, FlaggedDot, Y_AXIS_WIDTH } from "./PredictedVsActual";

/**
 * The residual on its own axis, as a small multiple of the plot above — never as
 * a second y-scale on the same plot. Two measures at different scales sharing one
 * frame invent a correlation that isn't in the data.
 *
 * Polarity is read off the zero baseline, not off a second hue: above the line is
 * hotter than physics predicts, below is colder.
 */
export default function ResidualStrip({
  points,
  selected,
  onSelectIndex,
  stale,
}: {
  points: AnomalyPoint[];
  selected: AnomalyEvent | null;
  onSelectIndex: (index: number) => void;
  stale?: boolean;
}) {
  const bands = useMemo(() => eclipseBands(points), [points]);

  if (!points.length) return null;

  return (
    <Panel
      title="Residual — observed minus prediction"
      subtitle="This, not the raw signal, is what the detector scores."
      aside={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <LegendKey color="var(--residual)" label="Residual" />
          <LegendKey color={LEVEL_HEX.critical} label="Flagged sample" kind="fill" />
        </div>
      }
      bodyClassName="pb-2 pr-2"
    >
      <div
        className={stale ? "stale" : undefined}
        role="img"
        aria-label="Area chart of the residual between observed and predicted temperature. Full values are in the table view below."
      >
        <ResponsiveContainer width="100%" height={170}>
          <AreaChart
            data={points}
            margin={CHART_MARGIN}
            onClick={(e: any) => {
              const i = e?.activeTooltipIndex;
              if (typeof i === "number") onSelectIndex(i);
            }}
          >
            <defs>
              {/* A wash, never a saturated block. */}
              <linearGradient id="residualWash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--residual)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--residual)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

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
                fill="var(--ink)"
                fillOpacity={0.05}
                stroke="var(--dim)"
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
              tickCount={4}
            />

            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
              isAnimationActive={false}
            />

            {/* The baseline is the encoding. Solid hairline, one step off surface. */}
            <ReferenceLine y={0} stroke="var(--muted)" strokeWidth={1} />

            <Area
              type="monotone"
              dataKey="residual"
              name="Residual"
              stroke="var(--residual)"
              strokeWidth={2}
              fill="url(#residualWash)"
              dot={<FlaggedDot />}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--panel)" }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
