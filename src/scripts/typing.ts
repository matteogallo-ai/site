/**
 * How many characters of `text` are written at `progress` (0 to 1): whole words only, at an
 * even pace per word, so the line never shows half a word.
 */
export function revealed(text: string, progress: number): number {
  const ends = [...text.matchAll(/\S+/g)].map((m) => m.index + m[0].length);
  if (progress >= 1) return text.length;
  const words = Math.floor(Math.max(0, progress) * ends.length);
  return words === 0 ? 0 : ends[words - 1]!;
}

/** A CSS <time> ("400ms", ".4s") in milliseconds; undefined when it is not one. */
export function durationMs(value: string): number | undefined {
  const m = /^\s*(\d*\.?\d+)(ms|s)\s*$/.exec(value);
  if (!m) return undefined;
  return Number(m[1]) * (m[2] === "s" ? 1000 : 1);
}
