export const SHOWN_MS = 1600;

/**
 * Turns the e-mail link into a button that copies the address (the page keeps the link without
 * this script). The outcome is said in `status` (role="status"), then cleared. If the clipboard
 * refuses (no permission, insecure context), the address is selected for the reader to copy.
 */
export function copyOnClick(link: HTMLAnchorElement, status: HTMLElement): void {
  const address = link.textContent?.trim() ?? "";
  const button = document.createElement("button");
  button.type = "button";
  // The link's attributes come along, the scoped-style marker (data-astro-cid-*) included.
  for (const { name, value } of link.attributes) if (name !== "href" && name !== "data-copy") button.setAttribute(name, value);
  button.textContent = address;
  button.setAttribute("aria-describedby", status.id);
  link.replaceWith(button);
  let timer = 0;
  const say = (...said: (string | Node)[]) => {
    clearTimeout(timer);
    status.replaceChildren(...said);
    timer = window.setTimeout(() => (status.textContent = ""), SHOWN_MS);
  };
  button.addEventListener("click", () => {
    navigator.clipboard.writeText(address).then(
      () => {
        // The tick is drawn by the mono subset; the sans subset has no U+2713.
        const tick = document.createElement("span");
        tick.className = "mono";
        tick.textContent = "✓";
        say("Copié ", tick);
      },
      () => {
        const range = document.createRange();
        range.selectNodeContents(button);
        getSelection()?.removeAllRanges();
        getSelection()?.addRange(range);
        say("Copie impossible : l’adresse est sélectionnée");
      },
    );
  });
}
