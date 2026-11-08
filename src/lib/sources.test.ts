import assert from "node:assert/strict";
import { test } from "node:test";
import { pinned, pull, repoUrl } from "./sources.ts";

test("a link to a source file uses the commit its repo's measures are pinned to", () => {
  assert.equal(
    pinned("verity", "docs/adr/0003-refusal-as-headline-feature.md"),
    "https://github.com/matteogallo-ai/verity/blob/59c465511555fca642e50dfbf0af5f1a8e87f0c1/docs/adr/0003-refusal-as-headline-feature.md",
  );
});

test("a repo with no pinned measure, or a path leaving the repo, fails the build", () => {
  assert.throws(() => pinned("no-such-repo", "README.md"), /no measure pins/);
  assert.throws(() => pinned("verity", "../x.md"), /repo-relative/);
  assert.throws(() => pinned("verity", "/x.md"), /repo-relative/);
});

test("a repo and a pull request link to the owner's repo", () => {
  assert.equal(repoUrl("praxis"), "https://github.com/matteogallo-ai/praxis");
  assert.equal(pull("praxis", 44), "https://github.com/matteogallo-ai/praxis/pull/44");
  assert.throws(() => pull("praxis", 0), /positive integer/);
});
