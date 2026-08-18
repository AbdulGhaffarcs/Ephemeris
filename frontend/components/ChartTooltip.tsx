import { AnomalyPoint } from "../lib/types";
import { LEVEL_HEX, absC, clockS, severityLevel, signed } from "../lib/format";

/**
 * One tooltip, every series. The reader already knows which line they are near —
 * what they want is the number, so values lead and series names follow. Series
 * are keyed with a short stroke, not a filled box: at this density a box is
 * data-weight ink doing a label's job.
 *
 * Every value shown here is also in the table view, so the tooltip enhances and
 * never gates.
 */
export default function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: AnomalyPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const level = severityLevel(p.severity);

  return (
    <div className="rounded-md border border-edge bg-hull/95 px-3 py-2.5 shadow-xl backdrop-blur-sm">
      <p className="tabular mb-2 text-[11px] text-muted">
        {clockS(p.t)} UTC
        <span className="ml-2 text-dim">
          {p.eclipse ? "eclipse" : `sunlit · ${p.sun_angle_deg.toFixed(0)}°`}
        </span>
      </p>

      <Row color="var(--observed)" label="Observed" value={absC(p.observed_c)} />
      <Row color="var(--predicted)" label="Predicted" value={absC(p.predicted_c)} />
      <Row
        color="var(--residual)"
        label="Residual"
        value={`${signed(p.residual)} °C`}
      />

      <div className="mt-2 flex items-center gap-3 border-t border-edge pt-2 text-[11px]">
        <span className="tabular text-muted">
          z {signed(p.zscore, 1)}
        </span>
        <span className="tabular text-muted">
          cusum {p.cusum.toFixed(1)}
        </span>
        {p.flagged && (
          <span
            className="tabular font-semibold"
            style={{ color: LEVEL_HEX[level] }}
          >
            flagged {p.severity.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

function Row({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline gap-2 leading-6">
      <span
        aria-hidden
        className="inline-block shrink-0"
        style={{ background: color, width: 10, height: 2 }}
      />
      <span className="tabular w-[74px] text-right text-sm font-semibold text-ink">
        {value}
      </span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
