import assert from "node:assert/strict";
import { test } from "node:test";
import { revealed, writingDuration } from "./typing.ts";

const text = "I don't know based on the provided documents.";

test("nothing at the start, everything at the end", () => {
  assert.equal(revealed(text, 0), 0);
  assert.equal(revealed(text, 1), text.length);
  assert.equal(revealed(text, 1.5), text.length);
  assert.equal(revealed(text, -1), 0);
});

test("the text grows by whole words, never cutting one", () => {
  let last = 0;
  for (let p = 0; p <= 1; p += 0.01) {
    const n = revealed(text, p);
    assert.ok(n >= last, "never shrinks");
    assert.ok(n === text.length || n === 0 || text[n] === " ", `cut inside a word at ${n}: ${text.slice(0, n)}|`);
    last = n;
  }
});

test("half the time shows about half the words", () => {
  const words = text.slice(0, revealed(text, 0.5)).split(" ").length;
  assert.ok(words >= 3 && words <= 5, String(words));
});

test("an empty or one-word text", () => {
  assert.equal(revealed("", 0.5), 0);
  assert.equal(revealed("Yes.", 0.5), 0);
  assert.equal(revealed("Yes.", 1), 4);
});

test("about 35 ms a word, never more than 1.5 s", () => {
  assert.equal(writingDuration("one two three four"), 4 * 35);
  assert.equal(writingDuration(""), 0);
  assert.equal(writingDuration(Array(100).fill("w").join(" ")), 1500);
});
