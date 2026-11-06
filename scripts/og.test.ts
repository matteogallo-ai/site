import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OG, ogImages } from "../src/lib/og.ts";
import { contrastRatio, readThemes } from "../src/styles/contrast.ts";
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

test("the images are drawn on the dark paper, every colour they use at 7:1 on it", () => {
  assert.equal(OG.scheme, "dark");
  const dark = readThemes(readFileSync("src/styles/tokens.css", "utf8")).dark;
  for (const fg of ["ink", "graphite", "proof-text"]) {
    const ratio = contrastRatio(dark[fg]!, dark.paper!);
    assert.ok(ratio >= 7, `--${fg}: ${ratio.toFixed(2)}:1 < 7:1`);
  }
});
