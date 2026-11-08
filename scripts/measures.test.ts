import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  evidenceError,
  GAP_DISPLAY,
  type GapMeasure,
  type ListingEvidence,
  listingError,
  type MeasuresFile,
  measuresErrors,
  rawUrl,
  resolvePointer,
  type VerifiedMeasure,
} from "./measures-lib.ts";

const measures = JSON.parse(readFileSync(new URL("../src/data/measures.json", import.meta.url), "utf8")) as MeasuresFile;

test("the committed measures meet every structural rule", () => {
  assert.deepEqual(measuresErrors(measures), []);
});

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const base = (): VerifiedMeasure => ({
  id: "x.ratio",
  label: { fr: "Ratio", en: "Ratio" },
  display: { fr: "3/4", en: "3/4" },
  value: 0.75,
  k: 3,
  n: 4,
  ci95: [0.3, 0.95],
  repo: "matteogallo-ai/x",
  commit: COMMIT,
  path: "a.json",
  url: `https://github.com/matteogallo-ai/x/blob/${COMMIT}/a.json`,
  evidence: [
    { pointer: "/k", equals: 3, binds: "k" },
    { pointer: "/n", equals: 4, binds: "n" },
    { pointer: "/ci", equals: [0.3, 0.95], binds: "ci95" },
    { pointer: "/arms/n_completed", equals: 7 },
  ],
  status: "verified",
});
const errorsOf = (m: VerifiedMeasure | GapMeasure) => measuresErrors({ schema: "site.measures/v1", measures: [m] });

test("a well-formed measure passes", () => {
  assert.deepEqual(errorsOf(base()), []);
});

test("each structural defect is reported", () => {
  const cases: [string, (m: VerifiedMeasure) => void, RegExp][] = [
    ["url not derived from repo, commit and path", (m) => (m.url = m.url.replace("a.json", "b.json")), /url must be/],
    ["abbreviated commit", (m) => (m.commit = "0123456"), /40-hex/],
    ["repo of another owner", (m) => (m.repo = "someone/x"), /not under/],
    ["path escaping the repo", (m) => (m.path = "../a.json"), /repo-relative/],
    ["value that is not k/n", (m) => (m.value = 0.8), /not k\/n/],
    ["k greater than n", (m) => (m.k = 5), /0 <= k <= n/],
    ["interval not containing the value", (m) => (m.ci95 = [0.8, 0.9]), /does not contain/],
    ["verified without evidence", (m) => (m.evidence = []), /needs evidence/],
    ["empty English label", (m) => (m.label.en = " "), /label.en/],
    ["k bound by no evidence", (m) => (m.evidence = m.evidence.filter((e) => !("binds" in e && e.binds === "k"))), /k bound by no evidence/],
    // The number exists in another evidence item: binding by value alone accepted it.
    ["n equal to an unrelated evidence value", (m) => ((m.n = 7), (m.value = 3 / 7), delete m.ci95), /binds n but states 4, not 7/],
    ["interval differing from its evidence", (m) => (m.ci95 = [0.31, 0.95]), /binds ci95/],
    ["display not equal to the figures", (m) => (m.display.en = "19/20"), /display.en shows 19/],
    ["display rounded differently from the value", (m) => ((m.display.fr = "0,76"), (m.display.en = "0.76")), /shows 0.76/],
    ["label number stated by no evidence", (m) => (m.label.en = "Ratio (60 claims)"), /label.en says 60/],
  ];
  for (const [name, mutate, expected] of cases) {
    const m = base();
    mutate(m);
    const errors = errorsOf(m);
    assert.ok(errors.some((e) => expected.test(e)), `${name}: ${JSON.stringify(errors)}`);
  }
});

test("a figure stated by no evidence passes only with a derivation", () => {
  const m = base();
  delete m.k;
  delete m.n;
  delete m.ci95;
  m.value = 6;
  m.display = { fr: "6/6", en: "6/6" };
  m.evidence = [{ contains: "six" }];
  assert.ok(errorsOf(m).some((e) => /value bound by no evidence/.test(e)));
  m.derived = "Count of the six files.";
  assert.deepEqual(errorsOf(m), []);
});

test("a number in a label passes when an evidence item states it, and a display at its precision", () => {
  const m = base();
  m.label.en = "Ratio (7 runs)";
  m.display = { fr: "0,75 · 3/4", en: "0.75 · 3/4" };
  assert.deepEqual(errorsOf(m), []);
});

const gap = (): GapMeasure => ({ id: "x.gap", label: { fr: "Écart", en: "Gap" }, display: { fr: GAP_DISPLAY, en: GAP_DISPLAY }, repo: "matteogallo-ai/x", value: null, status: "gap", note: "No artefact states it." });

