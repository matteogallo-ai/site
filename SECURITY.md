# Security Policy

## Reporting a vulnerability

Email **matteo.gallo@gallarti.io** with the subject line
`[SECURITY] site — <brief description>`. Do **not** open a public GitHub issue.
Reports are acknowledged within 48 hours.

## Scope

This repository builds a static site: no server code, no form, no cookie, no
tracker, no secret. What can still go wrong, and what guards it:

| Risk | Guard |
| --- | --- |
| A dependency with a known vulnerability in the build toolchain | OSV-Scanner on `package-lock.json` in CI; Dependabot weekly |
| A compromised or moved GitHub Action | every action pinned by full commit SHA; Dependabot updates the pin |
| A workflow token with more rights than needed | `permissions: contents: read` by default, widened per job with a comment |
| A deploy token leaking from the repo | none exists: Cloudflare Pages deploys through its Git integration |

Dev-only tools pull vulnerable transitive packages (`basic-ftp`, `glob`,
`minimatch`); `package.json` `overrides` pins them to patched releases, and
`npm audit` reports 0 vulnerabilities.
