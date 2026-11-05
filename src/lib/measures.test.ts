import assert from "node:assert/strict";
import { test } from "node:test";
import { decimal, interval, measure } from "./measures.ts";

test("a page gets a verified measure by id, and fails the build on an unknown id", () => {
  assert.equal(measure("verity.refusal_recall").display.fr, "17/20");
  assert.throws(() => measure("verity.no_such_measure"), /has no verity.no_such_measure/);
});

test("decimals use the comma in French and the point in English", () => {
  assert.equal(decimal(0.97, 2, "fr"), "0,97");
  assert.equal(decimal(0.97, 2, "en"), "0.97");
});

test("an interval reads as whole percents, with French spacing", () => {
  const m = measure("verity.refusal_recall");
  assert.equal(interval(m, "fr"), "64 % – 95 %");
  assert.equal(interval(m, "en"), "64%–95%");
});

test("an interval is refused for a measure that has none", () => {
  assert.throws(() => interval(measure("promptlang.mutation_score"), "fr"), /has no interval/);
});
