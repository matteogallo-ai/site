import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { builtPages, urlPath } from "./built-pages.ts";
import { buildMeasures, type Lhr, type ManifestEntry, transferWithUnrequested, unrequested } from "./site-measures-lib.ts";

const MANIFEST = ".lighthouseci/reports/manifest.json";
const OUT = process.argv[2] ?? "site-measures.json";

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
// CI checks out and passes the PR head (GITHUB_SHA would be the synthetic merge commit); locally, HEAD.
const commit = process.env["SITE_COMMIT"] ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const measures = buildMeasures(readJson<ManifestEntry[]>(MANIFEST), (p) => readJson<Lhr>(p), { commit, now: new Date(), expectedPaths: builtPages() });
// Astro names a processed asset <stem>.<hash>_<variant>.<ext>: the stem identifies it.
const stems = (readJson<{ media: { file: string }[] }>("src/data/media.json").media).map((m) => m.file.split("/").at(-1)!.replace(/\.[^.]+$/, ""));
const manifest = readJson<ManifestEntry[]>(MANIFEST);
const { budgets } = createRequire(import.meta.url)("../lighthouserc.cjs") as { budgets: { transferBytes: number } };
const assets = readdirSync("dist/_astro").map((name) => ({ name, bytes: statSync(`dist/_astro/${name}`).size }));
// Lighthouse asserts the budget on what a run requested; a lazy image below what it scrolled to
// is added here at its heaviest variant, so the home page stays in budget once fully scrolled.
for (const run of manifest.filter((r) => urlPath(new URL(r.url).pathname.slice(1)) === "/")) {
  const lhr = readJson<Lhr>(run.jsonPath);
  const missing = unrequested(lhr, stems);
  const bound = transferWithUnrequested(lhr, missing, assets);
  if (bound > budgets.transferBytes) throw new Error(`home run ${run.jsonPath}: ${bound} bytes once ${missing.join(", ")} load, over the ${budgets.transferBytes} budget`);
  if (missing.length) console.error(`home run: ${bound} bytes with ${missing.join(", ")} at its heaviest variant (budget ${budgets.transferBytes})`);
}

writeFileSync(OUT, `${JSON.stringify(measures, null, 2)}\n`);
console.log(JSON.stringify(measures, null, 2));
