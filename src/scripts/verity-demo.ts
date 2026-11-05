import { type Box, lensLayout, relativeBox, unionBox } from "./lens.ts";
import { revealed, writingDuration } from "./typing.ts";

type Mode = "answer" | "refusal";

/**
 * The words a mode points at: the text boxes of the spans cut at the trace's offsets, in the
 * coordinates of the sheet's content, which scrolls under its window.
 */
function targetBoxes(doc: Element, mode: Mode, sheet: HTMLElement): Box[] {
  const rect = sheet.getBoundingClientRect();
  return [...doc.querySelectorAll<HTMLElement>(`[data-mark~="${mode}"]`)].flatMap((span) =>
    [...span.getClientRects()].map((r) => {
      const box = relativeBox(r, rect);
      return { ...box, top: box.top + sheet.scrollTop };
    }),
  );
}

/** A unitless or px custom property of the sheet, set by the layout in VerityDemo.astro. */
function layoutValue(sheet: HTMLElement, name: string, fallback: number): number {
  const value = Number.parseFloat(getComputedStyle(sheet).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

const still = matchMedia("(prefers-reduced-motion: reduce)");

/**
 * Writes the card's answer word by word, then lets its checks appear in order (CSS on
 * data-written). Only an aria-hidden copy laid over the answer is animated: the answer
 * itself stays whole in the page, so assistive tech reads it from the start. A click or a
 * key shows it whole at once. Returns a function that ends the writing.
 */
function writeOut(card: HTMLElement): () => void {
  const answer = card.querySelector<HTMLElement>(".a");
  const text = answer?.querySelector(".a-text")?.textContent ?? "";
  // Under reduced motion the final state is shown at once (SPEC §4).
  if (!answer || !text || still.matches) return () => {};
  const duration = writingDuration(text);
  const layer = document.createElement("span");
  layer.className = "a-layer";
  layer.setAttribute("aria-hidden", "true");
  const shown = document.createElement("span");
  const rest = document.createElement("span");
  rest.className = "unwritten";
  layer.append(shown, rest);
  answer.append(layer);
  delete card.dataset["written"];
  card.dataset["writing"] = "";

  const start = performance.now();
  let frame = 0;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(frame);
    document.removeEventListener("pointerdown", skip, true);
    document.removeEventListener("keydown", skip, true);
    layer.remove();
    delete card.dataset["writing"];
    card.dataset["written"] = "";
  };
  // The click or key that started this writing was created before it: it does not skip it.
  const skip = (event: Event) => {
    if (event.timeStamp >= start) finish();
  };
  document.addEventListener("pointerdown", skip, true);
  document.addEventListener("keydown", skip, true);
  const step = (now: number) => {
    const n = revealed(text, (now - start) / duration);
    shown.textContent = text.slice(0, n);
    rest.textContent = text.slice(n);
    if (n < text.length) frame = requestAnimationFrame(step);
    else finish();
  };
  step(start);
  return finish;
}

export function mountVerityDemo(root: HTMLElement): void {
  const sheet = root.querySelector<HTMLElement>("[data-sheet]");
  const doc = sheet?.querySelector("article");
  const lens = root.querySelector<HTMLElement>("[data-lens]");
  const view = root.querySelector<HTMLElement>("[data-lens-view]");
  const tag = root.querySelector<HTMLElement>("[data-lens-tag]");
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  // Missing markup means a broken build, not a state to recover from: leave the static page as is.
  if (!sheet || !doc || !lens || !view || !tag || tabs.length !== 2) return;

  // The copy is the page's own markup, so it lays out exactly like the original.
  view.replaceChildren(doc.cloneNode(true));

  // The window scrolls to its target on load, on a change of mode and when the layout moves.
  const place = (behavior: ScrollBehavior = "instant") => {
    const width = sheet.clientWidth;
    const target = unionBox(targetBoxes(doc, root.dataset["mode"] as Mode, sheet));
    if (!target) return;
    const { lens: box, view: at, origin, scale } = lensLayout(target, width);
    Object.assign(lens.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
    Object.assign(view.style, {
      left: `${at.left}px`,
      top: `${at.top}px`,
      width: `${width}px`,
      transformOrigin: `${origin.x}px ${origin.y}px`,
      transform: `scale(${scale})`,
    });
    Object.assign(tag.style, { left: `${Math.min(box.left + box.width, width)}px`, top: `${box.top}px` });
    lens.hidden = false;
    tag.hidden = false;
    // The target's centre goes to --target-at of the window's height (the middle of the part
    // the card leaves uncovered), but never so far up that the tag above the lens enters the
    // top fade, where it would lose its contrast.
    const tagTop = box.top - tag.offsetHeight - layoutValue(sheet, "--tag-gap", 10);
    const centred = target.top + target.height / 2 - sheet.clientHeight * layoutValue(sheet, "--target-at", 0.5);
    sheet.scrollTo({ top: Math.min(centred, tagTop - layoutValue(sheet, "--fade", 40)), behavior });
  };

  const panelOf = (t: HTMLButtonElement) => document.getElementById(t.getAttribute("aria-controls") ?? "");
  let stopWriting = () => {};
  // Waits for the first card to scroll into view; a choice of mode settles it first.
  let pending: IntersectionObserver | undefined;
  const write = (panel: HTMLElement | null) => {
    pending?.disconnect();
    stopWriting();
    if (panel) stopWriting = writeOut(panel);
  };

  const select = (tab: HTMLButtonElement, focus: boolean) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = panelOf(t);
      if (panel) panel.hidden = !on;
    }
    if (root.dataset["mode"] !== tab.dataset["mode"]) {
      root.dataset["switched"] = "";
      write(panelOf(tab));
    }
    root.dataset["mode"] = tab.dataset["mode"];
    if (focus) tab.focus();
    place(still.matches ? "instant" : "smooth");
  };

  for (const tab of tabs) {
    tab.addEventListener("click", () => select(tab, false));
    // ARIA tabs pattern: arrows move between tabs and select them, Home and End go to the ends.
    tab.addEventListener("keydown", (event) => {
      const i = tabs.indexOf(tab);
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      select(tabs[(next + tabs.length) % tabs.length]!, true);
    });
  }

  // Layout changes with the width, the zoom and the web fonts: the lens follows each one.
  const observer = new ResizeObserver(() => place());
  observer.observe(sheet);
  // A web font swap can move the words without resizing the sheet.
  observer.observe(doc);
  document.fonts.addEventListener("loadingdone", () => place());
  // A card already on screen at load is simply there (no flash, no late paint); one further
  // down writes itself as soon as its answer starts to enter the view, before it can be read.
  const first = panelOf(tabs[0]!);
  const firstAnswer = first?.querySelector(".a");
  if (first && firstAnswer) {
    const seen = new IntersectionObserver(([entry]) => {
      seen.disconnect();
      if (entry && !entry.isIntersecting) {
        pending = new IntersectionObserver(([e]) => {
          if (e?.isIntersecting) write(first);
        });
        pending.observe(firstAnswer);
      }
    });
    seen.observe(firstAnswer);
  }
  void document.fonts.ready.then(() => place());
  place();
}
