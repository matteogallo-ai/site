// French at /, English at /en/ (SPEC §7). A page and its translation are twins: same place in
// each tree, path segments translated by SEGMENTS. tests/seo.spec.ts fails if a built page has no
// built twin, so every link this module computes leads to a page.

export type Lang = "fr" | "en";

/** French path segment -> English. */
const SEGMENTS: Record<string, string> = { projets: "projects" };

export const langOf = (path: string): Lang => (path === "/en" || path.startsWith("/en/") ? "en" : "fr");

/** The same page in the other language: `/projets/verity/` <-> `/en/projects/verity/`. */
export function twin(path: string): string {
  const swap = (segment: string, to: Record<string, string>) => to[segment] ?? segment;
  if (langOf(path) === "fr") return `/en${path.split("/").map((s) => swap(s, SEGMENTS)).join("/")}`;
  const french = Object.fromEntries(Object.entries(SEGMENTS).map(([fr, en]) => [en, fr]));
  return path.replace(/^\/en(?=\/|$)/, "").split("/").map((s) => swap(s, french)).join("/") || "/";
}

/** The hreflang alternates of a page: each language, and x-default on the French page. */
export function alternates(path: string): { hreflang: "fr" | "en" | "x-default"; path: string }[] {
  const fr = langOf(path) === "fr" ? path : twin(path);
  const en = twin(fr);
  return [
    { hreflang: "fr", path: fr },
    { hreflang: "en", path: en },
    { hreflang: "x-default", path: fr },
  ];
}

/** A project's number as each language writes it: « N° 01 », "No. 01"; never split across lines. */
export function numbered(n: string, lang: Lang): string {
  return `${lang === "fr" ? "N°" : "No."}\u00A0${n}`;
}

/** The three case studies, in their order, at their address in `lang`. */
export function caseStudies(lang: Lang): { no: string; name: string; href: string }[] {
  return [
    { no: "01", name: "Verity", href: "/projets/verity/" },
    { no: "02", name: "PromptLang", href: "/projets/promptlang/" },
    { no: "03", name: "Praxis", href: "/projets/praxis/" },
  ].map((c) => ({ ...c, href: lang === "fr" ? c.href : twin(c.href) }));
}
