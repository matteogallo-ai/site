// WCAG 1.4.13: content shown on hover or focus can be dismissed without moving either. A
// .tip-host shows its .tip on hover and keyboard focus (global.css) until Escape is pressed.
let ready = false;

/** Safe to call from every component that has tips: the listeners are set once per page. */
export function dismissibleTips(): void {
  if (ready) return;
  ready = true;
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    for (const host of document.querySelectorAll<HTMLElement>(".tip-host:hover, .tip-host:focus-visible")) host.dataset["dismissed"] = "";
  });
  for (const host of document.querySelectorAll<HTMLElement>(".tip-host")) {
    const reset = () => delete host.dataset["dismissed"];
    host.addEventListener("blur", reset);
    host.addEventListener("mouseleave", reset);
  }
}
