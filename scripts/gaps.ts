// A published page shows no placeholder: content without a source stays off the page until it
// has one. The build runs this over every page it writes and fails on the first placeholder.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { GAP_DISPLAY } from "./measures-lib.ts";

const MARKERS: [RegExp, string][] = [
  [/class="(?:[^"]*\s)?gap(?:\s[^"]*)?"|data-gap\b/g, "gap marker"],
  [/\b(?:Manquant|Missing)\s*:[^<]*/g, "placeholder text"],
  [new RegExp(`class="value">${GAP_DISPLAY}<`, "g"), "gap measure"],
  [/\b(?:TODO|TBD|FIXME)\b[^<]*/g, "placeholder text"],
];

/** Each placeholder in `html`, as "<kind>: <matched text>". */
export function gapsIn(html: string): string[] {
  return MARKERS.flatMap(([pattern, kind]) => [...html.matchAll(pattern)].map((m) => `${kind}: ${m[0].trim()}`));
}

/** Astro integration: fails the build when a written page contains a placeholder. */
export function noGaps(): AstroIntegration {
  return {
    name: "no-gaps",
    hooks: {
      "astro:build:done": ({ dir }) => {
        const root = fileURLToPath(dir);
        const found = readdirSync(root, { recursive: true, encoding: "utf8" })
          .filter((file) => file.endsWith(".html"))
          .flatMap((file) => gapsIn(readFileSync(join(root, file), "utf8")).map((gap) => `${file}: ${gap}`));
        if (found.length > 0) throw new Error(`placeholders on published pages:\n${found.join("\n")}`);
      },
    },
  };
}
