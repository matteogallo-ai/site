// Run at go-live, not in CI: the Colophon says GitHub rules protect main, and this fails until an
// active ruleset does. It is kept out of CI because the rulesets are configured by hand on GitHub,
// outside any pull request: a PR cannot fix a failure here. The repository is public, so the API
// answers without a token; GITHUB_TOKEN, if set, only raises the rate limit.
import { protectingMain, type Ruleset } from "./rulesets-lib.ts";

const REPO = "matteogallo-ai/site";
const headers: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
if (process.env["GITHUB_TOKEN"]) headers["Authorization"] = `Bearer ${process.env["GITHUB_TOKEN"]}`;

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.github.com/repos/${REPO}${path ? `/${path}` : ""}`, { headers, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`GET ${path}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

const { default_branch: branch } = await get<{ default_branch: string }>("");
// The list leaves out conditions and rules: each ruleset is read whole.
const list = await get<{ id: number }[]>("rulesets?includes_parents=true");
const rulesets = await Promise.all(list.map((r) => get<Ruleset>(`rulesets/${r.id}`)));
const names = protectingMain(rulesets, branch);
if (names.length === 0) {
  console.error(`No active ruleset protects ${branch} on ${REPO} (${rulesets.length} ruleset(s) read): the Colophon's sentence on GitHub rules is not true yet.`);
  process.exit(1);
}
console.log(`${branch} on ${REPO} is protected by: ${names.join(", ")}`);
