/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from './playwright-test-fixtures';

// The question of whether this should be supported is still open: https://github.com/microsoft/playwright/issues/15889
test('throw error when navigating with page.go', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import { defineConfig, devices } from './config';
      export default defineConfig({});
    `,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'registerSource.mjs': `
      window.playwrightMount = async (component, rootElement, hooksConfig) => {};
      window.playwrightUnmount = async rootElement => {};
      window.playwrightUpdate = async (rootElement, component) => {};
    `,
    'config.ts': `
      import { fixtures } from '@playwright/experimental-ct-core/lib/mount';
      import { test as baseTest, expect, devices, defineConfig as originalDefineConfig } from '@playwright/test';
      import path from 'path';
      const plugin = () => {
        const { createPlugin } = require('@playwright/experimental-ct-core/lib/vitePlugin');
        return createPlugin(path.join(__dirname, 'registerSource.mjs'), () => {});
      };
      const defineConfig = config => originalDefineConfig({ ...config, _plugins: [plugin] });
      const test = baseTest.extend(fixtures);
      export { test, expect, devices, defineConfig };
    `,
    'mount.test.tsx': `
      import { test, expect } from './config';
      test('throw error when navigating with page.go', async ({ page, mount }) => {
        await mount(<div />);
        await expect(async () => await page.goto('/test')).rejects.toThrowError(
          '\`page.goto()\` is not supported in component testing'
        );
        await expect(async () => await page.goBack()).rejects.toThrowError(
          '\`page.goBack()\` is not supported in component testing'
        );
        await expect(async () => await page.goForward()).rejects.toThrowError(
          '\`page.goForward()\` is not supported in component testing'
        );
      });    
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
