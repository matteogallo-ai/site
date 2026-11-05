import { defineConfig, devices } from "@playwright/test";

const PORT = 4321;

export default defineConfig({
  testDir: "tests",
  forbidOnly: !!process.env["CI"],
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Tests run against the production build, not the dev server: what ships is what is checked.
  webServer: {
    // --ignore-lock keeps preview in the foreground: Astro backgrounds it when it detects a coding agent,
    // and Playwright then sees the process exit and aborts.
    command: `npx astro preview --ignore-lock --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env["CI"],
  },
});
