import assert from "node:assert/strict";
import { test } from "node:test";
import { gapsIn } from "./gaps.ts";

test("a page with no placeholder has no gap", () => {
  assert.deepEqual(gapsIn('<h1>Matteo Gallo — Software &amp; AI Engineer</h1><p>Contact : <a href="mailto:a@b.c">a@b.c</a></p>'), []);
});

test("every placeholder form is reported, with its text", () => {
  const cases: [string, RegExp][] = [
    ['<span class="note gap">version EN</span>', /gap marker/],
    ["<p>Manquant : étude de cas</p>", /Manquant/],
    ["<p>Missing: case study</p>", /Missing/],
    ['<div data-gap="contact"></div>', /gap marker/],
    // A gap measure renders the em dash as its value (scripts/measures-lib.ts GAP_DISPLAY).
    // Markup as Figure.astro renders it (copied from dist/index.html).
    ['<a class="figure"><span class="value mono" data-astro-cid-khyig4bw>—</span></a>', /gap measure/],
    ["<p>TODO: write the bio</p>", /TODO/],
  ];
  for (const [html, expected] of cases) {
    const found = gapsIn(html);
    assert.equal(found.length, 1, html);
    assert.match(found[0]!, expected);
  }
});

test("words that merely contain a marker are not gaps", () => {
  assert.deepEqual(gapsIn('<p class="gap-free" data-gap-free>Mistodo</p><p>todos</p>'), []);
});

test("scripts, styles and comments are not page content", () => {
  assert.deepEqual(gapsIn("<script>/* TODO */</script><style>/* FIXME */</style><!-- TODO --><p>ok</p>"), []);
});
