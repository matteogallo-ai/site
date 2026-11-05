import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { buildMeasures, type Lhr, type ManifestEntry } from "./site-measures-lib.ts";

const MANIFEST = ".lighthouseci/reports/manifest.json";
const OUT = process.argv[2] ?? "site-measures.json";

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
// CI passes the PR head (GITHUB_SHA is the synthetic merge commit on a PR); locally, HEAD.
const commit = process.env["SITE_COMMIT"] ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const measures = buildMeasures(readJson<ManifestEntry[]>(MANIFEST), (p) => readJson<Lhr>(p), { commit, now: new Date() });
writeFileSync(OUT, `${JSON.stringify(measures, null, 2)}\n`);
console.log(JSON.stringify(measures, null, 2));
