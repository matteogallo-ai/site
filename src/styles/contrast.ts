/** WCAG 2.x relative luminance and contrast ratio, plus a reader for tokens.css. */

const HEX = /^#[0-9a-f]{6}$/i;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  if (!HEX.test(hex)) throw new Error(`not a six-digit hex colour: ${hex}`);
  const [r, g, b] = [1, 3, 5].map((i) => channel(Number.parseInt(hex.slice(i, i + 2), 16))) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export type Theme = Record<string, string>;

function declarations(block: string): Theme {
  const theme: Theme = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    theme[m[1] as string] = (m[2] as string).toLowerCase();
  }
  return theme;
}

/**
 * Light theme = the first `:root` block; dark theme = light overridden by the
 * `:root` inside `@media (prefers-color-scheme: dark)`. Throws if either is missing,
 * so a restructured tokens.css fails the test instead of passing on nothing.
 */
export function readThemes(css: string): { light: Theme; dark: Theme } {
  const lightBlock = /^:root\s*\{([^}]*)\}/m.exec(css)?.[1];
  const darkBlock = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[^{]*:root\s*\{([^}]*)\}/.exec(css)?.[1];
  if (lightBlock === undefined) throw new Error("tokens.css: no top-level :root block");
  if (darkBlock === undefined) throw new Error("tokens.css: no dark-scheme :root block");
  const light = declarations(lightBlock);
  return { light, dark: { ...light, ...declarations(darkBlock) } };
}
