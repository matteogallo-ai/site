// The sitemap lists the pages under src/pages, as the URLs their canonical links give
// (build.format "directory": /colophon/). The 404 page is not a page to index; a dynamic
// route has no single URL to list, so one fails here instead of being left out silently.

/** `./index.astro` -> `/`, `./projets/verity.astro` -> `/projets/verity/`; the 404 page -> undefined. */
export function route(file: string): string | undefined {
  const m = /^\.\/(.+)\.astro$/.exec(file);
  if (!m) throw new Error(`${file} is not a page file`);
  const path = m[1]!;
  if (path.includes("[")) throw new Error(`${file}: a dynamic route has no single URL for the sitemap`);
  if (path === "404") return undefined;
  if (path === "index") return "/";
  return `/${path.replace(/\/index$/, "")}/`;
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function sitemap(origin: string, files: string[]): string {
  const urls = files
    .map(route)
    .filter((p): p is string => p !== undefined)
    .sort()
    .map((p) => `  <url><loc>${escape(new URL(p, origin).href)}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export const robots = (origin: string) => `User-agent: *\nAllow: /\n\nSitemap: ${new URL("/sitemap.xml", origin).href}\n`;
