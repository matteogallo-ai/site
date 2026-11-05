# Claims register

Every capability that the README or the site states about this repository is
listed here with what implements it, the check that proves it, and its status.
Statuses: `shipped` (implemented, and the check passes in CI), `local` (implemented,
the check passes locally, CI has not run it on GitHub), `roadmap` (not implemented).

| Claim | Implemented in | Proved by | Status |
| --- | --- | --- | --- |
| Lighthouse ≥ 98 on performance, accessibility, best practices and SEO, on every built page (a missing page fails `npm run measures`), blocking | `lighthouserc.cjs` | CI job `lighthouse budgets + site measures` (`npm run lighthouse`) | local |
| LCP < 1.5 s and CLS < 0.05 (Lighthouse mobile, median of 3 runs), blocking | `lighthouserc.cjs` | same job | local |
| Home page ≤ 200 000 bytes transferred (gzip), blocking; deferred screenshots assumed outside, unverified while the site has none | `lighthouserc.cjs` (`resource-summary:total:size`) | same job | local |
| 0 axe violation (WCAG 2.2 A/AA tags), light and dark, every built HTML page, blocking | `tests/a11y.spec.ts` | CI job `axe + keyboard` | local |
| The text and graphic colour pairs listed in `contrast.test.ts` meet WCAG AA, light and dark | `src/styles/tokens.css` | `src/styles/contrast.test.ts` (CI job `typecheck + unit tests`) | local |
| No broken internal link or CSS asset reference | `linkinator.config.json` | CI job `build + links` | local |
| The footer shows the site's own measured weight and scores | `scripts/site-measures.ts` writes `site-measures.json` | `scripts/site-measures.test.ts` | roadmap: the file is generated in CI; no page reads it |
