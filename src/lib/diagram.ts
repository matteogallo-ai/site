// Layout of the case-study diagrams: steps stacked top to bottom, then the outcomes side by
// side. WIDTH is below the 327 px a 375 px screen leaves the container, so the SVG is never
// scaled down there and its smallest text stays at the 12 px step of the type scale
// (tests/case-studies.spec.ts measures it).

export const WIDTH = 320;
const MARGIN = 2;
const PAD_X = 10;
const PAD_Y = 10;
const GAP_Y = 26;
const GAP_X = 8;
const TITLE_SIZE = 14;
const LINE_SIZE = 12;
const TITLE_LEAD = 18;
const LINE_LEAD = 16;
// Average advance of Inter, in em, rounded up. An estimate, not a measurement (none exists at
// build time): it fails the build on lines far too long, and a line of wide glyphs could still
// pass and overflow, which the screenshots at 375 px are for.
const ADVANCE = { title: 0.62, line: 0.56 };

export type Tone = "proof" | "defect";

export interface Node {
  title: string;
  lines?: string[];
  tone?: Tone;
}

export interface Box extends Node {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Baselines of the title and of each line. */
  baselines: number[];
}

export interface Diagram {
  boxes: Box[];
  /** Polylines, each ending in an arrowhead. */
  arrows: [number, number][][];
  height: number;
}

export const TEXT = { titleSize: TITLE_SIZE, lineSize: LINE_SIZE, padX: PAD_X };

function box(node: Node, x: number, y: number, w: number): Box {
  const lines = node.lines ?? [];
  const inner = w - 2 * PAD_X;
  const check = (text: string, size: number, advance: number) => {
    if (text.length * size * advance > inner) throw new Error(`"${text}" does not fit a ${w}-unit box`);
  };
  check(node.title, TITLE_SIZE, ADVANCE.title);
  for (const line of lines) check(line, LINE_SIZE, ADVANCE.line);
  const baselines = [y + PAD_Y + TITLE_SIZE, ...lines.map((_, i) => y + PAD_Y + TITLE_SIZE + (i + 1) * LINE_LEAD)];
  const h = PAD_Y * 2 + TITLE_LEAD + lines.length * LINE_LEAD - (TITLE_LEAD - TITLE_SIZE);
  return { ...node, x, y, w, h, baselines };
}

export function layout({ steps, outcomes = [] }: { steps: Node[]; outcomes?: Node[] }): Diagram {
  if (steps.length === 0) throw new Error("a diagram has at least one step");
  const boxes: Box[] = [];
  const arrows: [number, number][][] = [];
  const full = WIDTH - 2 * MARGIN;
  const mid = WIDTH / 2;
  let y = MARGIN;
  for (const step of steps) {
    if (boxes.length) arrows.push([[mid, y - GAP_Y], [mid, y]]);
    const b = box(step, MARGIN, y, full);
    boxes.push(b);
    y += b.h + GAP_Y;
  }
  if (outcomes.length) {
    const w = (full - GAP_X * (outcomes.length - 1)) / outcomes.length;
    const top = y + GAP_Y / 2;
    const fork = y - GAP_Y + (top - (y - GAP_Y)) / 2;
    const row = outcomes.map((o, i) => box(o, MARGIN + i * (w + GAP_X), top, w));
    for (const b of row) arrows.push([[mid, y - GAP_Y], [mid, fork], [b.x + b.w / 2, fork], [b.x + b.w / 2, b.y]]);
    boxes.push(...row);
    y = top + Math.max(...row.map((b) => b.h)) + GAP_Y;
  }
  return { boxes, arrows, height: y - GAP_Y + MARGIN };
}
