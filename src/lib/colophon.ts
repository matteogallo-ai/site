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
import type { Lang } from "./i18n.ts";
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

/** "200 ko" / "200 kB": the budgets count a kilobyte as 1 000 bytes, the stricter reading of the SPEC. */
export const kilo = (bytes: number, lang: Lang) => `${Math.round(bytes / 1000)}\u00A0${lang === "fr" ? "ko" : "kB"}`;

/** The budgets as a reader states them, from the thresholds lhci compares with. */
export function budgets(config: Config, lang: Lang): Budget[] {
  const a = config.ci.assert.assertions;
  const scores = ["performance", "accessibility", "best-practices", "seo"].map((c) => bound(a, `categories:${c}`, "minScore"));
  if (new Set(scores).size !== 1) throw new Error("the four Lighthouse categories no longer share one threshold");
  // lhci passes a value equal to its bound; the SPEC's limits are strict, so lighthouserc.cjs
  // sets each bound one unit below them (1499 ms, 0.019). The page states the SPEC's limits, and
  // a bound of any other form fails here rather than be restated wrongly.
  const lcpBound = bound(a, "largest-contentful-paint", "maxNumericValue");
  const clsBound = bound(a, "cumulative-layout-shift", "maxNumericValue");
  const lcp = lcpBound + 1;
  const cls = Math.round((clsBound + 0.001) * 1000) / 1000;
  if (lcp % 100 !== 0) throw new Error(`LCP bound ${lcpBound} is not one millisecond under a tenth of a second`);
  if (Math.round(cls * 1000) % 10 !== 0) throw new Error(`CLS bound ${clsBound} is not one thousandth under a hundredth`);
  const total = kilo(bound(a, "resource-summary:total:size", "maxNumericValue"), lang);
  const fonts = kilo(bound(a, "resource-summary:font:size", "maxNumericValue"), lang);
  const lcpText = `${decimal(lcp / 1000, 1, lang)}\u00A0s`;
  const score = Math.round(scores[0]! * 100);
  if (lang === "fr") {
    return [
      { label: "Poids transféré d’une page", limit: `au plus ${total}` },
      { label: "Polices d’une page", limit: `au plus ${fonts}` },
      { label: "Affichage du plus grand élément (LCP)", limit: `moins de ${lcpText}` },
      { label: "Décalage de la mise en page (CLS)", limit: `moins de ${decimal(cls, 2, lang)}` },
      { label: "Notes Lighthouse, dans les quatre catégories", limit: `au moins ${score} sur 100` },
    ];
  }
  return [
    { label: "Weight transferred by a page", limit: `at most ${total}` },
    { label: "Fonts of a page", limit: `at most ${fonts}` },
    { label: "Largest Contentful Paint (LCP)", limit: `under ${lcpText}` },
    { label: "Cumulative Layout Shift (CLS)", limit: `under ${decimal(cls, 2, lang)}` },
    { label: "Lighthouse scores, in all four categories", limit: `at least ${score} out of 100` },
  ];
}

// A CommonJS file infers its assertion tuples as plain arrays; budgets() checks every value it reads.
export const siteBudgets = (lang: Lang) => budgets(lhci as unknown as Config, lang);
export const site = measures as SiteMeasures;
export const siteSource = source as { run: string; artifact: string; artifactDigest: string; artifactExpires: string; sha256: string };
