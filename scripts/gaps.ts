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
  // Content announced instead of shown: it stays off the page until it exists.
  [/(?<!\p{L})(?:à paraître|bientôt|prochainement|coming soon|forthcoming)(?!\p{L})[^<]*/giu, "announcement"],
];

/** A language label: the whole text of an element is a language code or name. */
const LANGUAGE_LABEL = /<([a-z][a-z0-9]*)\b([^>]*)>\s*(?:FR|EN|DE|IT|Français|English|Deutsch|Italiano)\s*<\/\1\s*>/g;
/** Any tag that names the language of the page it links to. */
const HREFLANG = /<[a-z][a-z0-9]*\b[^>]*\bhreflang=[^>]*>/gi;
const HREF = /\bhref="([^"]*)"/;

export interface Site {
  /** The production origin: absolute links to it are links to built pages. */
  site: string;
  /** Whether the build wrote this file, relative to the output directory (e.g. "en/index.html"). */
  built: (path: string) => boolean;
}

/** Whether `href` leads to a page of this build; links elsewhere are not language targets. */
function toBuiltPage(href: string, { site, built }: Site): boolean {
  const local = href.startsWith(site) ? href.slice(site.length) : href;
  if (!local.startsWith("/")) return false;
  const path = local.replace(/[?#].*$/, "").replace(/^\/+/, "");
  const candidates = path === "" || path.endsWith("/") ? [`${path}index.html`] : [path, `${path}.html`, `${path}/index.html`];
  return candidates.some(built);
}

/**
 * Each placeholder in `html`, as "<kind>: <matched text>". With `site`, language labels and
 * hreflang links must lead to a page of the build: a selector for a language that does not
 * exist announces content as much as « à paraître » does.
 */
export function gapsIn(html: string, site?: Site): string[] {
  // Code and comments are not page content: a TODO there is not shown to a reader. Their spans
  // are located and matches inside them skipped; the HTML itself is never rewritten.
  const code = [...html.matchAll(/<(script|style)\b[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->/gi)].map((m) => [m.index, m.index + m[0].length]);
  const inCode = (at: number) => code.some(([start, end]) => at >= start! && at < end!);
  const found = MARKERS.flatMap(([pattern, kind]) =>
    [...html.matchAll(pattern)].filter((m) => !inCode(m.index)).map((m) => `${kind}: ${m[0].trim()}`),
  );
  if (!site) return found;
  const leads = (tag: string) => toBuiltPage(HREF.exec(tag)?.[1] ?? "", site);
  const labels = [...html.matchAll(LANGUAGE_LABEL)];
  // A label that is also an hreflang link starts at the same tag: it is reported once, as a label.
  const labelAt = new Set(labels.map((m) => m.index));
  const languages = [
    ...labels.filter((m) => !(m[1] === "a" && leads(m[2]!))),
    ...[...html.matchAll(HREFLANG)].filter((m) => !labelAt.has(m.index) && !leads(m[0])),
  ].filter((m) => !inCode(m.index));
  return [...found, ...languages.map((m) => `language without a page: ${m[0].trim()}`)];
}

/** Astro integration: fails the build when a written page contains a placeholder. */
export function noGaps(): AstroIntegration {
  let site: string | undefined;
  return {
    name: "no-gaps",
    hooks: {
      "astro:config:done": ({ config }) => {
        site = config.site?.replace(/\/$/, "");
      },
      "astro:build:done": ({ dir }) => {
        if (!site) throw new Error("no-gaps: astro.config.mjs sets no site, so language links cannot be checked");
        const root = fileURLToPath(dir);
        const files = readdirSync(root, { recursive: true, encoding: "utf8" });
        const written = new Set(files);
        const options: Site = { site, built: (path) => written.has(path) };
        const found = files
          .filter((file) => file.endsWith(".html"))
          .flatMap((file) => gapsIn(readFileSync(join(root, file), "utf8"), options).map((gap) => `${file}: ${gap}`));
        if (found.length > 0) throw new Error(`placeholders on published pages:\n${found.join("\n")}`);
      },
    },
  };
}
