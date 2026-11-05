/**
 * Turns a Verity corpus document (Markdown as committed) into blocks whose text keeps
 * the source offsets, so a citation's [char_start, char_end) selects the same words on
 * the page as in the run.
 */

export interface Span {
  /** Offset of the span's first character in the source document. */
  start: number;
  text: string;
  /** Names of the targets that cover this span. */
  marks: string[];
}

export type Block =
  | { kind: "h1" | "h2" | "p"; spans: Span[] }
  | { kind: "ul"; items: Span[][] };

export interface Target {
  name: string;
  start: number;
  end: number;
}

/** Markdown prefixes this corpus uses; their characters stay out of the rendered text. */
const PREFIXES: [RegExp, "h1" | "h2" | "li"][] = [
  [/^# /, "h1"],
  [/^## /, "h2"],
  [/^- /, "li"],
];

function split(start: number, text: string, targets: Target[]): Span[] {
  const end = start + text.length;
  const cuts = new Set([start, end]);
  for (const t of targets) for (const c of [t.start, t.end]) if (c > start && c < end) cuts.add(c);
  const points = [...cuts].sort((a, b) => a - b);
  return points.slice(0, -1).map((s, i) => {
    const e = points[i + 1]!;
    return { start: s, text: text.slice(s - start, e - start), marks: targets.filter((t) => t.start <= s && e <= t.end).map((t) => t.name) };
  });
}

export function toBlocks(source: string, targets: Target[] = []): Block[] {
  for (const t of targets) if (!(0 <= t.start && t.start < t.end && t.end <= source.length)) throw new RangeError(`target ${t.name} [${t.start}, ${t.end}) is outside the document`);
  const blocks: Block[] = [];
  let offset = 0;
  for (const line of source.split("\n")) {
    const lineStart = offset;
    offset += line.length + 1;
    if (!line.trim()) continue;
    const match = PREFIXES.find(([re]) => re.test(line));
    const prefix = match ? line.match(match[0])![0].length : 0;
    const spans = split(lineStart + prefix, line.slice(prefix), targets);
    const kind = match?.[1] ?? "p";
    if (kind !== "li") {
      blocks.push({ kind, spans });
      continue;
    }
    const last = blocks.at(-1);
    if (last?.kind === "ul") last.items.push(spans);
    else blocks.push({ kind: "ul", items: [spans] });
  }
  return blocks;
}

/** The rendered text of the blocks, for checks: a target's words must be on the page. */
export const textOf = (blocks: Block[]) => blocks.flatMap((b) => (b.kind === "ul" ? b.items.flat() : b.spans)).map((s) => s.text).join("");

/**
 * The list a refusal's closest passage opens with: the magnifier goes on the items
 * the passage offers (here, the priorities the SLA does define), not on the whole chunk,
 * which runs into the next section.
 */
export function firstListIn(source: string, chunk: { char_start: number; char_end: number }): { start: number; end: number } {
  const text = source.slice(chunk.char_start, chunk.char_end);
  const lines = text.split("\n");
  let offset = chunk.char_start;
  let start = -1;
  let end = -1;
  for (const line of lines) {
    if (line.startsWith("- ")) {
      if (start < 0) start = offset + 2;
      end = offset + line.length;
    } else if (start >= 0) {
      break;
    }
    offset += line.length + 1;
  }
  if (start < 0) throw new Error("the passage has no list");
  return { start, end };
}
