# Personal site — specification

The reference specification for this site: structure, visual system, content
rules, technique and accessibility.

## 1. Goal and reader
- **Reader:** a technical lead hiring a software/AI engineer, who decides within 30 seconds.
- **What the site does:** confirm, not sell. One screen answers who, what, the proof, and how to get in touch.
- **Single message:** "I build AI products you can verify." Complete products, every measure published, defects included.
- The site proves by demonstration, not by effect.

## 2. Concept: "Verity at work"
Plain text on the left, one strong visual on the right: Verity working on a contract.
- **The card first:** the question, the cited passage (highlighted, proof colour; for a refusal the closest passage, defect colour) and the checked answer, then the checks (quote found word for word, claims supported, confidence) and the section the quote sits in. On the French page these are shown in French (translations bound to the English they translate: `translations.json`, `passages.json`); the run's own English is folded under « Original anglais ». The tabs, the whole card and its passage fit on the first screen (tested at 1440×800 and 1280×720).
- **The contract page, folded:** real text from Verity's demo corpus, never invented, set in a serif like a real document, behind « Voir le contrat complet (anglais) » / "See the full contract". Unfolded, it is seen through a window of fixed height scrolled by code to the passage in play, fading out at the top and bottom.
- **The spotlight:** in the unfolded contract, the text dims (still AA) and the passage in play keeps the ink, held whole inside a ring of glass, under a tag that names it; nothing is enlarged and the lines around the passage move apart, so neither the ring nor the tag covers another line. The ring's position is **computed** from the real position of the cited words in the page (Range API / `getBoundingClientRect`), never hard-coded, and recomputed on resize.
- **The frame:** the demo is framed and captioned « Démo : Verity sur un contrat de test » / "Demo: Verity on a test contract" (it replays a committed run, it does not call the model). Under it, a quiet note: « Traduit d’une exécution réelle en anglais · Voir la trace originale » / "Replay of a real run · See the original trace", the link pointing to the committed run. File names stay off the home page; the run's source is detailed on the Verity case study.
- **Two modes:** « Il répond, en citant » / "It answers, citing" and « Il refuse, faute de preuve » / "It refuses, for lack of evidence" (the closest passage retrieved, marked "judged insufficient"). Highlight, spotlight and card change with a transition. Both traces come from **real committed runs** of Verity.
- **Colour of proof:** green (`#1E8A4C`, text `#17703D`) for everything proven (highlights, ticks). Brick red `#A8382A` for defects and refusals. Night blue `#1C2A44` as the secondary colour, taken from the portrait.
- Watchmaking stays in the DNA without being drawn: calibre numbers on the case studies (« N° 01 » in French, “No. 01” in English), monospace figures, precision.

## 3. Pages

### 3.1 Home `/`
1. **Navigation:** floating glass pill. Projects · Method · About, and the FR | EN selector; Writing joins it once an article exists. On the other pages the selector sits in the header.
2. **First screen:** sober, readable by a recruiter in 30 seconds; no band of figures.
   - Left, in small type: the **portrait** (56 px, round), the name, « Ingénieur logiciel & IA · Lausanne » / "Software & AI Engineer · Lausanne" and the status « Disponible pour un poste » / "Available for a role" (green dot). Then the headline, 32 px at 375 px to 38 px from 1440 px, in at most 5 lines at 375 px and 4 at 1440 px: « Je construis des systèmes à base de LLM, et je mesure s’ils tiennent leurs promesses. » (EN: "I build LLM systems and measure whether they deliver.") Under it: « Recherche documentaire qui cite ou refuse, langage typé pour prompts, pipelines d’analyse : chaque résultat publié avec sa preuve. », and the buttons « Voir les projets » and « Écrire un e-mail ».
   - Right: the Verity demo (section 2).
