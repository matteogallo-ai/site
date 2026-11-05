# Claims register

Every capability that the README or the site states about this repository is
listed here with what implements it, the check that proves it, and its status.
Statuses: `shipped` (implemented, and the check passes in CI), `local` (implemented,
the check passes locally, CI has not run it on GitHub), `roadmap` (not implemented).
`shipped` rows were first proved by CI run
https://github.com/matteogallo-ai/site/actions/runs/42036373324 (PR #1); the measures and
demo-trace rows by https://github.com/matteogallo-ai/site/actions/runs/42041962003 (PR #2).

| Claim | Implemented in | Proved by | Status |
| --- | --- | --- | --- |
| Lighthouse ≥ 98 on performance, accessibility, best practices and SEO, on every built page (a missing page fails `npm run measures`), blocking | `lighthouserc.cjs` | CI job `lighthouse budgets + site measures` (`npm run lighthouse`) | shipped |
| LCP < 1.5 s and CLS < 0.05 (Lighthouse mobile, median of 5 runs), blocking | `lighthouserc.cjs` | same job | shipped |
| Home page ≤ 200 000 bytes transferred (gzip), project images included, blocking | `lighthouserc.cjs` (`resource-summary:total:size`), `scripts/site-measures.ts` (adds each project image a run did not request at its heaviest AVIF variant, and fails over the budget) | CI job `lighthouse budgets + site measures`, `scripts/site-measures.test.ts` | local |
| Fonts ≤ 90 000 bytes transferred on every page, home included, blocking | `scripts/fonts/subset.py`, `lighthouserc.cjs` (`resource-summary:font:size`) | CI job `lighthouse budgets + site measures` | shipped |
| Every character a page displays (text, pseudo-elements, list markers, quotes, form fields) is in the subset of the font that draws it, in a weight and style that subset ships | `src/assets/fonts/coverage.json`, `tests/collect-text.ts` | `tests/glyphs.spec.ts` (with a self-test on injected probes), `scripts/glyphs.test.ts` | shipped |
| A page downloads no font it draws no text with (the serif loads only on pages that declare it) | `src/layouts/Base.astro` (`serif` prop) | `tests/glyphs.spec.ts` | shipped |
| The committed font subsets, licences and coverage are exactly what the pinned script produces from pinned upstream releases | `scripts/fonts/subset.py` | CI job `font subsets reproducible` | shipped |
| 0 axe violation (WCAG 2.2 A/AA tags), light and dark, every built HTML page, blocking | `tests/a11y.spec.ts` | CI job `axe + keyboard` | shipped |
| The text and graphic colour pairs listed in `contrast.test.ts` meet WCAG AA, light and dark | `src/styles/tokens.css` | `src/styles/contrast.test.ts` (CI job `typecheck + unit tests`) | shipped |
| No broken internal link or CSS asset reference | `linkinator.config.json` | CI job `build + links` | shipped |
| Every evidence item of `src/data/measures.json` (a JSON value at a pointer, or a passage of text) is stated by its file in the cited repository at the pinned commit, and every cited file exists there; a counted set of files (the Praxis live runs) equals the directory listing at that commit (GitHub contents API) | `src/data/measures.json`, `scripts/check-sources.ts` | CI job `measures + demo traces match their sources` (`npm run check:sources`) | shipped |
| Every figure field of a measure (value, k, n, interval) equals the evidence item that binds it, or the entry writes how it is derived; every number in its displayed text is one of its figures at the precision shown, and every number in its label is stated by its evidence; a gap carries no figure | `scripts/measures-lib.ts` | `scripts/measures.test.ts` | shipped |
| The two demo traces are copied unchanged from a committed Verity run (file sha256, record, run settings), and every offset selects exactly the quoted words of the demo document | `src/data/demo/`, `scripts/traces-lib.ts` | `scripts/traces.test.ts` (offline), `npm run check:sources` (against GitHub) | shipped |
| The demo magnifier is centred within 8 px on the words it points at (the cited quote, or the priority list of the refusal's closest passage), covers them, and holds their enlarged copy under its centre, at 375, 1024 and 1440 px, after a width change (motion on), and without widening the page | `src/components/VerityDemo.astro`, `src/scripts/verity-demo.ts`, `src/scripts/lens.ts` | `tests/magnifier.spec.ts`, `src/scripts/lens.test.ts` | local |
| The demo modes are an ARIA tablist operated with arrows, Home and End; the refusal card carries no threshold check | `src/components/VerityDemo.astro`, `src/scripts/verity-demo.ts` | `tests/magnifier.spec.ts` | local |
| The highlighted words on the demo contract are exactly the cited quote and the refusal's priority list, cut at the trace offsets | `src/lib/document.ts` | `src/lib/document.test.ts` | local |
| Every figure on the home page is read from `src/data/measures.json`; an unknown or gap measure fails the build | `src/lib/measures.ts`, `src/components/Figure.astro` | `src/lib/measures.test.ts` | local |
| The project images come from their repositories at pinned commits: the Verity and PromptLang stills have the pixels of a pinned frame of their committed live recordings, the Praxis image those of the first page of a committed live briefing PDF | `src/data/media.json`, `scripts/media-frame.ts`, `scripts/media/pdf_page.py` | `scripts/media.test.ts`, CI job `measures + demo traces match their sources` (`media-frame.ts --check`, `pdf_page.py --check`) | local |
| No published page renders a placeholder (gap marker, « Manquant » / « Missing: », a gap measure as Figure renders it, TODO outside code and comments): the build fails | `scripts/gaps.ts` (Astro integration in `astro.config.mjs`) | `scripts/gaps.test.ts`, `npm run build` | local |
| The demo answer writes itself word by word and its checks show only once it is written; an answer on screen at load is left as it is, one below the fold writes itself as it enters the view; under reduced motion it is shown whole at once | `src/scripts/typing.ts`, `src/scripts/verity-demo.ts` | `src/scripts/typing.test.ts`, `tests/glass-motion.spec.ts` | local |
| The glass (navigation, magnifier, answer card) carries the SVG refraction filters in Chromium, the frosted blur alone when the engine has no `navigator.userAgentData` (simulated in Chromium), and neither under reduced transparency (computed styles) | `src/components/Glass.astro`, `src/styles/global.css` | `tests/glass-motion.spec.ts` | local |
| Each figure's proof path shows on hover and keyboard focus without widening a 375 px page, and Escape dismisses it | `src/components/Figure.astro` | `tests/magnifier.spec.ts` | local |
| Without JavaScript both demo cards and the detailed bio are shown, and no inert control | `src/components/VerityDemo.astro`, `src/components/Bio.astro` | `tests/magnifier.spec.ts` | local |
| The footer shows the site's own measured weight and scores | `scripts/site-measures.ts` writes `site-measures.json` | `scripts/site-measures.test.ts` | roadmap: the file is generated in CI; no page reads it |
