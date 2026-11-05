import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { builtPages, urlPath } from "./built-pages.ts";
import { buildMeasures, type Lhr, type ManifestEntry, unrequested } from "./site-measures-lib.ts";

const MANIFEST = ".lighthouseci/reports/manifest.json";
const OUT = process.argv[2] ?? "site-measures.json";

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
// CI checks out and passes the PR head (GITHUB_SHA would be the synthetic merge commit); locally, HEAD.
const commit = process.env["SITE_COMMIT"] ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const measures = buildMeasures(readJson<ManifestEntry[]>(MANIFEST), (p) => readJson<Lhr>(p), { commit, now: new Date(), expectedPaths: builtPages() });
// Astro names a processed asset <stem>.<hash>_<variant>.<ext>: the stem identifies it.
const stems = (readJson<{ media: { file: string }[] }>("src/data/media.json").media).map((m) => m.file.split("/").at(-1)!.replace(/\.[^.]+$/, ""));
const manifest = readJson<ManifestEntry[]>(MANIFEST);
for (const run of manifest.filter((r) => urlPath(new URL(r.url).pathname.slice(1)) === "/")) {
  const missing = unrequested(readJson<Lhr>(run.jsonPath), stems);
  if (missing.length) throw new Error(`home run ${run.jsonPath} requested no ${missing.join(", ")}: the budget did not count them`);
}

writeFileSync(OUT, `${JSON.stringify(measures, null, 2)}\n`);
console.log(JSON.stringify(measures, null, 2));
