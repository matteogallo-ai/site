// Rules read on the HTML the build wrote, before any browser renders it: what the compressor or a
// template did to the text is visible here exactly as it ships.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { builtFiles } from "../scripts/built-pages.ts";

const files = builtFiles();
const html = (file: string) => readFileSync(`dist/${file}`, "utf8");

/** Each match of `pattern` in `text`, with a little context, for a readable failure. */
function around(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(new RegExp(pattern, `${pattern.flags.replace("g", "")}g`))].map((m) => text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30));
}

for (const file of files) {
  // Astro's compressor drops a line break written right before an inline element, so a word
  // and the code that follows it render glued together ("Tests<code>bun test</code>").
  test(`${file}: no word is glued to inline code`, () => {
    const text = html(file);
    expect([...around(text, /[\p{L}\p{N},.;:]<code[\s>]/u), ...around(text, /<\/code>[\p{L}\p{N}]/u)]).toEqual([]);
  });
}

// The demo's second quote ("Premium Support shortens…") sits in section 5 of the order form, in a
// chunk that starts in section 3: the card names the section that holds the quote.
for (const [file, label] of [["index.html", "bon de commande Northwind (section 5)"], ["en/index.html", "Northwind order form (section 5)"]] as const) {
  test(`${file}: the demo places each quote in the section that holds it`, () => {
    expect(html(file)).toContain(label);
  });
}

// The description of a diagram is read aloud in place of the drawing: sentences, not the drawn
// lines joined end to end ("Versions, does it, break the, caller?").
test("the built pages hold diagram descriptions and English quotes: the rules below have something to read", () => {
  expect(files.reduce((n, f) => n + (html(f).match(/<desc[^>]*>/g)?.length ?? 0), 0)).toBeGreaterThanOrEqual(6);
  expect(files.filter((f) => !f.startsWith("en/")).reduce((n, f) => n + (html(f).match(/<blockquote[^>]*lang="en"/g)?.length ?? 0), 0)).toBeGreaterThanOrEqual(2);
});

for (const file of files) {
  test(`${file}: every diagram description is written in sentences`, () => {
    for (const [, desc] of html(file).matchAll(/<desc[^>]*>([^<]*)<\/desc>/g)) {
      expect(desc, desc).not.toMatch(/,\s*,|,\s*$|[,;:]\s*[.?!]/);
      expect(desc, desc).toMatch(/[.?!]$/);
    }
  });
}

// C4: the invention figure in Verity's brief names its scope: every answer given, whether the
// question has an answer or not, so no invention falls outside the figure by definition.
for (const [file, scope] of [
  ["projets/verity/index.html", "sur toutes les réponses données, que la question ait une réponse ou non"],
  ["en/projects/verity/index.html", "over every answer given, whether the question has an answer or not"],
] as const) {
  test(`${file}: the brief gives the hallucination figure its scope`, () => {
    const brief = /<section class="brief"[\s\S]*?<\/section>/.exec(html(file))![0];
    expect(brief).toContain(scope);
  });
}

// C6: on a French page an English quote carries its translation, as in the demo.
for (const file of files.filter((f) => !f.startsWith("en/"))) {
  test(`${file}: every English quote has a French translation`, () => {
    for (const [quote] of html(file).matchAll(/<blockquote[^>]*lang="en"[^>]*>[\s\S]*?<\/blockquote>/g)) {
      expect(quote, quote.slice(0, 120)).toMatch(/class="tr"[^>]*lang="fr"|lang="fr"[^>]*class="tr"/);
    }
  });
}

