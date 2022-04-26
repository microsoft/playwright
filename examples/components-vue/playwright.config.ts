import { PlaywrightTestConfig, devices } from '@playwright/test';
import vite from '@playwright/experimental-ct-vue/vitePlugin';
import vue from '@vitejs/plugin-vue';

const config: PlaywrightTestConfig = {
  testDir: 'src',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [
    ['html', { open: 'never' }],
  ] : [
    ['html', { open: 'on-failure' }]
  ],
  plugins: [
    vite({ config: { plugins: [ vue() ] }}),
  ],
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        channel: 'chrome',
        ...devices['Desktop Chrome']
      },
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
};

export default config;
