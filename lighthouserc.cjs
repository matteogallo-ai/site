// Blocking budgets from SPEC §8. lhci serves dist/ through express + gzip, so
// "transferred" here is gzip size: a little above the brotli bytes Cloudflare sends.
const TRANSFER_BUDGET_BYTES = 200 * 1024;

module.exports = {
  ci: {
    collect: {
      staticDistDir: "./dist",
      // Median of three runs: one run of the mobile emulation swings by several points.
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.98, aggregationMethod: "median-run" }],
        "categories:accessibility": ["error", { minScore: 0.98, aggregationMethod: "median-run" }],
        "categories:best-practices": ["error", { minScore: 0.98, aggregationMethod: "median-run" }],
        "categories:seo": ["error", { minScore: 0.98, aggregationMethod: "median-run" }],
        "largest-contentful-paint": ["error", { maxNumericValue: 1500, aggregationMethod: "median-run" }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.05, aggregationMethod: "median-run" }],
        // Lazy-loaded screenshots stay outside this figure: below the fold they are never requested during the run.
        "resource-summary:total:size": ["error", { maxNumericValue: TRANSFER_BUDGET_BYTES, aggregationMethod: "median-run" }],
      },
    },
    upload: {
      // Read by scripts/site-measures.ts.
      target: "filesystem",
      outputDir: "./.lighthouseci/reports",
    },
  },
};
