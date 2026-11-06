import { expect, test } from "@playwright/test";
import { builtPages } from "../scripts/built-pages.ts";
import { langOf } from "../src/lib/i18n.ts";

// The English pages are translated by hand: a French word left on one is a missed sentence. The
// check reads every text a reader or a screen reader gets (text nodes, alt, aria-label, title),
// outside elements marked with another language (the FR link of the selector) and outside code.
// It knows French by its accented letters and its commonest short words, which English never uses
// alone; it cannot judge the quality of a translation, which is the reviewer's to check.
const FRENCH = /[àâçéèêëîïôûùœ]|\b(?:le|la|les|des|du|une|est|et|pour|avec|dans|qui|que|sur|pas|sont|cette|ces|aux|au|ou|où|mais|puis|sans|je|nous)\b/i;

/** Runs in the page: each French-looking text, with where it was found. */
function frenchTexts(pattern: string): string[] {
  const re = new RegExp(pattern, "i");
  const foreign = (e: Element) => e.closest("[lang]:not([lang='en']), code, script, style") !== null;
  const found: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!foreign(node.parentElement!) && re.test(node.textContent ?? "")) found.push(`${node.parentElement!.tagName.toLowerCase()}: ${node.textContent!.trim()}`);
  }
  for (const el of document.querySelectorAll("[alt], [aria-label], [title]")) {
    if (foreign(el)) continue;
    for (const name of ["alt", "aria-label", "title"]) {
      const value = el.getAttribute(name);
      if (value && re.test(value)) found.push(`${el.tagName.toLowerCase()}[${name}]: ${value}`);
    }
  }
  for (const meta of document.querySelectorAll("title, meta[name='description'], meta[property^='og:']")) {
    const value = meta.tagName === "TITLE" ? meta.textContent : meta.getAttribute("content");
    if (value && !/^https?:/.test(value) && re.test(value)) found.push(`${meta.tagName.toLowerCase()}: ${value}`);
  }
  return found;
}

for (const path of builtPages().filter((p) => langOf(p) === "en")) {
  test(`${path}: no French text outside elements marked as French`, async ({ page }) => {
    await page.goto(path);
    expect(await page.evaluate(frenchTexts, FRENCH.source)).toEqual([]);
  });
}

test("the French check finds a French sentence left on an English page, and leaves one marked lang=fr alone", async ({ page }) => {
  await page.goto("/en/");
  await page.evaluate(() => {
    const p = document.createElement("p");
    p.textContent = "Chaque mesure est publiée.";
    const marked = document.createElement("p");
    marked.lang = "fr";
    marked.textContent = "Défauts compris.";
    document.querySelector("main")!.append(p, marked);
  });
  expect(await page.evaluate(frenchTexts, FRENCH.source)).toEqual(["p: Chaque mesure est publiée."]);
});
