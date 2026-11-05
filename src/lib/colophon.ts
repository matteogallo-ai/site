// What the Colophon shows about the site itself: the budgets CI enforces, read from the
// Lighthouse CI configuration that enforces them, and the measures of one CI run, copied
// byte for byte from its site-measures artifact. src/data/site-measures.source.json names the
// run and the artifact's digest; colophon.test.ts checks the copy against the recorded sha256.
// The copy is committed because CI keeps the artifact 30 days: past artifactExpires, the run page
// and the digest are what is left to compare it with.
import lhci from "../../lighthouserc.cjs";
import measures from "../data/site-measures.json" with { type: "json" };
import source from "../data/site-measures.source.json" with { type: "json" };
import type { SiteMeasures } from "../../scripts/site-measures-lib.ts";
import { decimal } from "./measures.ts";

type Assertion = [string, { minScore?: number; maxNumericValue?: number }];
interface Config {
  ci: { assert: { assertions: Record<string, Assertion> } };
}

export interface Budget {
  label: string;
  limit: string;
}

function bound(assertions: Record<string, Assertion>, id: string, key: "minScore" | "maxNumericValue"): number {
  const value = assertions[id]?.[1][key];
  if (typeof value !== "number") throw new Error(`lighthouserc.cjs asserts no ${key} for ${id}`);
  return value;
}

/** "200 ko": the budgets count 1 ko as 1 000 bytes, the stricter reading of the SPEC. */
export const kilo = (bytes: number) => `${Math.round(bytes / 1000)} ko`;

/** The budgets as a reader states them, from the thresholds lhci compares with. */
export function budgets(config: Config): Budget[] {
  const a = config.ci.assert.assertions;
  const scores = ["performance", "accessibility", "best-practices", "seo"].map((c) => bound(a, `categories:${c}`, "minScore"));
  if (new Set(scores).size !== 1) throw new Error("the four Lighthouse categories no longer share one threshold");
  // lhci passes a value equal to its bound; the SPEC's limits are strict, so lighthouserc.cjs
  // sets each bound one unit below them (1499 ms, 0.049). The page states the SPEC's limits, and
  // a bound of any other form fails here rather than be restated wrongly.
  const lcpBound = bound(a, "largest-contentful-paint", "maxNumericValue");
  const clsBound = bound(a, "cumulative-layout-shift", "maxNumericValue");
  const lcp = lcpBound + 1;
  const cls = Math.round((clsBound + 0.001) * 1000) / 1000;
  if (lcp % 100 !== 0) throw new Error(`LCP bound ${lcpBound} is not one millisecond under a tenth of a second`);
  if (Math.round(cls * 1000) % 10 !== 0) throw new Error(`CLS bound ${clsBound} is not one thousandth under a hundredth`);
  return [
    { label: "Poids transféré d’une page", limit: `au plus ${kilo(bound(a, "resource-summary:total:size", "maxNumericValue"))}` },
    { label: "Polices d’une page", limit: `au plus ${kilo(bound(a, "resource-summary:font:size", "maxNumericValue"))}` },
    { label: "Affichage du plus grand élément (LCP)", limit: `moins de ${decimal(lcp / 1000, 1, "fr")} s` },
    { label: "Décalage de la mise en page (CLS)", limit: `moins de ${decimal(cls, 2, "fr")}` },
    { label: "Notes Lighthouse, dans les quatre catégories", limit: `au moins ${Math.round(scores[0]! * 100)} sur 100` },
  ];
}

// A CommonJS file infers its assertion tuples as plain arrays; budgets() checks every value it reads.
export const siteBudgets = budgets(lhci as unknown as Config);
export const site = measures as SiteMeasures;
export const siteSource = source as { run: string; artifact: string; artifactDigest: string; artifactExpires: string; sha256: string };
