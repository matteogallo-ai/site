import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { builtPages } from "../scripts/built-pages.ts";
import { type Coverage, missingGlyphs, type Role } from "../scripts/glyphs.ts";
import { collectText } from "./collect-text.ts";

const coverage = JSON.parse(readFileSync("src/assets/fonts/coverage.json", "utf8")) as Coverage;

/** Font files the page downloads, by role (matched through the @font-face rules it declares). */
async function downloadedRoles(page: Page, fontUrls: string[]): Promise<string[]> {
  return page.evaluate((urls) => {
    const roleOf: Record<string, string> = {};
    for (const role of ["sans", "serif", "mono"]) {
      const v = getComputedStyle(document.documentElement).getPropertyValue(`--font-${role}`);
      const family = (v.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
      if (family) roleOf[family] = role;
    }
    const roles = new Set<string>();
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const family = rule.style.getPropertyValue("font-family").replace(/^["']|["']$/g, "");
        const src = rule.style.getPropertyValue("src");
        if (urls.some((u) => src.includes(new URL(u).pathname))) roles.add(roleOf[family] ?? family);
      }
    }
    return [...roles].sort();
  }, fontUrls);
}

async function check(page: Page) {
  const { byRole, problems, used } = await page.evaluate(collectText);
  return { problems: [...problems, ...missingGlyphs(byRole as Partial<Record<Role, string>>, coverage)], used };
}

for (const path of builtPages()) {
  test(`glyphs: every character on ${path} is drawn by a shipped subset, and no unused font is downloaded`, async ({ page }) => {
    const fontUrls: string[] = [];
    page.on("response", (r) => r.url().endsWith(".woff2") && fontUrls.push(r.url()));
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const { problems, used } = await check(page);
    expect(problems).toEqual([]);
    expect(await downloadedRoles(page, fontUrls)).toEqual([...used].sort());
  });
}

test("glyph collector self-test: hidden places a missing glyph can hide are all reported", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.innerHTML = `
      <style>.a::before{content:"⇒ "} .cap{text-transform:capitalize} .m{font-family:var(--font-mono)} .bold{font-weight:800} .qq{quotes:"⟨" "⟩"}</style>
      <span class="a">x</span><ul><li>item</li></ul><q class="qq">cité</q>
      <input value="✓ ok" placeholder="⌘K"><span class="cap">µs</span>
      <span class="m">é</span><span class="m">\u202F</span><span class="bold">gras</span>`;
    document.body.append(probe);
  });
  const { problems } = await check(page);
  expect(problems).toEqual(expect.arrayContaining([
    'sans: "⇒" U+21D2', 'sans: "•" U+2022', 'sans: "⟨" U+27E8', 'sans: "✓" U+2713', 'sans: "⌘" U+2318', 'sans: "Μ" U+039C',
    'mono: "é" U+00E9', 'mono: "\u202F" U+202F', expect.stringMatching(/^sans has no 800 normal face/),
  ]));
});
