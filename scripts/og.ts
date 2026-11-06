// Writes the Open Graph images (1200x630), public/og.png and public/og-en.png: each home page's
// headline and the portrait, set with the site's own font subsets and colour tokens. Rendered by Chromium
// through Playwright, so the type is the type of the site. The PNG is committed: browsers render
// text a little differently across platforms, so CI cannot compare pixels. It compares inputs:
// src/data/og.json records a hash of everything the images are drawn from and each PNG's own hash,
// and og.test.ts fails when either no longer matches, i.e. when `npm run og` was not re-run.
// tests/seo.spec.ts checks that the words drawn are those of the home page in the same language.
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import config from "../astro.config.mjs";
import type { Lang } from "../src/lib/i18n.ts";
import { OG } from "../src/lib/og.ts";

const root = new URL("../", import.meta.url);
const asset = (path: string) => new URL(path, root).href;
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const INPUTS = ["scripts/og.ts", "src/styles/tokens.css", "src/assets/fonts/inter-wght.woff2", "src/assets/fonts/mono-400.woff2", "src/assets/matteo.jpg"];
export const RECORD = new URL("src/data/og.json", root);

/** One hash over what the image is drawn from: this script, the words, the host, tokens, fonts, portrait. */
export function inputsHash(): string {
  const parts = [JSON.stringify(OG), new URL(config.site!).host, ...INPUTS.map((f) => sha256(readFileSync(new URL(f, root))))];
  return sha256(parts.join("\n"));
}

export const pngHash = (lang: Lang) => sha256(readFileSync(new URL(OG[lang].file, root)));

function page(lang: Lang): string {
  const portrait = `data:image/jpeg;base64,${readFileSync(new URL("src/assets/matteo.jpg", root)).toString("base64")}`;
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
    padding: 72px 80px; display: flex; flex-direction: column; justify-content: space-between;
    background: var(--paper); color: var(--ink); font-family: Inter; font-synthesis: none;
    /* The site's dotted vertical rules (SPEC §4), on the grid's outer columns. */
    background-image: linear-gradient(var(--rule) 50%, transparent 0), linear-gradient(var(--rule) 50%, transparent 0);
    background-size: 1px 6px; background-repeat: repeat-y; background-position: 40px 0, ${OG.width - 41}px 0;
  }
  .who { display: flex; align-items: center; gap: 28px; }
  img { width: 128px; height: 128px; border-radius: 50%; }
  .name { font-size: 44px; font-weight: 600; letter-spacing: var(--track-44); line-height: 1.1; }
  .role { font-size: 28px; color: var(--graphite); margin-top: 6px; }
  h1 { margin: 0; font-size: 68px; font-weight: 600; letter-spacing: var(--track-68); line-height: 1.08; max-width: 980px; text-wrap: balance; }
  .site { font-family: "JetBrains Mono"; font-size: 21px; color: var(--proof-text); }
</style>
</head>
<body>
  <div class="who"><img src="${portrait}" alt=""><div><div class="name">${escape(OG.name)}</div><div class="role">${escape(OG.role)}</div></div></div>
  <h1>${escape(OG[lang].headline)}</h1>
  <div class="site">${escape(new URL(config.site!).host)}</div>
</body>
</html>`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = mkdtempSync(join(tmpdir(), "og-"));
  const browser = await chromium.launch();
  try {
    for (const lang of ["fr", "en"] as const) {
      const html = join(dir, `og-${lang}.html`);
      writeFileSync(html, page(lang));
      const tab = await browser.newPage({ viewport: { width: OG.width, height: OG.height }, deviceScaleFactor: 1, colorScheme: "light" });
      await tab.goto(pathToFileURL(html).href);
      await tab.evaluate(() => document.fonts.ready);
      // A face that failed to load would leave a fallback font in the image without an error.
      const missing = await tab.evaluate(() => [...document.fonts].filter((f) => f.status !== "loaded").map((f) => f.family));
      if (missing.length) throw new Error(`fonts not loaded: ${missing.join(", ")}`);
      await tab.screenshot({ path: fileURLToPath(new URL(OG[lang].file, root)), type: "png" });
      console.log(`${OG[lang].file}: ${OG.width}x${OG.height}`);
    }
    writeFileSync(RECORD, `${JSON.stringify({ inputs: inputsHash(), png: { fr: pngHash("fr"), en: pngHash("en") } }, null, 2)}\n`);
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true });
  }
}
