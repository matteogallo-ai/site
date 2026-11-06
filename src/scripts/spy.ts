/**
 * The section the reader is in: the last one whose top has passed `line` (a distance from the
 * top of the viewport), or none while the reader is still above the first.
 */
export function activeSection(tops: readonly number[], line: number): number {
  let active = -1;
  for (const [i, top] of tops.entries()) if (top <= line) active = i;
  return active;
}

/**
 * Marks the navigation link of the section in view (aria-current) and slides the dot under it.
 * The dot only moves with transform: its left edge is fixed and it travels by translateX.
 */
export function spyOn(nav: HTMLElement): void {
  const links = [...nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const sections = links.map((a) => document.getElementById(a.hash.slice(1)));
  const dot = nav.querySelector<HTMLElement>("[data-spy-dot]");
  if (!dot || sections.some((s) => !s)) return;
  let shown = -2;
  const update = () => {
    const i = activeSection(sections.map((s) => s!.getBoundingClientRect().top), innerHeight * 0.4);
    if (i === shown) return;
    shown = i;
    for (const [j, a] of links.entries()) {
      if (j === i) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    }
    const link = links[i];
    dot.hidden = !link;
    if (link) dot.style.transform = `translateX(${link.offsetLeft + link.offsetWidth / 2}px)`;
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", () => {
    shown = -2;
    update();
  });
  update();
}
