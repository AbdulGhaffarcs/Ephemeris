import { ReactNode } from "react";
import { AnomalyPoint } from "../lib/types";
import { RunStats } from "../lib/events";
import {
  LEVEL_BG,
  LEVEL_LABEL,
  LEVEL_TEXT,
  Level,
  duration,
  pct,
  severityLevel,
  signed,
} from "../lib/format";
import Sparkline from "./Sparkline";

/** Downsample the residual to a sparkline's worth of points. */
function thin(points: AnomalyPoint[], n = 24) {
  if (points.length <= n) return points.map((p) => p.residual);
  const step = points.length / n;
  return Array.from({ length: n }, (_, i) => points[Math.floor(i * step)].residual);
}

/**
 * The run in five numbers. The hero figure is the peak residual because that is
 * the quantity the whole product exists to surface — how far the spacecraft is
 * from where physics says it should be. Everything else is supporting scale.
 */
export default function SummaryTiles({
  points,
  stats,
  worstSeverity,
}: {
  points: AnomalyPoint[];
  stats: RunStats;
  worstSeverity: number;
}) {
  const level: Level = stats.flaggedCount ? severityLevel(worstSeverity) : "good";
  const hot = stats.peakResidual >= 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {/* Hero — exactly one per view. */}
      <div className="rounded-card border border-edge bg-panel p-4 sm:col-span-2 xl:col-span-1">
        <p className="text-xs text-muted">Peak residual</p>
        <p className="figure mt-1 flex items-baseline gap-1.5 text-[44px] font-semibold leading-none text-ink">
          {signed(stats.peakResidual, 2)}
          <span className="text-lg font-normal text-muted">°C</span>
        </p>
        <p className="mt-2 text-xs text-muted">
          {stats.sampleCount
            ? `Observed runs ${hot ? "hotter" : "colder"} than predicted · RMS ${stats.rmsResidual.toFixed(2)} °C`
            : "No telemetry loaded"}
        </p>
        <div className="mt-3">
          <Sparkline
            values={thin(points)}
            color="var(--residual)"
            label="Residual trend across the window"
          />
        </div>
      </div>

      <Tile
        label="Divergence events"
        value={String(stats.eventCount)}
        note={
          stats.flaggedCount
            ? `${stats.flaggedCount} of ${stats.sampleCount} samples flagged`
            : `${stats.sampleCount} samples, none flagged`
        }
      >
        {/* Severity meter: fill carries state, track is the same ramp one step down. */}
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-edge">
            <div
              className={`h-full rounded-full ${LEVEL_BG[level]}`}
              style={{ width: `${Math.max(worstSeverity, 0.03) * 100}%` }}
            />
          </div>
          <p className={`mt-1.5 text-xs font-medium ${LEVEL_TEXT[level]}`}>
            <StatusGlyph level={level} /> {LEVEL_LABEL[level]}
            <span className="ml-1 font-normal text-muted">
              · worst severity {worstSeverity.toFixed(2)}
            </span>
          </p>
        </div>
      </Tile>

      <Tile
        label="Peak z-score"
        value={signed(stats.peakZ, 1)}
        note="Residual distance from its own rolling baseline"
      />

      <Tile
        label="Orbital night"
        value={pct(stats.eclipseFraction)}
        note={
          stats.sampleCount
            ? `${duration(stats.spanMin * stats.eclipseFraction)} of ${duration(stats.spanMin)} in eclipse`
            : "—"
        }
      />
    </div>
  );
}

function Tile({
  label,
  value,
  note,
  children,
}: {
  label: string;
  value: string;
  note: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-edge bg-panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="figure mt-1 text-[28px] font-semibold leading-none text-ink">
        {value}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted">{note}</p>
      {children}
    </div>
  );
}

/** Status is colour *plus* a glyph plus a word — never colour alone. */
export function StatusGlyph({ level }: { level: Level }) {
  const glyph = { good: "●", caution: "▲", serious: "▲", critical: "■" }[level];
  return <span aria-hidden>{glyph}</span>;
}
