import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { contrastRatio, mix, readMix, readThemes } from "./contrast.ts";

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
  ["ink", "defect-wash", 4.5],
  ["ink", "sheet", 4.5],
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

// The home page is read in thirty seconds, on any screen and in any light: body and secondary
// text reach 7:1 (WCAG 1.4.6, AAA), accents 4.5:1, on the paper and on the sheet that cards and
// the demo lie on.
for (const [name, theme] of Object.entries(themes)) {
  for (const bg of ["paper", "sheet"]) {
    for (const [fg, min] of [["ink", 7], ["graphite", 7], ["proof-text", 4.5], ["defect", 4.5]] as const) {
      test(`${name}: --${fg} on --${bg} >= ${min}:1 (text levels)`, () => {
        const ratio = contrastRatio(theme[fg]!, theme[bg]!);
        assert.ok(ratio >= min, `${ratio.toFixed(2)}:1 < ${min}:1`);
      });
    }
  }
}

// Dark mode: cards and the demo stand apart from the paper; the graphite is no darker than #B0AEA6.
test("dark paper, sheet and graphite are the chosen values", () => {
  assert.deepEqual([themes.dark.paper, themes.dark.sheet], ["#101110", "#1d1e1b"]);
  assert.ok(contrastRatio(themes.dark.graphite!, "#000000") >= contrastRatio("#b0aea6", "#000000"), `--graphite ${themes.dark.graphite} is darker than #b0aea6`);
});

test("SPEC §4 light values are the ones shipped", () => {
  assert.deepEqual(
    [themes.light.paper, themes.light.ink, themes.light.graphite, themes.light.rule, themes.light.proof, themes.light["proof-text"], themes.light.defect, themes.light.night],
    ["#f5f4f0", "#111111", "#52524e", "#dad8d2", "#1e8a4c", "#17703d", "#a8382a", "#1c2a44"],
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

test("mix matches CSS color-mix in srgb", () => {
  assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(mix("#a8382a", "#f5f4f0", 1), "#a8382a");
  assert.equal(mix("#a8382a", "#f5f4f0", 0), "#f5f4f0");
});

test("readMix reads a color-mix token and refuses any other form", () => {
  assert.deepEqual(readMix(":root { --t: color-mix(in srgb, var(--a) 7%, var(--b)); }", "t"), { first: "a", weight: 0.07, second: "b" });
  assert.deepEqual(readMix(":root { --t: color-mix(in srgb, var(--a) 90%, transparent); }", "t"), { first: "a", weight: 0.9, second: "transparent" });
  assert.throws(() => readMix(":root { --t: #ffffff; }", "t"), /not color-mix/);
  assert.throws(() => readMix(":root {}", "t"), /no --t/);
});

// « Défaut connu »: a barely tinted box, its label in the defect colour, its text in ink.
const tint = readMix(css, "defect-tint");
test("--defect-tint is at most 8 % of --defect over the paper", () => {
  assert.equal(tint.first, "defect");
  assert.equal(tint.second, "paper");
  assert.ok(tint.weight <= 0.08, `${tint.weight * 100} % > 8 %`);
});

// Spotlight: the contract around the passage is dimmed, and still AA on the sheet.
const dimmed = readMix(css, "dimmed");
test("--dimmed is the ink mixed into the sheet", () => {
  assert.equal(dimmed.first, "ink");
  assert.equal(dimmed.second, "sheet");
});

// The answer card lies over the contract on wide screens. Worst case for every colour it uses: a
// solid patch of ink behind its glass.
const cardFill = readMix(css, "card-fill");
test("--card-fill is the paper at 85 % or more", () => {
  assert.equal(cardFill.first, "paper");
  assert.equal(cardFill.second, "transparent");
  assert.ok(cardFill.weight >= 0.85, `${cardFill.weight * 100} % < 85 %`);
});

for (const [name, theme] of Object.entries(themes)) {
  const overInk = mix(theme.paper!, theme.ink!, cardFill.weight);
  for (const fg of ["ink", "graphite", "proof-text", "defect"]) {
    test(`${name}: --${fg} on the answer card over ink (${overInk}) >= 4.5:1`, () => {
      const ratio = contrastRatio(theme[fg]!, overInk);
      assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1 < 4.5:1`);
    });
  }
}

for (const [name, theme] of Object.entries(themes)) {
  const defectTint = mix(theme.defect!, theme.paper!, tint.weight);
  for (const fg of ["defect", "ink"]) {
    test(`${name}: --${fg} on --defect-tint (${defectTint}) >= 4.5:1`, () => {
      const ratio = contrastRatio(theme[fg]!, defectTint);
      assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1 < 4.5:1`);
    });
  }
  const dim = mix(theme.ink!, theme.sheet!, dimmed.weight);
  test(`${name}: --dimmed (${dim}) on --sheet >= 4.5:1, and at most half the contrast of --ink`, () => {
    const ratio = contrastRatio(dim, theme.sheet!);
    assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1 < 4.5:1`);
    assert.ok(ratio <= contrastRatio(theme.ink!, theme.sheet!) / 2, `${ratio.toFixed(2)}:1 is not dimmed`);
  });
}

// Halo behind the demo: the caption, the inactive tab and the note under it sit on it.
// Worst case, both colours of the halo over the sheet at once; secondary text there keeps 7:1.
const haloProof = readMix(css, "halo-proof");
const haloNight = readMix(css, "halo-night");
test("the halo is the proof green and the night blue, 2 % at most each", () => {
  assert.deepEqual([haloProof.first, haloNight.first], ["proof", "night"]);
  assert.ok(haloProof.weight <= 0.02 && haloNight.weight <= 0.02);
});

for (const [name, theme] of Object.entries(themes)) {
  const under = mix(theme.night!, mix(theme.proof!, theme.sheet!, haloProof.weight), haloNight.weight);
  for (const fg of ["ink", "graphite"]) {
    test(`${name}: --${fg} on the demo's halo (${under}) >= 7:1`, () => {
      const ratio = contrastRatio(theme[fg]!, under);
      assert.ok(ratio >= 7, `${ratio.toFixed(2)}:1 < 7:1`);
    });
  }
}

// Hover states: the primary button lightens its ink toward the paper, a secondary one takes an
// ink wash over the paper. The focus ring is the proof colour, a graphic: 3:1 on the paper.
const lifted = readMix(css, "ink-lifted");
const wash = readMix(css, "ink-wash");
test("hover tints are the ink lightened by 6 % and an ink wash of 6 %", () => {
  assert.deepEqual([lifted.first, lifted.second, lifted.weight], ["ink", "paper", 0.94]);
  assert.deepEqual([wash.first, wash.second, wash.weight], ["ink", "transparent", 0.06]);
});

for (const [name, theme] of Object.entries(themes)) {
  const primaryHover = mix(theme.ink!, theme.paper!, lifted.weight);
  test(`${name}: --paper on the hovered primary button (${primaryHover}) >= 4.5:1`, () => {
    const ratio = contrastRatio(theme.paper!, primaryHover);
    assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1 < 4.5:1`);
  });
  const secondaryHover = mix(theme.ink!, theme.paper!, wash.weight);
  test(`${name}: --ink on the hovered secondary button (${secondaryHover}) >= 4.5:1`, () => {
    const ratio = contrastRatio(theme.ink!, secondaryHover);
    assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1 < 4.5:1`);
  });
  test(`${name}: the focus ring (--proof) on the hovered secondary button >= 3:1`, () => {
    const ratio = contrastRatio(theme.proof!, secondaryHover);
    assert.ok(ratio >= 3, `${ratio.toFixed(2)}:1 < 3:1`);
  });
}
