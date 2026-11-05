import { isDeepStrictEqual } from "node:util";

/** Where a figure or a trace was read: a file of a public repo at a pinned commit. */
export interface Source {
  repo: string;
  commit: string;
  path: string;
  url: string;
}

/** A field of a measure that a pointer evidence item states. */
export type Binding = "value" | "k" | "n" | "ci95";

/**
 * One fact the file must state for the figure to stand: a JSON value, or a passage of text.
 * `binds` names the measure field that the value must equal.
 */
export type Evidence =
  | { path?: string; pointer: string; equals: unknown; binds?: Binding }
  | { path?: string; contains: string };

interface MeasureText {
  id: string;
  label: { fr: string; en: string };
  display: { fr: string; en: string };
  note?: string;
}

export interface VerifiedMeasure extends MeasureText, Source {
  status: "verified";
  value: number | number[];
  k?: number;
  n?: number;
  ci95?: [number, number];
  evidence: Evidence[];
  /** How a figure no evidence binds follows from the evidence (a count, a code default). */
  derived?: string;
}

/** A figure the site needs and no source states exactly: shown as a gap, never filled in. */
export interface GapMeasure extends MeasureText {
  status: "gap";
  repo: string;
  value: null;
}

export type Measure = VerifiedMeasure | GapMeasure;

/** What a gap shows in place of a figure. */
export const GAP_DISPLAY = "—";

export interface MeasuresFile {
  schema: "site.measures/v1";
  measures: Measure[];
}

const OWNER = "matteogallo-ai/";
const SHA1 = /^[0-9a-f]{40}$/;

export const blobUrl = (s: Pick<Source, "repo" | "commit" | "path">) => `https://github.com/${s.repo}/blob/${s.commit}/${s.path}`;
export const rawUrl = (s: Pick<Source, "repo" | "commit">, path: string) =>
  `https://raw.githubusercontent.com/${s.repo}/${s.commit}/${path.split("/").map(encodeURIComponent).join("/")}`;

export function sourceErrors(where: string, s: Source): string[] {
  const errors: string[] = [];
  if (!s.repo?.startsWith(OWNER)) errors.push(`${where}: repo ${s.repo} is not under ${OWNER}`);
  if (!SHA1.test(s.commit ?? "")) errors.push(`${where}: commit must be a full 40-hex hash`);
  if (!s.path || s.path.startsWith("/") || s.path.includes("..")) errors.push(`${where}: path must be repo-relative`);
  if (s.url !== blobUrl(s)) errors.push(`${where}: url must be ${blobUrl(s)}`);
  return errors;
}

/** Structural rules every entry must meet before any source is fetched. */
export function measuresErrors(file: MeasuresFile): string[] {
  const errors: string[] = [];
  if (file.schema !== "site.measures/v1") errors.push(`schema must be site.measures/v1`);
  const seen = new Set<string>();
  for (const m of file.measures) {
    const at = m.id;
    if (seen.has(at)) errors.push(`${at}: duplicate id`);
    seen.add(at);
    for (const lang of ["fr", "en"] as const) {
      if (!m.label?.[lang]?.trim()) errors.push(`${at}: label.${lang} is empty`);
      if (!m.display?.[lang]?.trim()) errors.push(`${at}: display.${lang} is empty`);
    }
    if (m.status === "gap") errors.push(...gapErrors(m));
    else if (m.status === "verified") errors.push(...verifiedErrors(m));
    else errors.push(`${at}: status must be verified or gap`);
  }
  return errors;
}

function gapErrors(m: GapMeasure): string[] {
  const errors: string[] = [];
  if (!m.repo?.startsWith(OWNER)) errors.push(`${m.id}: repo ${m.repo} is not under ${OWNER}`);
  if (m.value !== null) errors.push(`${m.id}: a gap has value null`);
  // Anything that could be read as a figure is refused, not only `value`.
  for (const key of ["k", "n", "ci95", "evidence", "derived"]) if (key in m) errors.push(`${m.id}: a gap carries no ${key}`);
  if (m.display.fr !== GAP_DISPLAY || m.display.en !== GAP_DISPLAY) errors.push(`${m.id}: a gap displays ${GAP_DISPLAY}`);
  if (!m.note) errors.push(`${m.id}: a gap says what is missing in note`);
  return errors;
}

