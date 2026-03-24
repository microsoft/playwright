import { defineConfig, devices } from '@playwright/test';

// This config stays intentionally small because the interesting part of the
// example is the tenant model, not complex runner setup.
// Teams can copy this example and then add retries, reporters, projects, or CI
// behavior that matches their own environment.
export default defineConfig({
  // All tests are generated from the tenant matrix under ./tests.
  testDir: './tests',
  fullyParallel: true,
  reporter: 'html',
  use: {
    // Trace on retry keeps the example friendly for debugging without adding
    // noise to every successful run.
    trace: 'on-first-retry',
    headless: process.env.HEADLESS !== 'false',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
