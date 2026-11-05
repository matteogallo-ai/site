// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import { noGaps } from "./scripts/gaps.ts";

// Subsets built by scripts/fonts/subset.py from pinned upstream releases (see coverage.json for the characters).
const font = (/** @type {string} */ name) => `./src/assets/fonts/${name}`;

export default defineConfig({
  // Canonical production origin (SPEC §8); hreflang, Open Graph and the sitemap derive from it.
  site: "https://matteogallo.pages.dev",
  trailingSlash: "ignore",
  build: { format: "directory" },
  integrations: [noGaps()],
  fonts: [
    {
      name: "Inter",
      cssVariable: "--font-sans",
      provider: fontProviders.local(),
      options: { variants: [{ src: [font("inter-wght.woff2")], weight: "400 700", style: "normal" }] },
      fallbacks: ["system-ui", "sans-serif"],
    },
    {
      // Not "Source Serif 4": the subset is a modified font, and "Source" is a Reserved Font Name (OFL).
      name: "Site Serif",
      cssVariable: "--font-serif",
      provider: fontProviders.local(),
      options: {
        variants: [
          { src: [font("serif-400.woff2")], weight: "400", style: "normal" },
          { src: [font("serif-600.woff2")], weight: "600", style: "normal" },
        ],
      },
      fallbacks: ["Georgia", "serif"],
    },
    {
      name: "JetBrains Mono",
      cssVariable: "--font-mono",
      provider: fontProviders.local(),
      options: { variants: [{ src: [font("mono-400.woff2")], weight: "400", style: "normal" }] },
      fallbacks: ["ui-monospace", "monospace"],
    },
  ],
});
