// @ts-check
const path = require('path')

/**
 * @see https://playwright.dev/docs/test-configuration
 * @type{import('@playwright/test').PlaywrightTestConfig}
 */
const config = {
  webServer: {
    port: 9900,
    command: 'npm run start',
  },
  // Test directory
  testDir: path.join(__dirname, 'tests'),
};
module.exports = config;
