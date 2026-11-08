// Cloudflare Pages reads response headers from dist/_headers. The policy allows only the site's
// own files and, by hash, the inline scripts and styles Astro writes into the pages: the hashes
// are taken on the finished HTML, so this integration runs after every other one that edits it.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

export interface Hashes {
  scripts: string[];
  styles: string[];
}

const hash = (text: string) => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

/** CSP sources for the inline `<script>` and `<style>` elements of one page, in page order. */
export function inlineHashes(html: string): Hashes {
  const of = (tag: string) =>
    [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, "gi"))].filter((m) => !/\bsrc=/.test(m[1] ?? "")).map((m) => hash(m[2] ?? ""));
  return { scripts: of("script"), styles: of("style") };
}

export function headersFile({ scripts, styles }: Hashes): string {
  const csp = [
    "default-src 'none'",
    `script-src 'self' ${scripts.join(" ")}`.trim(),
    `style-src 'self' ${styles.join(" ")}`.trim(),
    "img-src 'self'",
    "font-src 'self'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
  return [
    "/*",
    `  Content-Security-Policy: ${csp}`,
    // No includeSubDomains: the header would bind every subdomain of the zone, which this repo does not serve.
    "  Strict-Transport-Security: max-age=31536000",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    // The copy button writes the address to the clipboard; nothing else on the site asks for a device feature.
    "  Permissions-Policy: accelerometer=(), browsing-topics=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), clipboard-write=(self)",
    "  X-Content-Type-Options: nosniff",
    "",
  ].join("\n");
}

/** RFC 9116; Expires is required and should stay under a year, so each build renews it. */
export function securityTxt(now: Date): string {
  const expires = new Date(now.getTime() + 364 * 864e5);
  return [
    "Contact: mailto:matteogallo.office@gmail.com",
    `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, "Z")}`,
    "Preferred-Languages: fr, en",
    "Canonical: https://matteogallo.ch/.well-known/security.txt",
    "",
  ].join("\n");
}

export function edgeHeaders(): AstroIntegration {
  return {
    name: "edge-headers",
    hooks: {
      "astro:build:done": ({ dir }) => {
        const root = fileURLToPath(dir);
        const scripts = new Set<string>();
        const styles = new Set<string>();
        for (const file of readdirSync(root, { recursive: true, encoding: "utf8" })) {
          if (!file.endsWith(".html")) continue;
          const page = inlineHashes(readFileSync(join(root, file), "utf8"));
          for (const h of page.scripts) scripts.add(h);
          for (const h of page.styles) styles.add(h);
        }
        writeFileSync(join(root, "_headers"), headersFile({ scripts: [...scripts].sort(), styles: [...styles].sort() }));
        mkdirSync(join(root, ".well-known"), { recursive: true });
        writeFileSync(join(root, ".well-known", "security.txt"), securityTxt(new Date()));
      },
    },
  };
}
