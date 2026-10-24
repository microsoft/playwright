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

test('should load tests when cache writes fail', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43601' } }, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.cjs': `
      const fs = require('fs');
      const writeFileSync = fs.writeFileSync;
      fs.writeFileSync = function(file, ...args) {
        if (String(file).endsWith('_mapspec.map') || String(file).endsWith('_codespec.js')) {
          console.log('denied cache write: ' + require('path').extname(file));
          throw Object.assign(new Error('cache write denied'), { code: 'EPERM' });
        }
        return writeFileSync.call(this, file, ...args);
      };
      module.exports = {};
    `,
    'map.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('map', () => expect(1).toBe(1));
    `,
    'code.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('code', () => expect(2).toBe(2));
    `,
  }, { list: true });
  expect(result.output).toContain('denied cache write: .map');
  expect(result.output).toContain('denied cache write: .js');
  expect(result.output).toContain('Total: 2 tests in 2 files');
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
    PWTEST_CACHE_DIR: cacheDir
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
    PWTEST_CACHE_DIR: cacheDir
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
