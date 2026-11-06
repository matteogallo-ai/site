import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ogImages } from "../src/lib/og.ts";
import { inputsHash, pngHash, RECORD } from "./og.ts";

const record = JSON.parse(readFileSync(RECORD, "utf8")) as { inputs: string; png: Record<string, string> };

test("the Open Graph images were drawn from the current words, tokens, fonts and portrait (else: npm run og)", () => {
  assert.equal(inputsHash(), record.inputs);
});

test("every Open Graph image is the one npm run og wrote, not one edited or replaced since", () => {
  const files = ogImages().map((i) => i.file);
  assert.deepEqual(Object.keys(record.png).sort(), files.sort());
  for (const file of files) assert.equal(pngHash(file), record.png[file], file);
});
