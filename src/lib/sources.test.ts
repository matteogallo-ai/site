import assert from "node:assert/strict";
import { test } from "node:test";
import { pinned } from "./sources.ts";

test("a link to a source file uses the commit its repo's measures are pinned to", () => {
  assert.equal(
    pinned("verity", "docs/adr/0003-refusal-as-headline-feature.md"),
    "https://github.com/matteogallo-ai/verity/blob/162a055dee9ec26297b204c669a6a9b6e667b52a/docs/adr/0003-refusal-as-headline-feature.md",
  );
});

test("a repo with no pinned measure, or a path leaving the repo, fails the build", () => {
  assert.throws(() => pinned("no-such-repo", "README.md"), /no measure pins/);
  assert.throws(() => pinned("verity", "../x.md"), /repo-relative/);
  assert.throws(() => pinned("verity", "/x.md"), /repo-relative/);
});
