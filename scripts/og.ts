// Writes the Open Graph images (1200x630): public/og.png and public/og-en.png, each home page's
// headline beside the figures of its band, and public/og/<case>[-en].png, each case study's name
// beside the first figure of its brief; the portrait on all, set with the site's own font subsets,
// colour tokens and typography. Rendered by Chromium through Playwright, so the type is the type
// of the site. The PNG is committed: browsers render
// text a little differently across platforms, so CI cannot compare pixels. It compares inputs:
// src/data/og.json records a hash of everything the images are drawn from and each PNG's own hash,
// and og.test.ts fails when either no longer matches, i.e. when `npm run og` was not re-run.
// tests/seo.spec.ts checks that the words and figures drawn are those of the page that shares the image.
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import config from "../astro.config.mjs";
import { type Lang, numbered } from "../src/lib/i18n.ts";
import { measure } from "../src/lib/measures.ts";
import { OG, type OgImage, ogImages } from "../src/lib/og.ts";
import { english, french } from "./typography.ts";

const root = new URL("../", import.meta.url);
const asset = (path: string) => new URL(path, root).href;
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const INPUTS = ["scripts/og.ts", "scripts/typography.ts", "src/lib/i18n.ts", "src/styles/tokens.css", "src/assets/fonts/inter-wght.woff2", "src/assets/fonts/mono-400.woff2", "src/assets/matteo.jpg"];
export const RECORD = new URL("src/data/og.json", root);

/** One hash over what the image is drawn from: this script, the words, the host, tokens, fonts, portrait. */
export function inputsHash(): string {
  const parts = [JSON.stringify(OG), JSON.stringify(ogImages()), new URL(config.site!).host, ...INPUTS.map((f) => sha256(readFileSync(new URL(f, root))))];
  return sha256(parts.join("\n"));
}

export const pngHash = (file: string) => sha256(readFileSync(new URL(file, root)));

/** A string as the site sets it: the build's typography, then HTML-escaped. */
const text = (s: string, lang: Lang) => escape(lang === "fr" ? french(s, " ", false) : english(s, " ", false));

function page(image: OgImage): string {
  const { lang } = image;
  const portrait = `data:image/jpeg;base64,${readFileSync(new URL("src/assets/matteo.jpg", root)).toString("base64")}`;
  const who = `<div class="who"><img src="${portrait}" alt=""><div><div class="name">${text(OG.name, lang)}</div><div class="role">${text(OG.role, lang)}</div></div></div>`;
  const site = `<div class="site">${escape(new URL(config.site!).host)}</div>`;
  // Left, who and what; right, the proof: the figures fill the half a headline alone left empty.
  const left = image.case
    ? `${who}<div><div class="kind">${text(`${lang === "fr" ? "Étude de cas" : "Case study"} · ${numbered(image.case.no, lang)}`, lang)}</div><h1 class="case-name">${text(image.case.name, lang)}</h1></div>${site}`
    : `${who}<h1>${text(OG[lang].headline, lang)}</h1>${site}`;
  const figures = image.case
    ? [{ value: image.case.value, caption: image.case.caption, defect: false, big: true }]
    : OG.band.map((b) => ({ value: measure(b.id).display[lang], caption: b.caption[lang], defect: b.defect, big: false }));
  const right = figures
    .map((f) => `<div class="figure${f.defect ? " defect" : ""}${f.big ? " big" : ""}"><div class="value">${escape(lang === "fr" ? french(f.value, " ", true) : f.value)}</div><div class="caption">${text(f.caption, lang)}</div></div>`)
    .join("");
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="${asset("src/styles/tokens.css")}">
<style>
  @font-face { font-family: Inter; src: url("${asset("src/assets/fonts/inter-wght.woff2")}") format("woff2"); font-weight: 400 700; }
  @font-face { font-family: "JetBrains Mono"; src: url("${asset("src/assets/fonts/mono-400.woff2")}") format("woff2"); }
  :root { color-scheme: light; }
  html, body { margin: 0; }
  body {
    width: ${OG.width}px; height: ${OG.height}px; box-sizing: border-box;
    padding: 64px 72px; display: grid; grid-template-columns: 1fr 380px; gap: 64px;
    background: var(--paper); color: var(--ink); font-family: Inter; font-synthesis: none;
  }
  .left { display: flex; flex-direction: column; justify-content: space-between; }
  .who { display: flex; align-items: center; gap: 24px; }
  img { width: 104px; height: 104px; border-radius: 50%; }
  .name { font-size: 38px; font-weight: 600; letter-spacing: var(--track-44); line-height: 1.1; }
  .role { font-size: 24px; color: var(--graphite); margin-top: 6px; }
  h1 { margin: 0; font-size: 60px; font-weight: 600; letter-spacing: var(--track-68); line-height: 1.08; text-wrap: balance; }
  h1.case-name { font-size: 104px; letter-spacing: var(--track-68); line-height: 1; margin-top: 12px; }
  .kind { font-family: "JetBrains Mono"; font-size: 22px; color: var(--graphite); }
  .site { font-family: "JetBrains Mono"; font-size: 21px; color: var(--proof-text); }
  .right { display: flex; flex-direction: column; justify-content: center; gap: 28px; padding-left: 40px; border-left: 2px solid var(--rule); }
  .value { font-family: "JetBrains Mono"; font-size: 48px; color: var(--proof-text); line-height: 1; }
  .defect .value { color: var(--defect); }
  .caption { font-size: 19px; line-height: 1.35; color: var(--graphite); margin-top: 8px; text-wrap: pretty; }
  .value { white-space: nowrap; }
  .big .value { font-size: 80px; }
  .big .caption { font-size: 26px; margin-top: 16px; }
</style>
</head>
<body>
  <div class="left">${left}</div>
  <div class="right">${right}</div>
</body>
</html>`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = mkdtempSync(join(tmpdir(), "og-"));
  const browser = await chromium.launch();
  try {
    mkdirSync(fileURLToPath(new URL("public/og/", root)), { recursive: true });
    for (const image of ogImages()) {
      const html = join(dir, `${image.case?.slug ?? "home"}-${image.lang}.html`);
      writeFileSync(html, page(image));
      const tab = await browser.newPage({ viewport: { width: OG.width, height: OG.height }, deviceScaleFactor: 1, colorScheme: "light" });
      await tab.goto(pathToFileURL(html).href);
      await tab.evaluate(() => document.fonts.ready);
      // A face that failed to load would leave a fallback font in the image without an error.
      const missing = await tab.evaluate(() => [...document.fonts].filter((f) => f.status !== "loaded").map((f) => f.family));
      if (missing.length) throw new Error(`fonts not loaded: ${missing.join(", ")}`);
      await tab.screenshot({ path: fileURLToPath(new URL(image.file, root)), type: "png" });
      await tab.close();
      console.log(`${image.file}: ${OG.width}x${OG.height}`);
    }
    const png = Object.fromEntries(ogImages().map((i) => [i.file, pngHash(i.file)]));
    writeFileSync(RECORD, `${JSON.stringify({ inputs: inputsHash(), png }, null, 2)}\n`);
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true });
  }
}
