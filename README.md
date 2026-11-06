# matteogallo — personal site

The personal site of Matteo Gallo, Software & AI Engineer. Static
[Astro](https://astro.build) site. The full specification is [`docs/SPEC.md`](docs/SPEC.md);
what is proven by which check is in [`docs/CLAIMS.md`](docs/CLAIMS.md).

## Run it

Node 24 (`.nvmrc`; `engines` is `^24.0.0` and `.npmrc` sets `engine-strict`, so `npm ci` refuses any other major).
With [nvm](https://github.com/nvm-sh/nvm):

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.41.0/install.sh | bash
nvm install    # reads .nvmrc and installs Node 24
nvm use
npm ci
npm run build && npm run preview
```

The font subsets in `src/assets/fonts/` are committed. To rebuild them (Python 3.9+):

```
python3 -m venv .venv && .venv/bin/pip install --require-hashes -r scripts/fonts/requirements.txt
npm run fonts
```

The checks CI runs, and how to run each one locally, are listed in [`CLAUDE.md`](CLAUDE.md#commands).

## Why it exists

A CTO deciding in 30 seconds needs proof, not adjectives: the site shows one of
my AI products at work and publishes its measures and known defects. The hard
part is keeping that honest, so performance, accessibility and weight budgets are
blocking CI checks rather than promises.

## How this was built

**Stack.** [Astro](https://astro.build), static output, TypeScript in its strictest mode, no
client JavaScript except the Verity demo, the bio toggle and the small scripts in `src/scripts/`.
Self-hosted font subsets. Hosted on Cloudflare Pages through its Git integration. French at `/`,
English at `/en/`, translated by hand.

**CI.** Every pull request must pass these checks before it can merge (`.github/workflows/`):

| Check | What it proves |
| --- | --- |
| typecheck + unit tests | `astro check` finds no type error; the `node:test` suites pass (measures, intervals, diagrams, sitemap, budgets, contrast ratios, i18n, typography, icons). |
| measures + demo traces match their sources | every figure in `src/data/measures.json` and every demo trace is found, as stated, in its source repository at the pinned commit. |
| build + links | the site builds with no placeholder on any page; no internal link or CSS reference of any page, in either language, is broken, and external links answer (LinkedIn and the production origin are skipped, see `linkinator.config.json`). |
| axe + keyboard + glyphs | no axe violation on any page, light and dark; keyboard paths work; every displayed character is in the font subset that draws it; hover, focus, motion and SEO checks. |
| lighthouse budgets + site measures | every page meets the Lighthouse, LCP, CLS and weight budgets of `lighthouserc.cjs`, and the measures are written to the `site-measures` artifact. |
| font subsets reproducible | rebuilding the font subsets from the pinned upstream fonts gives the committed files. |
| conventional commits | every commit message follows the Conventional Commits format. |
| osv-scanner | no dependency in `package-lock.json`, in the font tool’s `requirements.txt` or in the PDF page tool’s (`scripts/media/requirements.txt`) has a known vulnerability. |
| CodeQL | GitHub's static analysis of the code and the workflows raises no alert at or above the repository's severity threshold. |

What each check covers in detail, claim by claim, is in [`docs/CLAIMS.md`](docs/CLAIMS.md).

**Rulesets.** GitHub rulesets protect `main`: changes arrive only through a pull request,
merged by squash, with every check above passing on a branch up to date with `main`; `main`
cannot be deleted or force-pushed. A second ruleset protects release tags.

**Review.** The code is written with coding agents. Before a pull request is handed back, a
second agent with no context from the first reviews the diff against the rules in
[`CLAUDE.md`](CLAUDE.md); its findings are fixed or rejected with evidence in the report. Then
I review and merge it myself.

**Measures.** The budgets and the measured figures of the site itself (weight, scores, LCP,
CLS per page, from a recorded CI run) are on the
[Colophon](https://matteogallo.ch/colophon/) ([English](https://matteogallo.ch/en/colophon/)).

## Licence

Code: [MIT](LICENSE). Content (text, photograph, data, specification): all rights
reserved, see [`LICENSE-CONTENT.md`](LICENSE-CONTENT.md).
