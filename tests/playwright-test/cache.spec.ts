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

import { createHash } from 'node:crypto';
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

// jsxImportSource (the absolute directory of the `playwright` package) is baked
// into the transformed code as the jsx-runtime import path, see configLoader's
// `path.dirname(require.resolve('playwright'))`. The transform cache key must
// include it: when the install layout changes between runs (npm -> pnpm, new
// worktree), a cached .tsx transform would otherwise keep importing the old
// install location and the run silently collects zero tests.
// https://github.com/microsoft/playwright/issues/42934
test('should not reuse the cached transform when jsxImportSource changes', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42934' },
}, async ({ runInlineTest }) => {
  const specContent = `
      import { test, expect } from '@playwright/test';
      const element = <div>hello</div>;
      test('jsx', () => { expect(element).toBeTruthy(); });
    `;
  const files = {
    'a.spec.tsx': specContent,
  };
  const cacheDir = test.info().outputPath('cache');
  const specPath = path.join(test.info().outputPath(), 'a.spec.tsx');

  // Seed the cache with a stale entry for the spec, as if it was cached when
  // `playwright` was installed elsewhere: the baked import still points at the
  // old install location. The entry is keyed with the cache hash that ignores
  // jsxImportSource - exactly what the buggy `calculateHash` produces.
  const version = require('../../packages/playwright/package.json').version;
  const staleContent = `module.exports = {}; require(${JSON.stringify(path.join(cacheDir, 'old-playwright-install', 'jsx-runtime'))});`;
  const filePathHash = createHash('sha1').update(specPath).digest('hex').substring(0, 10);
  const seedEntry = (isModule: boolean) => {
    const contentHash = createHash('sha1')
        .update(isModule ? 'esm' : 'no_esm')
        .update(specContent)
        .update(specPath)
        .update(version)
        .update('')
        .digest('hex');
    const artifactPath = path.join(cacheDir, filePathHash.substring(0, 2), `${filePathHash}_${contentHash.substring(0, 7)}_aspec.js`);
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, `// ${createHash('sha1').update(staleContent).digest('hex')}\n${staleContent}`, 'utf8');
  };
  // The loader picks the esm or the cjs pipeline depending on the project,
  // seed both variants - only one is ever looked up.
  seedEntry(false);
  seedEntry(true);

  const result = await runInlineTest(files, undefined, {
    PWTEST_CACHE_DIR: cacheDir,
    PW_TEST_SOURCE_TRANSFORM: '',
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(0);
});
