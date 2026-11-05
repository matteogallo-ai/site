import { lensLayout, relativeBox } from "./lens.ts";

type Mode = "answer" | "refusal";

/** The words a mode points at, as a DOM Range over the spans cut at the trace's offsets. */
function targetRange(doc: Element, mode: Mode): Range | null {
  const spans = doc.querySelectorAll<HTMLElement>(`[data-mark~="${mode}"]`);
  const first = spans[0]?.firstChild;
  const last = spans[spans.length - 1]?.firstChild;
  if (!first || !last) return null;
  const range = document.createRange();
  range.setStart(first, 0);
  range.setEnd(last, last.textContent?.length ?? 0);
  return range;
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
  const copy = doc.cloneNode(true) as HTMLElement;
  copy.removeAttribute("aria-label");
  view.replaceChildren(copy);

  const place = () => {
    const range = targetRange(doc, root.dataset["mode"] as Mode);
    if (!range) return;
    const sheetRect = sheet.getBoundingClientRect();
    const { lens: box, view: at, origin, scale } = lensLayout(relativeBox(range.getBoundingClientRect(), sheetRect), sheetRect.width);
    Object.assign(lens.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
    Object.assign(view.style, {
      left: `${at.left}px`,
      top: `${at.top}px`,
      width: `${sheetRect.width}px`,
      transformOrigin: `${origin.x}px ${origin.y}px`,
      transform: `scale(${scale})`,
    });
    Object.assign(tag.style, { left: `${Math.min(box.left + box.width, sheetRect.width)}px`, top: `${box.top}px` });
    lens.hidden = false;
    tag.hidden = false;
  };

  const select = (tab: HTMLButtonElement, focus: boolean) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute("aria-controls") ?? "");
      if (panel) panel.hidden = !on;
    }
    if (root.dataset["mode"] !== tab.dataset["mode"]) root.dataset["switched"] = "";
    root.dataset["mode"] = tab.dataset["mode"];
    if (focus) tab.focus();
    place();
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
  const observer = new ResizeObserver(place);
  observer.observe(sheet);
  // A web font swap can move the words without resizing the sheet.
  observer.observe(doc);
  document.fonts.addEventListener("loadingdone", place);
  void document.fonts.ready.then(place);
  place();
}
