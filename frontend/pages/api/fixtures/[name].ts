import { promises as fs } from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Serves the committed backend fixtures to the browser.
 *
 * The README promises Track B is never blocked on the physics core, but a browser
 * cannot read `backend/fixtures/` off disk — so this route does it server-side.
 * It only ever reads; nothing under backend/ is written or generated here.
 *
 * The allowlist is the whole security model: `name` comes from the URL, so it is
 * matched against a fixed set rather than joined into a path.
 */

const FIXTURES = {
  predict: "predict.json",
  "anomaly.nominal": "anomaly.nominal.json",
  "anomaly.spike": "anomaly.spike.json",
  "anomaly.drift": "anomaly.drift.json",
  "anomaly.fault": "anomaly.fault.json",
  explain: "explain.json",
} as const;

export type FixtureName = keyof typeof FIXTURES;

const FIXTURE_DIR = path.join(process.cwd(), "..", "backend", "fixtures");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const raw = Array.isArray(req.query.name) ? req.query.name[0] : req.query.name;
  const file = raw && Object.prototype.hasOwnProperty.call(FIXTURES, raw)
    ? FIXTURES[raw as FixtureName]
    : undefined;

  if (!file) {
    res.status(404).json({ error: `Unknown fixture "${raw ?? ""}"` });
    return;
  }

  try {
    const body = await fs.readFile(path.join(FIXTURE_DIR, file), "utf8");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(body);
  } catch {
    // Deployed without the backend checkout beside it — say so plainly rather
    // than letting the dashboard render an empty chart with no explanation.
    res.status(503).json({
      error: `Fixture ${file} not readable at ${FIXTURE_DIR}`,
    });
  }
}
