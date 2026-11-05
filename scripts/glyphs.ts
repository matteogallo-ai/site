/** Which displayed characters a font subset cannot draw (the browser would fall back to another font). */

export type Role = "sans" | "serif" | "mono";
export type Coverage = Record<Role, number[]>;

// Layout and invisible format characters: tab, line breaks, soft hyphen, zero-width space/joiner, word joiner.
const NOT_DRAWN = new Set([0x09, 0x0a, 0x0d, 0xad, 0x200b, 0x200d, 0x2060]);

export function missingGlyphs(textByRole: Partial<Record<Role, string>>, coverage: Coverage): string[] {
  const problems: string[] = [];
  for (const [role, text] of Object.entries(textByRole) as Array<[Role, string]>) {
    const covered = new Set(coverage[role]);
    const missing = new Set<string>();
    for (const ch of text) {
      const cp = ch.codePointAt(0) as number;
      if (!NOT_DRAWN.has(cp) && !covered.has(cp)) missing.add(ch);
    }
    for (const ch of [...missing].sort()) {
      problems.push(`${role}: "${ch}" U+${(ch.codePointAt(0) as number).toString(16).toUpperCase().padStart(4, "0")}`);
    }
  }
  return problems;
}
