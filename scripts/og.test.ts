import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OG, ogImages, ogImageUrl } from "../src/lib/og.ts";
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

test("an image's shared address changes when its PNG changes, and only then: LinkedIn caches a preview by image URL", () => {
  const site = "https://matteogallo.ch";
  const before = ogImageUrl("public/og.png", new Uint8Array([1, 2, 3]), site);
  assert.match(before, /^https:\/\/matteogallo\.ch\/og\.png\?v=[0-9a-f]{8}$/);
  assert.equal(ogImageUrl("public/og.png", new Uint8Array([1, 2, 3]), site), before);
  assert.notEqual(ogImageUrl("public/og.png", new Uint8Array([1, 2, 4]), site), before);
  for (const { file } of ogImages()) assert.ok(ogImageUrl(file, readFileSync(file), site).endsWith(`?v=${record.png[file]!.slice(0, 8)}`), file);
});
