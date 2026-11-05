// @ts-check
import { defineConfig, fontProviders } from "astro/config";

/** @param {string} pkg @param {string} name */
const files = (pkg, name) => `./node_modules/@fontsource-variable/${pkg}/files/${name}`;

export default defineConfig({
  // Canonical production origin (SPEC §8); hreflang, Open Graph and the sitemap derive from it.
  site: "https://matteogallo.pages.dev",
  trailingSlash: "ignore",
  build: { format: "directory" },
  fonts: [
    {
      name: "Inter",
      cssVariable: "--font-sans",
      provider: fontProviders.local(),
      // The opsz axis is what gives the large headings their display optics (SPEC §4).
      options: {
        variants: [{ src: [files("inter", "inter-latin-opsz-normal.woff2")], weight: "100 900", style: "normal" }],
      },
      fallbacks: ["system-ui", "sans-serif"],
    },
    {
      name: "Source Serif 4",
      cssVariable: "--font-serif",
      provider: fontProviders.local(),
      options: {
        variants: [
          { src: [files("source-serif-4", "source-serif-4-latin-wght-normal.woff2")], weight: "200 900", style: "normal" },
          { src: [files("source-serif-4", "source-serif-4-latin-wght-italic.woff2")], weight: "200 900", style: "italic" },
        ],
      },
      fallbacks: ["Georgia", "serif"],
    },
    {
      name: "JetBrains Mono",
      cssVariable: "--font-mono",
      provider: fontProviders.local(),
      options: {
        variants: [
          { src: [files("jetbrains-mono", "jetbrains-mono-latin-wght-normal.woff2")], weight: "100 800", style: "normal" },
        ],
      },
      fallbacks: ["ui-monospace", "monospace"],
    },
  ],
});
