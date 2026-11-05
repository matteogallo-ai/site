// Blocking budgets from SPEC §8. lhci serves dist/ through express + gzip, so
// "transferred" here is gzip size: a little above the brotli bytes Cloudflare sends.
// SPEC limits are strict (< 1.5 s, < 0.05) and lhci compares with <=, hence 1499 and 0.049;
// "200 Ko" is read as 200 000 bytes, the stricter of the two readings.
const TRANSFER_BUDGET_BYTES = 200_000;
// Font subsets (scripts/fonts/subset.py) on any page, the home page included.
const FONT_BUDGET_BYTES = 90_000;

module.exports = {
  ci: {
    collect: {
      staticDistDir: "./dist",
      // lhci otherwise stops at 5 pages and depth 2 without a warning; scripts/site-measures.ts
      // also fails if any built page is missing from the results.
      maxAutodiscoverUrls: 0,
      staticDirFileDiscoveryDepth: 10,
      // Median of three runs: one run of the mobile emulation swings by several points.
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.98, aggregationMethod: "median-run" }],
        "categories:accessibility": ["error", { minScore: 0.98, aggregationMethod: "median-run" }],
        "categories:best-practices": ["error", { minScore: 0.98, aggregationMethod: "median-run" }],
        "categories:seo": ["error", { minScore: 0.98, aggregationMethod: "median-run" }],
        "largest-contentful-paint": ["error", { maxNumericValue: 1499, aggregationMethod: "median-run" }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.049, aggregationMethod: "median-run" }],
        // Counts every request made during the run. Assumption, unverified while the site has no
        // screenshot: lazy images far enough below the fold are not requested, so they stay outside.
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
