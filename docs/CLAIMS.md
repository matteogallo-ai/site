# Claims register

Every capability that the README or the site states about this repository is
listed here with what implements it, the check that proves it, and its status.
Statuses: `shipped` (implemented, and the check passes in CI), `local` (implemented,
the check passes locally, CI has not run it on GitHub), `roadmap` (not implemented).
`shipped` rows were first proved by CI run
https://github.com/matteogallo-ai/site/actions/runs/42036373324 (PR #1).

| Claim | Implemented in | Proved by | Status |
| --- | --- | --- | --- |
| Lighthouse ≥ 98 on performance, accessibility, best practices and SEO, on every built page (a missing page fails `npm run measures`), blocking | `lighthouserc.cjs` | CI job `lighthouse budgets + site measures` (`npm run lighthouse`) | shipped |
| LCP < 1.5 s and CLS < 0.05 (Lighthouse mobile, median of 3 runs), blocking | `lighthouserc.cjs` | same job | shipped |
| Home page ≤ 200 000 bytes transferred (gzip), blocking; deferred screenshots assumed outside, unverified while the site has none | `lighthouserc.cjs` (`resource-summary:total:size`) | same job | shipped |
| Fonts ≤ 90 000 bytes transferred on every page, home included, blocking | `scripts/fonts/subset.py`, `lighthouserc.cjs` (`resource-summary:font:size`) | CI job `lighthouse budgets + site measures` | shipped |
| Every character a page displays (text, pseudo-elements, list markers, quotes, form fields) is in the subset of the font that draws it, in a weight and style that subset ships | `src/assets/fonts/coverage.json`, `tests/collect-text.ts` | `tests/glyphs.spec.ts` (with a self-test on injected probes), `scripts/glyphs.test.ts` | shipped |
| A page downloads no font it draws no text with (the serif loads only on pages that declare it) | `src/layouts/Base.astro` (`serif` prop) | `tests/glyphs.spec.ts` | shipped |
| The committed font subsets, licences and coverage are exactly what the pinned script produces from pinned upstream releases | `scripts/fonts/subset.py` | CI job `font subsets reproducible` | shipped |
| 0 axe violation (WCAG 2.2 A/AA tags), light and dark, every built HTML page, blocking | `tests/a11y.spec.ts` | CI job `axe + keyboard` | shipped |
| The text and graphic colour pairs listed in `contrast.test.ts` meet WCAG AA, light and dark | `src/styles/tokens.css` | `src/styles/contrast.test.ts` (CI job `typecheck + unit tests`) | shipped |
| No broken internal link or CSS asset reference | `linkinator.config.json` | CI job `build + links` | shipped |
| Every evidence item of `src/data/measures.json` (a JSON value at a pointer, or a passage of text) is stated by its file in the cited repository at the pinned commit, and every cited file exists there; a counted set of files (the Praxis live runs) equals the directory listing at that commit (GitHub contents API) | `src/data/measures.json`, `scripts/check-sources.ts` | CI job `measures + demo traces match their sources` (`npm run check:sources`) | local |
| Every figure field of a measure (value, k, n, interval) equals the evidence item that binds it, or the entry writes how it is derived; every number in its displayed text is one of its figures at the precision shown, and every number in its label is stated by its evidence; a gap carries no figure | `scripts/measures-lib.ts` | `scripts/measures.test.ts` | local |
| The two demo traces are copied unchanged from a committed Verity run (file sha256, record, run settings), and every offset selects exactly the quoted words of the demo document | `src/data/demo/`, `scripts/traces-lib.ts` | `scripts/traces.test.ts` (offline), `npm run check:sources` (against GitHub) | local |
| The footer shows the site's own measured weight and scores | `scripts/site-measures.ts` writes `site-measures.json` | `scripts/site-measures.test.ts` | roadmap: the file is generated in CI; no page reads it |
