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
  const tag = root.querySelector<HTMLElement>("[data-lens-tag]");
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  // Missing markup means a broken build, not a state to recover from: leave the static page as is.
  if (!sheet || !doc || !lens || !tag || tabs.length !== 2) return;

  // Spotlight on: the contract dims around the passage (CSS on data-lit).
  root.dataset["lit"] = "";

  // The window scrolls to its target on load, on a change of mode and when the layout moves.
  const place = (behavior: ScrollBehavior = "instant") => {
    const width = sheet.clientWidth;
    const target = unionBox(targetBoxes(doc, root.dataset["mode"] as Mode, sheet));
    if (!target) return;
    const box = lensLayout(target, width);
    // Placed by transform (CSS reads --x and --y): moving them then never counts as a layout shift.
    lens.style.setProperty("--x", `${box.left}px`);
    lens.style.setProperty("--y", `${box.top}px`);
    Object.assign(lens.style, { width: `${box.width}px`, height: `${box.height}px` });
    tag.style.setProperty("--x", `${Math.min(box.left + box.width, width)}px`);
    tag.style.setProperty("--y", `${box.top}px`);
    lens.hidden = false;
    tag.hidden = false;
    // The target's centre goes to --target-at of the window's height (the middle of the part
    // the card leaves uncovered), but never so far up that the tag above the lens enters the
    // top fade, where it would lose its contrast.
    const tagTop = box.top - tag.offsetHeight - layoutValue(sheet, "--tag-gap", 14);
    const centred = target.top + target.height / 2 - sheet.clientHeight * layoutValue(sheet, "--target-at", 0.5);
    sheet.scrollTo({ top: Math.floor(Math.min(centred, tagTop - layoutValue(sheet, "--fade", 40))), behavior });
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

  const tablist = root.querySelector<HTMLElement>('[role="tablist"]');
  // The ring fades out; once it is invisible the contract changes mode (its margins move the
  // text), the window scrolls and the ring fades in on the new passage. It never slides or
  // changes shape in view. Under reduced motion all of it happens at once.
  let away = 0;
  const hop = (mode: string) => {
    clearTimeout(away);
    if (still.matches) {
      root.dataset["mode"] = mode;
      return place();
    }
    root.dataset["away"] = "";
    away = window.setTimeout(() => {
      root.dataset["mode"] = mode;
      place("smooth");
      delete root.dataset["away"];
    }, Number.parseFloat(getComputedStyle(lens).transitionDuration) * 1000);
  };

  const select = (tab: HTMLButtonElement, focus: boolean) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = panelOf(t);
      // Both cards stay in the layout (they share a grid cell); the one that is off is invisible.
      if (panel) panel.toggleAttribute("data-off", !on);
    }
    if (tablist) tablist.dataset["at"] = String(tabs.indexOf(tab));
    const mode = tab.dataset["mode"] ?? "answer";
    const changed = (root.dataset["next"] ?? root.dataset["mode"]) !== mode;
    root.dataset["next"] = mode;
    if (changed) write(panelOf(tab));
    if (focus) tab.focus();
    if (changed) hop(mode);
    else place();
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
  // Not while the ring is away: it is placed once the contract has changed mode.
  const observer = new ResizeObserver(() => {
    if (!("away" in root.dataset)) place();
  });
  observer.observe(sheet);
  // A web font swap can move the words without resizing the sheet.
  observer.observe(doc);
  document.fonts.addEventListener("loadingdone", () => {
    if (!("away" in root.dataset)) place();
  });
  // A card already on screen at load is simply there (no flash, no late paint); one further
  // down writes itself as soon as its answer starts to enter the view, before it can be read.
  const first = panelOf(tabs[0]!);
  const firstAnswer = first?.querySelector(".a");
  // Measured now, not from an observer's first report: that report comes later, and a scroll in
  // between would pass an answer that was off-screen at load for one that was there.
  const box = firstAnswer?.getBoundingClientRect();
  if (first && firstAnswer && box && (box.top >= innerHeight || box.bottom <= 0)) {
    pending = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) write(first);
    });
    pending.observe(firstAnswer);
  }
  void document.fonts.ready.then(() => place());
  place();
}
