/** Formatting helpers. Every number on screen goes through one of these, so a
 *  change of precision is a one-line change and never drifts between panels. */

export const clock = (t: string) => t.slice(11, 16); // HH:MM, UTC as returned
export const clockS = (t: string) => t.slice(11, 19); // HH:MM:SS

export function signed(v: number, digits = 2) {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}`;
}

export const degC = (v: number, digits = 2) => `${signed(v, digits)} °C`;
export const absC = (v: number, digits = 1) => `${v.toFixed(digits)} °C`;

export function duration(min: number) {
  if (min < 1) return "<1 min";
  if (min < 90) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Severity buckets. These names are the status ramp's four steps and they map
 *  1:1 onto colour tokens — colour never carries the level on its own. */
export type Level = "good" | "caution" | "serious" | "critical";

export function severityLevel(severity: number): Level {
  if (severity >= 0.75) return "critical";
  if (severity >= 0.5) return "serious";
  if (severity >= 0.25) return "caution";
  return "good";
}

export const LEVEL_LABEL: Record<Level, string> = {
  good: "Nominal",
  caution: "Watch",
  serious: "Investigate",
  critical: "Act",
};

export const LEVEL_TEXT: Record<Level, string> = {
  good: "text-good",
  caution: "text-caution",
  serious: "text-serious",
  critical: "text-critical",
};

export const LEVEL_BG: Record<Level, string> = {
  good: "bg-good",
  caution: "bg-caution",
  serious: "bg-serious",
  critical: "bg-critical",
};

export const LEVEL_HEX: Record<Level, string> = {
  good: "#5BD99A",
  caution: "#E8B44A",
  serious: "#F0854A",
  critical: "#FF7A6B",
};
