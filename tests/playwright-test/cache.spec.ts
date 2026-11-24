/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as fs from 'fs';
import * as path from 'path';

import { test, expect } from './playwright-test-fixtures';

test('should enable the Node.js compile cache in the runner and workers', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44347' } }, async ({ runInlineTest, nodeVersion }, testInfo) => {
  test.skip(nodeVersion.major < 22 || (nodeVersion.major === 22 && nodeVersion.minor < 8), 'Node.js compile cache requires Node.js 22.8');
  test.skip(!!process.env.PW_BUN, 'Node.js compile cache is not available in Bun');

  const result = await runInlineTest({
    'playwright.config.js': `
      const { getCompileCacheDir } = require('node:module');
      if (!getCompileCacheDir())
        throw new Error('Runner compile cache is disabled');
      module.exports = {};
    `,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      const { getCompileCacheDir } = require('node:module');
      test('compile cache', () => {
        expect(getCompileCacheDir()).toBeTruthy();
      });
    `,
  }, {}, {
    NODE_COMPILE_CACHE: undefined,
    NODE_DISABLE_COMPILE_CACHE: undefined,
    TMPDIR: testInfo.outputPath(),
    TMP: testInfo.outputPath(),
    TEMP: testInfo.outputPath(),
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should clear cache with type:module', async ({ runCLICommand }) => {
  const result = await runCLICommand({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({});
    `,
    'package.json': `
      { "type": "module" }
    `,
    'a.spec.ts': `
      import { test } from '@playwright/test';
      test('example', () => {});
    `,
  }, 'clear-cache');
  expect(result.exitCode).toBe(0);
});

test('should clear cache for ct', async ({ runCLICommand }) => {
  const result = await runCLICommand({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({});
    `,
    'a.spec.ts': `
      import { test } from '@playwright/test';
      test('example', () => {});
    `,
  }, 'clear-cache', []);
  expect(result.exitCode).toBe(0);
});

test('should automatically clean cached versions of a changed file', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43798' } }, async ({ runInlineTest, writeFiles }) => {
  const cacheDir = test.info().outputPath('playwright-test-cache');
  await runInlineTest({
    'a.spec.ts': `
      import { test } from '@playwright/test';
      test('example', () => {});
    `,
  }, undefined, {
    PLAYWRIGHT_TRANSFORM_CACHE_DIR: undefined,
    PWTEST_CACHE_DIR: cacheDir,
  });

  const cacheDirectories = await fs.promises.readdir(cacheDir);
  expect(cacheDirectories).toHaveLength(1);
  const testCacheDirectory = path.join(cacheDir, cacheDirectories[0]);

  const matchRegex = (extension: string) => new RegExp('^([0-9a-f]{10})_([0-9a-f]{7})_aspec\\.' + extension + '$', 'i');

  let cachedFiles = await fs.promises.readdir(testCacheDirectory);
  cachedFiles.sort();
  expect(cachedFiles).toHaveLength(2);
  expect(cachedFiles[0]).toMatch(matchRegex('js'));
  expect(cachedFiles[1]).toMatch(matchRegex('map'));

  const initialMatches = cachedFiles[0].match(matchRegex('js'));
  expect(initialMatches).toHaveLength(3);
  const firstPathHash = initialMatches[1];
  const firstTestHash = initialMatches[2];

  await runInlineTest({
    'a.spec.ts': `
      import { test } from '@playwright/test';
      test('modified test', () => {});
    `,
  }, undefined, {
    PLAYWRIGHT_TRANSFORM_CACHE_DIR: cacheDir,
    PWTEST_CACHE_DIR: test.info().outputPath('unused-cache'),
  });

  cachedFiles = await fs.promises.readdir(testCacheDirectory);
  cachedFiles.sort();
  expect(cachedFiles).toHaveLength(2);
  expect(cachedFiles[0]).toMatch(matchRegex('js'));
  expect(cachedFiles[1]).toMatch(matchRegex('map'));

  const finalMatches = cachedFiles[0].match(matchRegex('js'));
  expect(finalMatches).toHaveLength(3);
  const finalPathHash = finalMatches[1];
  const finalTestHash = finalMatches[2];

  expect(finalPathHash).toBe(firstPathHash);
  expect(finalTestHash).not.toBe(firstTestHash);
});