3. **Projects:** 2 cards (Verity, PromptLang; no calibre number), each with **a real screenshot or GIF** of the product and a one-line caption (« Démo enregistrée : … Voir le GIF ↗ »; the detail is in the alt text), one sentence opening with what the project is technically (no jargon left unexplained, except PromptLang's, which names its terms bare, as its case study's first sentence does: « Compilateur pour un langage typé de prompts : génère du code TypeScript et Python, publié sur npm. », EN "A compiler for a typed prompt language: generates TypeScript and Python, published on npm."), **one** figure linked to its proof and written with what it is compared with (a baseline, a sample size), and at the foot a secondary button « Lire l’étude de cas → » beside « Code sur GitHub ↗ ». Verity's figure is the pre-registered comparison with a naive RAG; PromptLang's, its mutation score with the number of mutants it is taken over. Limits and technologies live on the case studies. The whole card opens its case study (its title is the link, stretched over the card; the links it holds stay their own, above it); under the pointer it rises 2 px and its border darkens, and keyboard focus rings the whole card. The other figures stay on the case studies. Under the cards, a short « Expériences » (“Experiments”) list: one line per project whose result did not hold, linking to its case study and to the published result; Praxis's reads « Praxis — pipeline d’analyse en 7 étapes ; comparé à l’aveugle à un appel unique 9,8× moins cher, il n’a pas fait mieux. Résultat publié. » (EN: "Praxis — a 7-stage analysis pipeline; compared blind with a single call 9.8× cheaper, it did no better. Result published."), its two figures linked to their proof. Its case study stays, the result among its known limits.
4. **Method:** 3 cards side by side with noun titles (« Audit indépendant », « Lecture des sorties réelles », « Évaluation pré-enregistrée »), the real incident behind each in at most two sentences and the link to its PR. Link to the repository.
5. **Writing:** dated list of published articles. The section is left out while none is published.
6. **About and contact**, one closing section on two columns. Left, the bio in one block: role and city, how I work with coding agents, initial training, languages, what I am looking for; then one personal line, set apart (« En dehors du code, j’assemble des montres Seiko personnalisées et je joue du piano. »). Right: "Un poste d'ingénieur logiciel et IA en Suisse romande ? Écrivez-moi.", the e-mail in large type, LinkedIn and GitHub as buttons. No form.
7. **Footer:** the site's own measures (weight, Lighthouse, build date, commit), generated by CI. Link to the Colophon.

### 3.2 Case studies `/projets/<slug>`
Problem (3 lines) · what I built (1 SVG diagram) · measures (table with intervals and baseline, linked to the artefacts) · known limits and next steps (each written scope → known limit → next step) · 3 decisions (ADR) · how it is built · what comes next.

### 3.3 Writing `/ecrits/<slug>`
68-character column, tabular figures, numbered figures, interactive demos allowed inside articles.

### 3.4 Colophon `/colophon`
How the site is built: stack, budgets, real measures, accessibility choices, what was delegated to coding agents and what was reviewed. A short page.

### 3.5 404
"No proof at this address." and a link home.

## 4. Visual system
- **Type:** Inter (headings and body; no optical-size axis, the display look of headings comes from the negative tracking), Source Serif 4 at 400 and 600 (only the demo contract and quotes, loaded only by the pages that declare it; renamed "Site Serif" inside the font files because "Source" is a Reserved Font Name under the OFL), JetBrains Mono at 400 (measures, traces). Self-hosted strict subsets, built by `scripts/fonts/subset.py` from pinned upstream releases.
- **Scale:** 12 · 14 · 16 · 21 · 28 · 44 · 68 px. Negative tracking on large headings. The home headline alone is fluid, between 32 and 38 px (§3.1): at 68 px its French text took 7 lines.
- **Colours:** paper `#F5F4F0`, ink `#111111`, graphite `#52524E` (7:1 on the paper), rules `#DAD8D2`, proof `#1E8A4C`/`#17703D`, defect `#A8382A`, night blue `#1C2A44`. Automatic dark mode (`prefers-color-scheme`, no toggle): paper `#101110`, cards and demo on the sheet `#1D1E1B` with a 1 px rule, graphite `#B0AEA6`. Body and secondary text at 7:1 or more, accents at 4.5:1, on the paper and the sheet, in both modes (contrast.test.ts).
- **Grid:** 12 columns, 24 px gutter, 1200 px container. Dotted vertical rules, "+" marks between sections, numbered sections.
- **Glass:** only the navigation, the spotlight's ring and the answer card. Frosted glass everywhere; SVG refraction as progressive enhancement (Chromium); opaque version under `prefers-reduced-transparency`. Text on glass only over a known, controlled background.
- **Motion:** one set of tokens in `tokens.css`: `--ease-out` `cubic-bezier(.22,1,.36,1)` for entrances and hovers, `--ease-in-out` `cubic-bezier(.65,0,.35,1)` for things that travel; press 90 ms, hover 180 ms, move 280 ms, reveal 480 ms. Transitions name their properties (never `all`); only transform and opacity move continuously. The spotlight glides to the clause, the answer writes itself, the ticks appear in order. Writing the answer is a reading animation, not a transition: about 35 ms a word, at most 1.5 s; a click or a key shows it whole, and only an `aria-hidden` visual layer is animated, so assistive tech reads the whole answer from the start. Figures never count: a screenshot taken during a count would show a wrong figure; the sections below the first screen come into place once as it scrolls into view: its children rise 12 px and fade in over 480 ms, 60 ms apart (four steps at most); nothing visible at load moves, except the answer writing itself. Under `prefers-reduced-motion` nothing travels or scales and the final state is shown at once; colours still change, in 120 ms at most.

