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

const test = baseTest.extend<{ git(command: string): void }>({
  git: async ({}, use, testInfo) => {
    const baseDir = testInfo.outputPath();

    const git = (command: string) => execSync(`git ${command}`, { cwd: baseDir });

    git(`init --initial-branch=main`);
    git(`config --local user.name "Robert Botman"`);
    git(`config --local user.email "botty@mcbotface.com"`);

    await use((command: string) => git(command));
  },
});

test.slow();

test('should detect untracked files', async ({ runInlineTest, git, writeFiles }) => {
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

  git(`add .`);
  git(`commit -m init`);

  const result = await runInlineTest({
    'c.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', () => { expect(1).toBe(2); });
    `
  }, { 'only-changed': true });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('c.spec.ts');
});


test('should detect changed files', async ({ runInlineTest, git, writeFiles }) => {
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

  git(`add .`);
  git(`commit -m init`);

  const result = await runInlineTest({
    'b.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('fails', () => { expect(1).toBe(3); });
      `,
  }, { 'only-changed': true });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('b.spec.ts');
});

test('should diff based on base commit', async ({ runInlineTest, git, writeFiles }) => {
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

  git(`add .`);
  git(`commit -m init`);

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
  expect(result.passed).toBe(0);
  expect(result.output).toContain('b.spec.ts');
});

test('should understand dependency structure', async ({ runInlineTest, git, writeFiles }) => {
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
    'c.spec.ts': `
    import { test, expect } from '@playwright/test';
    test('fails', () => { expect(1).toBe(2); });
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

  git(`add .`);
  git(`commit -m init`);

  await writeFiles({
    'question.ts': `
        export const question = "what is the answer to life the universe and everything";
      `,
  });
  const result = await runInlineTest({}, { 'only-changed': true });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(2);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('a.spec.ts');
  expect(result.output).toContain('b.spec.ts');
  expect(result.output).not.toContain('c.spec.ts');
});

test('watch mode is not supported', async ({ runWatchTest }) => {
  const testProcess = await runWatchTest({}, { 'only-changed': true });
  await testProcess.exited;
  expect(testProcess.output).toContain('--only-changed is not supported in watch mode');
});

test('should throw nice error message if git doesnt work', async ({ runInlineTest, git }) => {
  const result = await runInlineTest({}, { 'only-changed': `this-commit-does-not-exist` });

  expect(result.exitCode).toBe(1);
  expect(result.output, 'contains our error message').toContain('Cannot detect changed files for --only-changed mode');
  expect(result.output, 'contains command').toContain('git diff this-commit-does-not-exist --name-only');
  expect(result.output, 'contains git command output').toContain('unknown revision or path not in the working tree');
});

test('should suppport component tests', async ({ runInlineTest, git, writeFiles }) => {
  await writeFiles({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': `
    `,
    'src/contents.ts': `
      export const content = "Button";
    `,
    'src/button.tsx': `
      import {content} from './contents';
      export const Button = () => <button>{content}</button>;
    `,
    'src/helper.ts': `
      export { Button } from "./button";
    `,
    'src/button.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './helper';

      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
    'src/button2.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './helper';

      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
    'src/button3.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';

      test('pass', async ({ mount }) => {
        const component = await mount(<p>Hello World</p>);
        await expect(component).toHaveText('Hello World');
      });
    `,
  });

  git(`add .`);
  git(`commit -m "init"`);

  const result = await runInlineTest({}, { 'workers': 1, 'only-changed': true });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);

  const result2 = await runInlineTest({
    'src/button2.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './helper';

      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Different Button');
      });
    `
  }, { 'workers': 1, 'only-changed': true });

  expect(result2.exitCode).toBe(1);
  expect(result2.failed).toBe(1);
  expect(result2.passed).toBe(0);
  expect(result2.output).toContain('button2.test.tsx');
  expect(result2.output).not.toContain('button.test.tsx');
  expect(result2.output).not.toContain('button3.test.tsx');

  git(`commit -am "update button2 test"`);

  const result3 = await runInlineTest({
    'src/contents.ts': `
      export const content = 'Changed Content';
    `
  }, { 'workers': 1, 'only-changed': true });

  expect(result3.exitCode).toBe(1);
  expect(result3.failed).toBe(2);
  expect(result3.passed).toBe(0);
});

test.describe('should work the same if being called in subdirectory', () => {
  test('tracked file', async ({ runInlineTest, git, writeFiles }) => {
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

    git(`add .`);
    git(`commit -m init`);

    await writeFiles({
      'tests/c.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('fails', () => { expect(1).toBe(2); });
      `
    });
    git(`add .`);
    git(`commit -a -m "add test"`);

    const result = await runInlineTest({
      'tests/c.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('fails', () => { expect(1).toBe(3); });
      `
    }, { 'only-changed': true }, {}, { cwd: 'tests' });

    expect(result.exitCode).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.passed).toBe(0);
    expect(result.output).toContain('c.spec.ts');
  });

  test('untracked file', async ({ runInlineTest, git, writeFiles }) => {
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

    git(`add .`);
    git(`commit -m init`);

    const result = await runInlineTest({
      'tests/c.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('fails', () => { expect(1).toBe(3); });
      `
    }, { 'only-changed': true }, {}, { cwd: 'tests' });

    expect(result.exitCode).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.passed).toBe(0);
    expect(result.output).toContain('c.spec.ts');
  });
});

test('UI mode is not supported', async ({ runInlineTest }) => {
  const result = await runInlineTest({}, { 'only-changed': true, 'ui': true });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('--only-changed is not supported in UI mode');
});

test('should run project dependencies of changed tests', {
  annotation: {
    type: 'issue',
    description: 'https://github.com/microsoft/playwright/issues/32070',
  },
}, async ({ runInlineTest, git, writeFiles }) => {
  await writeFiles({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'setup', testMatch: 'setup.spec.ts', },
          { name: 'main', dependencies: ['setup'] },
        ],
      };
    `,
    'setup.spec.ts': `
    import { test, expect } from '@playwright/test';

    test('setup test', async ({ page }) => {
      console.log('setup test is executed')
    });
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', () => { expect(1).toBe(2); });
    `,
    'b.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', () => { expect(1).toBe(2); });
    `,
  });

  git(`add .`);
  git(`commit -m init`);

  const result = await runInlineTest({
    'c.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', () => { expect(1).toBe(2); });
    `
  }, { 'only-changed': true });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.passed).toBe(1);

  expect(result.output).toContain('setup test is executed');
});

test('should work with list mode', async ({ runInlineTest, git, writeFiles }) => {
  await writeFiles({
    'a.spec.ts': `
    import { test, expect } from '@playwright/test';
    test('fails', () => { expect(1).toBe(2); });
  `,
  });

  git(`add .`);
  git(`commit -m init`);

  const result = await runInlineTest({
    'b.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', () => { expect(1).toBe(2); });
    `
  }, { 'only-changed': true, 'list': true });

  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('b.spec.ts');
  expect(result.output).not.toContain('a.spec.ts');
});

test('exits successfully if there are no changes', async ({ runInlineTest, git, writeFiles }) => {
  await writeFiles({
    'a.spec.ts': `
    import { test, expect } from '@playwright/test';
    test('fails', () => { expect(1).toBe(2); });
  `,
  });

  git(`add .`);
  git(`commit -m init`);

  const result = await runInlineTest({}, { 'only-changed': true });

  expect(result.exitCode).toBe(0);
});

