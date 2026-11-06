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

test("an interval reads as whole percents rounded outwards, never narrower than its source", () => {
  // [0.639581, 0.947631]: the lower bound goes down, the upper bound up.
  assert.equal(interval(measure("verity.refusal_recall")), "63\u00A0% – 95\u00A0%");
  // Printed by its source as [9.5%, 16.3%]: rounding to nearest would show 10–16, inside it.
  assert.equal(interval(measure("promptlang.baseline_report_all_precision")), "9\u00A0% – 17\u00A0%");
  // Whole percents already ([0.23, 0.71]): floating-point error must not move them.
  assert.equal(interval(measure("praxis.live_completed")), "23\u00A0% – 71\u00A0%");
});

test("an interval is refused for a measure that has none", () => {
  assert.throws(() => interval(measure("promptlang.mutation_score")), /has no interval/);
});
