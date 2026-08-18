import { useState } from "react";
import { AnomalyPoint } from "../lib/types";
import { LEVEL_TEXT, clockS, severityLevel, signed } from "../lib/format";
import Panel from "./ui/Panel";

/**
 * The table twin. Every value the charts encode with position or colour is
 * readable here as text, so nothing on this dashboard is gated behind a hover or
 * behind colour vision.
 */
export default function TableView({ points }: { points: AnomalyPoint[] }) {
  const [open, setOpen] = useState(false);
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const rows = flaggedOnly ? points.filter((p) => p.flagged) : points;

  return (
    <Panel
      title="Sample table"
      subtitle="Every plotted value, as text."
      aside={
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(e) => setFlaggedOnly(e.target.checked)}
              className="focusable h-3.5 w-3.5 accent-[#10A6AD]"
            />
            Flagged only
          </label>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="focusable rounded border border-edge px-2 py-1 text-xs text-dim transition-colors hover:bg-raised hover:text-ink"
          >
            {open ? "Hide" : `Show ${points.length} samples`}
          </button>
        </div>
      }
      bodyClassName={open ? "p-0" : "px-4 py-3"}
    >
      {!open ? (
        <p className="text-xs text-muted">
          Collapsed by default — expand for the full numeric record of this run.
        </p>
      ) : (
        <div className="scroll-slim max-h-[420px] overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-panel">
              <tr className="border-b border-edge text-left text-muted">
                <Th>Time (UTC)</Th>
                <Th align="right">Predicted °C</Th>
                <Th align="right">Observed °C</Th>
                <Th align="right">Residual °C</Th>
                <Th align="right">z</Th>
                <Th align="right">CUSUM</Th>
                <Th align="right">Sun °</Th>
                <Th>Phase</Th>
                <Th>State</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-muted">
                    No flagged samples in this run.
                  </td>
                </tr>
              )}
              {rows.map((p) => (
                <tr
                  key={p.t}
                  className="border-b border-edge/50 last:border-0 hover:bg-raised/60"
                >
                  <Td>{clockS(p.t)}</Td>
                  <Td align="right">{p.predicted_c.toFixed(2)}</Td>
                  <Td align="right">{p.observed_c.toFixed(2)}</Td>
                  <Td align="right">{signed(p.residual)}</Td>
                  <Td align="right">{signed(p.zscore, 2)}</Td>
                  <Td align="right">{p.cusum.toFixed(2)}</Td>
                  <Td align="right">{p.sun_angle_deg.toFixed(1)}</Td>
                  <Td>{p.eclipse ? "eclipse" : "sunlit"}</Td>
                  <td className="px-3 py-1.5">
                    {p.flagged ? (
                      <span className={LEVEL_TEXT[severityLevel(p.severity)]}>
                        flagged {p.severity.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted">nominal</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-3 py-2 font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className={`tabular whitespace-nowrap px-3 py-1.5 text-dim ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </td>
  );
}
