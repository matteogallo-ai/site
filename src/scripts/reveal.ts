/**
 * Sections below the first screen come into place once, as they enter the view (SPEC §4): the
 * root gets data-reveal, which holds back each .reveal section's children until the section has
 * data-shown. A section already on screen when this runs is shown as it is, so nothing visible at
 * load moves. Without this script, or under reduced motion, nothing is ever held back.
 */
export function revealOnSight(sections: Iterable<HTMLElement>): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  const seen = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset["shown"] = "";
        seen.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -10% 0px" },
  );
  for (const section of sections) {
    const box = section.getBoundingClientRect();
    if (box.top < innerHeight && box.bottom > 0) section.dataset["shown"] = "";
    else seen.observe(section);
  }
  document.documentElement.dataset["reveal"] = "";
}