function verifiedErrors(m: VerifiedMeasure): string[] {
  const at = m.id;
  const errors = sourceErrors(at, m);
  if (!m.evidence?.length) return [...errors, `${at}: a verified measure needs evidence`];
  if ((m.k === undefined) !== (m.n === undefined)) errors.push(`${at}: k and n go together`);
  if (m.k !== undefined && m.n !== undefined) {
    if (!Number.isInteger(m.k) || !Number.isInteger(m.n) || m.k < 0 || m.k > m.n || m.n === 0) errors.push(`${at}: k/n must be integers with 0 <= k <= n, n > 0`);
    else if (typeof m.value !== "number" || Math.abs(m.value - m.k / m.n) > 1e-6) errors.push(`${at}: value ${m.value} is not k/n = ${m.k}/${m.n}`);
  }
  if (m.ci95) {
    const [lo, hi] = m.ci95;
    if (typeof m.value !== "number" || !(lo <= m.value + 1e-9 && m.value <= hi + 1e-9)) errors.push(`${at}: ci95 [${lo}, ${hi}] does not contain ${m.value}`);
  }
  for (const e of m.evidence) {
    if (e.path !== undefined && (e.path.startsWith("/") || e.path.includes(".."))) errors.push(`${at}: evidence path ${e.path} must be repo-relative`);
    if ("pointer" in e && !e.pointer.startsWith("/")) errors.push(`${at}: pointer ${e.pointer} must start with /`);
    if ("contains" in e && !e.contains) errors.push(`${at}: empty contains`);
    if ("binds" in e && e.binds !== undefined && !isDeepStrictEqual(e.equals, m[e.binds])) errors.push(`${at}: ${e.pointer} binds ${e.binds} but states ${JSON.stringify(e.equals)}, not ${JSON.stringify(m[e.binds])}`);
  }
  const unbound = unboundFields(m);
  if (unbound.length && !m.derived) errors.push(`${at}: ${unbound.join(", ")} bound by no evidence; bind it or explain it in derived`);
  errors.push(...textNumberErrors(m));
  return errors;
}

const isRatio = (m: VerifiedMeasure) => m.k !== undefined && m.n !== undefined && typeof m.value === "number" && Math.abs(m.value - m.k / m.n) <= 1e-6;

/** Fields the measure carries that no evidence item binds. A value equal to k/n is bound through k and n. */
export function unboundFields(m: VerifiedMeasure): Binding[] {
  const bound = new Set(m.evidence.flatMap((e) => ("binds" in e && e.binds ? [e.binds] : [])));
  const present: Binding[] = [...(isRatio(m) ? [] : ["value" as const]), ...(["k", "n", "ci95"] as const).filter((f) => m[f] !== undefined)];
  return present.filter((f) => !bound.has(f));
}

function numbersIn(x: unknown): number[] {
  if (typeof x === "number") return [x];
  if (Array.isArray(x)) return x.flatMap(numbersIn);
  return [];
}

/** Numbers written in French or English: "0,71", "96.13", "3/20" gives 3 and 20. */
const numberTokens = (text: string) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((t) => t.replace(",", "."));

/**
 * Every number a reader sees must come from the measure. A displayed number must be
 * one of its figures at the precision shown; a number in a label (a sample size, a
 * repeat) must be stated by some evidence item.
 */
export function textNumberErrors(m: VerifiedMeasure): string[] {
  const figures = [...numbersIn(m.value), ...numbersIn(m.k), ...numbersIn(m.n), ...numbersIn(m.ci95)];
  const stated = [...figures, ...m.evidence.flatMap((e) => ("equals" in e ? numbersIn(e.equals) : []))];
  const matches = (pool: number[]) => (t: string) => pool.some((x) => x.toFixed(t.split(".")[1]?.length ?? 0) === t);
  const errors: string[] = [];
  for (const lang of ["fr", "en"] as const) {
    for (const t of numberTokens(m.display[lang])) if (!matches(figures)(t)) errors.push(`${m.id}: display.${lang} shows ${t}, which is none of its figures`);
    for (const t of numberTokens(m.label[lang])) if (!matches(stated)(t)) errors.push(`${m.id}: label.${lang} says ${t}, which no evidence states`);
  }
  return errors;
}

/** RFC 6901 JSON pointer. Returns undefined when any step is missing. */
export function resolvePointer(doc: unknown, pointer: string): unknown {
  if (pointer === "") return doc;
  let node = doc;
  for (const raw of pointer.slice(1).split("/")) {
    const key = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(node) && /^(0|[1-9]\d*)$/.test(key)) node = node[Number(key)];
    else if (node !== null && typeof node === "object" && !Array.isArray(node) && Object.hasOwn(node, key)) node = (node as Record<string, unknown>)[key];
    else return undefined;
  }
  return node;
}

/** null when the file states the evidence; otherwise why it does not. */
export function evidenceError(fileText: string, e: Evidence): string | null {
  if ("contains" in e) return fileText.includes(e.contains) ? null : `text not found: ${JSON.stringify(e.contains)}`;
  let doc: unknown;
  try {
    doc = JSON.parse(fileText);
  } catch (error) {
    return `not JSON: ${(error as Error).message}`;
  }
  const found = resolvePointer(doc, e.pointer);
  return isDeepStrictEqual(found, e.equals) ? null : `${e.pointer} is ${JSON.stringify(found)}, expected ${JSON.stringify(e.equals)}`;
}
