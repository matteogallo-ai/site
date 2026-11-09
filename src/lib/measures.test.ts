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
  assert.deepEqual(n.display, { fr: "1\u00A0914", en: "1,914" });
  assert.equal(n.commit, measure("promptlang.mutation_score").commit);
});

test("the derived figures follow from their own evidence", () => {
  const stated = (id: string, pointer: string, path?: string): number => {
    for (const e of measure(id).evidence) {
      if ("equals" in e && e.pointer === pointer && (path === undefined || e.path === path)) return e.equals as number;
    }
    throw new Error(`${id}: no evidence at ${pointer}`);
  };
  const total = measure("promptlang.mutants_total").value as number;
  const n = ["/total/killed", "/total/timeout", "/total/survived", "/total/noCoverage"].map((p) => stated("promptlang.mutants_total", p));
  assert.equal(n.reduce((a, b) => a + b, 0), total);
  // Stryker's score: mutants detected (killed or timed out) over all mutants, to two decimals.
  assert.equal(Math.round(((n[0]! + n[1]!) / total) * 10_000) / 100, measure("promptlang.mutation_score").value);
  const cost = (path: string) => stated("praxis.q12_cost_ratio", "/usage/total/cost_usd", path);
  const ratio = cost("benchmarks/outputs/live/12-sodium-ion-plant-morocco/run-2026-11-04T13-20-16-572Z/metadata.json") / cost("benchmarks/outputs/baseline/12-sodium-ion-plant-morocco/run-2026-11-07T11-28-59-229Z/metadata.json");
  assert.equal(ratio.toFixed(1), "9.8");
  assert.equal(measure("praxis.q12_cost_ratio").value, Number(ratio.toFixed(4)));
});

test("a derived figure links to a file that states what it is derived from", () => {
  // praxis.q12_cost_ratio is $4.75 over $0.48: its link (path, url) must open a page that shows both.
  const m = measure("praxis.q12_cost_ratio");
  const own = m.evidence.filter((e) => "contains" in e && (e.path === undefined || e.path === m.path)).map((e) => ("contains" in e ? e.contains : ""));
  assert.ok(own.some((t) => t.includes("$0.48") && t.includes("$4.75")), `${m.path} states neither cost`);
  assert.equal(m.commit, "bfad47e21f0d191d5c7cf57993932a640c3453d2");
});

test("the PromptLang audit counts its defects apart from its one remark on context", () => {
  const m = measure("promptlang.audit_defects");
  assert.equal(m.value, 22);
  assert.equal(m.path, measure("promptlang.audit_findings").path);
  const rows = m.evidence.map((e) => ("contains" in e ? e.contains : ""));
  assert.ok(rows.includes("| C22 | Mineur |"), "row C22 is a defect");
  assert.ok(rows.includes("| C23 | Contexte (pas un défaut) |"), "row C23 is context, not a defect");
});
