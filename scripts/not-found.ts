// Cloudflare Pages answers an unknown address with the nearest 404.html up the directory tree,
// so the English 404 must be en/404.html. With build.format "directory" Astro writes only the root
// 404 page as a file and every other one as <dir>/404/index.html: this integration moves those.
import { readdirSync, renameSync, rmdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

/** Where a nested 404 page belongs (`en/404/index.html` -> `en/404.html`); any other file stays. */
export function notFoundFile(file: string): string | undefined {
  const m = /^(.+)\/404\/index\.html$/.exec(file);
  return m ? `${m[1]}/404.html` : undefined;
}

export function nestedNotFound(): AstroIntegration {
  return {
    name: "nested-not-found",
    hooks: {
      "astro:build:done": ({ dir }) => {
        const root = fileURLToPath(dir);
        for (const file of readdirSync(root, { recursive: true, encoding: "utf8" })) {
          const target = notFoundFile(file.split("\\").join("/"));
          if (!target) continue;
          renameSync(join(root, file), join(root, target));
          rmdirSync(dirname(join(root, file)));
        }
      },
    },
  };
}
