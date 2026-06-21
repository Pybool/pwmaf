import { defineConfig, devices } from "@playwright/test";

/**
 * playwright.config.ts — AUTH_MATRIX test suite
 *
 * Two projects:
 *   - "unit"    — Jest-style assertion tests with no browser interaction
 *                 (auth-events, config-validation, auth-factory resolution,
 *                 otp-resolver API-only specs). Still run through the
 *                 Playwright test runner so the whole suite is single-tool.
 *   - "browser" — full end-to-end specs that spin up a real Chromium
 *                 instance against the 18 mock auth containers
 *                 (ports 3001–3018, see docker-compose.yml).
 *
 * globalSetup points at ./global-setup.ts, which authenticates every
 * configured user against its mock container and writes the per-user
 * storageState files under .auth/ before any test runs.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 0 : 0,
  workers: 1,
  reporter: [
    ["html", { open: "never" }],
    ["list"],
  ],
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  globalSetup: "./tests/support/global-setup",

  use: {
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "unit",
      testMatch: [
        "tests/core/auth-events.spec.ts",
        "tests/core/config-validation.spec.ts",
        "tests/strategies/auth-factory.spec.ts",
      ],
    },
    {
      name: "browser",
      testIgnore: [
        "tests/core/auth-events.spec.ts",
        "tests/core/config-validation.spec.ts",
        "tests/strategies/auth-factory.spec.ts",
      ],
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
