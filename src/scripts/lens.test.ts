import assert from "node:assert/strict";
import { test } from "node:test";
import { lensLayout, SCALE } from "./lens.ts";

const centre = (b: { left: number; top: number; width: number; height: number }) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });

test("the lens is centred on the target", () => {
  const target = { left: 40, top: 300, width: 220, height: 22 };
  const { lens } = lensLayout(target, 520);
  assert.deepEqual(centre(lens), centre(target));
  assert.ok(lens.width > target.width && lens.height > target.height);
});

test("a target wider than the sheet keeps its centre: the lens is capped, not shifted", () => {
  const target = { left: 10, top: 100, width: 500, height: 60 };
  const { lens } = lensLayout(target, 400);
  assert.equal(lens.width, 400);
  assert.deepEqual(centre(lens), centre(target));
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
