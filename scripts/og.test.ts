import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { inputsHash, pngHash, RECORD } from "./og.ts";

const record = JSON.parse(readFileSync(RECORD, "utf8")) as { inputs: string; png: string };

test("public/og.png was drawn from the current words, tokens, fonts and portrait (else: npm run og)", () => {
  assert.equal(inputsHash(), record.inputs);
});

test("public/og.png is the image npm run og wrote, not one edited or replaced since", () => {
  assert.equal(pngHash(), record.png);
});
