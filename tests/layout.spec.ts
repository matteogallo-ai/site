// Layout rules measured in the browser at given widths.
import { expect, type Page, test } from "@playwright/test";
import { builtPages } from "../scripts/built-pages.ts";
import { plain } from "../scripts/typography.ts";

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

for (const [path, caption, note] of [
  ["/", "Démo : Verity sur un contrat de test", "Traduit d’un run réel en anglais · Voir la trace originale"],
  ["/en/", "Demo: Verity on a test contract", "Replay of a real run · See the original trace"],
] as const) {
  test(`${path}: the demo says it replays a real run, and a correct refusal is not drawn as a defect`, async ({ page }) => {
    await page.goto(path);
    expect(plain(await page.locator("[data-verity-demo] .caption").innerText())).toBe(plain(caption));
    expect(plain(await page.locator("[data-verity-demo] .note").innerText())).toBe(plain(note));
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
    await page.locator("details.contract summary").click();
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

// C3: on a wide screen a case study is not the phone layout stretched.
for (const path of ["/projets/verity/", "/en/projects/promptlang/"]) {
  test(`${path} at 1440 px: diagram beside its text, prose at a reading measure, measures at a set width`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    const diagram = (await page.locator("#construit .diagram").boundingBox())!;
    const prose = (await page.locator("#construit > p").last().boundingBox())!;
    expect(diagram.x, "diagram in its own column, right of the text").toBeGreaterThanOrEqual(prose.x + prose.width);
    // About 70 characters a line at most: text length over the lines it takes.
    const perLine = await page.locator(".case-section > p:not(.lead):not(.rule-label)").evaluateAll((ps) =>
      ps.map((p) => {
        const lines = Math.round(p.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(p).lineHeight));
        return lines > 1 ? (p as HTMLElement).innerText.replace(/\s+/g, " ").length / lines : 0;
      }),
    );
    expect(Math.max(...perLine)).toBeLessThanOrEqual(75);
    await page.locator(".measures-detail summary").first().click();
    const detail = await page.locator(".measures-detail").first().evaluate((d) => ({ width: d.getBoundingClientRect().width, layout: getComputedStyle(d.querySelector("table")!).tableLayout }));
    expect(detail.width).toBeLessThanOrEqual(1024);
    expect(detail.layout).toBe("fixed");
  });
}

// C2: each case study opens on its product, large, with the link to the recording or the PDF.
for (const [path, link] of [
  ["/projets/verity/", "Voir l’enregistrement (GIF)"],
  ["/en/projects/promptlang/", "See the recording (GIF)"],
  ["/projets/praxis/", "Voir le PDF"],
] as const) {
  test(`${path}: the product image follows the brief, large, with its link`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    const shot = page.locator(".case-shot");
    await expect(shot.locator("img")).toBeVisible();
    await expect(shot.locator("img")).toHaveAttribute("loading", "eager");
    // Right after the brief: above it, on a phone, it was the largest paint and broke the LCP budget.
    expect(await shot.evaluate((el) => el.previousElementSibling?.matches(".brief") ?? false)).toBe(true);
    expect((await shot.locator("img").boundingBox())!.width).toBeGreaterThan(600);
    await expect(shot.getByRole("link", { name: link })).toHaveAttribute("href", /^https:\/\//);
  });
}

// F5: paragraphs avoid a lone word on their last line.
for (const path of ["/", "/projets/verity/", "/en/colophon/"]) {
  test(`${path}: paragraphs wrap with text-wrap: pretty`, async ({ page }) => {
    await page.goto(path);
    const styles = await page.locator("main p").evaluateAll((ps) => [...new Set(ps.map((p) => getComputedStyle(p).textWrapStyle))]);
    expect(styles).toEqual(["pretty"]);
  });
}

// E2 (WCAG 2.5.8): at 375 px every control is at least 24×24 px, the home navigation 44 px tall.
// Links inside a sentence are exempt: the line of text sets their size.
for (const path of pages) {
  test(`${path} at 375 px: touch targets of 24×24 px at least, navigation 44 px tall`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(path);
    const small = await page.evaluate(() => {
      const inSentence = (el: Element) => {
        const block = el.closest("p, li, dd, td, figcaption, blockquote, footer");
        if (!block || el.closest(".actions, .links, .tabs, .langs, nav")) return false;
        return (block.textContent ?? "").trim().length > (el.textContent ?? "").trim().length + 1;
      };
      return [...document.querySelectorAll("a[href], button, [role=tab], summary, [tabindex='0']")]
        .filter((el) => (el as HTMLElement).offsetParent !== null && getComputedStyle(el).visibility !== "hidden")
        .filter((el) => !inSentence(el) && !el.closest(".skip"))
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width < 24 || r.height < 24)
        .map(({ el, r }) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    });
    expect(small).toEqual([]);
    const nav = await page.locator(".nav a, .crumbs a, .langs a").evaluateAll((as) => as.map((a) => `${a.textContent?.trim()} ${Math.round(a.getBoundingClientRect().height)}`));
    for (const link of nav) expect(Number(link.split(" ").at(-1)), link).toBeGreaterThanOrEqual(path === "/" || path === "/en/" ? 44 : 24);
  });
}

