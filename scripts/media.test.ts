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
  from?: { repo: string; commit: string; path: string; sha256: string };
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
    if (m.from) assert.deepEqual([m.from.repo, m.from.commit, m.from.path], [m.repo, m.commit, m.path]);
  }
});
