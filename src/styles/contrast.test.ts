import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { contrastRatio, readThemes } from "./contrast.ts";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const themes = readThemes(css);

// [foreground, background, minimum]: 4.5 for body text (WCAG 1.4.3), 3 for graphics such as ticks (1.4.11).
const PAIRS: Array<[string, string, number]> = [
  ["ink", "paper", 4.5],
  ["graphite", "paper", 4.5],
  ["proof-text", "paper", 4.5],
  ["defect", "paper", 4.5],
  ["night", "paper", 4.5],
  ["ink", "proof-wash", 4.5],
  ["proof-text", "proof-wash", 4.5],
  ["proof", "paper", 3],
];

for (const [name, theme] of Object.entries(themes)) {
  for (const [fg, bg, min] of PAIRS) {
    test(`${name}: --${fg} on --${bg} >= ${min}:1`, () => {
      const a = theme[fg];
      const b = theme[bg];
      assert.ok(a && b, `missing token --${fg} or --${bg} in ${name} theme`);
      const ratio = contrastRatio(a, b);
      assert.ok(ratio >= min, `${ratio.toFixed(2)}:1 < ${min}:1`);
    });
  }
}

test("SPEC §4 light values are the ones shipped", () => {
  assert.deepEqual(
    [themes.light.paper, themes.light.ink, themes.light.graphite, themes.light.rule, themes.light.proof, themes.light["proof-text"], themes.light.defect, themes.light.night],
    ["#f5f4f0", "#111111", "#5c5c58", "#dad8d2", "#1e8a4c", "#17703d", "#a8382a", "#1c2a44"],
  );
});

test("contrastRatio matches known WCAG values", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#777777", "#777777"), 1);
  assert.throws(() => contrastRatio("#fff", "#000000"), /six-digit/);
});

test("readThemes refuses a file without a dark block", () => {
  assert.throws(() => readThemes(":root { --ink: #111111; }"), /dark-scheme/);
});

test("readThemes refuses a dark colour written in another format instead of falling back to light", () => {
  const css = ":root { --ink: #111111; }\n@media (prefers-color-scheme: dark) { :root { --ink: #eee; } }";
  assert.throws(() => readThemes(css), /--ink.*six-digit hex/);
});

test("readThemes ignores braces and declarations inside comments", () => {
  const css = ":root { /* not {this} --ink: #ffffff; */ --ink: #111111; }\n@media (prefers-color-scheme: dark) { :root { --ink: #eeeeee; } }";
  assert.deepEqual(readThemes(css), { light: { ink: "#111111" }, dark: { ink: "#eeeeee" } });
});
