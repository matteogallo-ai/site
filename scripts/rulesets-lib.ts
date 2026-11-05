// Whether the GitHub rulesets of the repository protect its main branch, as the Colophon says
// they do ("la branche principale, que des règles GitHub protègent"). Pure: check-rulesets.ts
// fetches the rulesets, this decides.

export interface Ruleset {
  id: number;
  name: string;
  target?: string;
  enforcement: "active" | "evaluate" | "disabled";
  conditions?: { ref_name?: { include?: string[]; exclude?: string[] } } | null;
  rules?: { type: string }[];
}

// Rules that stop a change from reaching main without going through the owner: a required pull
// request, no force-push rewriting it, no deletion, no direct update.
const PROTECTIVE = new Set(["pull_request", "non_fast_forward", "deletion", "update"]);

function targetsMain(r: Ruleset, defaultBranch: string): boolean {
  const ref = r.conditions?.ref_name;
  const names = (list: string[] | undefined) => (list ?? []).some((p) => p === "~ALL" || p === "~DEFAULT_BRANCH" || p === `refs/heads/${defaultBranch}`);
  return names(ref?.include) && !names(ref?.exclude);
}

/** The active branch rulesets that protect main, by name; empty when none does. */
export function protectingMain(rulesets: Ruleset[], defaultBranch = "main"): string[] {
  return rulesets
    .filter((r) => (r.target ?? "branch") === "branch" && r.enforcement === "active" && targetsMain(r, defaultBranch))
    .filter((r) => (r.rules ?? []).some((rule) => PROTECTIVE.has(rule.type)))
    .map((r) => r.name);
}
