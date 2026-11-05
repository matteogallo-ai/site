/** A box in the coordinates of the contract sheet (CSS pixels, origin at its top-left). */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LensLayout {
  lens: Box;
  /** Where the copy of the sheet sits inside the lens, before it is scaled about `origin`. */
  view: { left: number; top: number };
  origin: { x: number; y: number };
  scale: number;
}

export const SCALE = 1.12;
export const PAD = 8;

/**
 * The lens is centred on the target's centre and sized to the enlarged target. The copy is
 * aligned with the sheet, then scaled about that same centre, so the enlarged words stay under
 * the lens centre. The lens stays on the sheet (its glass ring uses the demo's clip margin) and
 * is symmetric about the centre, so near an edge or in a narrow column the words are enlarged
 * less, down to their own size, and the lens still holds them whole: a cut first letter reads
 * as a different word.
 */
export function lensLayout(target: Box, sheetWidth: number, scale = SCALE): LensLayout {
  const cx = target.left + target.width / 2;
  const cy = target.top + target.height / 2;
  const half = Math.max(0, Math.min(cx, sheetWidth - cx));
  const fit = Math.max(1, Math.min(scale, (half - PAD) / (target.width / 2)));
  const width = Math.min(target.width * fit + 2 * PAD, 2 * half);
  const height = target.height * fit + 2 * PAD;
  const left = cx - width / 2;
  const top = cy - height / 2;
  return { lens: { left, top, width, height }, view: { left: -left, top: -top }, origin: { x: cx, y: cy }, scale: fit };
}

/** The rectangle of a target relative to the sheet, from the page's own layout. */
export function relativeBox(target: DOMRect, sheet: DOMRect): Box {
  return { left: target.left - sheet.left, top: target.top - sheet.top, width: target.width, height: target.height };
}

/**
 * The smallest box around `boxes`. The target is built from its text boxes: a Range across
 * list items also returns the whole box of every item it fully contains, as wide as the
 * line, which shifts the centre and widens the lens past what the words need.
 */
export function unionBox(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.left + b.width));
  const bottom = Math.max(...boxes.map((b) => b.top + b.height));
  return { left, top, width: right - left, height: bottom - top };
}
