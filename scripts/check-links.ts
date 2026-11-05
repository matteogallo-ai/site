// Link check of every built page. linkinator crawls from the pages it is given and does not
// descend into every page it reaches: given only the home page, the links of a page reached
// from it went unchecked (the case studies' ADR links). Each built page is therefore an
// entry point, served from dist so that root-relative paths resolve.
import { spawnSync } from "node:child_process";
import { builtFiles } from "./built-pages.ts";

const bin = new URL("../node_modules/.bin/linkinator", import.meta.url).pathname;
const run = spawnSync(bin, [...builtFiles(), "--server-root", "dist", "--config", "linkinator.config.json"], { stdio: "inherit" });
if (run.error) throw run.error;
process.exit(run.status ?? 1);
