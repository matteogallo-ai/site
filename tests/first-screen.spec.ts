import { expect, type Page, test } from "@playwright/test";

type Box = { top: number; bottom: number; left: number; right: number };

/** The boxes that make the demo's first screen, in viewport coordinates. */
async function boxes(page: Page, mode: "answer" | "refusal") {
  return page.evaluate((m) => {
    const box = (e: Element): Box => {
      const r = e.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    const spans = [...document.querySelectorAll(`[data-sheet] article [data-mark~="${m}"]`)].flatMap((s) => [...s.getClientRects()]);
    const target = {
      top: Math.min(...spans.map((r) => r.top)),
      bottom: Math.max(...spans.map((r) => r.bottom)),
      left: Math.min(...spans.map((r) => r.left)),
      right: Math.max(...spans.map((r) => r.right)),
    };
    return {
      viewport: { top: 0, left: 0, bottom: innerHeight, right: innerWidth },
      tabs: box(document.querySelector('[role="tablist"]')!),
      window: box(document.querySelector("[data-sheet]")!),
      target,
      lens: box(document.querySelector("[data-lens]")!),
      card: box(document.querySelector(`#verity-panel-${m}`)!),
    };
  }, mode);
}

const within = (inner: Box, outer: Box) => inner.top >= outer.top && inner.bottom <= outer.bottom && inner.left >= outer.left && inner.right <= outer.right;
const apart = (a: Box, b: Box) => a.bottom <= b.top || b.bottom <= a.top || a.right <= b.left || b.right <= a.left;

for (const [width, height] of [
  [1440, 800],
  [1280, 720],
] as const) {
  for (const mode of ["answer", "refusal"] as const) {
    test(`first screen at ${width}×${height}: tabs, ${mode} passage, lens and whole card visible without scrolling`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      if (mode === "refusal") await page.getByRole("tab", { name: "Refuse, faute de preuve" }).click();
      await expect(page.locator(`#verity-panel-${mode}`)).toBeVisible();
      expect(await page.evaluate(() => scrollY)).toBe(0);
      // The window scrolls to the passage: measure once it has settled.
      await expect.poll(async () => within((await boxes(page, mode)).target, (await boxes(page, mode)).window)).toBe(true);
      const b = await boxes(page, mode);
      for (const name of ["tabs", "window", "target", "lens", "card"] as const) {
        expect(within(b[name], b.viewport), `${name} ${JSON.stringify(b[name])} in ${JSON.stringify(b.viewport)}`).toBe(true);
      }
      // The passage and its lens are in the part of the window the card leaves uncovered.
      expect(within(b.target, b.window)).toBe(true);
      expect(apart(b.target, b.card), JSON.stringify(b)).toBe(true);
      expect(apart(b.lens, b.card), JSON.stringify(b)).toBe(true);
    });
  }
}

test("narrow screens: the card follows the window, the passage is in view inside it", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(async () => within((await boxes(page, "answer")).target, (await boxes(page, "answer")).window)).toBe(true);
  const b = await boxes(page, "answer");
  expect(b.card.top).toBeGreaterThanOrEqual(b.window.bottom);
});
