import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { builtPages } from "../scripts/built-pages.ts";
import { kilo, site, siteBudgets } from "../src/lib/colophon.ts";
import { alternates, langOf, twin } from "../src/lib/i18n.ts";
import { decimal } from "../src/lib/measures.ts";
import { homeFigures, OG, ogImage, ogImages } from "../src/lib/og.ts";
import { plain } from "../scripts/typography.ts";
import config from "../astro.config.mjs";

const ORIGIN = new URL(config.site!).origin;
const pages = builtPages();
// The sitemap's namespace names are URLs that are not links.
const XML_NAMESPACES = ["http://www.sitemaps.org", "http://www.w3.org"];

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
  urls.push(...files.flatMap((f) => [...f.matchAll(/https?:\/\/[^\s<"]+/g)].map((m) => m[0]).filter((u) => !XML_NAMESPACES.includes(new URL(u).origin))));
  // Each source must contribute: one og:image per page, and the sitemap's own URLs.
  expect(urls.filter((u) => new URL(u).pathname.endsWith(".png")).length).toBe(pages.length);
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
    await expect(page.locator(".hero .role")).toHaveText(OG.role[lang]);
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
    // A case study is an article; the home pages, the Colophon and the 404 are the site's own pages.
    expect(await og("type")).toBe(/\/(projets|projects)\/[a-z]+\/$/.test(path) ? "article" : "website");
    if (path.endsWith("/404.html")) {
      // Served at every unknown address: no URL of its own to name.
      await expect(page.locator('link[rel="canonical"], meta[property="og:url"]')).toHaveCount(0);
    } else {
      expect(await og("url")).toBe(await page.locator('link[rel="canonical"]').getAttribute("href"));
    }
    const image = (await og("image"))!;
    // F2: a case study shares its own image, every other page its language's home image.
    const expected = ogImage(path);
    // Versioned by the served PNG's own bytes: a redrawn image gets a new address, so a feed that
    // cached the old one (LinkedIn) fetches it again.
    const served = expected.file.replace(/^public\//, "");
    const version = createHash("sha256").update(readFileSync(`dist/${served}`)).digest("hex").slice(0, 8);
    expect(image).toBe(`${ORIGIN}/${served}?v=${version}`);
    expect(plain((await og("image:alt"))!)).toBe(plain(expected.alt));
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
    // F6: every file of this repository is linked at the measured commit, never at a moving branch.
    const blobs = await page.locator('main a[href*="/matteogallo-ai/site/blob/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    expect(blobs.length).toBeGreaterThan(1);
    for (const href of blobs) expect(href).toContain(`/blob/${site.commit}/`);
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
    // Its own zone, named for what it is, outside any navigation landmark, the current language marked.
    await expect(selector).toHaveAttribute("aria-label", lang === "fr" ? "Langue" : "Language");
    expect(await selector.evaluate((el) => el.closest("nav, main") === null)).toBe(true);
    await expect(selector.locator('[aria-current="true"]')).toHaveText(lang.toUpperCase());
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

// F4: a lost visitor still learns whose site this is and reaches the three case studies.
for (const [path, cases] of [
  ["/aucune-page-ici/", ["/projets/verity/", "/projets/promptlang/", "/projets/praxis/"]],
  // The preview server answers every unknown address with the root 404; Cloudflare Pages serves
  // en/404.html under /en/, so the English page is read at its file.
  ["/en/404.html", ["/en/projects/verity/", "/en/projects/promptlang/", "/en/projects/praxis/"]],
] as const) {
  test(`${path}: the 404 names the site's author and links to the three case studies`, async ({ page }) => {
    const response = await page.goto(path);
    if (path !== "/en/404.html") expect(response?.status()).toBe(404);
    await expect(page.locator("main")).toContainText("Matteo Gallo");
    await expect(page.locator("main .cases a")).toHaveCount(3);
    expect(await page.locator("main .cases a").evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(cases);
  });
}

// F1: the icons in the site's colours, for browsers (SVG, ICO) and for a phone's home screen.
for (const path of ["/", "/en/projects/verity/"]) {
  test(`${path}: names its icons, each served`, async ({ page, request }) => {
    await page.goto(path);
    const icons = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll((ls) => ls.map((l) => `${l.getAttribute("rel")} ${l.getAttribute("href")}`));
    expect(icons).toEqual(["icon /favicon.ico", "icon /favicon.svg", "apple-touch-icon /apple-touch-icon.png"]);
    for (const [file, type] of [["/favicon.ico", /icon/], ["/favicon.svg", /^image\/svg\+xml/], ["/apple-touch-icon.png", /^image\/png/]] as const) {
      const response = await request.get(file);
      expect(response.status(), file).toBe(200);
      expect(response.headers()["content-type"], file).toMatch(type);
    }
  });
}

// F2: what each image says beside its title is what the page says: the home cards' figures, a
// case study's first brief figure and its caption; every image is a 1200x630 PNG.
for (const image of ogImages()) {
  const path = image.case ? (image.lang === "fr" ? `/projets/${image.case.slug}/` : `/en/projects/${image.case.slug}/`) : image.lang === "fr" ? "/" : "/en/";
  test(`${image.file}: drawn at 1200x630 from the words of ${path}`, async ({ page }) => {
    const meta = await sharp(readFileSync(image.file)).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["png", OG.width, OG.height]);
    await page.goto(path);
    if (image.case) {
      const first = page.locator(".brief .figure").first();
      expect(plain(await first.locator(".value").innerText())).toBe(plain(image.case.value));
      expect(plain(await page.locator(".brief").innerText()).replace(/\s+/g, " ")).toContain(plain(image.case.caption));
    } else {
      const lines = await page.locator(".project .figure-line").allInnerTexts();
      expect(lines.map(plain)).toEqual(homeFigures(image.lang).map((f) => plain(f.line)));
    }
  });
}

// Search engines read who the site is about from a Person record on each home page. It is an
// inline script like any other: the build hashes it into the security policy.
for (const [path, jobTitle] of [["/", "Ingénieur logiciel & IA"], ["/en/", "Software & AI Engineer"]] as const) {
  test(`${path}: a JSON-LD Person names the author, his role and profiles, and its hash is in the policy`, async ({ page }) => {
    await page.goto(path);
    const blocks = page.locator('script[type="application/ld+json"]');
    await expect(blocks).toHaveCount(1);
    const text = (await blocks.textContent())!;
    expect(JSON.parse(text)).toEqual({
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Matteo Gallo",
      jobTitle,
      url: `${ORIGIN}${path}`,
      sameAs: ["https://github.com/matteogallo-ai", "https://www.linkedin.com/in/matteogallo-ai"],
    });
    const csp = /Content-Security-Policy: (.+)/.exec(readFileSync("dist/_headers", "utf8"))?.[1] ?? "";
    const hash = createHash("sha256").update(text, "utf8").digest("base64");
    expect(csp).toContain(`'sha256-${hash}'`);
  });
}

// Only the home pages carry it: elsewhere the record would describe the page as the person.
for (const path of pages.filter((p) => p !== "/" && p !== "/en/")) {
  test(`${path}: no JSON-LD`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  });
}
