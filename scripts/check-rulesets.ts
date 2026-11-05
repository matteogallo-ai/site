// Run at go-live, not in CI: the Colophon says GitHub rules protect main, and this fails until an
// active ruleset gates every change to it. It is kept out of CI because rulesets are configured by
// hand on GitHub, outside any pull request: a PR cannot fix a failure here. The repository is
// public, so the API answers without a token; GITHUB_TOKEN, if set, only raises the rate limit.
// Bypass lists are not readable without admin rights: who may bypass a ruleset is checked by
// hand in the repository settings.
import { type BranchRule, gatingRulesets } from "./rulesets-lib.ts";

const REPO = "matteogallo-ai/site";
const headers: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
if (process.env["GITHUB_TOKEN"]) headers["Authorization"] = `Bearer ${process.env["GITHUB_TOKEN"]}`;

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.github.com/repos/${REPO}${path}`, { headers, signal: AbortSignal.timeout(30_000) });
  // A 403 is the anonymous rate limit as often as a refusal: the status is printed, never guessed.
  if (!response.ok) throw new Error(`GET ${path}: HTTP ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

const { default_branch: branch } = await get<{ default_branch: string }>("");
// GitHub resolves the rulesets that apply to the branch (active only, patterns and exclusions included).
const rules = await get<BranchRule[]>(`/rules/branches/${encodeURIComponent(branch)}`);
const ids = gatingRulesets(rules);
if (ids.length === 0) {
  console.error(`No active ruleset requires a pull request on ${branch} of ${REPO} (${rules.length} rule(s) apply): the Colophon's sentence on GitHub rules is not true yet.`);
  process.exit(1);
}
const names = await Promise.all(ids.map(async (id) => (await get<{ name: string }>(`/rulesets/${id}`)).name));
console.log(`${branch} of ${REPO} is gated by: ${names.join(", ")}`);
