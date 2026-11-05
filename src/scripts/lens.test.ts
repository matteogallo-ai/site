import assert from "node:assert/strict";
import { test } from "node:test";
import { type Box, lensLayout, RING, SCALE, unionBox } from "./lens.ts";

const centre = (b: { left: number; top: number; width: number; height: number }) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });

test("the lens is centred on the target", () => {
  const target = { left: 40, top: 300, width: 220, height: 22 };
  const { lens } = lensLayout(target, 520);
  assert.deepEqual(centre(lens), centre(target));
  assert.ok(lens.width > target.width && lens.height > target.height);
});

const enlarged = (target: Box, origin: { x: number }, scale: number) => ({
  left: origin.x - (origin.x - target.left) * scale,
  right: origin.x + (target.left + target.width - origin.x) * scale,
});

const holds = (target: Box, sheetWidth: number) => {
  const { lens, origin, scale } = lensLayout(target, sheetWidth);
  const words = enlarged(target, origin, scale);
  return { lens, scale, inside: words.left >= lens.left - 1e-9 && words.right <= lens.left + lens.width + 1e-9, onSheet: lens.left >= 0 && lens.left + lens.width <= sheetWidth + 1e-9 };
};

test("words near a sheet edge are enlarged less, never cut, and the lens stays on the sheet", () => {
  // Off-centre targets: close to the left edge, close to the right edge.
  for (const [target, sheet] of [
    [{ left: 0, top: 0, width: 300, height: 20 }, 320],
    [{ left: 200, top: 0, width: 310, height: 20 }, 520],
    [{ left: 8, top: 100, width: 469, height: 68 }, 541],
  ] as const) {
    const r = holds(target, sheet);
    assert.ok(r.inside && r.onSheet, JSON.stringify({ target, sheet, ...r }));
    assert.ok(r.scale >= 1 && r.scale <= SCALE);
    assert.deepEqual(centre(r.lens), centre(target));
  }
});

test("with room on the sheet, the lens keeps its ring on the sheet", () => {
  // 10 px from the left edge: without the inset the lens would reach x = 0 and lose its ring.
  const { lens } = lensLayout({ left: 10, top: 0, width: 300, height: 20 }, 400);
  // The ring .lens draws in VerityDemo.astro: box-shadow out to 7 px.
  const drawn = 7;
  assert.ok(RING >= drawn);
  assert.ok(lens.left >= drawn && lens.left + lens.width <= 400 - drawn, JSON.stringify(lens));
});

test("words with no room to grow are shown at their size", () => {
  assert.equal(lensLayout({ left: 0, top: 0, width: 300, height: 20 }, 300).scale, 1);
});

test("the enlarged copy puts the target's centre under the lens centre", () => {
  const target = { left: 64, top: 410, width: 300, height: 66 };
  const { lens, view, origin, scale } = lensLayout(target, 520);
  // A point p of the copy, aligned with the sheet, lands at view + origin + (p - origin) * scale in lens coordinates.
  const at = (p: number, v: number, o: number) => v + o + (p - o) * scale;
  const c = centre(target);
  assert.ok(Math.abs(at(c.x, view.left, origin.x) - lens.width / 2) < 1e-9);
  assert.ok(Math.abs(at(c.y, view.top, origin.y) - lens.height / 2) < 1e-9);
  assert.equal(scale, SCALE);
});

test("the target is the union of its text boxes, not of the elements around them", () => {
  // Three list lines of different lengths: the union spans the longest, from the shared left edge.
  const lines = [
    { left: 42, top: 100, width: 389, height: 20 },
    { left: 42, top: 124, width: 469, height: 20 },
    { left: 42, top: 148, width: 310, height: 20 },
  ];
  assert.deepEqual(unionBox(lines), { left: 42, top: 100, width: 469, height: 68 });
  assert.equal(unionBox([]), null);
});

test("an enlarged target that fits the sheet stays inside the lens at full scale", () => {
  const target = { left: 60, top: 100, width: 469, height: 68 };
  const { lens, origin, scale } = lensLayout(target, 672);
  const words = enlarged(target, origin, scale);
  assert.equal(scale, SCALE);
  assert.ok(words.left >= lens.left && words.right <= lens.left + lens.width);
});
