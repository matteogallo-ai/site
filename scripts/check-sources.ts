// Fetches every source file at its pinned commit and checks that it states what
// src/data says it states. Collects every mismatch, prints them, and exits 1 if any.
import { readFileSync } from "node:fs";
import { evidenceError, type MeasuresFile, measuresErrors, rawUrl } from "./measures-lib.ts";
import { type DemoDocument, type DemoTrace, sha256, traceErrors, traceMatchesRun } from "./traces-lib.ts";

const read = <T>(path: string) => JSON.parse(readFileSync(new URL(`../src/data/${path}`, import.meta.url), "utf8")) as T;
const cache = new Map<string, Promise<Uint8Array>>();

class NotFound extends Error {}

async function fetchOnce(url: string): Promise<Uint8Array> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
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

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
const verified = measures.measures.filter((m) => m.status === "verified").length;
console.log(`${verified} measures, ${checked} evidence items and 2 demo traces match their sources at the pinned commits.`);
