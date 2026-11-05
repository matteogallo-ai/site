import assert from "node:assert/strict";
import { test } from "node:test";
import { counted } from "./count.ts";

test("the first number counts from 0 to its value; the rest of the text stays", () => {
  assert.equal(counted("17/20", 0), "0/20");
  assert.equal(counted("17/20", 1), "17/20");
  assert.equal(counted("17/20", 2), "17/20");
  assert.equal(counted("17/20", -1), "0/20");
  assert.equal(counted("0/31", 0.5), "0/31");
});

test("the count only grows, and lands on the value exactly", () => {
  let last = -1;
  for (let p = 0; p <= 1.0001; p += 0.01) {
    const n = Number(counted("17/20", p).split("/")[0]);
    assert.ok(n >= last && n <= 17, `${n} after ${last}`);
    last = n;
  }
  assert.equal(last, 17);
});

test("a display without a number is shown as it is", () => {
  assert.equal(counted("—", 0.3), "—");
});
