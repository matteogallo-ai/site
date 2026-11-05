// A published page shows no placeholder: content without a source stays off the page until it
// has one. The build runs this over every page it writes and fails, listing each placeholder.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { GAP_DISPLAY } from "./measures-lib.ts";

const MARKERS: [RegExp, string][] = [
  [/class="(?:[^"]*\s)?gap(?:\s[^"]*)?"|data-gap(?=[\s=>])/g, "gap marker"],
  [/\b(?:Manquant|Missing)\s*:[^<]*/g, "placeholder text"],
  // Figure.astro's value span, whatever its other classes and attributes.
  [new RegExp(`class="value(?:\\s[^"]*)?"[^>]*>${GAP_DISPLAY}<`, "g"), "gap measure"],
  [/\b(?:TODO|TBD|FIXME)\b[^<]*/g, "placeholder text"],
];

/** Each placeholder in `html`, as "<kind>: <matched text>". */
export function gapsIn(html: string): string[] {
  // Code and comments are not page content: a TODO there is not shown to a reader.
  const content = html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, "");
  return MARKERS.flatMap(([pattern, kind]) => [...content.matchAll(pattern)].map((m) => `${kind}: ${m[0].trim()}`));
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
