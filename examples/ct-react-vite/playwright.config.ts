import { defineConfig, devices } from '@playwright/test';

// Component testing with Playwright, following the playwright-component-testing skill.
// The gallery (playwright/gallery/index.html) is served by the app's own Vite dev server;
// `baseURL` points the built-in `mount` fixture at it.
export default defineConfig({
  // Specs live next to their components as trios: Button.tsx / Button.story.tsx / Button.spec.tsx.
  testDir: './src',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'html' : 'line',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/playwright/gallery/index.html',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:5173/playwright/gallery/index.html',
    serviceWorkers: 'block',
    reuseContext: true,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
