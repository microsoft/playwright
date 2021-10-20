import { PlaywrightTestConfig } from '@playwright/test';

// Reference: https://playwright.dev/docs/test-configuration
const config: PlaywrightTestConfig = {
  // Run your local dev server before starting the tests:
  // https://playwright.dev/docs/test-advanced#launching-a-development-web-server-during-the-tests
  webServer: {
    command: 'node ./server',
    port: 4345,
    cwd: __dirname,
  },
};
export default config;
