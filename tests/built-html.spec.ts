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
