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
 * The 95 % interval in whole percents. Whole percents because some sources print their
 * interval at that precision (Praxis's SYSTEM_CARD); more digits would claim precision
 * the source does not give.
 */
export function interval(m: VerifiedMeasure, lang: "fr" | "en"): string {
  if (!m.ci95) throw new Error(`${m.id} has no interval`);
  const [lo, hi] = m.ci95.map((x) => (x * 100).toFixed(0));
  // The no-break space keeps "%" on the line of its number; the sans subset has U+00A0.
  return lang === "fr" ? `${lo} % – ${hi} %` : `${lo}%–${hi}%`;
}
