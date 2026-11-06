// The Open Graph image and what it says. Shared by scripts/og.ts, which draws it, by Base.astro,
// which points every page at it, and by tests/seo.spec.ts, which checks the headline against
// the home page's.
export const OG = {
  width: 1200,
  height: 630,
  file: "public/og.png",
  headline: "Je construis des produits IA qu’on peut vérifier.",
  name: "Matteo Gallo",
  role: "Software & AI Engineer · Lausanne",
  alt: "Matteo Gallo, Software & AI Engineer à Lausanne : « Je construis des produits IA qu’on peut vérifier. »",
} as const;
