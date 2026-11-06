import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { budgets, kilo, site, siteBudgets, siteSource } from "./colophon.ts";

const config = (over: Record<string, [string, object]> = {}) => ({
  ci: {
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.98 }],
        "categories:accessibility": ["error", { minScore: 0.98 }],
        "categories:best-practices": ["error", { minScore: 0.98 }],
        "categories:seo": ["error", { minScore: 0.98 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 1499 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.019 }],
        "resource-summary:total:size": ["error", { maxNumericValue: 200_000 }],
        "resource-summary:font:size": ["error", { maxNumericValue: 90_000 }],
        ...over,
      } as Record<string, [string, { minScore?: number; maxNumericValue?: number }]>,
    },
  },
});

test("the budgets read as the SPEC states them, from the bounds lhci compares with", () => {
  assert.deepEqual(
    budgets(config()).map((b) => b.limit),
    ["au plus 200 ko", "au plus 90 ko", "moins de 1,5 s", "moins de 0,02", "au moins 98 sur 100"],
  );
});

test("the page shows the budgets lighthouserc.cjs enforces", () => {
  assert.deepEqual(siteBudgets, budgets(config()));
});

test("a budget missing from the configuration fails instead of showing a blank", () => {
  const c = config();
  delete (c.ci.assert.assertions as Record<string, unknown>)["resource-summary:font:size"];
  assert.throws(() => budgets(c), /no maxNumericValue for resource-summary:font:size/);
});

test("a bound not one unit under a round limit fails instead of being restated wrongly", () => {
  assert.throws(() => budgets(config({ "largest-contentful-paint": ["error", { maxNumericValue: 1500 }] })), /LCP bound 1500/);
  assert.throws(() => budgets(config({ "cumulative-layout-shift": ["error", { maxNumericValue: 0.05 }] })), /CLS bound 0.05/);
});

test("four categories with different thresholds cannot be stated as one", () => {
  assert.throws(() => budgets(config({ "categories:seo": ["error", { minScore: 0.9 }] })), /share one threshold/);
});

test("kilo rounds to whole kilobytes of 1 000 bytes", () => {
  assert.equal(kilo(167_813), "168 ko");
  assert.equal(kilo(82_112), "82 ko");
});

test("the measures are the CI artifact byte for byte, from a CI run of this repository", () => {
  const bytes = readFileSync(new URL("../data/site-measures.json", import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), siteSource.sha256);
  assert.match(siteSource.artifactDigest, /^sha256:[0-9a-f]{64}$/);
  assert.match(siteSource.run, /^https:\/\/github\.com\/matteogallo-ai\/site\/actions\/runs\/\d+$/);
  assert.match(site.commit, /^[0-9a-f]{40}$/);
  assert.ok(site.pages.length > 0);
});
