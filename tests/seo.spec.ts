import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { builtPages } from "../scripts/built-pages.ts";
import { kilo, site, siteBudgets } from "../src/lib/colophon.ts";
import { decimal } from "../src/lib/measures.ts";
import { OG } from "../src/lib/og.ts";
import config from "../astro.config.mjs";

const ORIGIN = new URL(config.site!).origin;
const pages = builtPages();

test("the sitemap lists every built page but the 404, each at its canonical URL", async ({ page, request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const canonicals: string[] = [];
  for (const path of pages.filter((p) => p !== "/404.html")) {
    await page.goto(path);
    canonicals.push((await page.locator('link[rel="canonical"]').getAttribute("href"))!);
  }
  expect(locs).toEqual(canonicals.sort());
});

test("robots.txt allows every crawler and names the sitemap", async ({ request }) => {
  expect(await (await request.get("/robots.txt")).text()).toBe(`User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
});

test("the Open Graph image is a 1200x630 PNG, and its headline is the home page's", async ({ page }) => {
  const meta = await sharp(readFileSync(`dist/${OG.file.replace(/^public\//, "")}`)).metadata();
  expect([meta.format, meta.width, meta.height]).toEqual(["png", OG.width, OG.height]);
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText(OG.headline);
  await expect(page.locator(".hero .name")).toHaveText(OG.name);
  await expect(page.locator(".hero .role")).toHaveText(OG.role);
});

for (const path of pages) {
  test(`${path}: link previews name the page, its URL and the shared image`, async ({ page, request }) => {
    await page.goto(path);
    const og = (p: string) => page.locator(`meta[property="og:${p}"]`).getAttribute("content");
    expect(await og("title")).toBe(await page.title());
    if (path === "/404.html") {
      // Served at every unknown address: no URL of its own to name.
      await expect(page.locator('link[rel="canonical"], meta[property="og:url"]')).toHaveCount(0);
    } else {
      expect(await og("url")).toBe(await page.locator('link[rel="canonical"]').getAttribute("href"));
    }
    const image = (await og("image"))!;
    expect(image).toBe(`${ORIGIN}/og.png`);
    expect(await og("image:alt")).toBe(OG.alt);
    const local = await request.get(new URL(image).pathname);
    expect(local.status()).toBe(200);
    expect(local.headers()["content-type"]).toBe("image/png");
  });
}

test("the home page's footer links to the Colophon", async ({ page }) => {
  await page.goto("/");
  await page.locator(".footer").getByRole("link", { name: "Colophon" }).click();
  await expect(page).toHaveURL(/\/colophon\/$/);
  await expect(page.locator("h1")).toHaveText("Colophon");
});

test("an unknown address answers 404 with the 404 page and a way home", async ({ page }) => {
  const response = await page.goto("/aucune-page-ici/");
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Aucune preuve à cette adresse.");
  await page.getByRole("link", { name: "Retour à l’accueil" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("the Colophon shows the budgets lighthouserc.cjs enforces and the measures of the recorded CI run", async ({ page }) => {
  await page.goto("/colophon/");
  const budgets = page.locator("#budgets ~ .rows > div");
  await expect(budgets.locator("dt")).toHaveText(siteBudgets("fr").map((b) => b.label));
  await expect(budgets.locator("dd")).toHaveText(siteBudgets("fr").map((b) => b.limit));
  const measured = page.locator(".page");
  await expect(measured).toHaveCount(site.pages.length);
  for (const [i, p] of site.pages.entries()) {
    const values = measured.nth(i).locator("dd");
    await expect(values.nth(0)).toHaveText(kilo(p.transferBytes, "fr"));
    await expect(values.nth(1)).toHaveText(kilo(p.fontBytes, "fr"));
    await expect(values.nth(2)).toHaveText([p.scores.performance, p.scores.accessibility, p.scores.bestPractices, p.scores.seo].join(" · "));
    await expect(values.nth(3)).toHaveText(`${decimal(p.lcpMs / 1000, 2, "fr")}\u00A0s`);
    await expect(values.nth(4)).toHaveText(decimal(p.cls, 3, "fr"));
  }
  await expect(page.locator(`section:has(#mesures) a[href$="${site.commit}"]`)).toHaveText(site.commit.slice(0, 7));
  // Every built page the recorded run did not measure is named, so the figures are not read as the whole site's.
  const unmeasured = pages.filter((p) => !site.pages.some((m) => m.path === p));
  await expect(page.locator("section:has(#mesures) .note .mono")).toHaveText(unmeasured.join(", "));
});
