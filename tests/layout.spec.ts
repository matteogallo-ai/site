// Layout rules measured in the browser at given widths.
import { expect, type Page, test } from "@playwright/test";
import { builtPages } from "../scripts/built-pages.ts";

const pages = builtPages();
const withContact = pages.filter((p) => !p.endsWith("/404.html"));

/** The text offsets at which a rendered element's text moves to a new line. */
async function lineBreaks(page: Page, selector: string): Promise<{ text: string; breaks: number[] }> {
  return page.locator(selector).first().evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const chars: { top: number; offset: number }[] = [];
    let offset = 0;
    let text = "";
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (let i = 0; i < node.textContent!.length; i++) {
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        chars.push({ top: Math.round(range.getBoundingClientRect().top), offset: offset + i });
      }
      offset += node.textContent!.length;
      text += node.textContent;
    }
    const breaks = chars.filter((c, i) => i > 0 && c.top > chars[i - 1]!.top + 2).map((c) => c.offset);
    return { text, breaks };
  });
}

for (const width of [320, 375]) {
  for (const path of ["/", "/en/"]) {
    test(`${path} at ${width} px: the e-mail address holds on one line, or breaks right after the @`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      const { text, breaks } = await lineBreaks(page, "#contact .address");
      expect(text).toBe("matteogallo.office@gmail.com");
      expect(breaks.every((b) => text[b - 1] === "@")).toBe(true);
      expect(breaks.length).toBeLessThanOrEqual(1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}

for (const path of withContact) {
  test(`${path}: ends with the contact block and the footer`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("#contact .address")).toHaveText("matteogallo.office@gmail.com");
    await expect(page.locator("#contact a.button.primary")).toHaveAttribute("href", "mailto:matteogallo.office@gmail.com");
    await expect(page.locator("footer.footer").getByRole("link", { name: "Colophon" })).toHaveCount(1);
  });
}

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 800 } });
  for (const [path, words] of [["/", "Touchez l’adresse pour la copier."], ["/en/", "Tap the address to copy it."]] as const) {
    test(`${path}: the copy hint speaks of tapping, not clicking`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("[data-copy-hint]")).toBeVisible();
      expect(await page.locator("[data-copy-hint]").evaluate((el) => (el as HTMLElement).innerText.trim())).toBe(words);
    });
  }
});
