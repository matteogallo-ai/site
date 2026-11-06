import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { type Block, firstListIn, type Span, textOf, toBlocks, passageError } from "./document.ts";

const read = (name: string) => JSON.parse(readFileSync(new URL(`../data/demo/${name}.json`, import.meta.url), "utf8"));
const sla: string = read("sla").text;
const answer = read("answer");
const refusal = read("refusal");

const spans = (blocks: Block[]): Span[] => blocks.flatMap((b) => (b.kind === "ul" ? b.items.flat() : b.spans));
const marked = (blocks: Block[], name: string) => spans(blocks).filter((s) => s.marks.includes(name)).map((s) => s.text);

test("every span keeps its source offset and drops only Markdown prefixes", () => {
  const blocks = toBlocks(sla);
  for (const s of spans(blocks)) assert.equal(sla.slice(s.start, s.start + s.text.length), s.text);
  assert.ok(!textOf(blocks).includes("## "));
  assert.deepEqual(blocks.map((b) => b.kind), ["h1", "p", "h2", "p", "h2", "p", "ul", "p", "h2", "p", "ul", "h2", "p"]);
});

test("the answer's cited quote is exactly the marked words", () => {
  const quote = answer.citations[0];
  const blocks = toBlocks(sla, [{ name: "answer", start: quote.char_start, end: quote.char_end }]);
  assert.equal(marked(blocks, "answer").join(""), quote.quote);
});

test("the refusal target is the priority list its closest passage offers", () => {
  const chunk = refusal.hits_used[0].chunk;
  const t = firstListIn(sla, chunk);
  assert.equal(
    sla.slice(t.start, t.end),
    "Priority 1 (critical, service unavailable): within one (1) hour.\n- Priority 2 (high, major feature impaired): within four (4) business hours.\n- Priority 3 (normal): within one (1) business day.",
  );
  const blocks = toBlocks(sla, [{ name: "refusal", ...t }]);
  assert.deepEqual(marked(blocks, "refusal"), [
    "Priority 1 (critical, service unavailable): within one (1) hour.",
    "Priority 2 (high, major feature impaired): within four (4) business hours.",
    "Priority 3 (normal): within one (1) business day.",
  ]);
});

test("overlapping targets split spans at every boundary and keep both marks", () => {
  const blocks = toBlocks("- abcdef", [
    { name: "a", start: 2, end: 6 },
    { name: "b", start: 4, end: 8 },
  ]);
  assert.deepEqual(spans(blocks), [
    { start: 2, text: "ab", marks: ["a"] },
    { start: 4, text: "cd", marks: ["a", "b"] },
    { start: 6, text: "ef", marks: ["b"] },
  ]);
});

test("a target outside the document is refused, and a passage without a list too", () => {
  assert.throws(() => toBlocks("abc", [{ name: "x", start: 2, end: 9 }]), RangeError);
  assert.throws(() => firstListIn("## Title\nNo list here.", { char_start: 0, char_end: 21 }), /no list/);
});

test("passageError: a translated passage is the contract's text at its offsets, with the same numbers", () => {
  const source = "Priority 1: within one (1) hour.";
  const at = { char_start: 0, char_end: source.length };
  assert.equal(passageError(source, { en: source, fr: "Priorité 1 : dans une (1) heure.", at }), undefined);
  assert.match(passageError(source, { en: "Priority 2", fr: "Priorité 2", at }) ?? "", /not the contract/);
  assert.match(passageError(source, { en: source, fr: "Priorité 1 : dans cinq (5) heures.", at }) ?? "", /numbers/);
});
