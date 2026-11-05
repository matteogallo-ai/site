import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { builtPages } from "../scripts/built-pages.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const path of builtPages()) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`axe: ${path} (${colorScheme})`, async ({ page }) => {
      // Reduced motion shows the final state: sections that come in on scroll would otherwise wait
      // at opacity 0 below the screen, and axe skips what it cannot see. Elements not rendered
      // (closed tooltips) or invisible (the demo card that is off) are hidden from everyone.
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(path);
      const unseen = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden" && Number(getComputedStyle(e).opacity) < 1).map((e) => e.id || e.getAttribute("class")));
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
