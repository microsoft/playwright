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

import { test as baseTest, expect } from './playwright-test-fixtures';
import { execSync } from 'node:child_process';

const test = baseTest.extend({
  setupRepository: async ({ writeFiles }, use, testInfo) => {
    const baseDir = testInfo.outputPath();

    const git = (command: string) => execSync(`git ${command}`, { cwd: baseDir });

    await use(async () => {
      await writeFiles({
        'a.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('fails', () => { expect(1).toBe(2); });
      `,
        'b.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('fails', () => { expect(1).toBe(2); });
      `,
      });
      git(`init --initial-branch=main`);
      git(`add .`);
      git(`commit -m init`);
      return git;
    });
  },
});

test('should detect untracked files', async ({ runInlineTest, setupRepository }) => {
  await setupRepository();

  const result = await runInlineTest({
    'c.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', () => { expect(1).toBe(2); });
    `
  }, { 'only-changed': true });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('c.spec.ts');
});


test('should detect changed files', async ({ runInlineTest, setupRepository }) => {
  await setupRepository();
  const result = await runInlineTest({
    'b.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('fails', () => { expect(1).toBe(3); });
      `,
  }, { 'only-changed': true });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('b.spec.ts');
});

test('should diff based on base commit', async ({ runInlineTest, setupRepository, writeFiles }) => {
  const git = await setupRepository();
  await writeFiles({
    'b.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('fails', () => { expect(1).toBe(3); });
      `,
  });
  git('commit -a -m update');
  const result = await runInlineTest({}, { 'only-changed': `HEAD~1` });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('b.spec.ts');
});

test.describe('should be smart about PR base reference from CI', () => {
  function testCIEnvironment(name: string, envVar: string) {
    test(name, async ({ runInlineTest, setupRepository, writeFiles }) => {
      const git = await setupRepository();
      await writeFiles({
        'b.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('fails', () => { expect(1).toBe(3); });
      `,
      });
      git('commit -a -m update');
      const result = await runInlineTest({}, { 'only-changed': true }, { [envVar]: 'HEAD~1' });

      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.output).toContain('b.spec.ts');
    });
  }

  testCIEnvironment('Github Actions', 'GITHUB_BASE_REF');
  testCIEnvironment('Azure DevOps', 'Build.PullRequest.TargetBranch');
});
