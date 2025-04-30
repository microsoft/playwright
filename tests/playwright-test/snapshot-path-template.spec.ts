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

import path from 'path';
import fs from 'fs';
import { test, expect } from './playwright-test-fixtures';

async function getSnapshotPaths(runInlineTest, testInfo, playwrightConfig, pathArgs) {
  const SEPARATOR = '==== 8< ---- ';
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = ${JSON.stringify(playwrightConfig, null, 2)}
    `,
    'a/b/c/d.spec.ts': `
      import { test, expect } from '@playwright/test';
      test.describe('suite', () => {
        test('test should work', async ({ page }, testInfo) => {
          console.log([
            ${JSON.stringify(SEPARATOR)},
            testInfo.project.name,
            ${JSON.stringify(SEPARATOR)},
            testInfo.snapshotPath(...${JSON.stringify(pathArgs)}),
            ${JSON.stringify(SEPARATOR)},
          ].join(''));
        });
      });
    `
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  const allSegments = result.output.split(SEPARATOR);
  const projToSnapshot = {};
  for (let i = 1; i < allSegments.length; i += 3)
    projToSnapshot[allSegments[i]] = path.relative(testInfo.outputDir, allSegments[i + 1]);
  return projToSnapshot;
}

test('tokens should expand property', async ({ runInlineTest }, testInfo) => {
  test.slow();
  const snapshotPath = await getSnapshotPaths(runInlineTest, testInfo, {
    projects: [{
      name: 'proj1',
      snapshotPathTemplate: '{projectName}',
    }, {
      name: 'proj 2',
      snapshotPathTemplate: '{-projectName}',
    }, {
      name: 'proj3',
      snapshotPathTemplate: 'foo{/projectName}',
    }, {
      snapshotPathTemplate: '{/projectName}',
    }, {
      name: 'platform',
      snapshotPathTemplate: '{platform}',
    }, {
      name: 'extension',
      snapshotPathTemplate: 'mysnapshot{ext}',
    }, {
      name: 'arg',
      snapshotPathTemplate: 'bar/{arg}',
    }, {
      name: 'testFileDir',
      snapshotPathTemplate: '{testFileDir}',
    }, {
      name: 'testFilePath',
      snapshotPathTemplate: '{testFilePath}',
    }, {
      name: 'testFileName',
      snapshotPathTemplate: '{testFileName}',
    }, {
      name: 'snapshotDir',
      snapshotDir: './a-snapshot-dir',
      snapshotPathTemplate: '{snapshotDir}.png',
    }, {
      name: 'snapshotSuffix',
      snapshotPathTemplate: '{-snapshotSuffix}',
    }, {
      name: 'testName',
      snapshotPathTemplate: '{testName}',
    }],
  }, ['foo.png']);
  expect.soft(snapshotPath['proj1']).toBe('proj1');
  expect.soft(snapshotPath['proj 2']).toBe('-proj-2');
  expect.soft(snapshotPath['proj3']).toBe(path.join('foo', 'proj3'));
  expect.soft(snapshotPath['']).toBe('');
  expect.soft(snapshotPath['platform']).toBe(process.platform);
  expect.soft(snapshotPath['extension']).toBe('mysnapshot.png');
  expect.soft(snapshotPath['arg']).toBe(path.join('bar', 'foo'));
  expect.soft(snapshotPath['testFileDir']).toBe(path.join('a', 'b', 'c'));
  expect.soft(snapshotPath['testFilePath']).toBe(path.join('a', 'b', 'c', 'd.spec.ts'));
  expect.soft(snapshotPath['testFileName']).toBe('d.spec.ts');
  expect.soft(snapshotPath['snapshotDir']).toBe('a-snapshot-dir.png');
  expect.soft(snapshotPath['snapshotSuffix']).toBe('-' + process.platform);
  expect.soft(snapshotPath['testName']).toBe('suite-test-should-work');
});

test('args array should work', async ({ runInlineTest }, testInfo) => {
  const snapshotPath = await getSnapshotPaths(runInlineTest, testInfo, {
    projects: [{
      name: 'proj',
      snapshotPathTemplate: '{ext}{arg}',
    }],
  }, ['foo', 'bar', 'baz.jpeg']);
  expect.soft(snapshotPath['proj']).toBe(path.join('.jpegfoo', 'bar', 'baz'));
});

test('arg should receive default arg', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        snapshotPathTemplate: '__screenshots__/{arg}{ext}',
      }
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot();
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('__screenshots__/is-a-test-1.png');
  expect(result.output).toContain(`A snapshot doesn't exist at ${snapshotOutputPath}, writing actual`);
  expect(fs.existsSync(snapshotOutputPath)).toBe(true);
});

test('should throw for unknown snapshot kind', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('is a test', async ({}) => {
        test.info().snapshotPath('foo', { kind: 'bar' });
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain(`testInfo.snapshotPath: unknown kind "bar"`);
});
