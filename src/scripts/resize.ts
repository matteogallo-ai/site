/**
 * Runs `change`, which alters what `box` holds, and lets the box's height travel from the old
 * height to the new one (its CSS declares the height transition). With no transition (reduced
 * motion), the height is left to the content at once: a transition of 0 s fires no
 * transitionend, which would leave the height fixed.
 */
export function resize(box: HTMLElement, change: () => void): void {
  const from = box.getBoundingClientRect().height;
  box.style.height = "";
  change();
  const to = box.getBoundingClientRect().height;
  if (from === to || Number.parseFloat(getComputedStyle(box).transitionDuration) === 0) return;
  box.style.height = `${from}px`;
  // Read once so the browser starts from the old height rather than skipping to the new one.
  void box.offsetHeight;
  box.style.height = `${to}px`;
  const done = (event: TransitionEvent) => {
    if (event.target !== box || event.propertyName !== "height") return;
    box.style.height = "";
    box.removeEventListener("transitionend", done);
  };
  box.addEventListener("transitionend", done);
}
