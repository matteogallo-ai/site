import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { builtPages } from "../scripts/built-pages.ts";
import { kilo, site, siteBudgets } from "../src/lib/colophon.ts";
import { alternates, langOf, twin } from "../src/lib/i18n.ts";
import { decimal } from "../src/lib/measures.ts";
import { OG } from "../src/lib/og.ts";
import config from "../astro.config.mjs";

const ORIGIN = new URL(config.site!).origin;
const pages = builtPages();

test("the sitemap lists every built page but the 404, each at its canonical URL", async ({ page, request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const canonicals: string[] = [];
  for (const path of pages.filter((p) => !p.endsWith("/404.html"))) {
    await page.goto(path);
    canonicals.push((await page.locator('link[rel="canonical"]').getAttribute("href"))!);
  }
  expect(locs).toEqual(canonicals.sort());
});

// The production address is the custom domain (SPEC §8): a *.pages.dev origin left in a canonical,
// hreflang, sitemap, robots or Open Graph URL would split the site's ranking across two hosts.
test("canonical, hreflang, sitemap, robots and Open Graph URLs all name https://matteogallo.ch", async ({ page, request }) => {
  expect(ORIGIN).toBe("https://matteogallo.ch");
  const urls: string[] = [];
  for (const path of pages) {
    await page.goto(path);
    for (const selector of ['link[rel="canonical"]', 'link[rel="alternate"]']) urls.push(...(await page.locator(selector).evaluateAll((els) => els.map((e) => e.getAttribute("href")!))));
    urls.push(...(await page.locator('meta[property^="og:"][content^="http"]').evaluateAll((els) => els.map((e) => e.getAttribute("content")!))));
  }
  const files = [await (await request.get("/sitemap.xml")).text(), await (await request.get("/robots.txt")).text()];
  urls.push(...files.flatMap((f) => [...f.matchAll(/https?:\/\/[^\s<"]+/g)].map((m) => m[0]).filter((u) => !u.includes("sitemaps.org") && !u.includes("w3.org"))));
  // Each source must contribute: one og:image per page, and the sitemap's own URLs.
  expect(urls.filter((u) => u.endsWith(".png")).length).toBe(pages.length);
  expect(files[0]).toContain("<loc>");
  expect(urls.filter((u) => new URL(u).origin !== ORIGIN)).toEqual([]);
});

test("robots.txt allows every crawler and names the sitemap", async ({ request }) => {
  expect(await (await request.get("/robots.txt")).text()).toBe(`User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
});

for (const [lang, home] of [["fr", "/"], ["en", "/en/"]] as const) {
  test(`the ${lang} Open Graph image is a 1200x630 PNG, and its headline is the ${lang} home page's`, async ({ page }) => {
    const meta = await sharp(readFileSync(`dist/${OG[lang].file.replace(/^public\//, "")}`)).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["png", OG.width, OG.height]);
    await page.goto(home);
    await expect(page.locator("h1")).toHaveText(OG[lang].headline);
    await expect(page.locator(".hero .name")).toHaveText(OG.name);
    await expect(page.locator(".hero .role")).toHaveText(OG.role);
  });
}

test("every built page has its twin in the other language, and the other way round", () => {
  const built = new Set(pages);
  expect(pages.filter((p) => !built.has(twin(p))).map((p) => `${p} has no twin ${twin(p)}`)).toEqual([]);
  expect(pages.filter((p) => langOf(p) === "en")).toHaveLength(pages.length / 2);
});

for (const path of pages) {
  test(`${path}: link previews name the page, its URL and the shared image`, async ({ page, request }) => {
    await page.goto(path);
    const og = (p: string) => page.locator(`meta[property="og:${p}"]`).getAttribute("content");
    expect(await og("title")).toBe(await page.title());
    if (path.endsWith("/404.html")) {
      // Served at every unknown address: no URL of its own to name.
      await expect(page.locator('link[rel="canonical"], meta[property="og:url"]')).toHaveCount(0);
    } else {
      expect(await og("url")).toBe(await page.locator('link[rel="canonical"]').getAttribute("href"));
    }
    const lang = langOf(path);
    const image = (await og("image"))!;
    expect(image).toBe(`${ORIGIN}/${OG[lang].file.replace(/^public\//, "")}`);
    expect(await og("image:alt")).toBe(OG[lang].alt);
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

for (const path of ["/colophon/", twin("/colophon/")]) {
  const lang = langOf(path);
  test(`${path}: the Colophon shows the budgets lighthouserc.cjs enforces and the measures of the recorded CI run`, async ({ page }) => {
    await page.goto(path);
    const budgets = page.locator("#budgets ~ .rows > div");
    await expect(budgets.locator("dt")).toHaveText(siteBudgets(lang).map((b) => b.label));
    await expect(budgets.locator("dd")).toHaveText(siteBudgets(lang).map((b) => b.limit));
    const measured = page.locator(".page");
    await expect(measured).toHaveCount(site.pages.length);
    for (const [i, p] of site.pages.entries()) {
      const values = measured.nth(i).locator("dd");
      await expect(values.nth(0)).toHaveText(kilo(p.transferBytes, lang));
      await expect(values.nth(1)).toHaveText(kilo(p.fontBytes, lang));
      await expect(values.nth(2)).toHaveText([p.scores.performance, p.scores.accessibility, p.scores.bestPractices, p.scores.seo].join(" · "));
      await expect(values.nth(3)).toHaveText(`${decimal(p.lcpMs / 1000, 2, lang)}\u00A0s`);
      await expect(values.nth(4)).toHaveText(decimal(p.cls, 3, lang));
    }
    await expect(page.locator(`section:has(#mesures) a[href$="${site.commit}"]`)).toHaveText(site.commit.slice(0, 7));
    // Every built page the recorded run did not measure is named, so the figures are not read as the whole site's.
    const unmeasured = pages.filter((p) => !site.pages.some((m) => m.path === p));
    const note = page.locator("section:has(#mesures) .note .mono");
    if (unmeasured.length > 0) await expect(note).toHaveText(unmeasured.join(", "));
    else await expect(note).toHaveCount(0);
  });
}

for (const path of pages) {
  test(`${path}: the page names its language, its versions in hreflang links, and offers the other language`, async ({ page, request }) => {
    await page.goto(path);
    const lang = langOf(path);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    const links = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((ls) => ls.map((l) => ({ hreflang: l.getAttribute("hreflang"), href: l.getAttribute("href") })));
    if (path.endsWith("/404.html")) {
      // Served at every unknown address: it has no URL of its own, hence no versions to name.
      expect(links).toEqual([]);
    } else {
      expect(links).toEqual(alternates(path).map((a) => ({ hreflang: a.hreflang, href: `${ORIGIN}${a.path}` })));
      for (const { href } of links) expect((await request.get(new URL(href!).pathname)).status(), href!).toBe(200);
    }
    // The selector: the page's own language as plain text, the other one as a link to the twin
    // (to the other home page from a 404, which has no address of its own).
    const other = lang === "fr" ? "en" : "fr";
    const selector = page.locator(".langs");
    await expect(selector).toHaveCount(1);
    await expect(selector).toContainText(lang.toUpperCase());
    await expect(selector.getByRole("link")).toHaveCount(1);
    const link = selector.getByRole("link", { name: other.toUpperCase() });
    await expect(link).toHaveAttribute("hreflang", other);
    await expect(link).toHaveAttribute("lang", other);
    await expect(link).toHaveAttribute("href", path.endsWith("/404.html") ? (other === "en" ? "/en/" : "/") : twin(path));
  });
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the language selector leads from a French case study to its English twin and back", async ({ page }) => {
    await page.goto("/projets/verity/");
    await page.locator(".langs").getByRole("link", { name: "EN" }).click();
    await expect(page).toHaveURL(/\/en\/projects\/verity\/$/);
    await expect(page.locator("h1")).toHaveText("Verity");
    await page.locator(".langs").getByRole("link", { name: "FR" }).click();
    await expect(page).toHaveURL(/\/projets\/verity\/$/);
  });
});
