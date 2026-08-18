/** A 12-ish point trend, drawn small enough that it is a texture rather than a
 *  chart. It carries no axis and no labels — the tile's value is the number. */
export default function Sparkline({
  values,
  color,
  width = 96,
  height = 24,
  label,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  label: string;
}) {
  if (values.length < 2) return null;

  const lo = Math.min(...values, 0);
  const hi = Math.max(...values, 0);
  const span = hi - lo || 1;
  const pad = 2;
  const x = (i: number) => (i / (values.length - 1)) * (width - pad * 2) + pad;
  const y = (v: number) => height - pad - ((v - lo) / span) * (height - pad * 2);

  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const zero = lo <= 0 && hi >= 0 ? y(0) : null;

  return (
    <svg width={width} height={height} role="img" aria-label={label} className="overflow-visible">
      {zero !== null && (
        <line x1={0} x2={width} y1={zero} y2={zero} stroke="var(--edge)" strokeWidth={1} />
      )}
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={x(values.length - 1)}
        cy={y(values[values.length - 1])}
        r={2.5}
        fill={color}
        stroke="var(--panel)"
        strokeWidth={2}
      />
    </svg>
  );
}
