import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Every built HTML page as the URL path a browser requests: `index.html` maps to
 * its directory, any other file (e.g. `404.html`) keeps its name. Shared by the
 * axe tests and by site-measures, so both check the same set of pages.
 */
export function builtPages(dist = "dist"): string[] {
  const pages: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".html")) pages.push(urlPath(relative(dist, full).split(sep).join("/")));
    }
  };
  walk(dist);
  if (pages.length === 0) throw new Error(`no HTML page under ${dist}: run the build first`);
  return pages.sort();
}

/** `index.html` -> `/`, `en/index.html` -> `/en/`, `404.html` -> `/404.html`. */
export function urlPath(file: string): string {
  return `/${file}`.replace(/(^|\/)index\.html$/, "$1");
}