// D1: English that reads as a word-for-word French calque, on any English page (text, alt, meta).
const CALQUES = [
  /\bmeasures\b(?! whether)/i, // the noun « mesures »: results, measurements or metrics; the verb stays
  /\bMeasure\s*<\/th>/, // a table column headed « Mesure »
  /refuses? rightly/, // « à raison »: correctly
  /technician training/, // « formation professionnelle d’automaticien »: vocational training as an automation technician
  /\bWrite (to me|an e-mail)\b/,
  /\banalysis note|\bnotes?\b(?![^<]*<\/code>)/, // Praxis delivers briefings
  /\bFrame of\b/, // « Image de l’enregistrement »: a still
  /told apart from chance|counted apart\b/,
  /programming interface \(API\)/,
  /point of comparison|test bench/, // « point de comparaison », « banc de test »: baseline, test harness
];
const VOID = /^<(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)\b/i;

/**
 * What a reader or a link preview shows on a built page: the text, and the attributes written for
 * people. Read token by token, scripts and styles skipped whole, rather than by deleting markup.
 * An element whose opening tag matches `skip` is left out with everything inside it; a </th> is
 * kept as a marker.
 */
function readerText(file: string, skip: RegExp): string {
  const parts: string[] = [];
  const open: boolean[] = [];
  for (const [token] of html(file).matchAll(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>]*>|[^<]+/gi)) {
    const skipped = open.includes(true);
    if (token[0] !== "<") {
      if (!skipped) parts.push(token);
      continue;
    }
    if (/^<(script|style)\b/i.test(token) || token.startsWith("<!")) continue;
    if (token[1] === "/") {
      open.pop();
      if (token === "</th>" && !skipped) parts.push(token);
    } else {
      if (!skipped) parts.push(...[...token.matchAll(/\b(?:alt|content|aria-label|title)="([^"]*)"/g)].map((m) => `\n${m[1]}\n`));
      if (!VOID.test(token) && !token.endsWith("/>")) open.push(skip.test(token));
    }
    parts.push(" ");
  }
  return parts.join("");
}

for (const file of files.filter((f) => f.startsWith("en/"))) {
  test(`${file}: no French calque in the English`, () => {
    expect(CALQUES.flatMap((c) => around(readerText(file, /\blang="fr"/), c))).toEqual([]);
  });
}

// The French pages say in French what a French reader would otherwise have to translate: Git and
// English jargon (« mergé », « commité », « run », « business », « live ») and calques of English
// (« support d’éditeur », « l’exerce »). Code and text marked lang="en" keep their own words.
const ANGLICISMS = [/\b(?:mergée?s?|commitée?s?|business|runs?|baseline)\b/i, /\bbriefings? live\b/i, /support d.éditeur/i, /\bl.exerce\b/i];
for (const file of files.filter((f) => !f.startsWith("en/"))) {
  test(`${file}: no English jargon in the French`, () => {
    const text = readerText(file, /\blang="en"|^<code\b|\bclass="[^"]*\bmono\b/);
    expect(ANGLICISMS.flatMap((a) => around(text, a))).toEqual([]);
  });
}

// M9: PromptLang's "not supported" list names the eval blocks, which are read and not run; the
// test blocks are run (promptlang/docs/CLAIMS.md, "Native tests").
for (const [file, line] of [
  ["projets/promptlang/index.html", /Exécuter les blocs <code>eval<\/code>\s*:\s*ils sont lus, pas exécutés\./],
  ["en/projects/promptlang/index.html", /Running the <code>eval<\/code> blocks: they are read, not run\./],
] as const) {
  test(`${file}: the eval blocks, not the tests, are the ones not run`, () => {
    expect(html(file)).toMatch(line);
    expect(html(file)).not.toMatch(/tests écrits dans les fichiers de prompt|tests written in the prompt files/);
  });
}

// Cloudflare's e-mail obfuscation rewrites every address it finds into a link that works only
// with its script; it leaves alone what sits between email_off comments, so the address and the
// mailto links read the same with or without JavaScript, whatever the zone setting.
for (const file of files) {
  test(`${file}: every e-mail address sits inside email_off`, () => {
    const outside = html(file).replace(/<!--email_off-->[\s\S]*?<!--\/email_off-->/g, "");
    expect(around(outside, /matteogallo\.office@/)).toEqual([]);
  });
}

