import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildMeasures, type Lhr, type ManifestEntry } from "./site-measures-lib.ts";

// Plumbing fixture: a trimmed local Lighthouse report, used only to check parsing.
const fixture = JSON.parse(readFileSync(new URL("./fixtures/lhr-index.json", import.meta.url), "utf8")) as Lhr;
const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const NOW = new Date("2026-11-05T12:00:00Z");

const run = (url: string, representative: boolean): ManifestEntry => ({ url, isRepresentativeRun: representative, jsonPath: url });
const manifest = [run("http://localhost:1/index.html", false), run("http://localhost:1/index.html", true), run("http://localhost:1/index.html", false)];

test("reads the representative run of each page", () => {
  const m = buildMeasures(manifest, () => fixture, { commit: COMMIT, now: NOW });
  assert.equal(m.generatedAt, "2026-11-05T12:00:00.000Z");
  assert.equal(m.commit, COMMIT);
  assert.deepEqual(m.lighthouse, { version: "13.6.0", formFactor: "mobile", runsPerPage: 3, aggregation: "median-run" });
  assert.deepEqual(m.pages, [
    { path: "/", transferBytes: 116743, scores: { performance: 100, accessibility: 100, bestPractices: 100, seo: 100 }, lcpMs: 609, cls: 0 },
  ]);
});

test("keeps nested paths and sorts pages", () => {
  const two = [run("http://localhost:1/projets/verity/index.html", true), run("http://localhost:1/index.html", true)];
  const m = buildMeasures(two, () => fixture, { commit: COMMIT, now: NOW });
  assert.deepEqual(m.pages.map((p) => p.path), ["/", "/projets/verity/"]);
});

test("refuses an empty manifest instead of writing empty measures", () => {
  assert.throws(() => buildMeasures([], () => fixture, { commit: COMMIT, now: NOW }), /no representative run/);
});

test("refuses a short or missing commit hash", () => {
  assert.throws(() => buildMeasures(manifest, () => fixture, { commit: "abc123", now: NOW }), /full commit hash/);
});

test("refuses a report with a null category score (Lighthouse error page)", () => {
  const broken = structuredClone(fixture);
  (broken.categories["seo"] as { score: number | null }).score = null;
  assert.throws(() => buildMeasures(manifest, () => broken, { commit: COMMIT, now: NOW }), /score for category "seo"/);
});

test("refuses a report without the transfer total", () => {
  const broken = structuredClone(fixture);
  delete broken.audits["resource-summary"];
  assert.throws(() => buildMeasures(manifest, () => broken, { commit: COMMIT, now: NOW }), /resource-summary/);
});
