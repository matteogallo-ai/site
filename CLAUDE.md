# CLAUDE.md — site

## What this is

The personal site of Matteo Gallo, Software & AI Engineer: a static Astro site
(TypeScript strict, zero JS by default) deployed on Cloudflare Pages. `docs/SPEC.md`
is the reference specification: read it in full before changing anything; it takes
precedence over habits. Every figure the site shows comes from `src/data/measures.json`
with its repo, artefact path, commit hash and URL; a missing source is shown as a
visible gap, never filled in.

## Layout

```
docs/SPEC.md             reference specification (structure, visual system, budgets)
src/styles/tokens.css    design tokens from SPEC §4 (colour, type scale, grid, motion, glass)
src/styles/contrast.ts   WCAG contrast ratio + tokens.css reader (tested by contrast.test.ts)
src/styles/global.css    base element styles
src/layouts/Base.astro   document shell: fonts, metadata, skip link
src/pages/               one file per route
astro.config.mjs         site origin and self-hosted fonts (latin subsets from @fontsource-variable)
lighthouserc.cjs         blocking budgets from SPEC §8 (scores, LCP, CLS, transferred bytes)
tests/                   Playwright: axe (light + dark) and keyboard checks on every built page
scripts/site-measures*   Lighthouse CI output -> site-measures.json (weight, scores, date, commit)
linkinator.config.json   link check; the production origin is skipped because the crawl
                         already covers the same pages locally and the site may not be live
```

## Commands

Node version: `.nvmrc` (Astro 7 needs >= 22.23.4).

```
npm ci                 install exactly the lockfile
npm run dev            local dev server
npm run build          static build into dist/
npm run typecheck      astro check (TypeScript strictest)
npm test               unit tests (node:test)
npm run check:links    link check on dist/ (needs a build)
npm run test:a11y      axe + keyboard on every page of dist/ (needs a build, Playwright chromium)
npm run lighthouse     Lighthouse CI with blocking budgets (needs a build and Chrome)
npm run measures       write site-measures.json from the last Lighthouse run
```

CI (`.github/workflows/ci.yml`) runs all of the above on every PR, plus commitlint and
OSV-Scanner; CodeQL and Scorecard run in their own workflows.

## Appendix A — How coding agents must work in my repos

Every repo's `CLAUDE.md` reproduces this appendix verbatim, below a short repo-specific
section (what it is, layout, exact commands). Its purpose: make the agent engineer, not
generate.

### Engineer, don't generate
1. **Read before you write.** Find the existing module, contract and test for what you are
   changing. Extend it; never create a parallel version.
2. **Smallest change that meets the acceptance criteria.** No speculative abstractions, no
   "for future use" parameters, no options nobody asked for.
3. **Second copy = extract.** About to paste a helper? Move it to a shared module and test it once.
4. **Failing test first** for every bug: show it red, then fix, then show it green.
5. **Name the failure modes** of what you write (timeout, empty input, malformed model output,
   provider down, oversized input, hostile content) and test the ones that matter.
6. **Comments explain why — never what, never when.** No sprint IDs, no "will be added later",
   no restating the code.
7. **Deterministic code over model calls** whenever the answer is computable. The model
   proposes; code validates.
8. **Never report success without the command output that proves it.**
9. **Challenge with evidence.** If an instruction, finding or ADR looks wrong, say so with file,
   line and output — do not comply silently, do not "fix" something that is not broken.
10. **Explain trade-offs** in the PR: what you chose, what you rejected, why.
11. **Independent review before handing back**: a fresh-context reviewer subagent checks the
    diff against these standards; report what it found, what you fixed, what you rejected and why.

### Forbidden
- Claiming in README/docs a feature that has no passing test listed in `docs/CLAIMS.md`.
- Future tense or sprint references in source code or docs.
- Presenting any score computed on a stub, mock or fixture as a quality measure.
- Concatenating untrusted content (retrieved, ingested, scraped, tool output) into a prompt
  without delimiters and an explicit untrusted-content instruction.
- Catch-all exception handlers without a justifying comment and a typed re-raise or log.
- Secrets held in plain strings where the framework offers a secret type
  (e.g. pydantic `SecretStr`).
- Any paid model call without a cost estimate and explicit approval.
- Commits over ~400 changed lines (lockfiles and generated artefacts excluded).
- Pushing to main, force-pushing, tagging or publishing: the human does that. Pushing a work
  branch and opening a PR is allowed; GitHub rulesets protect main and release tags.

### Report format (end of every work unit, in French for Matteo)
1. What changed, point by point. 2. Evidence: commands + outputs. 3. Audit findings disproved,
with proof. 4. Reviewer findings: fixed / rejected + why. 5. Open items. 6. Walkthrough per
changed module — what it does, why this design, how it is verified, how it breaks — written
for someone who pilots agents well but did not hand-write the code. 7. Five comprehension
questions Matteo must answer before merging (expected answers folded at the end).
