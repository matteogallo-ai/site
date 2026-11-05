import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildMeasures, type Lhr, type ManifestEntry } from "./site-measures-lib.ts";

// Plumbing fixture: a trimmed local Lighthouse report, used only to check parsing.
const fixture = JSON.parse(readFileSync(new URL("./fixtures/lhr-index.json", import.meta.url), "utf8")) as Lhr;
const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const NOW = new Date("2026-11-05T12:00:00Z");
const ctx = (expectedPaths = ["/"]) => ({ commit: COMMIT, now: NOW, expectedPaths });

const run = (url: string, representative: boolean): ManifestEntry => ({ url, isRepresentativeRun: representative, jsonPath: url });
const manifest = [run("http://localhost:1/index.html", false), run("http://localhost:1/index.html", true), run("http://localhost:1/index.html", false)];

test("reads the representative run of each page", () => {
  const m = buildMeasures(manifest, () => fixture, ctx());
  assert.equal(m.generatedAt, "2026-11-05T12:00:00.000Z");
  assert.equal(m.commit, COMMIT);
  assert.deepEqual(m.lighthouse, {
    version: "13.6.0",
    formFactor: "mobile",
    runsPerPage: 3,
    aggregation: "median-run",
    transfer: "gzip, served by the lhci local static server",
  });
  assert.deepEqual(m.pages, [
    { path: "/", transferBytes: 116743, fontBytes: 113935, scores: { performance: 100, accessibility: 100, bestPractices: 100, seo: 100 }, lcpMs: 609, cls: 0 },
  ]);
});

test("keeps nested paths and sorts pages", () => {
  const two = [run("http://localhost:1/projets/verity/index.html", true), run("http://localhost:1/index.html", true)];
  const m = buildMeasures(two, () => fixture, ctx(["/", "/projets/verity/"]));
  assert.deepEqual(m.pages.map((p) => p.path), ["/", "/projets/verity/"]);
});

test("refuses an empty manifest instead of writing empty measures", () => {
  assert.throws(() => buildMeasures([], () => fixture, ctx()), /no representative run/);
});

test("refuses a short or missing commit hash", () => {
  assert.throws(() => buildMeasures(manifest, () => fixture, { ...ctx(), commit: "abc123" }), /full commit hash/);
});

test("refuses a report with a null category score (Lighthouse error page)", () => {
  const broken = structuredClone(fixture);
  (broken.categories["seo"] as { score: number | null }).score = null;
  assert.throws(() => buildMeasures(manifest, () => broken, ctx()), /score for category "seo"/);
});

test("refuses a report without the transfer total", () => {
  const broken = structuredClone(fixture);
  delete broken.audits["resource-summary"];
  assert.throws(() => buildMeasures(manifest, () => broken, ctx()), /resource-summary/);
});

test("refuses measures that miss a built page (lhci autodiscovery caps)", () => {
  assert.throws(() => buildMeasures(manifest, () => fixture, ctx(["/", "/404.html", "/en/"])), /not measured: \/404\.html, \/en\//);
});

test("refuses a manifest with uneven runs per page", () => {
  // 3 runs of "/" and 2 of "/en/": the median of each is not over the same sample size.
  const uneven = [...manifest, run("http://localhost:1/en/index.html", true), run("http://localhost:1/en/index.html", false)];
  assert.throws(() => buildMeasures(uneven, () => fixture, ctx(["/", "/en/"])), /runs per page/);
});

test("refuses a report without the font row (Lighthouse always emits it, 0 included)", () => {
  const noFont = structuredClone(fixture);
  const items = noFont.audits["resource-summary"]?.details?.items ?? [];
  noFont.audits["resource-summary"] = { details: { items: items.filter((i) => i.resourceType !== "font") } };
  assert.throws(() => buildMeasures(manifest, () => noFont, ctx()), /font row/);
});
