import type { PlaywrightTestConfig } from '@playwright/test';
import { devices } from '@playwright/test';

/**
 * Read environment variables OUTLOOK_USER and OUTLOOK_PASSWORD from file.
 * https://github.com/motdotla/dotenv
 */
require('dotenv').config();

const config: PlaywrightTestConfig = {
  testDir: './tests',
  reporter: 'html',
  use: {
    baseURL: 'https://outlook.com'
  },

  projects: [
    {
      name: 'chromium',
      setup: /.*setup.ts$/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    {
      name: 'firefox',
      setup: /.*setup.ts$/,
      use: {
        ...devices['Desktop Firefox'],
      },
    },

    {
      name: 'webkit',
      setup: /.*setup.ts$/,
      use: {
        ...devices['Desktop Safari'],
      },
    },
  ],
};

export default config;
