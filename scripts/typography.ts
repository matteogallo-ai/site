// Typography of the text as it ships, set by the build rather than by hand: a rule written once
// cannot be forgotten on the next sentence. French: a narrow no-break space (U+202F) before
// ; ! ? and %, a no-break space (U+00A0) before : and $ and inside « », curly apostrophes.
// English: curly quotes and apostrophes. Each element follows its own language (lang), so an
// English quote on a French page is set as English.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

const NBSP = "\u00A0";
const NNBSP = "\u202F";

/** Elements whose text is code or markup, never prose. */
const CODE = new Set(["code", "pre", "kbd", "samp", "textarea"]);
/** Elements that do not end a run of text: a quote opened before one closes after it. */
const INLINE = new Set(["a", "abbr", "b", "bdi", "cite", "code", "data", "em", "i", "kbd", "mark", "q", "s", "samp", "small", "span", "strong", "sub", "sup", "time", "u", "wbr", "tspan"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
/** Attributes written for people: read aloud, shown as a tooltip or in a link preview. */
const READ_ATTRIBUTES = new Set(["alt", "title", "aria-label", "aria-description", "placeholder", "data-copied", "data-failed"]);
const READ_META = /^(?:description|og:title|og:description|og:image:alt|twitter:title|twitter:description|twitter:image:alt)$/;

interface Context {
  tag: string;
  lang: string;
  /** Code or a verbatim quote: its text ships exactly as written. */
  skip: boolean;
  /** Set in the monospace face, whose subset has no U+202F and no curly quotes. */
  mono: boolean;
}

// Entities other than the quotes and the no-break space, and URLs written in the text, hold
// characters the rules must not see as punctuation ("&amp;" ends in ";", "?a=1" is a query): they
// travel as private-use characters and come back unchanged. A text that already holds one would
// be rewritten by mistake, so it fails the build instead.
function protect(text: string): { text: string; restore: (s: string) => string } {
  if (/[\uE000-\uF8FF]/.test(text)) throw new Error(`typography: private-use character in ${JSON.stringify(text.slice(0, 80))}`);
  const kept: string[] = [];
  const keep = (s: string) => {
    kept.push(s);
    return String.fromCharCode(0xe000 + kept.length - 1);
  };
  const decoded = text
    .replace(/\bhttps?:\/\/[^\s<]+/g, keep)
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (entity, body: string) => {
      const hex = body[1]?.toLowerCase() === "x";
      const code = body[0] === "#" ? Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10) : undefined;
      const named: Record<string, string> = { quot: '"', apos: "'", nbsp: NBSP };
      const valid = code !== undefined && code > 0 && code <= 0x10ffff && ![38, 60, 62].includes(code);
      const char = valid ? String.fromCodePoint(code) : code === undefined ? named[body.toLowerCase()] : undefined;
      return char ?? keep(entity);
    });
  return { text: decoded, restore: (s) => s.replace(/[\uE000-\uF8FF]/g, (c) => kept[c.charCodeAt(0) - 0xe000] ?? c) };
}

/** French rules on `text`, `before` being the character that precedes it on the page. */
export function french(text: string, before: string, mono: boolean): string {
  const narrow = mono ? NBSP : NNBSP;
  let s = before + text;
  if (!mono) s = s.replace(/'/g, "’");
  s = s
    .replace(/([^\s;!?\u00A0\u202F])[ \u00A0\u202F]*([;!?])/g, `$1${narrow}$2`)
    .replace(/[ \u00A0\u202F]+([;!?])/g, `${narrow}$1`)
    .replace(/[ \u00A0\u202F]+:/g, `${NBSP}:`)
    .replace(/([\p{L})»]):(?=\s)/gu, `$1${NBSP}:`)
    .replace(/(\d)[ \u00A0\u202F]?%/g, `$1${narrow}%`)
    .replace(/(\d)[ \u00A0\u202F]?\$/g, `$1${NBSP}$`)
    .replace(/«[ \u00A0\u202F]*/g, `«${NBSP}`)
    .replace(/(?<=\S)[ \u00A0\u202F]*»/g, `${NBSP}»`);
  return s.slice(before.length);
}

