/** A box in the coordinates of the contract sheet (CSS pixels, origin at its top-left). */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Room left between the words and the inner edge of the glass ring. */
export const PAD = 8;
/** The glass ring drawn around the lens box: the sheet scrolls and clips it, so it keeps this far in. */
export const RING = 8;

/**
 * The spotlight's lens: the target box grown by PAD, centred on the target. It stays a ring's
 * width inside the sheet and symmetric about the centre, so the words stay centred under it; when
 * words lie closer to an edge than that, the lens keeps their width and its ring is clipped
 * rather than cutting a letter.
 */
export function lensLayout(target: Box, sheetWidth: number): Box {
  const cx = target.left + target.width / 2;
  const cy = target.top + target.height / 2;
  const half = Math.max(0, Math.min(cx, sheetWidth - cx) - RING);
  const width = Math.min(target.width + 2 * PAD, Math.max(2 * half, target.width));
  const height = target.height + 2 * PAD;
  return { left: cx - width / 2, top: cy - height / 2, width, height };
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
