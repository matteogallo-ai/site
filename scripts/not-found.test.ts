import { test } from "node:test";
import assert from "node:assert/strict";
import { notFoundFile } from "./not-found.ts";

test("a nested 404 page is written where a host looks for it: <dir>/404.html", () => {
  assert.equal(notFoundFile("en/404/index.html"), "en/404.html");
});

test("the root 404 and every other page stay where the build wrote them", () => {
  assert.equal(notFoundFile("404.html"), undefined);
  assert.equal(notFoundFile("en/index.html"), undefined);
  assert.equal(notFoundFile("en/projects/verity/index.html"), undefined);
  assert.equal(notFoundFile("en/a404/index.html"), undefined);
});
