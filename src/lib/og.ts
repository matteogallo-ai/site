// The Open Graph images and what they say: the home page's, one per language, and each case
// study's. Shared by scripts/og.ts, which draws them, by Base.astro, which points every page at
// its image (ogImage), and by tests/seo.spec.ts, which checks every word drawn against the page.
import { createHash } from "node:crypto";
import { caseStudies, type Lang, langOf } from "./i18n.ts";
import { measure } from "./measures.ts";

export const OG = {
  width: 1200,
  height: 630,
  /** The site's dark tokens: a light card disappears in a white feed (LinkedIn). */
  scheme: "dark",
  name: "Matteo Gallo",
  role: { fr: "Ingénieur logiciel & IA · Lausanne", en: "Software & AI Engineer · Lausanne" },
  fr: {
    file: "public/og.png",
    headline: "Je construis des systèmes à base de LLM, et je mesure s’ils tiennent leurs promesses.",
    alt: "Matteo Gallo, ingénieur logiciel et IA à Lausanne : « Je construis des systèmes à base de LLM, et je mesure s’ils tiennent leurs promesses. »",
  },
  en: {
    file: "public/og-en.png",
    headline: "I build LLM systems and measure whether they deliver.",
    alt: "Matteo Gallo, software and AI engineer in Lausanne: “I build LLM systems and measure whether they deliver.”",
  },
  /** The home page's project cards, drawn beside the headline: one figure each, as the card shows it. */
  figures: [
    {
      id: "verity.twoarm_unanswerable_answered_verity",
      // A comparison: the baseline's count is read from its measure.
      caption: {
        fr: `questions sans réponse traitées comme si elles en avaient une, contre ${measure("verity.twoarm_unanswerable_answered_naive").display.fr} pour la même chaîne sans contrôles`,
        en: `unanswerable questions answered as if they had an answer, against ${measure("verity.twoarm_unanswerable_answered_naive").display.en} for the same pipeline without checks`,
      },
      dash: false,
    },
    {
      id: "promptlang.mutation_score",
      caption: {
        fr: `des ${measure("promptlang.mutants_total").display.fr} mutants détectés par ses tests (erreurs introduites exprès dans la lecture du langage et le contrôle de version)`,
        en: `of ${measure("promptlang.mutants_total").display.en} mutants detected by its tests (errors deliberately introduced into the language reader and the version check)`,
      },
      dash: false,
    },
  ],
  /** Each case study's image leads with the first figure of its brief, captioned as there, red when the brief flags it a defect. */
  cases: {
    verity: {
      id: "verity.invented_answer_rate",
      caption: {
        fr: "réponses contenant une invention, sur toutes les réponses données, que la question ait une réponse ou non (selon le juge)",
        en: "answers containing a fabrication, over every answer given, whether the question has an answer or not (according to the judge)",
      },
    },
    promptlang: {
      id: "promptlang.mutation_score",
      caption: {
        fr: "des erreurs introduites exprès dans la lecture du langage et le contrôle de version, repérées par les tests",
        en: "of the errors deliberately introduced into the language reader and the version check, caught by the tests",
      },
    },
    praxis: {
      id: "praxis.q12_cost_ratio",
      defect: true,
      caption: {
        fr: "moins cher : l’appel unique au modèle, préféré à Praxis à l’aveugle (une question, un relecteur)",
        en: "cheaper: the single model call, preferred to Praxis in a blind review (one question, one reviewer)",
      },
    },
  },
} as const;

export type CaseSlug = keyof typeof OG.cases;

/** One image to draw and to point at: the home page's in `lang`, or a case study's. */
export interface OgImage {
  lang: Lang;
  file: string;
  alt: string;
  case?: { slug: CaseSlug; no: string; name: string; value: string; caption: string; defect: boolean };
}

function caseImage(slug: CaseSlug, lang: Lang): OgImage {
  const study = caseStudies(lang).find((c) => c.name.toLowerCase() === slug)!;
  const { id, caption } = OG.cases[slug];
  const defect = "defect" in OG.cases[slug] && OG.cases[slug].defect === true;
  const value = measure(id).display[lang];
  const alt =
    lang === "fr"
      ? `${study.name}, étude de cas de Matteo Gallo : ${value} ${caption[lang]}.`
      : `${study.name}, a case study by Matteo Gallo: ${value} ${caption[lang]}.`;
  return { lang, file: `public/og/${slug}${lang === "en" ? "-en" : ""}.png`, alt, case: { slug, no: study.no, name: study.name, value, caption: caption[lang], defect } };
}

/** The figures of the home image in `lang`: the value as its card shows it, and its caption. */
/** Each card's figure: `line` is how the card writes it, value and caption in one sentence, or joined by a dash. */
export function homeFigures(lang: Lang): { id: string; value: string; caption: string; line: string }[] {
  return OG.figures.map((f) => {
    const value = measure(f.id).display[lang];
    return { id: f.id, value, caption: f.caption[lang], line: "dash" in f && !f.dash ? `${value} ${f.caption[lang]}` : `${value} — ${f.caption[lang]}` };
  });
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

/**
 * The address a page shares for the image `file`, whose bytes are `png`: its path with the first 8
 * hex digits of their sha256. LinkedIn caches a preview by image URL, so a fixed /og.png kept the
 * old picture after a redraw; a new drawing gets a new address.
 */
export function ogImageUrl(file: string, png: Uint8Array, site: string | URL): string {
  const version = createHash("sha256").update(png).digest("hex").slice(0, 8);
  return `${new URL(file.replace(/^public/, ""), site).href}?v=${version}`;
}
