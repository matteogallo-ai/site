import assert from "node:assert/strict";
import { test } from "node:test";
import { layout, WIDTH } from "./diagram.ts";

const steps = [
  { title: "Question" },
  { title: "Recherche", lines: ["dense et lexicale"] },
];

test("steps stack top to bottom inside the width, each joined to the next by an arrow", () => {
  const d = layout({ steps });
  assert.equal(d.boxes.length, 2);
  const [a, b] = d.boxes;
  assert.ok(a!.y + a!.h < b!.y, "the second step is below the first");
  for (const box of d.boxes) assert.ok(box.x >= 0 && box.x + box.w <= WIDTH);
  assert.equal(d.arrows.length, 1);
  assert.ok(d.height >= b!.y + b!.h);
});

test("a box grows with its lines", () => {
  const short = layout({ steps: [{ title: "A" }] }).boxes[0]!;
  const tall = layout({ steps: [{ title: "A", lines: ["x", "y"] }] }).boxes[0]!;
  assert.ok(tall.h > short.h);
});

test("outcomes sit side by side under the last step, each reached by an arrow", () => {
  const d = layout({ steps, outcomes: [{ title: "Réponse", tone: "proof" }, { title: "Refus", tone: "defect" }] });
  const [, last, left, right] = d.boxes;
  assert.equal(left!.y, right!.y);
  assert.ok(left!.x + left!.w < right!.x);
  assert.ok(left!.y > last!.y + last!.h);
  assert.equal(left!.tone, "proof");
  assert.equal(d.arrows.length, 1 + 2);
});

test("a line too long for its box fails instead of overflowing it", () => {
  const long = "x".repeat(80);
  assert.throws(() => layout({ steps: [{ title: "A", lines: [long] }] }), /does not fit/);
  assert.throws(() => layout({ steps, outcomes: [{ title: "a", lines: ["deux lignes"] }, { title: "b" }, { title: "c", lines: ["une ligne bien trop longue"] }] }), /does not fit/);
});

test("a diagram has at least one step", () => {
  assert.throws(() => layout({ steps: [] }), /at least one step/);
});
