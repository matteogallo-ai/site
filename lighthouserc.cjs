// Blocking budgets from SPEC §8. lhci serves dist/ through express + gzip, so
// "transferred" here is gzip size: a little above the brotli bytes Cloudflare sends.
// SPEC limits are strict (< 1.5 s, < 0.05) and lhci compares with <=, hence 1499 and 0.049;
// "200 Ko" is read as 200 000 bytes, the stricter of the two readings.
const TRANSFER_BUDGET_BYTES = 200_000;
// Font subsets (scripts/fonts/subset.py) on any page, the home page included.
const FONT_BUDGET_BYTES = 90_000;

module.exports = {
  // Read by scripts/site-measures.ts; lhci ignores keys outside `ci`.
  budgets: { transferBytes: TRANSFER_BUDGET_BYTES, fontBytes: FONT_BUDGET_BYTES },
  ci: {
    collect: {
      staticDistDir: "./dist",
      // lhci otherwise stops at 5 pages and depth 2 without a warning; scripts/site-measures.ts
      // also fails if any built page is missing from the results.
      maxAutodiscoverUrls: 0,
      staticDirFileDiscoveryDepth: 10,
      // Median of five runs: the first run on a cold CI runner is an outlier (performance 0.84
      // on PR #2, 0.90 on PR #3, against 1.00 for the runs after it), and with three runs the
      // median-run choice can land on it.
      numberOfRuns: 5,
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.98, aggregationMethod: "median-run" }],
        "categories:accessibility": ["error", { minScore: 0.98, aggregationMethod: "median-run" }],
        "categories:best-practices": ["error", { minScore: 0.98, aggregationMethod: "median-run" }],
        "categories:seo": ["error", { minScore: 0.98, aggregationMethod: "median-run" }],
        "largest-contentful-paint": ["error", { maxNumericValue: 1499, aggregationMethod: "median-run" }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.02, aggregationMethod: "median-run" }],
        // Counts every request made during the run; a lazy project image the run did not load is
        // added by `npm run measures` at its heaviest variant, which fails over this budget.
        "resource-summary:total:size": ["error", { maxNumericValue: TRANSFER_BUDGET_BYTES, aggregationMethod: "median-run" }],
        "resource-summary:font:size": ["error", { maxNumericValue: FONT_BUDGET_BYTES, aggregationMethod: "median-run" }],
      },
    },
    upload: {
      // Read by scripts/site-measures.ts.
      target: "filesystem",
      outputDir: "./.lighthouseci/reports",
    },
  },
};
