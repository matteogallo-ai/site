import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { builtFiles } from "../scripts/built-pages.ts";

// What can be clicked says so, and says where it goes: a project card opens its case study, a
// figure opens its proof, a link that leaves the site carries ↗.
const HOMES = [
  { path: "/", study: (slug: string) => `/projets/${slug}/`, read: "Lire l’étude de cas →", code: "Code sur GitHub ↗" },
  { path: "/en/", study: (slug: string) => `/en/projects/${slug}/`, read: "Read the case study →", code: "Code on GitHub ↗" },
];
const SLUGS = ["verity", "promptlang", "praxis"];

/** What a link shows: its text and the sign drawn after it (global.css). */
const shown = (a: Element) => `${(a as HTMLElement).innerText}${getComputedStyle(a, "::after").content.replace(/^"(.*?)"(?: \/ "")?$/, "$1").replace(/^none$/, "")}`;

/** Answers every request that leaves the site with an empty page: clicks are followed without the network. */
async function stubOutside(page: Page): Promise<void> {
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>outside</title>" }));
}

for (const home of HOMES) {
  for (const [i, slug] of SLUGS.entries()) {
    test(`${home.path}: the ${slug} card opens its case study from its image; its figure opens its proof`, async ({ page }) => {
      await stubOutside(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(home.path);
      const card = page.locator(".project").nth(i);
      await card.scrollIntoViewIfNeeded();
      // A visitor clicks the picture; the card's stretched link lies over it and takes the click.
      const box = (await card.locator("img").boundingBox())!;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page).toHaveURL(new RegExp(`${home.study(slug)}$`));

      await page.goto(home.path);
      const figure = page.locator(".project").nth(i).locator(".figure-line a.figure");
      const proof = await figure.getAttribute("href");
      expect(proof).toMatch(/^https:\/\/github\.com\//);
      await figure.click();
      await expect(page).toHaveURL(proof!);
    });
  }

  test(`${home.path}: each card says how to open it, a button to the case study and a link to its code`, async ({ page }) => {
    // Sections rise into place as they scroll in: measured once they are still.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(home.path);
    for (const [i, slug] of SLUGS.entries()) {
      const card = page.locator(".project").nth(i);
      const button = card.locator("a.button");
      await expect(button).toHaveText(home.read);
      expect(await button.getAttribute("href")).toBe(home.study(slug));
      await expect(card.locator("h3 a.card-link")).toHaveAttribute("href", home.study(slug));
      expect((await card.locator(".links a:not(.button)").evaluate(shown)).replace(/\u00A0/g, " ")).toBe(home.code);
      // The stretched link lies over the whole card: its middle (clear of the floating navigation)
      // is the link to the case study, so the browser shows the hand there.
      await card.scrollIntoViewIfNeeded();
      const box = (await card.boundingBox())!;
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest("a")?.getAttribute("href"), [box.x + box.width / 2, box.y + box.height / 2]);
      expect(hit).toBe(home.study(slug));
    }
  });

  test(`${home.path}: every link that leaves the site carries ↗, no link inside it does`, async ({ page }) => {
    await page.goto(home.path);
    const links = await page.locator("a[href]").evaluateAll(
      (as, source) => {
        const sign = new Function(`return ${source}`)() as (a: Element) => string;
        return as.map((a) => ({ href: (a as HTMLAnchorElement).href, out: (a as HTMLAnchorElement).origin !== location.origin && /^https?:/.test((a as HTMLAnchorElement).href), text: sign(a) }));
      },
      shown.toString(),
    );
    expect(links.filter((l) => l.out).length).toBeGreaterThan(10);
    expect(links.filter((l) => l.out && !l.text.includes("↗")).map((l) => l.href)).toEqual([]);
    expect(links.filter((l) => !l.out && l.text.includes("↗")).map((l) => l.href)).toEqual([]);
  });
}

// A card that opens as a whole leads into the site: a card whose only destination is elsewhere
// (the method cards' pull requests) keeps that link to its own words, which carry the ↗.
for (const path of ["/", "/en/"]) {
  test(`${path}: a card that opens as a whole stays on the site; a method card's middle is not a link`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    const stretched = await page.locator(".card .card-link").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!));
    expect(stretched.filter((h) => /^https?:/.test(h))).toEqual([]);
    const method = page.locator(`#${path === "/" ? "methode" : "method"} .card`);
    expect(await method.count()).toBe(3);
    for (const card of await method.all()) {
      await card.scrollIntoViewIfNeeded();
      const box = (await card.boundingBox())!;
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest("a")?.getAttribute("href") ?? null, [box.x + box.width / 2, box.y + box.height / 2]);
      expect(hit).toBeNull();
      expect(await card.evaluate((c) => getComputedStyle(c).cursor)).not.toBe("pointer");
    }
  });
}

// A figure inside a sentence is a word of it: one space, no more, between it and the next word.
for (const path of ["/", "/en/"]) {
  test(`${path}: a figure in a sentence is followed by one space, measured on screen`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    const gaps = await page.locator("a.figure[data-in-sentence]").evaluateAll((figures) =>
      figures.map((a) => {
        const after = a.nextSibling;
        const range = document.createRange();
        range.setStart(after!, (after!.textContent ?? "").search(/\S/));
        range.setEnd(after!, (after!.textContent ?? "").search(/\S/) + 1);
        const probe = document.createElement("span");
        probe.textContent = " ";
        a.parentElement!.append(probe);
        const space = probe.getBoundingClientRect().width;
        probe.remove();
        return { text: (a as HTMLElement).innerText, gap: range.getBoundingClientRect().left - a.getBoundingClientRect().right, space };
      }),
    );
    // "3", "12 signalements justes sur 40" and "6" in the cards' limits.
    expect(gaps.length).toBeGreaterThanOrEqual(3);
    for (const g of gaps) expect(g.gap, JSON.stringify(g)).toBeLessThanOrEqual(g.space + 0.5);
  });
}

test("built pages: a figure link is followed by one space at most", () => {
  for (const file of builtFiles()) {
    const html = readFileSync(`dist/${file}`, "utf8");
    const runs = [...html.matchAll(/<a class="figure[^>]*>[\s\S]*?<\/a>((?:\s|&nbsp;| | ){2,})/g)].map((m) => `${file}: ${JSON.stringify(m[1])}`);
    expect(runs).toEqual([]);
  }
});

// The demo's quiet links read as links: the trace leaves the site, the contract fold is a control.
test("/: the demo's trace link carries ↗ and the contract fold reads as a button", async ({ page }) => {
  await page.goto("/");
  expect(await page.locator("[data-verity-demo] .note a").evaluate(shown)).toBe("Voir la trace originale\u00A0↗");
  const summary = page.locator("details.contract summary");
  const style = await summary.evaluate((s) => ({ border: getComputedStyle(s).borderTopStyle, radius: getComputedStyle(s).borderTopLeftRadius }));
  expect(style.border).toBe("solid");
  expect(style.radius).not.toBe("0px");
});