// E3: a figure is announced as its value and what it counts; the proof path is its description only.
for (const path of ["/", "/en/projects/verity/"]) {
  test(`${path}: each figure's accessible name is its value and its label, the proof its description`, async ({ page }) => {
    await page.goto(path);
    const figures = page.locator("a.figure");
    expect(await figures.count()).toBeGreaterThan(3);
    expect(await page.locator("a.figure[data-in-sentence]").count()).toBeGreaterThan(0);
    for (const figure of await figures.all()) {
      if (!(await figure.isVisible())) continue;
      // Within a sentence the sentence says what the figure counts: its name is the shown text alone.
      if ((await figure.getAttribute("data-in-sentence")) !== null) {
        await expect(figure).not.toHaveAttribute("aria-label");
        continue;
      }
      // The value in monospace takes U+00A0, the typeset label U+202F: compared as spaces.
      const value = (await figure.locator(".value").innerText()).trim().replace(/\s/g, " ");
      const name = (await figure.evaluate((a) => a.getAttribute("aria-label") ?? "")).replace(/\s/g, " ");
      expect(name.startsWith(`${value}, `) && name.length > value.length + 6, name).toBe(true);
      await expect(figure).toHaveAccessibleName(/\S/);
      await expect(figure).not.toHaveAccessibleName(/Preuve|Proof/);
      await expect(figure).toHaveAccessibleDescription(/^(Preuve|Proof)\s?: \S+\/\S+$/);
    }
  });
}

// E5: the contract's focus ring has the site's focus style, and no ancestor clips it.
for (const width of [375, 1440]) {
  test(`demo at ${width} px: the contract's focus ring is the site's, drawn whole`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.locator("details.contract summary").click();
    await page.locator("[data-sheet]").focus();
    await page.keyboard.press("ArrowDown");
    const ring = await page.evaluate(() => {
      const sheet = document.querySelector("[data-sheet]")!;
      const host = [sheet, sheet.parentElement!].find((el) => getComputedStyle(el).outlineStyle !== "none")!;
      const s = getComputedStyle(host);
      const probe = document.createElement("a");
      probe.href = "#";
      document.body.append(probe);
      probe.focus({ focusVisible: true } as FocusOptions);
      const site = getComputedStyle(probe);
      const expected = { color: site.outlineColor, width: site.outlineWidth, offset: site.outlineOffset };
      probe.remove();
      sheet instanceof HTMLElement && sheet.focus();
      const reach = Number.parseFloat(s.outlineWidth) + Number.parseFloat(s.outlineOffset);
      const r = host.getBoundingClientRect();
      const box = { top: r.top - reach, left: r.left - reach, right: r.right + reach, bottom: r.bottom + reach };
      const clipped: string[] = [];
      for (let el = host.parentElement; el; el = el.parentElement) {
        const cs = getComputedStyle(el);
        if (cs.overflowX === "visible" && cs.overflowY === "visible" && cs.clipPath === "none" && cs.maskImage === "none") continue;
        const c = el.getBoundingClientRect();
        if (box.left < c.left || box.right > c.right || box.top < c.top || box.bottom > c.bottom) clipped.push(`${el.tagName}.${el.className}`);
      }
      return { got: { color: s.outlineColor, width: s.outlineWidth, offset: s.outlineOffset }, expected, clipped };
    });
    expect(ring.got).toEqual(ring.expected);
    expect(ring.clipped).toEqual([]);
  });
}

// The language selector's codes and bar share one line, whatever the height of the link's box.
for (const path of ["/", "/en/projects/verity/"]) {
  test(`${path}: FR, the bar and EN are vertically aligned`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(path);
    const middles = await page.locator(".langs > *").evaluateAll((els) =>
      els.map((e) => {
        const range = document.createRange();
        range.selectNodeContents(e);
        const r = range.getBoundingClientRect();
        return Math.round(r.top + r.height / 2);
      }),
    );
    expect(Math.max(...middles) - Math.min(...middles), JSON.stringify(middles)).toBeLessThanOrEqual(1);
  });
}
