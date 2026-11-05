import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { type Box, lensLayout, PAD, RING, unionBox } from "./lens.ts";

const centre = (b: Box) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
const holds = (lens: Box, t: Box) => t.left >= lens.left && t.left + t.width <= lens.left + lens.width && t.top >= lens.top && t.top + t.height <= lens.top + lens.height;

test("the lens is centred on the target and holds it with PAD around", () => {
  const target = { left: 40, top: 300, width: 220, height: 22 };
  const lens = lensLayout(target, 520);
  assert.deepEqual(centre(lens), centre(target));
  assert.deepEqual(lens, { left: 40 - PAD, top: 300 - PAD, width: 220 + 2 * PAD, height: 22 + 2 * PAD });
});

test("words near a sheet edge stay whole and centred; the lens stays on the sheet", () => {
  for (const [target, sheet] of [
    [{ left: 0, top: 0, width: 300, height: 20 }, 320],
    [{ left: 200, top: 0, width: 310, height: 20 }, 520],
    [{ left: 8, top: 100, width: 469, height: 68 }, 541],
  ] as const) {
    const lens = lensLayout(target, sheet);
    assert.ok(holds(lens, target), JSON.stringify({ target, sheet, lens }));
    assert.ok(lens.left >= 0 && lens.left + lens.width <= sheet + 1e-9, JSON.stringify({ target, sheet, lens }));
    assert.deepEqual(centre(lens), centre(target));
  }
});

test("with room on the sheet, the lens keeps its whole ring on the sheet", () => {
  // The widest ring .lens draws in VerityDemo.astro (its padding, masked to a ring).
  const css = readFileSync(new URL("../components/VerityDemo.astro", import.meta.url), "utf8");
  const drawn = Number(/\n  \.lens \{[^}]*?--ring:\s*(\d+)px/.exec(css)?.[1]);
  assert.ok(drawn > 0, "no --ring found in .lens");
  assert.ok(RING >= drawn, `RING ${RING} < ring drawn ${drawn}`);
  // 10 px from the left edge: without the inset the lens would reach x = 2 and lose its ring.
  const lens = lensLayout({ left: 10, top: 0, width: 300, height: 20 }, 400);
  assert.ok(lens.left >= drawn && lens.left + lens.width <= 400 - drawn, JSON.stringify(lens));
});

test("the target is the union of its text boxes, not of the elements around them", () => {
  const lines = [
    { left: 42, top: 100, width: 389, height: 20 },
    { left: 42, top: 124, width: 469, height: 20 },
    { left: 42, top: 148, width: 310, height: 20 },
  ];
  assert.deepEqual(unionBox(lines), { left: 42, top: 100, width: 469, height: 68 });
  assert.equal(unionBox([]), null);
});
