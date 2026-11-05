// Whether GitHub rules protect the main branch, as the Colophon says ("la branche principale,
// que des règles GitHub protègent"). GitHub itself resolves which rulesets apply to a branch
// (active ones only, with their branch patterns and exclusions): check-rulesets.ts reads that
// answer from /rules/branches/<branch>, and this decides whether it amounts to protection.

export interface BranchRule {
  type: string;
  ruleset_id: number;
}

// "Je suis seul à fusionner" holds only if nothing reaches main without the owner: a required
// pull request, or no direct update at all. Rules such as no deletion or no force-push guard
// the history but still let a direct push through, so they do not count on their own.
const GATES = new Set(["pull_request", "update"]);

/** The ids of the rulesets whose rules gate every change to the branch; empty when none does. */
export function gatingRulesets(rules: BranchRule[]): number[] {
  return [...new Set(rules.filter((r) => GATES.has(r.type)).map((r) => r.ruleset_id))].sort((a, b) => a - b);
}
