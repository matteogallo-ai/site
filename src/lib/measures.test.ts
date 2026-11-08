import assert from "node:assert/strict";
import { test } from "node:test";
import { decimal, interval, measure, shownTextError } from "./measures.ts";

test("a page gets a verified measure by id, and fails the build on an unknown id", () => {
  assert.equal(measure("verity.refusal_recall").display.fr, "13/18");
  assert.throws(() => measure("verity.no_such_measure"), /has no verity.no_such_measure/);
});

test("decimals use the comma in French and the point in English", () => {
  assert.equal(decimal(0.97, 2, "fr"), "0,97");
  assert.equal(decimal(0.97, 2, "en"), "0.97");
});

test("an interval reads as whole percents rounded outwards, never narrower than its source", () => {
  // [0.491273, 0.875002]: the lower bound goes down, the upper bound up.
  assert.equal(interval(measure("verity.refusal_recall"), "fr"), "49–88\u00A0%");
  // Printed by its source as [9.5%, 16.3%]: rounding to nearest would show 10–16, inside it.
  assert.equal(interval(measure("promptlang.baseline_report_all_precision"), "fr"), "9–17\u00A0%");
  // Whole percents already ([0.23, 0.71]): floating-point error must not move them. No measure
  // has such an interval now; the case is kept on a copy of one.
  const whole = { ...measure("verity.refusal_recall"), ci95: [0.23, 0.71] as [number, number] };
  assert.equal(interval(whole, "fr"), "23–71\u00A0%");
  assert.equal(interval(whole, "en"), "23–71%");
});

test("an interval is refused for a measure that has none", () => {
  assert.throws(() => interval(measure("promptlang.mutation_score"), "fr"), /has no interval/);
});

test("shownTextError: words shown for a figure carry only the measure's own numbers", () => {
  const m = measure("verity.unanswerable_answered");
  assert.equal(shownTextError(m, "5", "fr"), undefined);
  assert.match(shownTextError(m, "4", "fr") ?? "", /shows 4/);
  // A figure in words must still show a number: "trois" would escape the check.
  assert.match(shownTextError(m, "trois", "fr") ?? "", /no number/);
  assert.equal(shownTextError(measure("praxis.cost_per_briefing"), "$3.29–4.75", "en"), undefined);
});

test("Praxis is pinned on the merge of praxis#65, where README and the system card state the blind comparison", () => {
  for (const id of ["praxis.q12_cost_ratio", "praxis.live_completed", "praxis.cost_per_briefing", "praxis.insufficiently_sourced", "praxis.stages"]) {
    assert.equal(measure(id).commit, "bfad47e21f0d191d5c7cf57993932a640c3453d2", id);
  }
  // 4.752918 / 0.482876 = 9.84: the unit hid the decimal the brief now leads with.
  assert.deepEqual(measure("praxis.q12_cost_ratio").display, { fr: "9,8×", en: "9.8×" });
});

test("PromptLang's mutant count is the artefact's total, the denominator of its score", () => {
  const n = measure("promptlang.mutants_total");
  assert.equal(n.value, 1914);
  assert.deepEqual(n.display, { fr: "1914", en: "1914" });
  assert.equal(n.commit, measure("promptlang.mutation_score").commit);
});
