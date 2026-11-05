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
const PAD = 8;

/**
 * The lens is centred on the target's centre, sized to the enlarged target, and never
 * wider than the sheet. The copy is aligned with the sheet, then scaled about that same
 * centre, so the enlarged words stay under the lens centre.
 */
export function lensLayout(target: Box, sheetWidth: number, scale = SCALE): LensLayout {
  const cx = target.left + target.width / 2;
  const cy = target.top + target.height / 2;
  const width = Math.min(target.width * scale + 2 * PAD, sheetWidth);
  const height = target.height * scale + 2 * PAD;
  const left = cx - width / 2;
  const top = cy - height / 2;
  return { lens: { left, top, width, height }, view: { left: -left, top: -top }, origin: { x: cx, y: cy }, scale };
}

/** The rectangle of a target relative to the sheet, from the page's own layout. */
export function relativeBox(target: DOMRect, sheet: DOMRect): Box {
  return { left: target.left - sheet.left, top: target.top - sheet.top, width: target.width, height: target.height };
}
