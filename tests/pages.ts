import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Every built page, as a URL path, so a new page is checked without editing a list. */
export function builtPages(dist = "dist"): string[] {
  const pages: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "index.html") {
        const rel = relative(dist, dir).split(sep).join("/");
        pages.push(rel === "" ? "/" : `/${rel}/`);
      }
    }
  };
  walk(dist);
  if (pages.length === 0) throw new Error(`no index.html under ${dist}: run the build first`);
  return pages.sort();
}
