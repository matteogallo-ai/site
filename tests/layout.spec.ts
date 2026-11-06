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

for (const [path, caption] of [["/", "Exécution réelle rejouée : Verity, mon agent RAG, contrat de test en anglais"], ["/en/", "Replay of a real run: Verity, my RAG agent, on a test contract"]] as const) {
  test(`${path}: the demo says it replays a real run, and a correct refusal is not drawn as a defect`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("[data-verity-demo] .caption")).toHaveText(caption);
    const colours = await page.evaluate(() => {
      const probe = document.createElement("span");
      document.body.append(probe);
      const of = (v: string) => ((probe.style.color = `var(${v})`), getComputedStyle(probe).color);
      const out = { verdict: getComputedStyle(document.querySelector(".verdict")!).color, defect: of("--defect"), proof: of("--proof-text") };
      probe.remove();
      return out;
    });
    expect(colours.verdict).not.toBe(colours.defect);
    expect(colours.verdict).toBe(colours.proof);
  });
}

// B1: the contract window is positioned by the script; the wheel and the finger scroll the page.
for (const width of [375, 1440]) {
  test(`demo at ${width} px: the wheel over the contract scrolls the page, not the contract`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const sheet = page.locator("[data-sheet]");
    await sheet.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => ({ y: scrollY, sheet: document.querySelector("[data-sheet]")!.scrollTop }));
    const box = (await sheet.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 40);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before.y);
    expect(await sheet.evaluate((s) => s.scrollTop)).toBe(before.sheet);
  });
}

// B2: in either mode the card fills the cell it shares with the other one: no blank band under
// the shorter card, and nothing below the cards moves when the mode changes.
for (const width of [768, 1440]) {
  test(`demo at ${width} px: both cards are as tall as each other`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const heights = await page.evaluate(() => ["answer", "refusal"].map((m) => document.getElementById(`verity-panel-${m}`)!.getBoundingClientRect().height));
    expect(Math.abs(heights[0]! - heights[1]!)).toBeLessThan(1);
  });
}

// B3: at 375 px each tab label holds on one line.
for (const path of ["/", "/en/"]) {
  test(`${path} at 375 px: the demo's tabs hold on one line each`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(path);
    const lines = await page.locator(".tabs [role=tab]").evaluateAll((tabs) =>
      tabs.map((t) => Math.round(t.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(t).lineHeight || "20"))),
    );
    for (const tab of await page.locator(".tabs [role=tab]").all()) {
      const { height, lineHeight, padding } = await tab.evaluate((t) => {
        const s = getComputedStyle(t);
        return { height: t.getBoundingClientRect().height, lineHeight: Number.parseFloat(s.lineHeight), padding: Number.parseFloat(s.paddingTop) + Number.parseFloat(s.paddingBottom) };
      });
      expect(height - padding, `lines ${JSON.stringify(lines)}`).toBeLessThan(lineHeight * 1.5);
    }
  });
}

// B4: at 1440 the three project cards line up: same image height, links on one line across.
for (const path of ["/", "/en/"]) {
  test(`${path} at 1440 px: the project cards' images share a height and their links a line`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    const boxes = await page.locator(".project").evaluateAll((cards) =>
      cards.map((c) => ({ img: Math.round(c.querySelector("figure img")!.getBoundingClientRect().height), links: Math.round(c.querySelector(".links")!.getBoundingClientRect().top) })),
    );
    expect(boxes).toHaveLength(3);
    expect(new Set(boxes.map((b) => b.img)).size, JSON.stringify(boxes)).toBe(1);
    expect(new Set(boxes.map((b) => b.links)).size, JSON.stringify(boxes)).toBe(1);
  });
}

// B5: a caption is smaller than the text, muted, and close to its image.
test("project captions: 14 px at most, in graphite, 8 to 12 px under their image", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const captions = await page.locator(".project figcaption").evaluateAll((cs) =>
    cs.map((c) => {
      const s = getComputedStyle(c);
      const probe = document.createElement("span");
      probe.style.color = "var(--graphite)";
      document.body.append(probe);
      const graphite = getComputedStyle(probe).color;
      probe.remove();
      return { size: Number.parseFloat(s.fontSize), muted: s.color === graphite, gap: Math.round(c.getBoundingClientRect().top - c.parentElement!.querySelector("img")!.getBoundingClientRect().bottom) };
    }),
  );
  for (const c of captions) {
    expect(c.size).toBeLessThanOrEqual(14);
    expect(c.size).toBeGreaterThanOrEqual(13);
    expect(c.muted).toBe(true);
    expect(c.gap).toBeGreaterThanOrEqual(8);
    expect(c.gap).toBeLessThanOrEqual(12);
  }
});

// C7: the brief's heading is larger than the labels it heads, and in ink like them.
for (const path of ["/projets/verity/", "/en/projects/verity/"]) {
  test(`${path}: the brief's heading outranks its labels`, async ({ page }) => {
    await page.goto(path);
    const [h2, dt] = await Promise.all([".brief h2", ".brief dt"].map((s) => page.locator(s).first().evaluate((e) => ({ size: Number.parseFloat(getComputedStyle(e).fontSize), color: getComputedStyle(e).color, weight: Number(getComputedStyle(e).fontWeight) }))));
    expect(h2!.size).toBeGreaterThan(dt!.size * 1.2);
    expect(h2!.color).toBe(dt!.color);
    expect(h2!.weight).toBeGreaterThanOrEqual(dt!.weight);
  });
}
