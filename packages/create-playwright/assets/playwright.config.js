// @ts-check
const { devices } = require('@playwright/test');
const path = require('path')

/**
 * @see https://playwright.dev/docs/test-configuration
 * @type{import('@playwright/test').PlaywrightTestConfig}
 * */
const config = {
  timeout: 30 * 1000,
  testDir: path.join(__dirname, '{{testDir}}'),

  // Run your local dev server before starting the tests:
  // https://playwright.dev/docs/test-advanced#launching-a-development-web-server-during-the-tests
  // webServer: {
  //   command: 'npm run start',
  //   port: 3000,
  // },

  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'Desktop Safari',
      use: {
        browserName: 'webkit',
        viewport: { width: 1200, height: 750 },
      }
    },
    // Test against mobile viewports.
    {
      name: 'Mobile Chrome',
      use: devices['Pixel 5'],
    },
    {
      name: 'Mobile Safari',
      use: devices['iPhone 12'],
    },
    {
      name: 'Desktop Firefox',
      use: {
        browserName: 'firefox',
        viewport: { width: 800, height: 600 },
      }
    },
  ],
};

module.exports = config;
