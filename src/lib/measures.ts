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
