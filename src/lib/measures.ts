// The attribute lets Node run this module in unit tests; Vite reads it the same way.
import data from "../data/measures.json" with { type: "json" };
import type { MeasuresFile, VerifiedMeasure } from "../../scripts/measures-lib.ts";

const file = data as MeasuresFile;

/** A verified measure by id. A page asking for a missing or gap measure fails the build. */
export function measure(id: string): VerifiedMeasure {
  const m = file.measures.find((x) => x.id === id);
  if (!m) throw new Error(`measures.json has no ${id}`);
  if (m.status !== "verified") throw new Error(`${id} is a gap: show it as a gap, not as a figure`);
  return m;
}

/** "0,99" in French, "0.99" in English: the decimal separator is the only difference used. */
export const decimal = (x: number, digits: number, lang: "fr" | "en") => {
  const s = x.toFixed(digits);
  return lang === "fr" ? s.replace(".", ",") : s;
};

/**
 * The 95 % interval in whole percents, rounded outwards: some sources print their interval
 * at that precision (Praxis's SYSTEM_CARD), and a shown interval is never narrower than
 * the one its source states.
 */
export function interval(m: VerifiedMeasure, lang: "fr" | "en"): string {
  if (!m.ci95) throw new Error(`${m.id} has no interval`);
  // 0.23 * 100 is 23.000000000000004: the tolerance keeps exact whole percents where they are.
  const lo = Math.floor(m.ci95[0] * 100 + 1e-9);
  const hi = Math.ceil(m.ci95[1] * 100 - 1e-9);
  // French sets a no-break space before "%" (U+00A0, which the sans subset has); English none.
  return lang === "fr" ? `${lo}\u00A0% – ${hi}\u00A0%` : `${lo}% – ${hi}%`;
}
