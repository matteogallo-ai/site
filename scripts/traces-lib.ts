import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { resolvePointer, type Source, sourceErrors } from "./measures-lib.ts";

export interface DemoDocument {
  source: Source & { sha256: string };
  text: string;
}

export interface Chunk {
  id: string;
  document_id: string;
  char_start: number;
  char_end: number;
  section: string;
  text: string;
}

export interface Citation {
  chunk_id: string;
  document_id: string;
  char_start: number;
  char_end: number;
  quote: string;
}

/** Fields copied verbatim from one `per_audit` record of a committed Verity run. */
export const TRACE_FIELDS = [
  "example_id",
  "question",
  "refused",
  "refusal_reason",
  "refusal_rationale",
  "confidence_score",
  "answer_text",
  "citations",
  "judge_claims",
] as const;
export const RUN_FIELDS = ["agent_model", "judge_model", "embedding_model", "confidence_threshold"] as const;

export interface DemoTrace {
  source: Source & { sha256: string; pointer: string };
  /** Corpus path of every document the trace refers to, keyed by Verity's document id. */
  documents: Record<string, string>;
  run: Record<(typeof RUN_FIELDS)[number], unknown>;
  example_id: string;
  question: string;
  refused: boolean;
  refusal_reason: string | null;
  refusal_rationale: string;
  confidence_score: number;
  answer_text: string;
  citations: Citation[];
  judge_claims: { claim: string; supported: boolean; citation_ok: boolean }[] | null;
  hits_used: { chunk: Chunk; kind: string; rank: number; score: number }[];
}

/** RFC 4122 version-5 UUID in the URL namespace: Verity's document id for a corpus path. */
export function uuid5Url(name: string): string {
  const namespace = Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex");
  const h = createHash("sha1").update(namespace).update(name, "utf8").digest();
  h[6] = (h[6]! & 0x0f) | 0x50;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

export const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

/**
 * Offline consistency of a trace with the document page it is shown on: every offset
 * the spotlight uses must select exactly the quoted words.
 */
export function traceErrors(trace: DemoTrace, doc: DemoDocument): string[] {
  const errors: string[] = [];
  const at = trace.example_id;
  errors.push(...sourceErrors(`${at} source`, trace.source), ...sourceErrors("document source", doc.source));
  if (sha256(doc.text) !== doc.source.sha256) errors.push("document text does not match its sha256");
  const docId = uuid5Url(doc.source.path);
  for (const [id, path] of Object.entries(trace.documents ?? {})) if (uuid5Url(path) !== id) errors.push(`${at}: document ${id} is not ${path}`);
  const referred = [...trace.citations.map((c) => c.document_id), ...trace.hits_used.map((h) => h.chunk.document_id)];
  for (const id of new Set(referred)) if (!trace.documents?.[id]) errors.push(`${at}: document ${id} has no path in documents`);
  const chunks = new Map(trace.hits_used.map((h) => [h.chunk.id, h.chunk]));
  for (const h of trace.hits_used) {
    const c = h.chunk;
    if (c.document_id === docId && doc.text.slice(c.char_start, c.char_end) !== c.text) errors.push(`${at}: chunk ${c.id} is not document[${c.char_start}:${c.char_end}]`);
  }
  for (const c of trace.citations) {
    const chunk = chunks.get(c.chunk_id);
    if (chunk && chunk.document_id !== c.document_id) errors.push(`${at}: citation document ${c.document_id} is not its chunk's`);
    if (c.document_id === docId) {
      if (doc.text.slice(c.char_start, c.char_end) !== c.quote) errors.push(`${at}: quote is not document[${c.char_start}:${c.char_end}]`);
    } else if (!chunk) {
      errors.push(`${at}: citation of another document without its chunk in hits_used`);
    } else if (chunk.text.slice(c.char_start - chunk.char_start, c.char_end - chunk.char_start) !== c.quote) {
      errors.push(`${at}: quote is not at [${c.char_start}:${c.char_end}] of chunk ${c.chunk_id}`);
    }
  }
  if (trace.refused && trace.citations.length) errors.push(`${at}: a refusal carries no citation`);
  if (!trace.refused && !trace.citations.some((c) => c.document_id === docId)) errors.push(`${at}: an answer cites the document it is shown on`);
  if (trace.refused && trace.hits_used[0]?.chunk.document_id !== docId) errors.push(`${at}: the closest passage of a refusal is on the document it is shown on`);
  return errors;
}

/** The trace equals the committed run record it claims to come from. */
export function traceMatchesRun(trace: DemoTrace, run: unknown): string[] {
  const record = resolvePointer(run, trace.source.pointer) as Record<string, unknown> | undefined;
  if (!record) return [`${trace.source.pointer} not found in the run`];
  const errors: string[] = [];
  // A key outside these lists would reach the page without being compared with the run.
  const known = new Set<string>(["source", "run", "documents", "hits_used", ...TRACE_FIELDS]);
  for (const key of Object.keys(trace)) if (!known.has(key)) errors.push(`${trace.example_id}: unknown key ${key}`);
  for (const f of TRACE_FIELDS) if (!isDeepStrictEqual(trace[f], record[f])) errors.push(`${trace.example_id}: ${f} differs from the run`);
  for (const f of RUN_FIELDS) if (!isDeepStrictEqual(trace.run[f], (run as Record<string, unknown>)[f])) errors.push(`${trace.example_id}: run.${f} differs from the run`);
  const hits = record["hits_used"];
  if (!Array.isArray(hits) || !isDeepStrictEqual(trace.hits_used, hits.slice(0, trace.hits_used.length))) errors.push(`${trace.example_id}: hits_used is not a prefix of the run's`);
  return errors;
}

export interface Translation {
  en: string;
  fr: string;
}

export type DemoTranslations = Record<string, { question: Translation; answer: Translation; rationale?: Translation } | string>;

/** Why a trace's French lines would not translate what the trace says (empty when they do). */
export function translationErrors(trace: DemoTrace, translations: DemoTranslations): string[] {
  const entry = translations[trace.example_id];
  if (typeof entry !== "object") return [`${trace.example_id}: no translation`];
  // A refusal shows why it refused: that explanation is translated as well.
  const fields = trace.refused ? (["question", "answer", "rationale"] as const) : (["question", "answer"] as const);
  return fields.flatMap((field) => {
    const t = entry[field];
    if (typeof t?.en !== "string" || typeof t.fr !== "string") return [`${trace.example_id}: no ${field} translation`];
    const said = { question: trace.question, answer: trace.answer_text, rationale: trace.refusal_rationale }[field];
    if (t.en !== said) return [`${trace.example_id}: the ${field} translated is not the trace's ${field}`];
    return t.fr.trim() === "" ? [`${trace.example_id}: empty ${field} translation`] : [];
  });
}
