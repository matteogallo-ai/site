// The Open Graph images and what they say, one per language. Shared by scripts/og.ts, which draws
// them, by Base.astro, which points every page at the image of its language, and by
// tests/seo.spec.ts, which checks each headline against its home page's.
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
} as const;
