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

test("code in upper case or with spaced closing tags is still code", () => {
  assert.deepEqual(gapsIn("<SCRIPT>/* TODO */</SCRIPT ><Style>/* FIXME */</style\n>"), []);
});

test("a marker after a script is still found", () => {
  assert.equal(gapsIn("<script>x</script><p>TODO: bio</p>").length, 1);
});

test("an announcement of content that is not there is a gap", () => {
  for (const html of [
    '<li><span class="date">À paraître</span> J’ai piégé mon propre juge</li>',
    "<p>Version anglaise bientôt</p>",
    "<p>Prochainement : les études de cas</p>",
    "<p>Case studies coming soon</p>",
    "<p>A forthcoming article</p>",
  ]) {
    const found = gapsIn(html);
    assert.equal(found.length, 1, html);
    assert.match(found[0]!, /announcement/);
  }
});

const built = (paths: string[]) => (path: string) => paths.includes(path);

test("a language label with no page behind it is a gap", () => {
  for (const html of [
    '<li><span class="lang" aria-current="true" lang="fr">FR</span></li>',
    '<li><a href="/en/" hreflang="en" lang="en">EN</a></li>',
    '<li><a href="https://matteogallo.pages.dev/en/" hreflang="en">English</a></li>',
  ]) {
    const found = gapsIn(html, { site: "https://matteogallo.pages.dev", built: built(["index.html"]) });
    assert.equal(found.length, 1, html);
    assert.match(found[0]!, /language/);
  }
});

test("a language link or alternate to a built page is not a gap", () => {
  const options = { site: "https://matteogallo.pages.dev", built: built(["index.html", "en/index.html"]) };
  assert.deepEqual(gapsIn('<a href="/en/" hreflang="en" lang="en">EN</a>', options), []);
  assert.deepEqual(gapsIn('<link rel="alternate" hreflang="fr" href="https://matteogallo.pages.dev/">', options), []);
  assert.deepEqual(gapsIn('<a href="/en/#projects" hreflang="en">English</a>', options), []);
});

test("an alternate language link to a page that was not built is a gap", () => {
  const found = gapsIn('<link rel="alternate" hreflang="en" href="https://matteogallo.pages.dev/en/">', { site: "https://matteogallo.pages.dev", built: built(["index.html"]) });
  assert.equal(found.length, 1);
  assert.match(found[0]!, /language/);
});
