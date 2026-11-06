import { test } from "node:test";
import assert from "node:assert/strict";
import { robots, route, sitemap } from "./sitemap.ts";

test("page files map to the URLs their canonical links give", () => {
  assert.equal(route("./index.astro"), "/");
  assert.equal(route("./colophon.astro"), "/colophon/");
  assert.equal(route("./projets/verity.astro"), "/projets/verity/");
  assert.equal(route("./en/index.astro"), "/en/");
});

test("the 404 page stays out; a dynamic route fails rather than vanish", () => {
  assert.equal(route("./404.astro"), undefined);
  assert.equal(route("./en/404.astro"), undefined);
  assert.throws(() => route("./ecrits/[slug].astro"), /dynamic route/);
  assert.throws(() => route("./sitemap.xml.ts"), /not a page file/);
});

test("the sitemap lists each page once, sorted, under the origin", () => {
  const xml = sitemap("https://example.org", ["./colophon.astro", "./404.astro", "./index.astro"]);
  assert.deepEqual([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]), ["https://example.org/", "https://example.org/colophon/"]);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
});

test("each URL of the sitemap names its French, English and x-default versions", () => {
  const xml = sitemap("https://example.org", ["./projets/verity.astro", "./en/projects/verity.astro"]);
  const entry = xml.split("<url>")[2]!;
  assert.match(entry, /<loc>https:\/\/example\.org\/projets\/verity\/<\/loc>/);
  for (const [lang, href] of [["fr", "https://example.org/projets/verity/"], ["en", "https://example.org/en/projects/verity/"], ["x-default", "https://example.org/projets/verity/"]]) {
    assert.ok(entry.includes(`<xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`), `${lang} in ${entry}`);
  }
  assert.match(xml, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
});

test("robots.txt allows everything and names the sitemap", () => {
  assert.equal(robots("https://example.org"), "User-agent: *\nAllow: /\n\nSitemap: https://example.org/sitemap.xml\n");
});
