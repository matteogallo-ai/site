import { urlPath } from "./built-pages.ts";

/**
 * Turns Lighthouse CI filesystem output into site-measures.json: the figures the
 * footer and the Colophon show about the site itself (SPEC §3.1 item 8, §5.3).
 */

export interface ManifestEntry {
  url: string;
  isRepresentativeRun: boolean;
  jsonPath: string;
}

interface Audit {
  numericValue?: number;
  details?: { items?: Array<{ resourceType?: string; transferSize?: number; url?: string }> };
}

export interface Lhr {
  lighthouseVersion: string;
  configSettings: { formFactor: string };
  categories: Record<string, { score: number | null }>;
  audits: Record<string, Audit>;
}

export interface PageMeasure {
  path: string;
  transferBytes: number;
  fontBytes: number;
  scores: { performance: number; accessibility: number; bestPractices: number; seo: number };
  lcpMs: number;
  cls: number;
}

export interface SiteMeasures {
  generatedAt: string;
  commit: string;
  lighthouse: {
    version: string;
    formFactor: string;
    runsPerPage: number;
    aggregation: "median-run";
    /** The footer shows this next to the weight: it is not the brotli size Cloudflare sends. */
    transfer: "gzip, served by the lhci local static server";
  };
  pages: PageMeasure[];
}

function score(lhr: Lhr, id: string): number {
  const s = lhr.categories[id]?.score;
  if (typeof s !== "number") throw new Error(`Lighthouse report has no score for category "${id}"`);
  return Math.round(s * 100);
}

function numeric(lhr: Lhr, id: string): number {
  const v = lhr.audits[id]?.numericValue;
  if (typeof v !== "number") throw new Error(`Lighthouse report has no numeric value for audit "${id}"`);
  return v;
}

function transfer(lhr: Lhr, resourceType: "total" | "font"): number {
  const items = lhr.audits["resource-summary"]?.details?.items;
  if (!items) throw new Error('Lighthouse report has no "resource-summary"');
  // Lighthouse emits a row for every resource type, 0 included: a missing row means a malformed report.
  const size = items.find((i) => i.resourceType === resourceType)?.transferSize;
  if (typeof size !== "number") throw new Error(`Lighthouse report has no "resource-summary" ${resourceType} row`);
  return size;
}

export function pageMeasure(url: string, lhr: Lhr): PageMeasure {
  return {
    // lhci serves dist/ on a random localhost port; only the path is stable.
    path: urlPath(new URL(url).pathname.slice(1)),
    transferBytes: transfer(lhr, "total"),
    fontBytes: transfer(lhr, "font"),
    scores: {
      performance: score(lhr, "performance"),
      accessibility: score(lhr, "accessibility"),
      bestPractices: score(lhr, "best-practices"),
      seo: score(lhr, "seo"),
    },
    lcpMs: Math.round(numeric(lhr, "largest-contentful-paint")),
    cls: Number(numeric(lhr, "cumulative-layout-shift").toFixed(3)),
  };
}

/** `readLhr` and `now` are injected so the test reads fixtures and a fixed clock. */
export function buildMeasures(
  manifest: ManifestEntry[],
  readLhr: (jsonPath: string) => Lhr,
  context: { commit: string; now: Date; expectedPaths: string[] },
): SiteMeasures {
  if (!/^[0-9a-f]{40}$/.test(context.commit)) throw new Error(`not a full commit hash: "${context.commit}"`);
  const representative = manifest.filter((e) => e.isRepresentativeRun);
  if (representative.length === 0) throw new Error("manifest has no representative run: did lhci collect anything?");
  const runsPerPage = manifest.length / representative.length;
  if (!Number.isInteger(runsPerPage)) throw new Error(`uneven runs per page: ${manifest.length} runs for ${representative.length} pages`);
  const lhrs = representative.map((e) => ({ entry: e, lhr: readLhr(e.jsonPath) }));
  const pages = lhrs.map(({ entry, lhr }) => pageMeasure(entry.url, lhr)).sort((a, b) => a.path.localeCompare(b.path));
  // lhci drops pages silently past its autodiscovery caps; a missing page must fail, not shrink the file.
  const measured = new Set(pages.map((p) => p.path));
  const missing = context.expectedPaths.filter((p) => !measured.has(p));
  if (missing.length > 0) throw new Error(`built pages not measured: ${missing.join(", ")}`);
  const first = lhrs[0]?.lhr as Lhr;
  if (typeof first.configSettings?.formFactor !== "string") throw new Error("Lighthouse report has no form factor");
  return {
    generatedAt: context.now.toISOString(),
    commit: context.commit,
    lighthouse: {
      version: first.lighthouseVersion,
      formFactor: first.configSettings.formFactor,
      runsPerPage,
      aggregation: "median-run",
      transfer: "gzip, served by the lhci local static server",
    },
    pages,
  };
}

/**
 * Files a run must have requested for its transfer total to include them: the home
 * budget counts the project screenshots, which load lazily, so a run that never
 * reached them would pass the budget without measuring it.
 */
export function unrequested(lhr: Lhr, stems: string[]): string[] {
  const urls = (lhr.audits["network-requests"]?.details?.items ?? []).map((i) => i.url ?? "");
  return stems.filter((stem) => !urls.some((u) => u.split("/").at(-1)!.startsWith(`${stem}.`)));
}
