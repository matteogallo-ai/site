import { expect, type Page, test } from "@playwright/test";

type Box = { top: number; bottom: number; left: number; right: number };

/** The boxes of the demo's contract once unfolded, and its card, in viewport coordinates. */
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
      tag: box(document.querySelector("[data-lens-tag]")!),
      fade: Number.parseFloat(getComputedStyle(document.querySelector("[data-sheet]")!).getPropertyValue("--fade")),
      card: box(document.querySelector(`#verity-panel-${m}`)!),
    };
  }, mode);
}

const within = (inner: Box, outer: Box) => inner.top >= outer.top && inner.bottom <= outer.bottom && inner.left >= outer.left && inner.right <= outer.right;
// Settled: the window has scrolled to the passage and the lens has reached it. Web fonts can land
// after document.fonts.ready and move the words; the lens follows them a moment later.
const settled = async (page: Page, mode: "answer" | "refusal") => {
  const b = await boxes(page, mode);
  const centre = (x: Box) => (x.top + x.bottom) / 2;
  return within(b.target, b.window) && Math.abs(centre(b.lens) - centre(b.target)) < 8;
};

const open = async (page: Page) => {
  await page.locator("details.contract summary").click();
  await expect(page.locator("[data-sheet]")).toBeVisible();
};

// The first screen holds the claim and the demo's card: question, cited passage, answer, checks.
for (const [width, height] of [
  [1440, 800],
  [1280, 720],
] as const) {
  for (const mode of ["answer", "refusal"] as const) {
    test(`first screen at ${width}×${height}: tabs and the whole ${mode} card, its passage in it, visible without scrolling`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      if (mode === "refusal") await page.getByRole("tab", { name: "Il refuse, faute de preuve" }).click();
      const card = page.locator(`#verity-panel-${mode}`);
      await expect(card).toBeVisible();
      expect(await page.evaluate(() => scrollY)).toBe(0);
      const b = await page.evaluate((m) => {
        const box = (e: Element): Box => {
          const r = e.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
        };
        return {
          viewport: { top: 0, left: 0, bottom: innerHeight, right: innerWidth },
          tabs: box(document.querySelector('[role="tablist"]')!),
          card: box(document.querySelector(`#verity-panel-${m}`)!),
          passage: box(document.querySelector(`#verity-panel-${m} .passage`)!),
        };
      }, mode);
      for (const name of ["tabs", "card", "passage"] as const) {
        expect(within(b[name], b.viewport), `${name} ${JSON.stringify(b[name])} in ${JSON.stringify(b.viewport)}`).toBe(true);
      }
    });
  }
}

test("narrow screens: the folded contract follows the cards, and once open its passage is in view inside it", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await open(page);
  await expect.poll(() => settled(page, "answer")).toBe(true);
  const b = await boxes(page, "answer");
  expect(b.window.top).toBeGreaterThanOrEqual(b.card.bottom);
});

// The window fades out over --fade at its top: the tag and the lens (its ring included) stay below it.
for (const [width, height] of [
  [1440, 800],
  [1280, 720],
  [1024, 768],
  [375, 812],
] as const) {
  for (const mode of ["answer", "refusal"] as const) {
    test(`at ${width}×${height}, the ${mode} tag and lens stay clear of the window's top fade`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      if (mode === "refusal") await page.getByRole("tab", { name: "Il refuse, faute de preuve" }).click();
      await open(page);
      await expect.poll(() => settled(page, mode)).toBe(true);
      const b = await boxes(page, mode);
      expect(b.fade).toBeGreaterThan(0);
      expect(b.tag.top - b.window.top, JSON.stringify(b)).toBeGreaterThanOrEqual(b.fade - 0.5);
      expect(b.lens.top - b.window.top, JSON.stringify(b)).toBeGreaterThanOrEqual(b.fade - 0.5);
    });
  }
}
