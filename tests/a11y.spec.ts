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
      // at opacity 0 below the screen, and axe skips what it cannot see. Elements not rendered
      // (closed tooltips) or invisible (the demo card that is off) are hidden from everyone.
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(path);
      // axe skips hidden content: folded sections are opened so what they hold is checked too.
      await page.locator("details").evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true)));
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
    // The navigation and the language selector come before main: the skip link passes them.
    await expect(page.locator("main :is(.nav, .crumbs, .langs)")).toHaveCount(0);
    await page.keyboard.press("Tab");
    const after = page.locator(":focus");
    await expect(after).toHaveCount(1);
    expect(await after.evaluate((el) => !!el.closest("main") && !el.closest(".site-header, nav"))).toBe(true);
  });

  // In the viewport is not enough: at 375 px the sticky navigation sits where the focused skip
  // link appears, and covered it while toBeInViewport still passed.
  test(`keyboard: ${path} the focused skip link is drawn above everything at 375 px`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(path);
    await page.keyboard.press("Tab");
    const skip = page.locator(".skip-link");
    await expect(skip).toBeFocused();
    const covered = await skip.evaluate((link) => {
      const box = link.getBoundingClientRect();
      const points = [[box.left + 2, box.top + 2], [box.right - 2, box.top + 2], [box.left + box.width / 2, box.top + box.height / 2], [box.left + 2, box.bottom - 2], [box.right - 2, box.bottom - 2]];
      return points.filter(([x, y]) => !link.contains(document.elementFromPoint(x!, y!))).map(([x, y]) => `${Math.round(x!)},${Math.round(y!)}: ${document.elementFromPoint(x!, y!)?.className}`);
    });
    expect(covered).toEqual([]);
  });
}
