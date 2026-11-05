/**
 * Runs inside the page (passed to page.evaluate): every character the page can display,
 * grouped by the font role that draws it, plus faces it cannot draw with the shipped files.
 */
export function collectText() {
  type Role = "sans" | "serif" | "mono";
  const first = (stack: string) => (stack.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
  const root = getComputedStyle(document.documentElement);
  const roles: Record<string, Role> = {};
  for (const role of ["sans", "serif", "mono"] as const) {
    const family = first(root.getPropertyValue(`--font-${role}`));
    if (family) roles[family] = role;
  }
  // Weights and styles each role's files provide (scripts/fonts/subset.py).
  const faces: Record<Role, (w: number, s: string) => boolean> = {
    sans: (w, s) => w >= 400 && w <= 700 && s === "normal",
    serif: (w, s) => (w === 400 || w === 600) && s === "normal",
    mono: (w, s) => w === 400 && s === "normal",
  };
  const MARKERS: Record<string, string> = { disc: "•", circle: "◦", square: "▪", "disclosure-open": "▾", "disclosure-closed": "▸" };

  const byRole: Partial<Record<Role, string>> = {};
  const problems: string[] = [];
  const used = new Set<Role>();

  const add = (el: Element, text: string, pseudo?: string) => {
    if (/^[\t\n\r ]*$/.test(text)) return;
    const style = getComputedStyle(el, pseudo);
    const transform = style.textTransform;
    // capitalize: check the upper case of every character, a superset of what is drawn.
    if (transform === "uppercase" || transform === "capitalize") text += text.toUpperCase();
    if (transform === "lowercase") text = text.toLowerCase();
    const role = roles[first(style.fontFamily)];
    const where = `${el.tagName.toLowerCase()}${pseudo ?? ""} "${text.trim().slice(0, 30)}"`;
    if (!role) return void problems.push(`no subset font: ${style.fontFamily} for ${where}`);
    if (!faces[role](Number(style.fontWeight), style.fontStyle)) {
      problems.push(`${role} has no ${style.fontWeight} ${style.fontStyle} face: ${where}`);
    }
    used.add(role);
    byRole[role] = (byRole[role] ?? "") + text;
  };
  // Literal strings of a computed `content` value ("→ " or open-quote are the cases that occur).
  const contentStrings = (content: string) => [...content.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => (m[1] ?? "").replace(/\\(.)/g, "$1"));

  for (const el of document.body.querySelectorAll("*")) {
    if (el.closest("script, style, noscript, template")) continue;
    // Hidden text counts too: a skip link or a toggled bio is still drawn at some point.
    for (const node of el.childNodes) if (node.nodeType === Node.TEXT_NODE) add(el, node.textContent ?? "");
    for (const pseudo of ["::before", "::after"]) for (const s of contentStrings(getComputedStyle(el, pseudo).content)) add(el, s, pseudo);
    const style = getComputedStyle(el);
    if (style.display === "list-item") add(el, MARKERS[style.listStyleType] ?? "", "::marker");
    if (el.tagName === "Q") add(el, style.quotes === "auto" ? "«»“”‘’" : contentStrings(style.quotes).join(""));
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) add(el, `${el.value}${el.placeholder}`);
  }
  return { byRole, problems, used: [...used] };
}
