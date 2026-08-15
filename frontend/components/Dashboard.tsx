import { useCallback, useEffect, useState } from "react";
import { AnomalyPoint, Explanation, Scenario } from "../lib/types";
import { fetchAnomalies } from "../lib/fetchAnomalies";
import { fetchExplanation, windowAround } from "../lib/fetchExplanation";
import PredictedVsActual from "./PredictedVsActual";
import AlertFeed from "./AlertFeed";
import AIExplanation from "./AIExplanation";
import ScenarioControl from "./ScenarioControl";

export default function Dashboard() {
  const [scenario, setScenario] = useState<Scenario>("nominal");
  const [points, setPoints] = useState<AnomalyPoint[]>([]);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingTelemetry(true);
    setExplanation(null);
    setError(null);

    fetchAnomalies(scenario)
      .then((data) => !cancelled && setPoints(data))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadingTelemetry(false));

    return () => { cancelled = true; };
  }, [scenario]);

  const explainAt = useCallback(
    (index: number) => {
      setLoadingExplanation(true);
      setError(null);
      fetchExplanation(windowAround(points, index))
        .then(setExplanation)
        .catch((e) => setError(e.message))
        .finally(() => setLoadingExplanation(false));
    },
    [points]
  );

  const flaggedCount = points.filter((p) => p.flagged).length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ephemeris</h1>
          <p className="text-sm text-muted">
            Know what your spacecraft should be doing — and why it isn&apos;t.
          </p>
        </div>
        <ScenarioControl value={scenario} onChange={setScenario} disabled={loadingTelemetry} />
      </header>

      <div className="mb-4 flex items-center gap-2 text-sm">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            flaggedCount ? "bg-alarm" : "bg-nominal"
          }`}
        />
        <span className="text-muted">
          {loadingTelemetry
            ? "Propagating orbit…"
            : flaggedCount
            ? `${flaggedCount} samples diverge from prediction`
            : "All subsystems nominal"}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PredictedVsActual points={points} onSelectPoint={explainAt} />
        </div>
        <div className="space-y-4">
          <AlertFeed points={points} onSelect={explainAt} />
          <AIExplanation
            explanation={explanation}
            loading={loadingExplanation}
            error={error}
          />
        </div>
      </div>
    </main>
  );
}