## 5. Signature details
1. The Verity demo with the spotlight computed on the citation.
2. Every figure is a link to its proof: a thin solid underline and ↗ in the proof colour (the artefact path shown on hover and focus). Every link that leaves the site carries ↗ (an e-mail link opens the mail client and does not; neither does a case study's image, whose caption link carries it); internal links never do. Within a sentence a figure is a word of it: one space after it, no more.
3. The footer that measures itself, and the Colophon page.

## 6. Content rules
- No figure without a source: everything comes from `src/data/measures.json`, filled from the published artefacts of the repositories at their current commit, with link and hash.
- No placeholder on a published page: an element of §3 whose content or target does not exist yet (the EN version and its language selector, the Writing section, case-study links, the résumé PDF, the footer site measures, the Colophon link) is left out of the page until it does, and nothing announces it ("forthcoming", a language label without its page); the build fails on any placeholder, announcement, or language label or `hreflang` link without a built page behind it.
- No skills wall, no technology logos, no carousel, no form, no templated developer-portfolio layout.
- Defects shown at the same level as measures.
- Public resume: no postal address, phone or date of birth. The PDF published on the site carries only e-mail, LinkedIn, GitHub and city.
- Languages: French and Italian native, English intermediate, Spanish basics.
- Path: self-taught; automation technician training at ETML, a full-time vocational school (not an apprenticeship), left in the second year to focus on software development.

## 7. Languages
French at `/`, English at `/en/`, translated by hand, correct `hreflang` (x-default: the French page). Case-study paths are translated (`/projets/x/` ↔ `/en/projects/x/`); section anchors and figures are the same in both languages.

## 8. Technique
- **Astro**, static, zero JS by default. JS islands: the Verity demo and the one-time reveal of the sections (figures never count up: any value between two is a wrong figure).
- **Cloudflare Pages** through its Git integration (no token). Canonical address: `https://matteogallo.ch` (the custom domain; `site` in `astro.config.mjs` is the one place the pages take it from; `linkinator.config.json` also names it, to skip it, and `tests/seo.spec.ts` pins it); `matteogallo.pages.dev` is the Pages project's own address.
- **Blocking budgets in CI:** home ≤ 200 KB transferred excluding deferred screenshots, measured with gzip (stricter than the brotli Cloudflare serves, on purpose); fonts ≤ 90 000 bytes on any page; LCP < 1.5 s; CLS < 0.02; Lighthouse ≥ 98 on all 4 categories; 0 axe violation.
- **CI:** build, typecheck, links, Lighthouse CI, axe, budgets, spotlight position test at 3 widths, generation of `site-measures.json`.
- Portrait: `src/assets/matteo.jpg` (800 × 800), served as AVIF/WebP at the sizes used.
- Metadata: Open Graph (drawn on the dark tokens, every colour at 7:1 or more, so it stands out in a white feed; the home image: the first screen's headline beside the projects' figures, one per card; each case study its own, its name beside the first figure of its brief), favicon in the ink and paper tokens with `favicon.ico` and `apple-touch-icon.png`, sitemap, robots. No tracker.
- Typography is set by the build, per element language (`scripts/typography.ts`): French spaces before ; ! ? % : $ and inside « », curly apostrophes and quotes; ranges as « 18–46 % ».

## 9. Accessibility
AA everywhere, full keyboard, visible focus, skip link, demo tabs as a real ARIA `tablist`, motion/transparency/colour preferences respected, real alternative text.