test("a gap passes without a source and is refused any figure", () => {
  assert.deepEqual(errorsOf(gap()), []);
  const cases: [string, (g: GapMeasure & Record<string, unknown>) => void, RegExp][] = [
    ["a value", (g) => (g.value = 0.85 as unknown as null), /value null/],
    ["k and n", (g) => ((g.k = 17), (g.n = 20)), /no k/],
    ["an interval", (g) => (g.ci95 = [0.6, 0.9]), /no ci95/],
    ["a figure in display", (g) => (g.display = { fr: "17/20", en: "17/20" }), /displays/],
    ["no note", (g) => delete g.note, /says what is missing/],
  ];
  for (const [name, mutate, expected] of cases) {
    const g = gap() as GapMeasure & Record<string, unknown>;
    mutate(g);
    assert.ok(errorsOf(g).some((e) => expected.test(e)), `${name}: ${JSON.stringify(errorsOf(g))}`);
  }
});

test("duplicate ids are reported", () => {
  assert.ok(measuresErrors({ schema: "site.measures/v1", measures: [base(), base()] }).some((e) => /duplicate/.test(e)));
});

test("evidence is checked against the file text", () => {
  const file = JSON.stringify({ a: { "b/c": [1, { "~d": 0.5 }] }, notes: ["upper bound"] });
  assert.equal(evidenceError(file, { pointer: "/a/b~1c/1/~0d", equals: 0.5 }), null);
  assert.equal(evidenceError(file, { pointer: "/notes", equals: ["upper bound"] }), null);
  assert.match(evidenceError(file, { pointer: "/a/b~1c/0", equals: 2 }) ?? "", /is 1, expected 2/);
  assert.match(evidenceError(file, { pointer: "/missing", equals: 0 }) ?? "", /is undefined/);
  assert.equal(evidenceError("Every one is flagged", { contains: "is flagged" }), null);
  assert.match(evidenceError("text", { contains: "absent" }) ?? "", /not found/);
  assert.match(evidenceError("not json", { pointer: "/a", equals: 1 }) ?? "", /not JSON/);
});

test("a pointer never reads inherited properties nor non-index array keys", () => {
  assert.equal(resolvePointer({}, "/constructor"), undefined);
  assert.equal(resolvePointer([1, 2], "/length"), undefined);
  assert.equal(resolvePointer([1, 2], "/01"), undefined);
});

test("raw URLs are pinned to the commit and escape path segments", () => {
  assert.equal(rawUrl({ repo: "matteogallo-ai/x", commit: COMMIT }, "a b/c#d.json"), `https://raw.githubusercontent.com/matteogallo-ai/x/${COMMIT}/a%20b/c%23d.json`);
});

const listing = (): ListingEvidence => ({
  listing: "runs",
  matching: "^[^/]+/run-[^/]+/metadata\\.json$",
  files: ["q1/run-a/metadata.json", "q2/run-b/metadata.json"],
  pointer: "/flagged",
  each: true,
  binds: ["k", "n"],
});
const counted = (e: ListingEvidence): VerifiedMeasure => ({ ...base(), display: { fr: "2/2", en: "2/2" }, value: 1, k: 2, n: 2, evidence: [e] });

test("a listing binds k and n to its number of files", () => {
  const m = counted(listing());
  delete m.ci95;
  assert.deepEqual(errorsOf(m), []);
  m.n = 3;
  m.value = 2 / 3;
  m.display = { fr: "2/3", en: "2/3" };
  assert.ok(errorsOf(m).some((e) => /binds n to 2 files, not 3/.test(e)));
});

test("a listing refuses files that do not match, repeat, or sit at different depths", () => {
  const cases: [string, (e: ListingEvidence) => void, RegExp][] = [
    ["a file outside the pattern", (e) => e.files.push("q3/notes.md"), /does not match/],
    ["a repeated file", (e) => e.files.push(e.files[0]!), /repeat/],
    ["mixed depths", (e) => ((e.matching = ".*"), e.files.push("top.json")), /one depth/],
    ["an invalid pattern", (e) => (e.matching = "("), /not a regular expression/],
  ];
  for (const [name, mutate, expected] of cases) {
    const e = listing();
    mutate(e);
    const m = counted(e);
    delete m.ci95;
    assert.ok(errorsOf(m).some((x) => expected.test(x)), `${name}: ${JSON.stringify(errorsOf(m))}`);
  }
});

test("the directory at the commit must hold exactly the listed files", () => {
  const e = listing();
  const found = ["q1/run-a/metadata.json", "q2/run-b/metadata.json", "q2/error-x.json", "README.md"];
  assert.equal(listingError(found, e), null);
  assert.equal(listingError([...found, "q3/run-c/metadata.json"], e), "runs: unlisted q3/run-c/metadata.json");
  assert.equal(listingError(found.slice(1), e), "runs: missing q1/run-a/metadata.json");
});

// A label cannot round an interval outwards (its numbers must be stated by the evidence), and
// rounding to the nearest makes it narrower than its source, against the Colophon's one rule:
// an interval written in a label keeps the source's precision.
test("the earlier judge's bootstrap interval is written as its source states it", () => {
  const kappa = measures.measures.find((m) => m.id === "verity.judge_kappa_all");
  assert.match(kappa?.label.fr ?? "", /IC bootstrap 0,4872–0,8934\)/);
  assert.match(kappa?.label.en ?? "", /bootstrap CI 0\.4872–0\.8934\)/);
});
