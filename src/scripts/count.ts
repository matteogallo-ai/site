/** How long a figure takes to count up: a reading animation, not a transition (SPEC §4). */
export const COUNT_MS = 700;

/**
 * `display` with its first number counted up to `progress` (0 to 1) of its value, easing out so
 * the count slows as it lands. "17/20" at 0 reads "0/20": what is being counted stays in view.
 */
export function counted(display: string, progress: number): string {
  const p = Math.min(1, Math.max(0, progress));
  const eased = 1 - (1 - p) ** 3;
  return display.replace(/\d+/, (n) => String(Math.round(Number(n) * eased)));
}

/**
 * Counts each figure up once, as it comes into view. Only an aria-hidden copy laid over the
 * figure counts; the figure itself stays in the page, transparent, so assistive tech reads its
 * value throughout and the line keeps its width. Under reduced motion nothing moves.
 */
export function countOnSight(values: Iterable<HTMLElement>): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      seen.unobserve(entry.target);
      countUp(entry.target as HTMLElement);
    }
  });
  for (const value of values) seen.observe(value);
}

function countUp(value: HTMLElement): void {
  const text = value.textContent ?? "";
  if (counted(text, 0) === text) return;
  const layer = document.createElement("span");
  layer.className = "count-layer";
  layer.setAttribute("aria-hidden", "true");
  value.append(layer);
  value.dataset["counting"] = "";
  const start = performance.now();
  const step = (now: number) => {
    const p = (now - start) / COUNT_MS;
    layer.textContent = counted(text, p);
    if (p < 1) requestAnimationFrame(step);
    else {
      layer.remove();
      delete value.dataset["counting"];
    }
  };
  step(start);
}
