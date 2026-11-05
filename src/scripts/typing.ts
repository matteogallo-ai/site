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

/** Reading pace of the written answer: about 35 ms a word, capped at 1.5 s (SPEC §4). */
export const MS_PER_WORD = 35;
export const MAX_WRITING_MS = 1500;

export function writingDuration(text: string): number {
  return Math.min((text.match(/\S+/g)?.length ?? 0) * MS_PER_WORD, MAX_WRITING_MS);
}
