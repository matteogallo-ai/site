# Claims register

Every capability that the README or the site states about this repository is
listed here with what implements it, the check that proves it, and its status.
Statuses: `shipped` (implemented, and the check passes in CI), `roadmap` (not implemented).

| Claim | Implemented in | Proved by | Status |
| --- | --- | --- | --- |
| Lighthouse ≥ 98 on performance, accessibility, best practices and SEO, on every page, blocking | `lighthouserc.cjs` | CI job `lighthouse budgets + site measures` (`npm run lighthouse`) | shipped |
| LCP < 1.5 s and CLS < 0.05 (Lighthouse mobile, median of 3 runs), blocking | `lighthouserc.cjs` | same job | shipped |
| Home page ≤ 200 KB transferred, excluding deferred screenshots, blocking | `lighthouserc.cjs` (`resource-summary:total:size`) | same job | shipped |
| 0 axe violation (WCAG 2.2 A/AA tags), light and dark, every page, blocking | `tests/a11y.spec.ts` | CI job `axe + keyboard` | shipped |
| Every colour pair of the design tokens meets WCAG AA, light and dark | `src/styles/tokens.css` | `src/styles/contrast.test.ts` (CI job `typecheck + unit tests`) | shipped |
| No broken internal link or CSS asset reference | `linkinator.config.json` | CI job `build + links` | shipped |
| The footer shows the site's own measured weight and scores | `scripts/site-measures.ts` writes `site-measures.json` | `scripts/site-measures.test.ts` | roadmap: the file is generated in CI; no page reads it |
