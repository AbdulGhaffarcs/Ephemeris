import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AnomalyPoint,
  Explanation,
  Origin,
  Scenario,
} from "../lib/types";
import { AnomalyEvent, groupEvents, runStats } from "../lib/events";
import { fetchAnomalies } from "../lib/fetchAnomalies";
import {
  fetchExplanation,
  windowAround,
  windowForRange,
} from "../lib/fetchExplanation";
import StatusBar from "./StatusBar";
import Controls from "./Controls";
import SummaryTiles from "./SummaryTiles";
import PredictedVsActual from "./PredictedVsActual";
import ResidualStrip from "./ResidualStrip";
import AlertFeed from "./AlertFeed";
import AIExplanation from "./AIExplanation";
import TableView from "./TableView";

const NORAD_ID = 25544;
const SUBSYSTEM = "thermal_panel_a";

export default function Dashboard() {
  const [scenario, setScenario] = useState<Scenario>("nominal");
  const [hours, setHours] = useState(3);
  const [reloadKey, setReloadKey] = useState(0);

  const [points, setPoints] = useState<AnomalyPoint[]>([]);
  const [origin, setOrigin] = useState<Origin>("live");
  const [originNote, setOriginNote] = useState<string | undefined>();
  const [loadingTelemetry, setLoadingTelemetry] = useState(true);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);

  const [selected, setSelected] = useState<AnomalyEvent | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explanationOrigin, setExplanationOrigin] = useState<Origin>("live");
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  /** Guards against a slow explain call landing after the user has moved on. */
  const explainToken = useRef(0);

  const events = useMemo(() => groupEvents(points), [points]);
  const stats = useMemo(() => runStats(points, events), [points, events]);
  const worstSeverity = useMemo(
    () => events.reduce((a, e) => Math.max(a, e.peakSeverity), 0),
    [events]
  );

  // ── telemetry ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingTelemetry(true);
    setTelemetryError(null);

    fetchAnomalies({ scenario, hours, noradId: NORAD_ID })
      .then((r) => {
        if (cancelled) return;
        setPoints(r.data);
        setOrigin(r.origin);
        setOriginNote(r.note);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setPoints([]);
        setTelemetryError(
          e instanceof Error
            ? `${e.message}. Neither the backend nor the committed fixtures could be read.`
            : "Telemetry unavailable."
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingTelemetry(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scenario, hours, reloadKey]);

  // ── explanation ────────────────────────────────────────────────────────────
  const explainWindow = useCallback(
    (window: AnomalyPoint[]) => {
      if (window.length < 3) return;
      const token = ++explainToken.current;
      setLoadingExplanation(true);
      setExplanationError(null);

      fetchExplanation(window, SUBSYSTEM)
        .then((r) => {
          if (token !== explainToken.current) return;
          setExplanation(r.data);
          setExplanationOrigin(r.origin);
        })
        .catch((e: unknown) => {
          if (token !== explainToken.current) return;
          setExplanation(null);
          setExplanationError(
            e instanceof Error ? e.message : "Explanation unavailable."
          );
        })
        .finally(() => {
          if (token === explainToken.current) setLoadingExplanation(false);
        });
    },
    []
  );

  const selectEvent = useCallback(
    (e: AnomalyEvent) => {
      setSelected(e);
      explainWindow(windowForRange(points, e.from, e.to));
    },
    [points, explainWindow]
  );

  /** A click anywhere on either plot. If the sample sits inside a known event we
   *  explain the whole event — an operator asking about one sample means the
   *  excursion it belongs to, not that sample in isolation. */
  const selectIndex = useCallback(
    (index: number) => {
      const owning = events.find((e) => index >= e.from && index <= e.to);
      if (owning) {
        selectEvent(owning);
        return;
      }
      setSelected(null);
      explainWindow(windowAround(points, index));
    },
    [events, points, selectEvent, explainWindow]
  );

  /** On every fresh run, open the event with the largest physical discrepancy.
   *  A recovery edge can have the largest z-score, but the largest residual is
   *  the event that best represents the fault an operator needs to diagnose. */
  useEffect(() => {
    if (loadingTelemetry || !points.length) return;
    explainToken.current++; // invalidate anything still in flight
    const worst = events.reduce<AnomalyEvent | null>(
      (a, e) => (!a || Math.abs(e.peakResidual) > Math.abs(a.peakResidual) ? e : a),
      null
    );
    if (worst) {
      setSelected(worst);
      explainWindow(windowForRange(points, worst.from, worst.to));
    } else {
      setSelected(null);
      explainWindow(points);
    }
    // Deliberately keyed on the loaded run, not on every render of `events`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, loadingTelemetry]);

  const stale = loadingTelemetry && points.length > 0;

  return (
    <div className="min-h-screen bg-hull">
      <StatusBar
        origin={origin}
        note={originNote}
        loading={loadingTelemetry}
        stats={stats}
        noradId={NORAD_ID}
        subsystem={SUBSYSTEM}
      />

      <main className="mx-auto max-w-[1400px] space-y-5 px-6 py-6">
        <Controls
          scenario={scenario}
          onScenario={setScenario}
          hours={hours}
          onHours={setHours}
          disabled={loadingTelemetry}
          onRefresh={() => setReloadKey((k) => k + 1)}
        />

        {telemetryError && (
          <p
            role="alert"
            className="rounded-card border border-critical/40 bg-panel px-4 py-3 text-sm text-critical"
          >
            {telemetryError}
          </p>
        )}

        <SummaryTiles points={points} stats={stats} worstSeverity={worstSeverity} />

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <PredictedVsActual
              points={points}
              selected={selected}
              onSelectIndex={selectIndex}
              stale={stale}
              subsystem={SUBSYSTEM}
            />
            <ResidualStrip
              points={points}
              selected={selected}
              onSelectIndex={selectIndex}
              stale={stale}
            />
          </div>

          <div className="space-y-4">
            <AlertFeed
              events={events}
              selectedId={selected?.id ?? null}
              onSelect={selectEvent}
              loading={loadingTelemetry}
            />
            <AIExplanation
              explanation={explanation}
              origin={explanationOrigin}
              loading={loadingExplanation}
              error={explanationError}
              emptyHint="Select an event, or click the plot, to see what the physics gap implies."
            />
          </div>
        </div>

        <TableView points={points} />

        <footer className="pt-2 text-xs text-muted">
          Residuals are observed minus physics prediction. A modelling gap is a
          legitimate finding here, not a failure — the diagnosis says which it is.
        </footer>
      </main>
    </div>
  );
}