// M1: the French 404 names the role in French.
test("404.html: the role reads in French", () => {
  expect(html("404.html")).toContain("Matteo Gallo · Ingénieur logiciel &amp; IA");
  expect(html("404.html")).not.toContain("Software &amp; AI Engineer");
});

// D4: the English refusal rationale is the trace's own text, internal reference included; a short
// label says so and what the reference points to.
test("en/index.html: the refusal rationale is labelled as quoted from the run", () => {
  expect(html("en/index.html")).toMatch(/<p class="why"[^>]*><span class="why-k"[^>]*>the model’s words, as recorded; document index 0 is the SLA<\/span> <span data-verbatim[^>]*>The SLA section \(document index 0\)/);
});

/**
 * The prose of a built page in one language: code, scripts, monospace, verbatim quotes of a run
 * and elements in the other language left out.
 */
function prose(page: string, lang: "fr" | "en"): string {
  const out: string[] = [];
  const stack: { tag: string; keep: boolean }[] = [];
  for (const [token] of page.matchAll(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/?[a-zA-Z][^>]*>|[^<]+/gi)) {
    if (token[0] !== "<") {
      if (stack.at(-1)?.keep) out.push(token.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
      continue;
    }
    const name = /^<\/?([a-zA-Z][\w-]*)/.exec(token)?.[1]?.toLowerCase();
    if (!name || /^<(script|style)\b/i.test(token)) continue;
    if (token[1] === "/") {
      const at = stack.findLastIndex((c) => c.tag === name);
      if (at >= 0) stack.length = at;
      continue;
    }
    if (/^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/.test(name) || token.endsWith("/>")) continue;
    const own = /\slang="([a-z]+)/.exec(token)?.[1];
    const parent = stack.at(-1);
    const keep = (parent ? parent.keep || (own === lang && name !== "html") : own === lang) && !/^(code|pre|kbd|samp)$/.test(name) && !/\sdata-verbatim/.test(token) && !/class="[^"]*\bmono\b/.test(token) && (own === undefined || own === lang);
    stack.push({ tag: name, keep });
  }
  return out.join("");
}

// D2: French typography, set by the build on every French page.
for (const file of files.filter((f) => !f.startsWith("en/"))) {
  test(`${file}: French typography`, () => {
    const text = prose(html(file), "fr");
    expect(text.length).toBeGreaterThan(20);
    expect(around(text, /[ \u00A0]+[;!?%]|(?<=[\p{L}\d])[;!?](?=\s)/u), "U+202F before ; ! ? %").toEqual([]);
    expect(around(text, /(?:[ \u202F]|(?<=[\p{L})»])):(?=\s)/u), "U+00A0 before :").toEqual([]);
    expect(around(text, /«(?!\u00A0)|(?<!\u00A0)»/), "U+00A0 inside « »").toEqual([]);
    expect(around(text, /'/), "curly apostrophes").toEqual([]);
    expect(around(text, /\d[ \u202F]?\$/), "U+00A0 before $").toEqual([]);
    // The number of a project is set in monospace, which prose() leaves out: read on the whole page.
    expect(around(html(file), /\bNo\.(?:\s|&nbsp;)?\d/u), "N° 01").toEqual([]);
    expect(around(text, /\d\s?%\s?[–-]\s?\d/), "ranges: 18–46 %").toEqual([]);
    // After a colon, French goes on in lower case (« Ce que je cherche : un poste »), names aside.
    expect(around(text, /Ce que je cherche\s?:\s?\p{Lu}/u)).toEqual([]);
  });
}

// D3: English typography, set by the build on every English page.
for (const file of files.filter((f) => f.startsWith("en/"))) {
  test(`${file}: English typography`, () => {
    const text = prose(html(file), "en");
    expect(text.length).toBeGreaterThan(20);
    expect(around(text, /['"]/), "curly quotes and apostrophes").toEqual([]);
    expect(around(text, /\d%\s?[–-]\s?\d/), "ranges: 18–46%").toEqual([]);
  });
}
