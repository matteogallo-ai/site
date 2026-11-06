import { test } from "node:test";
import assert from "node:assert/strict";
import { gatingRulesets } from "./rulesets-lib.ts";

test("a required pull request or a ban on direct updates gates main", () => {
  assert.deepEqual(gatingRulesets([{ type: "pull_request", ruleset_id: 7 }]), [7]);
  assert.deepEqual(gatingRulesets([{ type: "update", ruleset_id: 3 }]), [3]);
});

test("no rule, as GitHub answers before any ruleset is active, gates nothing", () => {
  assert.deepEqual(gatingRulesets([]), []);
});

test("rules that guard the history but let a direct push through do not gate main", () => {
  assert.deepEqual(
    gatingRulesets([
      { type: "deletion", ruleset_id: 1 },
      { type: "non_fast_forward", ruleset_id: 1 },
      { type: "required_signatures", ruleset_id: 2 },
    ]),
    [],
  );
});

test("several rulesets: each gating one is named once, the others are not", () => {
  assert.deepEqual(
    gatingRulesets([
      { type: "deletion", ruleset_id: 9 },
      { type: "pull_request", ruleset_id: 4 },
      { type: "update", ruleset_id: 4 },
      { type: "pull_request", ruleset_id: 2 },
    ]),
    [2, 4],
  );
});
