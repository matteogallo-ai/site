import { alternates } from "./i18n.ts";

// The sitemap lists the pages under src/pages, as the URLs their canonical links give
// (build.format "directory": /colophon/). The 404 page is not a page to index; a dynamic
// route has no single URL to list, so one fails here instead of being left out silently.

/** `./index.astro` -> `/`, `./projets/verity.astro` -> `/projets/verity/`; a 404 page -> undefined. */
export function route(file: string): string | undefined {
  const m = /^\.\/(.+)\.astro$/.exec(file);
  if (!m) throw new Error(`${file} is not a page file`);
  const path = m[1]!;
  if (path.includes("[")) throw new Error(`${file}: a dynamic route has no single URL for the sitemap`);
  if (path === "404" || path.endsWith("/404")) return undefined;
  if (path === "index") return "/";
  return `/${path.replace(/\/index$/, "")}/`;
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function sitemap(origin: string, files: string[]): string {
  const urls = files
    .map(route)
    .filter((p): p is string => p !== undefined)
    .sort()
    .map((p) => {
      const href = (path: string) => escape(new URL(path, origin).href);
      const links = alternates(p).map((a) => `<xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${href(a.path)}"/>`);
      return `  <url><loc>${href(p)}</loc>${links.join("")}</url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
}

export const robots = (origin: string) => `User-agent: *\nAllow: /\n\nSitemap: ${new URL("/sitemap.xml", origin).href}\n`;
