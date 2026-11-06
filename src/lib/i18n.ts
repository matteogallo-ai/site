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
