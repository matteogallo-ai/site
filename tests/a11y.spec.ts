import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { builtPages } from "../scripts/built-pages.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const path of builtPages()) {
  // 375 px: the measures tables turn into stacked cards there, a layout of their own to check.
  for (const [colorScheme, width] of [["light", 1280], ["dark", 1280], ["light", 375], ["dark", 375]] as const) {
    test(`axe: ${path} (${colorScheme}, ${width} px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      // Reduced motion shows the final state: sections that come in on scroll would otherwise wait
      // at opacity 0 below the screen, and axe skips what it cannot see.
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(path);
      // axe skips hidden content: folded sections are opened so what they hold is checked too.
      await page.locator("details").evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true)));
      const unseen = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => Number(getComputedStyle(e).opacity) < 1).map((e) => e.id || e.getAttribute("class")));
      expect(unseen, "elements axe would skip as invisible").toEqual([]);
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  }

  test(`keyboard: ${path} skip link is the first stop and lands on main`, async ({ page }) => {
    await page.goto(path);
    await page.keyboard.press("Tab");
    const skip = page.locator(".skip-link");
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });
}
