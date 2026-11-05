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

function declarations(block: string): Record<string, string> {
  const all: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)) all[m[1] as string] = (m[2] as string).trim().toLowerCase();
  return all;
}

/**
 * Light theme = the hex colours of the first `:root` block; dark theme = light
 * overridden by the `:root` inside `@media (prefers-color-scheme: dark)`. Throws if
 * either block is missing, or if the dark block redefines a light colour in any
 * other format: the test would otherwise check the light value the browser never shows.
 */
export function readThemes(source: string): { light: Theme; dark: Theme } {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const lightBlock = /^:root\s*\{([^}]*)\}/m.exec(css)?.[1];
  const darkBlock = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[^{]*:root\s*\{([^}]*)\}/.exec(css)?.[1];
  if (lightBlock === undefined) throw new Error("tokens.css: no top-level :root block");
  if (darkBlock === undefined) throw new Error("tokens.css: no dark-scheme :root block");
  const light: Theme = Object.fromEntries(Object.entries(declarations(lightBlock)).filter(([, v]) => HEX.test(v)));
  const dark: Theme = { ...light };
  for (const [name, value] of Object.entries(declarations(darkBlock))) {
    if (!(name in light)) continue;
    if (!HEX.test(value)) throw new Error(`tokens.css: dark --${name} is "${value}", not a six-digit hex colour`);
    dark[name] = value;
  }
  return { light, dark };
}
