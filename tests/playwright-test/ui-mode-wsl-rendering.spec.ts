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

import { test as base, expect } from './ui-mode-fixtures';
import fs from 'fs';

const test = base.extend<{}>({});

// Helper function to create a simple test file
const createTestFile = () => ({
  'test.spec.ts': `
    import { test, expect } from '@playwright/test';
    test('sample test', async ({ page }) => {
      await page.goto('data:text/html,<h1>Hello</h1>');
      await expect(page.locator('h1')).toHaveText('Hello');
    });
  `
});

// Helper function to verify UI mode loads correctly
const verifyUILoads = async (page: any) => {
  await expect(page.locator('[data-testid="test-tree"]')).toBeVisible({ timeout: 10000 });
};

test.describe('UI mode WSL rendering workarounds', () => {
  test('should use SwiftShader by default on WSL', async ({ runUITest }) => {
    const originalPlatform = process.platform;
    const originalEnv = { ...process.env };

    // Mock WSL environment
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    process.env.WSL_DISTRO_NAME = 'Ubuntu';

    try {
      const { page } = await runUITest(createTestFile());
      await verifyUILoads(page);
    } finally {
      // Restore original environment
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      Object.assign(process.env, originalEnv);
    }
  });

  test('should respect PW_UI_DISABLE_GPU environment variable', async ({ runUITest }) => {
    const originalEnv = { ...process.env };
    process.env.PW_UI_DISABLE_GPU = '1';

    try {
      const { page } = await runUITest(createTestFile());
      await verifyUILoads(page);
    } finally {
      Object.assign(process.env, originalEnv);
    }
  });

  test('should respect PW_UI_USE_SWIFTSHADER environment variable', async ({ runUITest }) => {
    const originalEnv = { ...process.env };
    process.env.PW_UI_USE_SWIFTSHADER = '1';

    try {
      const { page } = await runUITest(createTestFile());
      await verifyUILoads(page);
    } finally {
      Object.assign(process.env, originalEnv);
    }
  });

  test('should respect PW_UI_USE_DISCRETE_GPU environment variable', async ({ runUITest }) => {
    const originalEnv = { ...process.env };
    process.env.PW_UI_USE_DISCRETE_GPU = '1';

    try {
      const { page } = await runUITest(createTestFile());
      await verifyUILoads(page);
    } finally {
      Object.assign(process.env, originalEnv);
    }
  });

  test('should prioritize PW_UI_DISABLE_GPU over other options', async ({ runUITest }) => {
    const originalEnv = { ...process.env };
    process.env.PW_UI_DISABLE_GPU = '1';
    process.env.PW_UI_USE_SWIFTSHADER = '1';
    process.env.PW_UI_USE_DISCRETE_GPU = '1';

    try {
      const { page } = await runUITest(createTestFile());
      await verifyUILoads(page);
    } finally {
      Object.assign(process.env, originalEnv);
    }
  });

  test('should prioritize PW_UI_USE_SWIFTSHADER over PW_UI_USE_DISCRETE_GPU', async ({ runUITest }) => {
    const originalEnv = { ...process.env };
    process.env.PW_UI_USE_SWIFTSHADER = '1';
    process.env.PW_UI_USE_DISCRETE_GPU = '1';

    try {
      const { page } = await runUITest(createTestFile());
      await verifyUILoads(page);
    } finally {
      Object.assign(process.env, originalEnv);
    }
  });

  test('should detect WSL via WSLInterop file', async ({ runUITest }) => {
    const originalPlatform = process.platform;
    const originalEnv = { ...process.env };
    const originalExistsSync = fs.existsSync;

    // Mock WSL environment
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    delete process.env.WSL_DISTRO_NAME; // Ensure other WSL detection is off
    fs.existsSync = (path: string) => {
      if (path === '/proc/sys/fs/binfmt_misc/WSLInterop')
        return true;
      return originalExistsSync(path);
    };

    try {
      const { page } = await runUITest(createTestFile());
      await verifyUILoads(page);
    } finally {
      // Restore original environment
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      Object.assign(process.env, originalEnv);
      fs.existsSync = originalExistsSync;
    }
  });

  test('should detect WSL via /proc/version', async ({ runUITest }) => {
    const originalPlatform = process.platform;
    const originalEnv = { ...process.env };

    // Mock WSL environment with Microsoft in /proc/version
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

    // Mock fs.existsSync and fs.readFileSync for /proc/version
    const originalExistsSync = fs.existsSync;
    const originalReadFileSync = fs.readFileSync;

    fs.existsSync = (path: string) => {
      if (path === '/proc/version')
        return true;

      return originalExistsSync(path);
    };

    fs.readFileSync = (path: string, encoding?: any) => {
      if (path === '/proc/version')
        return 'Linux version 5.10.102.1-microsoft-standard-WSL2' as any;

      return originalReadFileSync(path, encoding);
    };

    try {
      const { page } = await runUITest(createTestFile());
      await verifyUILoads(page);
    } finally {
      // Restore original environment
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      Object.assign(process.env, originalEnv);
      fs.existsSync = originalExistsSync;
      fs.readFileSync = originalReadFileSync;
    }
  });

  test('should not apply WSL workarounds on non-Linux platforms', async ({ runUITest }) => {
    const originalPlatform = process.platform;
    const originalEnv = { ...process.env };

    // Mock non-Linux platform
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });

    try {
      const { page } = await runUITest({
        'test.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('sample test', async ({ page }) => {
            await page.goto('data:text/html,<h1>Hello</h1>');
            await expect(page.locator('h1')).toHaveText('Hello');
          });
        `
      });

      // Verify the UI mode loads correctly without WSL workarounds
      await expect(page.locator('[data-testid="test-tree"]')).toBeVisible({ timeout: 10000 });
    } finally {
      // Restore original environment
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      Object.assign(process.env, originalEnv);
    }
  });
});
