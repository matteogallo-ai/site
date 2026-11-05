import assert from "node:assert/strict";
import { test } from "node:test";
import { activeSection } from "./spy.ts";

test("no section is active while the reader is above the first", () => {
  assert.equal(activeSection([900, 1800, 2600], 320), -1);
});

test("the last section whose top passed the line is active", () => {
  assert.equal(activeSection([-400, 200, 1100], 320), 1);
  assert.equal(activeSection([-2000, -900, -10], 320), 2);
});

test("a top exactly on the line counts as passed; no sections, none active", () => {
  assert.equal(activeSection([320, 900], 320), 0);
  assert.equal(activeSection([], 320), -1);
});
