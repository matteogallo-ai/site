import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { type DemoDocument, type DemoTrace, type DemoTranslations, traceErrors, traceMatchesRun, translationErrors, uuid5Url } from "./traces-lib.ts";

const read = <T>(path: string) => JSON.parse(readFileSync(new URL(`../src/data/demo/${path}`, import.meta.url), "utf8")) as T;
const sla = read<DemoDocument>("sla.json");
const answer = read<DemoTrace>("answer.json");
const refusal = read<DemoTrace>("refusal.json");
const clone = <T>(x: T): T => structuredClone(x);

test("the committed demo traces select exactly their quoted words in the document", () => {
  assert.deepEqual(traceErrors(answer, sla), []);
  assert.deepEqual(traceErrors(refusal, sla), []);
  assert.equal(answer.refused, false);
  assert.equal(refusal.refused, true);
});

test("uuid5 matches the RFC 4122 URL-namespace vector and Verity's document ids", () => {
  assert.equal(uuid5Url("http://python.org/"), "4c565f0d-3f5a-5890-b41b-20cf47701c5e");
  assert.equal(uuid5Url("datasets/corpus/sla.md"), "e1acb2d6-45aa-5ee9-abc4-91428d0b1ed0");
});

test("a trace whose offsets miss the quote by one character is rejected", () => {
  const t = clone(answer);
  t.citations[0]!.char_start += 1;
  assert.ok(traceErrors(t, sla).some((e) => /quote is not document/.test(e)));
});

test("a document edited after its hash was recorded is rejected", () => {
  const d = clone(sla);
  d.text = d.text.replace("one (1) hour", "two (2) hours");
  assert.ok(traceErrors(answer, d).some((e) => /sha256/.test(e)));
});

test("a quote from another document is checked against its chunk", () => {
  const t = clone(answer);
  t.citations[1]!.quote = t.citations[1]!.quote.replace("twentyfour", "twenty-four");
  assert.ok(traceErrors(t, sla).some((e) => /of chunk/.test(e)));
});

test("a citation whose document is not its chunk's is rejected", () => {
  const t = clone(answer);
  t.citations[0]!.document_id = t.citations[1]!.document_id;
  assert.ok(traceErrors(t, sla).some((e) => /not its chunk's/.test(e)));
});

test("every document a trace refers to has its corpus path, checked by id", () => {
  const t = clone(answer);
  const [first] = Object.keys(t.documents);
  t.documents[first!] = "datasets/corpus/msa.md";
  assert.ok(traceErrors(t, sla).some((e) => /is not datasets\/corpus\/msa.md/.test(e)));
  delete t.documents[first!];
  assert.ok(traceErrors(t, sla).some((e) => /has no path/.test(e)));
});

test("a refusal carrying a citation is rejected", () => {
  const t = clone(refusal);
  t.citations = [clone(answer.citations[0]!)];
  assert.ok(traceErrors(t, sla).some((e) => /refusal carries no citation/.test(e)));
});

test("a trace must equal the run record it points to", () => {
  // A run rebuilt from the trace itself: the network check compares with the committed run.
  const record = Object.fromEntries(Object.entries(clone(answer)).filter(([k]) => !["source", "run", "documents"].includes(k)));
  const run = { ...answer.run, per_audit: [{}, {}, {}, {}, {}, record] };
  assert.deepEqual(traceMatchesRun(answer, run), []);
  const tampered = clone(run);
  (tampered.per_audit[5] as { answer_text: string }).answer_text = "Within two hours.";
  assert.ok(traceMatchesRun(answer, tampered).some((e) => /answer_text differs/.test(e)));
  assert.ok(traceMatchesRun(answer, { ...run, judge_model: "other" }).some((e) => /run.judge_model/.test(e)));
  assert.ok(traceMatchesRun({ ...answer, headline: "Cited in one hour" } as DemoTrace, run).some((e) => /unknown key headline/.test(e)));
});

const translations = read<DemoTranslations>("translations.json");

test("each French line translates the English the trace says", () => {
  assert.deepEqual(translationErrors(answer, translations), []);
  assert.deepEqual(translationErrors(refusal, translations), []);
});

test("a translation of an answer the trace no longer gives is rejected", () => {
  const t = clone(answer);
  t.answer_text += " Edited.";
  assert.deepEqual(translationErrors(t, translations), [`${t.example_id}: the answer translated is not the trace's answer`]);
  assert.deepEqual(translationErrors({ ...t, example_id: "q-999" }, translations), ["q-999: no translation"]);
});
