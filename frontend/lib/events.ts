import { AnomalyPoint } from "./types";

/**
 * One flagged sample is not an alert. A detector running at 1 Hz produces
 * hundreds of them for a single physical excursion, and a feed that lists each
 * one is a feed nobody reads. Contiguous flagged samples are collapsed into
 * events, which is the unit an operator actually acts on.
 */
export interface AnomalyEvent {
  id: string;
  /** Inclusive indices into the original points array. */
  from: number;
  to: number;
  /** Index of the sample with the largest |residual| in the event. */
  peakIndex: number;
  startT: string;
  endT: string;
  sampleCount: number;
  durationMin: number;
  peakResidual: number;
  peakZ: number;
  peakSeverity: number;
  meanResidual: number;
  /** Which side of the prediction the spacecraft sat on. */
  direction: "hot" | "cold";
  /** Orbital phase the event lived in — the first thing the signature table asks. */
  phase: "sunlit" | "eclipse" | "spanning";
}

/** Samples that may lapse between two flagged runs before they count as separate
 *  events. Detectors chatter around their threshold; bridging two samples stops
 *  one excursion being reported three times. */
const BRIDGE_SAMPLES = 2;

function minutesBetween(a: string, b: string) {
  const ms = Date.parse(b) - Date.parse(a);
  return Number.isFinite(ms) ? ms / 60000 : 0;
}

export function groupEvents(points: AnomalyPoint[]): AnomalyEvent[] {
  const events: AnomalyEvent[] = [];
  let from: number | null = null;
  let lastFlagged = -1;

  const close = (end: number) => {
    if (from === null) return;
    events.push(summarise(points, from, end));
    from = null;
  };

  points.forEach((p, i) => {
    if (p.flagged) {
      if (from === null) from = i;
      else if (i - lastFlagged > BRIDGE_SAMPLES + 1) {
        close(lastFlagged);
        from = i;
      }
      lastFlagged = i;
    }
  });
  close(lastFlagged);

  return events;
}

function summarise(points: AnomalyPoint[], from: number, to: number): AnomalyEvent {
  const slice = points.slice(from, to + 1);

  let peakIndex = from;
  for (let i = from; i <= to; i++) {
    if (Math.abs(points[i].residual) > Math.abs(points[peakIndex].residual)) peakIndex = i;
  }

  const peakResidual = points[peakIndex].residual;
  const meanResidual = slice.reduce((a, p) => a + p.residual, 0) / slice.length;
  const eclipsed = slice.filter((p) => p.eclipse).length;

  return {
    id: `${points[from].t}-${points[to].t}`,
    from,
    to,
    peakIndex,
    startT: points[from].t,
    endT: points[to].t,
    sampleCount: slice.length,
    durationMin: Math.max(minutesBetween(points[from].t, points[to].t), 0),
    peakResidual,
    peakZ: slice.reduce((a, p) => (Math.abs(p.zscore) > Math.abs(a) ? p.zscore : a), 0),
    peakSeverity: slice.reduce((a, p) => Math.max(a, p.severity), 0),
    meanResidual,
    direction: meanResidual >= 0 ? "hot" : "cold",
    phase: eclipsed === 0 ? "sunlit" : eclipsed === slice.length ? "eclipse" : "spanning",
  };
}

// ── run-level summary ────────────────────────────────────────────────────────

export interface RunStats {
  sampleCount: number;
  flaggedCount: number;
  eventCount: number;
  peakResidual: number;
  rmsResidual: number;
  peakZ: number;
  eclipseFraction: number;
  spanMin: number;
  latest: AnomalyPoint | null;
}

export function runStats(points: AnomalyPoint[], events: AnomalyEvent[]): RunStats {
  if (!points.length) {
    return {
      sampleCount: 0, flaggedCount: 0, eventCount: 0, peakResidual: 0,
      rmsResidual: 0, peakZ: 0, eclipseFraction: 0, spanMin: 0, latest: null,
    };
  }

  let peakResidual = 0;
  let peakZ = 0;
  let sumSq = 0;
  let eclipsed = 0;
  let flagged = 0;

  for (const p of points) {
    if (Math.abs(p.residual) > Math.abs(peakResidual)) peakResidual = p.residual;
    if (Math.abs(p.zscore) > Math.abs(peakZ)) peakZ = p.zscore;
    sumSq += p.residual * p.residual;
    if (p.eclipse) eclipsed++;
    if (p.flagged) flagged++;
  }

  return {
    sampleCount: points.length,
    flaggedCount: flagged,
    eventCount: events.length,
    peakResidual,
    rmsResidual: Math.sqrt(sumSq / points.length),
    peakZ,
    eclipseFraction: eclipsed / points.length,
    spanMin: minutesBetween(points[0].t, points[points.length - 1].t),
    latest: points[points.length - 1],
  };
}

// ── eclipse geometry ─────────────────────────────────────────────────────────

export interface EclipseBand {
  from: string;
  to: string;
}

/** Contiguous eclipse spans, so orbital night can be shaded behind the curves.
 *  This shading is what makes the physics visible rather than asserted. */
export function eclipseBands(points: AnomalyPoint[]): EclipseBand[] {
  const bands: EclipseBand[] = [];
  let start: string | null = null;

  points.forEach((p, i) => {
    if (p.eclipse && start === null) start = p.t;
    const last = i === points.length - 1;
    if (start !== null && (!p.eclipse || last)) {
      bands.push({ from: start, to: p.t });
      start = null;
    }
  });

  return bands;
}
