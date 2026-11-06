import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { builtFiles, builtPages, urlPath } from "./built-pages.ts";

test("urlPath maps index files to directories and keeps other names", () => {
  assert.equal(urlPath("index.html"), "/");
  assert.equal(urlPath("en/index.html"), "/en/");
  assert.equal(urlPath("404.html"), "/404.html");
  assert.equal(urlPath("en/projets/verity/index.html"), "/en/projets/verity/");
});

test("builtPages finds every HTML file at any depth, including 404.html", () => {
  const dist = mkdtempSync(join(tmpdir(), "dist-"));
  for (const f of ["index.html", "404.html", "en/projets/verity/index.html", "_astro/app.css"]) {
    mkdirSync(join(dist, f, ".."), { recursive: true });
    writeFileSync(join(dist, f), "");
  }
  assert.deepEqual(builtPages(dist), ["/", "/404.html", "/en/projets/verity/"]);
});

test("builtPages refuses an empty build", () => {
  assert.throws(() => builtPages(mkdtempSync(join(tmpdir(), "dist-"))), /run the build first/);
});

test("builtFiles lists the same pages as files relative to dist, for tools that read files", () => {
  const dist = mkdtempSync(join(tmpdir(), "dist-"));
  for (const f of ["index.html", "404.html", "projets/verity/index.html", "_astro/app.css"]) {
    mkdirSync(join(dist, f, ".."), { recursive: true });
    writeFileSync(join(dist, f), "");
  }
  assert.deepEqual(builtFiles(dist), ["404.html", "index.html", "projets/verity/index.html"]);
  assert.deepEqual(builtFiles(dist).map(urlPath).sort(), builtPages(dist));
});
