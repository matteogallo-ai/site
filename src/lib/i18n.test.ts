import { test } from "node:test";
import assert from "node:assert/strict";
import { alternates, langOf, numbered, twin } from "./i18n.ts";

test("a page's language is read from its path: English under /en/, French elsewhere", () => {
  assert.equal(langOf("/"), "fr");
  assert.equal(langOf("/projets/verity/"), "fr");
  assert.equal(langOf("/en/"), "en");
  assert.equal(langOf("/en"), "en");
  assert.equal(langOf("/en/projects/verity/"), "en");
  assert.equal(langOf("/english/"), "fr");
});

test("each page's twin is the same page in the other language, and back", () => {
  const pairs = [
    ["/", "/en/"],
    ["/colophon/", "/en/colophon/"],
    ["/projets/verity/", "/en/projects/verity/"],
    ["/404.html", "/en/404.html"],
  ];
  for (const [fr, en] of pairs) {
    assert.equal(twin(fr!), en);
    assert.equal(twin(en!), fr);
  }
});

test("alternates name both languages and x-default (the French page), from either side", () => {
  const expected = [
    { hreflang: "fr", path: "/projets/verity/" },
    { hreflang: "en", path: "/en/projects/verity/" },
    { hreflang: "x-default", path: "/projets/verity/" },
  ];
  assert.deepEqual(alternates("/projets/verity/"), expected);
  assert.deepEqual(alternates("/en/projects/verity/"), expected);
});

test("a project's number: « N° 01 » in French, No. 01 in English, joined by a no-break space", () => {
  assert.equal(numbered("01", "fr"), "N°\u00A001");
  assert.equal(numbered("01", "en"), "No.\u00A001");
});
