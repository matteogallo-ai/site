import { test } from "node:test";
import assert from "node:assert/strict";
import { protectingMain, type Ruleset } from "./rulesets-lib.ts";

const ruleset = (over: Partial<Ruleset> = {}): Ruleset => ({
  id: 1,
  name: "main",
  target: "branch",
  enforcement: "active",
  conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
  rules: [{ type: "pull_request" }, { type: "non_fast_forward" }],
  ...over,
});

test("an active branch ruleset with a protective rule on the default branch protects main", () => {
  assert.deepEqual(protectingMain([ruleset()]), ["main"]);
  assert.deepEqual(protectingMain([ruleset({ conditions: { ref_name: { include: ["refs/heads/main"] } } })]), ["main"]);
  assert.deepEqual(protectingMain([ruleset({ conditions: { ref_name: { include: ["~ALL"] } } })]), ["main"]);
});

test("no ruleset, as the API answers before any is created, protects nothing", () => {
  assert.deepEqual(protectingMain([]), []);
});

test("a ruleset that is only evaluated or disabled does not protect", () => {
  assert.deepEqual(protectingMain([ruleset({ enforcement: "evaluate" }), ruleset({ enforcement: "disabled" })]), []);
});

test("a ruleset on other branches, excluding main, or on tags does not protect main", () => {
  assert.deepEqual(protectingMain([ruleset({ conditions: { ref_name: { include: ["refs/heads/release"] } } })]), []);
  assert.deepEqual(protectingMain([ruleset({ conditions: { ref_name: { include: ["~ALL"], exclude: ["refs/heads/main"] } } })]), []);
  assert.deepEqual(protectingMain([ruleset({ target: "tag" })]), []);
});

test("a ruleset with no protective rule does not protect", () => {
  assert.deepEqual(protectingMain([ruleset({ rules: [{ type: "required_signatures" }] })]), []);
});
