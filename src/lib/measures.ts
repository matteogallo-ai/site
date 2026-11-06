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
  // One convention for every range on the site, as for costs (3,29–4,75 $): the bounds joined by
  // an en dash, the unit once. French puts a no-break space before "%"; the typography pass of
  // the build narrows it where the font has U+202F (scripts/typography.ts).
  return lang === "fr" ? `${lo}–${hi}\u00A0%` : `${lo}–${hi}%`;
}

const numbers = (s: string) => s.match(/\d+(?:[.,]\d+)?/g) ?? [];

/**
 * Why words shown in place of a figure's value ("3", "12 signalements justes sur 40") would
 * misstate the measure, or undefined: each number in them must be the measure's k, n or a number
 * of its display, and there must be one, so a figure never hides behind words.
 */
export function shownTextError(m: VerifiedMeasure, text: string, lang: "fr" | "en"): string | undefined {
  const shown = numbers(text);
  if (shown.length === 0) return `${m.id}: "${text}" shows no number`;
  const own = new Set([...[m.k, m.n].filter((v) => v !== undefined).map(String), ...numbers(m.display[lang])]);
  const stray = shown.filter((n) => !own.has(n));
  return stray.length > 0 ? `${m.id}: "${text}" shows ${stray.join(", ")}, not a number of the measure` : undefined;
}
