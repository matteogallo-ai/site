import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { type Coverage, missingGlyphs } from "./glyphs.ts";

const coverage = JSON.parse(readFileSync(new URL("../src/assets/fonts/coverage.json", import.meta.url), "utf8")) as Coverage;
const NBSP = "\u00A0";
const NARROW_NBSP = "\u202F";

test("French and Italian text with French punctuation is covered by the text fonts", () => {
  const text = `«${NARROW_NBSP}Défauts compris${NARROW_NBSP}»${NBSP}: œuvre, Où${NARROW_NBSP}? À l’été… — perché, così — 16${NBSP}/${NBSP}20${NBSP}€ ŸVONNE\n`;
  assert.deepEqual(missingGlyphs({ sans: text, serif: text }, coverage), []);
});

test("the mono subset draws the measure symbols and no-break spaces", () => {
  assert.deepEqual(missingGlyphs({ mono: `κ? no: 0,71 ≥ 0,60 ✓ ✗ · ‹ › 200${NBSP}000 € <> ≤` }, coverage), ['mono: "κ" U+03BA']);
});

test("the narrow no-break space of French Intl.NumberFormat is reported in mono: JetBrains Mono has none", () => {
  const formatted = new Intl.NumberFormat("fr-FR").format(200000);
  assert.ok(formatted.includes(NARROW_NBSP), "this Node's ICU no longer emits U+202F; update the test");
  assert.deepEqual(missingGlyphs({ mono: formatted }, coverage), [`mono: "${NARROW_NBSP}" U+202F`]);
});

test("invisible format characters are never reported", () => {
  assert.deepEqual(missingGlyphs({ mono: "a\u00ADb\u200Bc\u2060d" }, coverage), []);
});

test("a symbol outside a subset is reported once, with its role and code point", () => {
  assert.deepEqual(missingGlyphs({ sans: "ok ✓ ✓", mono: "é" }, coverage), ['sans: "✓" U+2713', 'mono: "é" U+00E9']);
});
