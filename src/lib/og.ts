// The Open Graph images and what they say: the home page's, one per language, and each case
// study's. Shared by scripts/og.ts, which draws them, by Base.astro, which points every page at
// its image (ogImage), and by tests/seo.spec.ts, which checks every word drawn against the page.
import { caseStudies, type Lang, langOf } from "./i18n.ts";
import { measure } from "./measures.ts";

export const OG = {
  width: 1200,
  height: 630,
  name: "Matteo Gallo",
  role: "Software & AI Engineer · Lausanne",
  fr: {
    file: "public/og.png",
    headline: "Je construis des produits IA qu’on peut vérifier.",
    alt: "Matteo Gallo, Software & AI Engineer à Lausanne : « Je construis des produits IA qu’on peut vérifier. »",
  },
  en: {
    file: "public/og-en.png",
    headline: "I build AI products you can verify.",
    alt: "Matteo Gallo, Software & AI Engineer in Lausanne: “I build AI products you can verify.”",
  },
  /** The home page's band, drawn beside the headline: its figures and captions, in its order. */
  band: [
    {
      id: "verity.hallucination_rate",
      caption: {
        fr: "réponses avec une hallucination, selon un juge LLM, parmi les questions avec réponse auxquelles Verity a répondu",
        en: "answers with a hallucination, according to an LLM judge, among the answerable questions Verity answered",
      },
      defect: false,
    },
    { id: "verity.refusal_recall", caption: { fr: "questions sans réponse correctement refusées", en: "unanswerable questions correctly refused" }, defect: false },
    {
      id: "verity.unanswerable_answered",
      caption: { fr: "questions sans réponse auxquelles il a quand même répondu : son défaut principal", en: "unanswerable questions it answered anyway: its main defect" },
      defect: true,
    },
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

/** The image a page at `path` points to: its case study's, or its language's home image. */
export function ogImage(path: string): OgImage {
  const lang = langOf(path);
  const slug = /^\/(?:projets|en\/projects)\/([a-z]+)\/?$/.exec(path)?.[1];
  if (slug && slug in OG.cases) return caseImage(slug as CaseSlug, lang);
  const values = OG.band.map((b) => measure(b.id).display[lang]);
  const figures = lang === "fr" ? `À côté, trois chiffres de Verity : ${values.slice(0, -1).join(", ")} et ${values.at(-1)}.` : `Beside it, three figures of Verity: ${values.slice(0, -1).join(", ")} and ${values.at(-1)}.`;
  return { lang, file: OG[lang].file, alt: `${OG[lang].alt} ${figures}` };
}

/** Every image scripts/og.ts draws. */
export function ogImages(): OgImage[] {
  return (["fr", "en"] as const).flatMap((lang) => [ogImage(lang === "fr" ? "/" : "/en/"), ...(Object.keys(OG.cases) as CaseSlug[]).map((slug) => caseImage(slug, lang))]);
}
