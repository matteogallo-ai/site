import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { blobUrl } from "./measures-lib.ts";

interface Media {
  id: string;
  file: string;
  sha256: string;
  repo: string;
  commit: string;
  path: string;
  url: string;
  from?: { repo: string; commit: string; path: string; sha256: string; pixels_sha256: string; frame?: number; page?: number };
  alt: { fr: string; en: string };
}

const root = new URL("../", import.meta.url);
const { media } = JSON.parse(readFileSync(new URL("src/data/media.json", root), "utf8")) as { media: Media[] };

test("every project image is the committed file its record names, with a full source", () => {
  for (const m of media) {
    const digest = createHash("sha256").update(readFileSync(new URL(m.file, root))).digest("hex");
    assert.equal(digest, m.sha256, `${m.file} changed since its sha256 was recorded`);
    assert.match(m.commit, /^[0-9a-f]{40}$/);
    assert.equal(m.url, blobUrl(m));
    assert.ok(m.alt.fr.trim() && m.alt.en.trim(), `${m.id}: alternative text in both languages`);
    // A derived still points at the file it was taken from, which is also the file the card links to.
    if (m.from) {
      assert.deepEqual([m.from.repo, m.from.commit, m.from.path], [m.repo, m.commit, m.path]);
      // One re-derivation each: a recording frame (scripts/media-frame.ts) or a PDF page (scripts/media/pdf_page.py).
      assert.ok((m.from.frame === undefined) !== (m.from.page === undefined), `${m.id}: a frame or a page, not both`);
      assert.match(m.from.pixels_sha256, /^[0-9a-f]{64}$/);
    }
  }
});

test("an image's alternative text is short and in its page's language; details go to the caption", () => {
  for (const m of media) {
    for (const lang of ["fr", "en"] as const) assert.ok(m.alt[lang].length <= 125, `${m.id} (${lang}): ${m.alt[lang].length} characters of alt text`);
    // English quoted inside a French alt is read with French pronunciation by a screen reader.
    assert.doesNotMatch(m.alt.fr, /«[^»]*\b(?:the|what|is|for|our|on)\b/i, `${m.id}: English inside the French alt text`);
  }
});
