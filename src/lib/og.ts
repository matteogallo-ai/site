// The Open Graph images and what they say: the home page's, one per language, and each case
// study's. Shared by scripts/og.ts, which draws them, by Base.astro, which points every page at
// its image (ogImage), and by tests/seo.spec.ts, which checks every word drawn against the page.
import { caseStudies, type Lang, langOf } from "./i18n.ts";
import { measure } from "./measures.ts";

export const OG = {
  width: 1200,
  height: 630,
  name: "Matteo Gallo",
  role: { fr: "Ingénieur logiciel & IA · Lausanne", en: "Software & AI Engineer · Lausanne" },
  fr: {
    file: "public/og.png",
    headline: "Je conçois des applications d’IA, de l’idée à la production.",
    alt: "Matteo Gallo, ingénieur logiciel et IA à Lausanne : « Je conçois des applications d’IA, de l’idée à la production. »",
  },
  en: {
    file: "public/og-en.png",
    headline: "I build AI applications, from idea to production.",
    alt: "Matteo Gallo, software and AI engineer in Lausanne: “I build AI applications, from idea to production.”",
  },
  /** The home page's project cards, drawn beside the headline: one figure each, as the card shows it. */
  figures: [
    { id: "verity.refusal_recall", caption: { fr: "questions sans réponse correctement refusées", en: "unanswerable questions correctly refused" } },
    {
      id: "promptlang.mutation_score",
      caption: { fr: "score de mutation (lexer, parser, semver ; exécution locale, hors CI)", en: "mutation score (lexer, parser, semver; local run, not in CI)" },
    },
    { id: "praxis.cost_per_briefing", caption: { fr: "par briefing live terminé", en: "per completed live briefing" } },
  ],
  /** Each case study's image leads with the first figure of its brief, captioned as there. */
  cases: {
    verity: { id: "verity.refusal_recall", caption: { fr: "questions sans réponse correctement refusées", en: "unanswerable questions correctly refused" } },
    promptlang: {
      id: "promptlang.mutation_score",
      caption: {
        fr: "des erreurs introduites exprès dans la lecture du langage et le contrôle de version, repérées par les tests",
        en: "of the errors deliberately introduced into the language reader and the version check, caught by the tests",
      },
    },
    praxis: { id: "praxis.live_completed", caption: { fr: "exécutions réelles arrivées au bout, sur les tentatives", en: "real runs that reached the end, out of the attempts" } },
  },
} as const;

export type CaseSlug = keyof typeof OG.cases;

/** One image to draw and to point at: the home page's in `lang`, or a case study's. */
export interface OgImage {
  lang: Lang;
  file: string;
  alt: string;
  case?: { slug: CaseSlug; no: string; name: string; value: string; caption: string };
}

function caseImage(slug: CaseSlug, lang: Lang): OgImage {
  const study = caseStudies(lang).find((c) => c.name.toLowerCase() === slug)!;
  const { id, caption } = OG.cases[slug];
  const value = measure(id).display[lang];
  const alt =
    lang === "fr"
      ? `${study.name}, étude de cas de Matteo Gallo : ${value} ${caption[lang]}.`
      : `${study.name}, a case study by Matteo Gallo: ${value} ${caption[lang]}.`;
  return { lang, file: `public/og/${slug}${lang === "en" ? "-en" : ""}.png`, alt, case: { slug, no: study.no, name: study.name, value, caption: caption[lang] } };
}

/** The figures of the home image in `lang`: the value as its card shows it, and its caption. */
export function homeFigures(lang: Lang): { id: string; value: string; caption: string }[] {
  return OG.figures.map((f) => ({ id: f.id, value: measure(f.id).display[lang], caption: f.caption[lang] }));
}

/** The image a page at `path` points to: its case study's, or its language's home image. */
export function ogImage(path: string): OgImage {
  const lang = langOf(path);
  const slug = /^\/(?:projets|en\/projects)\/([a-z]+)\/?$/.exec(path)?.[1];
  if (slug && Object.hasOwn(OG.cases, slug)) return caseImage(slug as CaseSlug, lang);
  const values = homeFigures(lang).map((f) => f.value);
  const figures = lang === "fr" ? `À côté, un chiffre par projet : ${values.slice(0, -1).join(", ")} et ${values.at(-1)}.` : `Beside it, one figure per project: ${values.slice(0, -1).join(", ")} and ${values.at(-1)}.`;
  return { lang, file: OG[lang].file, alt: `${OG[lang].alt} ${figures}` };
}

/** Every image scripts/og.ts draws. */
export function ogImages(): OgImage[] {
  return (["fr", "en"] as const).flatMap((lang) => [ogImage(lang === "fr" ? "/" : "/en/"), ...(Object.keys(OG.cases) as CaseSlug[]).map((slug) => caseImage(slug, lang))]);
}
