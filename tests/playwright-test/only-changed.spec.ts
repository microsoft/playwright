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

import { test as baseTest, expect, playwrightCtConfigText } from './playwright-test-fixtures';
import { execSync } from 'node:child_process';

const test = baseTest.extend({
  setupRepository: async ({ writeFiles }, use, testInfo) => {
    const baseDir = testInfo.outputPath();

    const git = (command: string) => execSync(`git ${command}`, { cwd: baseDir });

    await use(async () => {
      await writeFiles({
        'a.spec.ts': `
        import { test, expect } from '@playwright/test';
        import { answer, question } from './utils';
        test('fails', () => { expect(question).toBe(answer); });
      `,
        'b.spec.ts': `
        import { test, expect } from '@playwright/test';
        import { answer, question } from './utils';
        test('fails', () => { expect(question).toBe(answer); });
      `,
        'utils.ts': `
        export * from './answer';
        export * from './question';
      `,
        'answer.ts': `
        export const answer = 42;
      `,
        'question.ts': `
        export const question = "???";
      `,
      });
      git(`init --initial-branch=main`);
      git(`config --local user.name "Robert Botman"`);
      git(`config --local user.email "botty@mcbotface.com"`);
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
      const result = await runInlineTest({}, { 'only-changed': true }, { CI: 'true', [envVar]: 'HEAD~1' });

      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.output).toContain('b.spec.ts');
    });
  }

  testCIEnvironment('Github Actions', 'GITHUB_BASE_REF');
  testCIEnvironment('Bitbucket', 'BITBUCKET_BRANCH');
  testCIEnvironment('Azure DevOps', 'Build.PullRequest.TargetBranch');

  test("throws error if ref isn't available", async ({ runInlineTest, setupRepository, writeFiles }) => {
    const git = await setupRepository();
    await writeFiles({
      'b.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', () => { expect(1).toBe(3); });
    `,
    });
    git('commit -a -m update');
    const result = await runInlineTest({}, { 'only-changed': true }, { CI: 'true' });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('You specified --only-changed in a CI environment, but the base reference can not be inferred.');
  });
});

test('should understand dependency structure', async ({ runInlineTest, setupRepository, writeFiles }) => {
  await setupRepository();
  await writeFiles({
    'question.ts': `
        export const question = "what is the answer to life the universe and everything";
      `,
  });
  const result = await runInlineTest({}, { 'only-changed': true });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(2);
  expect(result.output).toContain('a.spec.ts');
  expect(result.output).toContain('b.spec.ts');
});

test('should support watch mode', async ({ setupRepository, writeFiles, runWatchTest }) => {
  const git = await setupRepository();
  await writeFiles({
    'b.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('fails', () => { expect(1).toBe(3); });
      `,
  });
  git('commit -a -m update');

  const testProcess = await runWatchTest({}, { 'only-changed': `HEAD~1` });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('r');

  await testProcess.waitForOutput('b.spec.ts:3:13 › fails');
  expect(testProcess.output).not.toContain('a.spec');
});

test('should throw nice error message if git doesnt work', async ({ setupRepository, runInlineTest }) => {
  await setupRepository();
  const result = await runInlineTest({}, { 'only-changed': `this-commit-does-not-exist` });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('only works with Git repositories');
});

test('should suppport component tests', async ({ runInlineTest, setupRepository, writeFiles }) => {
  const git = await setupRepository();

  await writeFiles({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': `
    `,
    'src/button.tsx': `
      export const Button = () => <button>Button</button>;
    `,
    'src/button.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';

      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
    'src/button2.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';

      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
  });

  git('add .');
  git('commit -m "init components"');

  const result = await runInlineTest({}, { 'workers': 1, 'only-changed': true });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('No tests found');

  const result2 = await runInlineTest({
    'src/button2.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';

      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Different Button');
      });
    `
  }, { 'workers': 1, 'only-changed': true });

  expect(result2.exitCode).toBe(1);
  expect(result2.failed).toBe(1);
  expect(result2.output).toContain('button2.test.tsx');
  expect(result2.output).not.toContain('button.test.tsx');
});
