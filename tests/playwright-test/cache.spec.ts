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

test('should automatically clean cached versions of a changed file', async ({ runInlineTest, writeFiles }) => {
  const cacheDir = test.info().outputPath('playwright-test-cache');
  await runInlineTest({
    'a.spec.ts': `
      import { test } from '@playwright/test';
      test('example', () => {});
    `,
  }, undefined, {
    PLAYWRIGHT_TRANSFORM_CACHE_DIR: cacheDir
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
    PLAYWRIGHT_TRANSFORM_CACHE_DIR: cacheDir
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

test('transform cache directories are private to the current user', async ({ runInlineTest }) => {
  test.skip(process.platform === 'win32', 'POSIX directory modes do not apply on Windows');
  const cacheDir = test.info().outputPath('playwright-test-cache-private');
  // Start from a permissive directory, as a shared temp directory would be.
  await fs.promises.mkdir(cacheDir, { recursive: true });
  await fs.promises.chmod(cacheDir, 0o755);

  await runInlineTest({
    'a.spec.ts': `
      import { test } from '@playwright/test';
      test('example', () => {});
    `,
  }, undefined, {
    PLAYWRIGHT_TRANSFORM_CACHE_DIR: cacheDir
  });

  const mode = (await fs.promises.stat(cacheDir)).mode & 0o777;
  expect(mode).toBe(0o700);
  const subdirectories = await fs.promises.readdir(cacheDir);
  expect(subdirectories).toHaveLength(1);
  const subdirectoryMode = (await fs.promises.stat(path.join(cacheDir, subdirectories[0]))).mode & 0o777;
  expect(subdirectoryMode).toBe(0o700);
});
