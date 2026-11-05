# matteogallo — personal site

The personal site of Matteo Gallo, Software & AI Engineer. Static
[Astro](https://astro.build) site. The full specification is [`docs/SPEC.md`](docs/SPEC.md);
what is proven by which check is in [`docs/CLAIMS.md`](docs/CLAIMS.md).

## Run it

Node per `.nvmrc`, then:

```
npm ci
npm run build && npm run preview
```

The checks CI runs, and how to run each one locally, are listed in [`CLAUDE.md`](CLAUDE.md#commands).

## Why it exists

A CTO deciding in 30 seconds needs proof, not adjectives: the site shows one of
my AI products at work and publishes its measures and known defects. The hard
part is keeping that honest, so performance, accessibility and weight budgets are
blocking CI checks rather than promises.

## Licence

Code: [MIT](LICENSE). Content (text, photograph, data, specification): all rights
reserved, see [`LICENSE-CONTENT.md`](LICENSE-CONTENT.md).
