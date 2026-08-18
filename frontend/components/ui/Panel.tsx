import { ReactNode } from "react";

/** Every card on the dashboard is this shape: hairline edge, panel surface,
 *  a title row that can carry a legend or a control on the right. Keeping it in
 *  one place is what stops six panels drifting into six different paddings. */
export default function Panel({
  title,
  subtitle,
  aside,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`rounded-card border border-edge bg-panel ${className}`}
    >
      {(title || aside) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-edge px-4 py-3">
          <div>
            {title && (
              <h2 className="text-sm font-semibold tracking-wide text-ink">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
            )}
          </div>
          {aside}
        </div>
      )}
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** Legend entry. Lines get a line key, fills get a rect — the swatch mirrors the
 *  mark it stands for, so identity never rests on colour matching alone. */
export function LegendKey({
  color,
  label,
  kind = "line",
}: {
  color: string;
  label: string;
  kind?: "line" | "fill";
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-dim">
      {/* A fill key for a near-surface colour (the eclipse band) would be
          invisible without an edge, so fills carry a hairline; lines do not. */}
      <span
        aria-hidden
        className="inline-block rounded-[1px]"
        style={{
          background: color,
          width: 12,
          height: kind === "line" ? 2 : 8,
          border: kind === "fill" ? "1px solid var(--edge)" : undefined,
        }}
      />
      {label}
    </span>
  );
}
