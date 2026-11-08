import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { builtPages } from "../scripts/built-pages.ts";

// `astro preview` does not read Cloudflare's _headers, so the test serves each page with the policy
// the build wrote: a script, style, font or image the policy does not allow shows up as a violation.
const headers = readFileSync("dist/_headers", "utf8");
const csp = /Content-Security-Policy: (.+)/.exec(headers)?.[1] ?? "";

// Cloudflare Pages ignores a _headers line over 2,000 characters; every inline script or style
// adds a hash to the policy line.
test("dist/_headers: every line within Cloudflare's limit", () => {
  expect(headers.split("\n").filter((line) => line.length > 2000)).toEqual([]);
});

for (const path of builtPages()) {
  test(`${path}: nothing the security policy blocks, no cookie`, async ({ page, context }) => {
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() !== "document") return route.continue();
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), "content-security-policy": csp } });
    });
    await page.addInitScript(() => {
      (window as unknown as { violations: string[] }).violations = [];
      document.addEventListener("securitypolicyviolation", (e) => (window as unknown as { violations: string[] }).violations.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.wheel(0, 20000);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as unknown as { violations: string[] }).violations)).toEqual([]);
    // The scripts ran: the address became a copy button, the demo lit its spotlight.
    if (!path.includes("404")) await expect(page.locator(".contact button.address")).toHaveCount(1);
    if (path === "/" || path === "/en/") await expect(page.locator("[data-verity-demo][data-lit]")).toHaveCount(1);
    expect(await page.evaluate(() => [...document.fonts].filter((f) => f.status === "error").map((f) => f.family))).toEqual([]);
    expect(await context.cookies()).toEqual([]);
  });
}

test("security.txt is served from /.well-known", async ({ request }) => {
  const response = await request.get("/.well-known/security.txt");
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("Contact: mailto:matteogallo.office@gmail.com");
});
