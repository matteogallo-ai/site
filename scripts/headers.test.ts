import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { headersFile, inlineHashes, securityTxt } from "./headers.ts";

const sha = (text: string) => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

test("inline scripts and styles are hashed on their exact bytes; external scripts are not", () => {
  const html = `<style>a{color:red}</style><script type="module">go()</script><script src="/x.js"></script><style media="print">\nb{}\n</style>`;
  assert.deepEqual(inlineHashes(html), { scripts: [sha("go()")], styles: [sha("a{color:red}"), sha("\nb{}\n")] });
});

test("the headers file applies one policy to every path, with each hash and no unsafe source", () => {
  const file = headersFile({ scripts: ["'sha256-s'"], styles: ["'sha256-t'"] });
  assert.match(file, /^\/\*\n/);
  const csp = /Content-Security-Policy: (.+)/.exec(file)?.[1] ?? "";
  for (const directive of ["default-src 'none'", "script-src 'self' 'sha256-s'", "style-src 'self' 'sha256-t'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'none'"]) {
    assert.ok(csp.split("; ").includes(directive), directive);
  }
  assert.doesNotMatch(csp, /unsafe-|\*/);
  assert.match(file, /Strict-Transport-Security: max-age=31536000\n/);
  assert.match(file, /Referrer-Policy: strict-origin-when-cross-origin\n/);
  assert.match(file, /Permissions-Policy: .*camera=\(\).*clipboard-write=\(self\)/);
  assert.match(file, /X-Content-Type-Options: nosniff\n/);
});

test("security.txt names the one contact and expires within a year of the build (RFC 9116)", () => {
  const now = new Date("2026-11-08T10:00:00Z");
  const text = securityTxt(now);
  assert.match(text, /^Contact: mailto:matteogallo\.office@gmail\.com$/m);
  assert.match(text, /^Canonical: https:\/\/matteogallo\.ch\/\.well-known\/security\.txt$/m);
  assert.match(text, /^Preferred-Languages: fr, en$/m);
  const expires = new Date(/^Expires: (.+)$/m.exec(text)?.[1] ?? "");
  assert.ok(expires > now && expires.getTime() - now.getTime() <= 365 * 864e5, String(expires));
});
