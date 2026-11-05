// Fetches every source file at its pinned commit and checks that it states what
// src/data says it states. Collects every mismatch, prints them, and exits 1 if any.
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { evidenceError, type ListingEvidence, listingDepth, listingError, type MeasuresFile, measuresErrors, rawUrl, resolvePointer } from "./measures-lib.ts";
import { type DemoDocument, type DemoTrace, sha256, traceErrors, traceMatchesRun } from "./traces-lib.ts";

const read = <T>(path: string) => JSON.parse(readFileSync(new URL(`../src/data/${path}`, import.meta.url), "utf8")) as T;
const cache = new Map<string, Promise<Uint8Array>>();

class NotFound extends Error {}

// CI passes its read-only token: unauthenticated API calls share a 60-per-hour quota per IP.
const API_HEADERS: Record<string, string> = { accept: "application/vnd.github+json", ...(process.env["GITHUB_TOKEN"] ? { authorization: `Bearer ${process.env["GITHUB_TOKEN"]}` } : {}) };

async function fetchOnce(url: string): Promise<Uint8Array> {
  for (let attempt = 0; ; attempt++) {
    try {
      const headers = url.startsWith("https://api.github.com/") ? API_HEADERS : {};
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
      if (response.ok) return new Uint8Array(await response.arrayBuffer());
      // 404: the file is not at that commit, a real failure that a retry cannot change.
      if (response.status === 404) throw new NotFound(`${url}: HTTP 404`);
      throw new Error(`${url}: HTTP ${response.status}`);
    } catch (error) {
      // Timeouts, resets, 429 and 5xx are transient: retried twice, then reported.
      if (error instanceof NotFound || attempt === 2) throw error;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}

const get = (url: string) => {
  if (!cache.has(url)) cache.set(url, fetchOnce(url));
  return cache.get(url)!;
};
// Fatal decoding: a source that is not UTF-8 cannot state a passage of text.
const decode = (bytes: Uint8Array) => new TextDecoder("utf-8", { fatal: true }).decode(bytes);

/** Files under `dir` at the commit, `depth` levels down, as paths relative to `dir` (GitHub contents API). */
async function listFiles(repo: string, commit: string, dir: string, depth: number): Promise<string[]> {
  const url = `https://api.github.com/repos/${repo}/contents/${dir.split("/").map(encodeURIComponent).join("/")}?ref=${commit}`;
  const entries = JSON.parse(decode(await get(url))) as { type: string; name: string }[];
  const nested = await Promise.all(
    entries.map(async (entry) => {
      if (entry.type === "file") return depth === 1 ? [entry.name] : [];
      if (entry.type !== "dir" || depth === 1) return [];
      return (await listFiles(repo, commit, `${dir}/${entry.name}`, depth - 1)).map((f) => `${entry.name}/${f}`);
    }),
  );
  return nested.flat();
}

async function listingCheck(repo: string, commit: string, e: ListingEvidence): Promise<string | null> {
  const problem = listingError(await listFiles(repo, commit, e.listing, listingDepth(e.files[0]!)), e);
  if (problem) return problem;
  for (const file of e.files) {
    const value = resolvePointer(JSON.parse(decode(await get(rawUrl({ repo, commit }, `${e.listing}/${file}`)))), e.pointer);
    if (!isDeepStrictEqual(value, e.each)) return `${e.listing}/${file}: ${e.pointer} is ${JSON.stringify(value)}, expected ${JSON.stringify(e.each)}`;
  }
  return null;
}

const errors: string[] = [];
// Every failure, network or content, becomes a line of the report and fails the run.
const record = (where: string) => (error: unknown) => errors.push(`${where}: ${error instanceof Error ? error.message : String(error)}`);

const measures = read<MeasuresFile>("measures.json");
errors.push(...measuresErrors(measures));

let checked = 0;
await Promise.all(
  measures.measures.map(async (m) => {
    // A gap has no source to fetch: it is shown as a gap.
    if (m.status !== "verified") return;
    for (const e of m.evidence ?? []) {
      if ("listing" in e) {
        await listingCheck(m.repo, m.commit, e)
          .then((problem) => (problem ? errors.push(`${m.id}: ${problem}`) : checked++))
          .catch(record(m.id));
        continue;
      }
      const url = rawUrl(m, e.path ?? m.path);
      await get(url)
        .then((bytes) => {
          const problem = evidenceError(decode(bytes), e);
          if (problem) errors.push(`${m.id}: ${url}: ${problem}`);
          else checked++;
        })
        .catch(record(m.id));
    }
    // The cited file itself must exist at the commit, even when every evidence item lives elsewhere.
    await get(rawUrl(m, m.path)).catch(record(m.id));
  }),
);

const sla = read<DemoDocument>("demo/sla.json");
await get(rawUrl(sla.source, sla.source.path))
  .then((bytes) => {
    if (sha256(bytes) !== sla.source.sha256) errors.push(`demo/sla.json: committed file sha256 is ${sha256(bytes)}`);
    if (decode(bytes) !== sla.text) errors.push("demo/sla.json: text differs from the committed file");
  })
  .catch(record("demo/sla.json"));

for (const name of ["answer", "refusal"]) {
  const trace = read<DemoTrace>(`demo/${name}.json`);
  errors.push(...traceErrors(trace, sla));
  await get(rawUrl(trace.source, trace.source.path))
    .then((bytes) => {
      if (sha256(bytes) !== trace.source.sha256) errors.push(`demo/${name}.json: run sha256 is ${sha256(bytes)}`);
      errors.push(...traceMatchesRun(trace, JSON.parse(decode(bytes))));
    })
    .catch(record(`demo/${name}.json`));
}

// Project images: a copied file must be byte-identical to its source; a derived still's
// source must be the file it was derived from (scripts/media-frame.ts re-derives it in CI).
const { media } = read<{ media: { id: string; sha256: string; repo: string; commit: string; path: string; from?: { sha256: string } }[] }>("media.json");
for (const m of media) {
  await get(rawUrl(m, m.path))
    .then((bytes) => {
      const expected = m.from?.sha256 ?? m.sha256;
      if (sha256(bytes) !== expected) errors.push(`media ${m.id}: ${m.path} sha256 is ${sha256(bytes)}, expected ${expected}`);
    })
    .catch(record(`media ${m.id}`));
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
const verified = measures.measures.filter((m) => m.status === "verified").length;
console.log(`${verified} measures, ${checked} evidence items, 2 demo traces and ${media.length} project images match their sources at the pinned commits.`);
