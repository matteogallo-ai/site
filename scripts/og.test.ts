import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { inputsHash, pngHash, RECORD } from "./og.ts";

const record = JSON.parse(readFileSync(RECORD, "utf8")) as { inputs: string; png: { fr: string; en: string } };

test("the Open Graph images were drawn from the current words, tokens, fonts and portrait (else: npm run og)", () => {
  assert.equal(inputsHash(), record.inputs);
});

test("public/og.png and public/og-en.png are the images npm run og wrote, not ones edited or replaced since", () => {
  assert.equal(pngHash("fr"), record.png.fr);
  assert.equal(pngHash("en"), record.png.en);
});