/** English rules on `text`, `before` being the character that precedes it on the page. */
export function english(text: string, before: string, mono: boolean): string {
  if (mono) return text;
  const chars = [...before + text];
  for (let i = before.length; i < chars.length; i++) {
    const prev = chars[i - 1] ?? " ";
    const opens = /[\s([{“‘—–]/u.test(prev);
    if (chars[i] === '"') chars[i] = opens ? "“" : "”";
    else if (chars[i] === "'") chars[i] = opens ? "‘" : "’";
  }
  return chars.slice([...before].length).join("");
}

function set(text: string, lang: string, before: string, mono: boolean): string {
  if (lang.startsWith("fr")) return french(text, before, mono);
  if (lang.startsWith("en")) return english(text, before, mono);
  return text;
}

const attribute = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

function setAttributes(tag: string, name: string, lang: string): string {
  const meta = name === "meta" && READ_META.test(attribute(tag, "name") ?? attribute(tag, "property") ?? "");
  return tag.replace(/(\s)([a-zA-Z][\w:-]*)="([^"]*)"/g, (whole, space: string, key: string, value: string) => {
    if (!READ_ATTRIBUTES.has(key) && !(meta && key === "content")) return whole;
    const { text, restore } = protect(value);
    const out = restore(set(text, lang, " ", false)).replace(/"/g, "&quot;");
    return `${space}${key}="${out}"`;
  });
}

/** `html` with the typography of each element's language applied to its text and read attributes. */
export function typeset(html: string): string {
  const stack: Context[] = [];
  let prev = " ";
  const tokens = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<!DOCTYPE[^>]*>|<\/?[a-zA-Z](?:[^>"]|"[^"]*")*>|[^<]+/gi;
  return html.replace(tokens, (token) => {
    const top = stack.at(-1);
    if (token[0] !== "<") {
      const { text, restore } = protect(token);
      const out = top && !top.skip ? set(text, top.lang, prev, top.mono) : text;
      prev = text.at(-1) ?? prev;
      return restore(out);
    }
    if (token.startsWith("<!") || /^<(script|style)\b/i.test(token)) return token;
    const name = /^<\/?([a-zA-Z][\w-]*)/.exec(token)![1]!.toLowerCase();
    if (!INLINE.has(name)) prev = " ";
    if (token[1] === "/") {
      const at = stack.findLastIndex((c) => c.tag === name);
      if (at >= 0) stack.length = at;
      return token;
    }
    const lang = attribute(token, "lang") ?? top?.lang ?? "";
    const cls = attribute(token, "class") ?? "";
    const context: Context = {
      tag: name,
      lang,
      skip: (top?.skip ?? false) || CODE.has(name) || /\sdata-verbatim(?=[\s=>/])/.test(token),
      mono: (top?.mono ?? false) || /(?:^|\s)mono(?:\s|$)/.test(cls),
    };
    if (!VOID.has(name) && !token.endsWith("/>")) stack.push(context);
    return setAttributes(token, name, lang);
  });
}

/**
 * `text` with the characters this module sets turned back into keyboard ones: compares what a
 * page shows with the source string it was built from.
 */
export function plain(text: string): string {
  return text.replace(/[\u00A0\u202F]/g, " ").replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
}

/** Typesets every page the build wrote. */
export function typography(): AstroIntegration {
  return {
    name: "typography",
    hooks: {
      "astro:build:done": ({ dir }) => {
        const root = fileURLToPath(dir);
        for (const file of readdirSync(root, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".html"))) {
          const path = join(root, file);
          writeFileSync(path, typeset(readFileSync(path, "utf8")));
        }
      },
    },
  };
}
