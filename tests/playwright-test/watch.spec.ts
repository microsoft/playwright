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

import path from 'path';
import timers from 'timers/promises';
import { test, expect, playwrightCtConfigText } from './playwright-test-fixtures';

test.describe.configure({ mode: 'parallel' });

test('should print dependencies in CJS mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        globalTeardown: './globalTeardown.ts',
      });
    `,
    'helperA.ts': `export function foo() {}`,
    'helperB.ts': `import './helperA';`,
    'a.test.ts': `
      import './helperA';
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'b.test.ts': `
      import './helperB';
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'globalTeardown.ts': `
      import { fileDependencies } from 'playwright/lib/internalsForTest';
      export default () => {
        console.log('###' + JSON.stringify(fileDependencies()) + '###');
      };
    `
  }, {});

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  const output = result.output;
  const deps = JSON.parse(output.match(/###(.*)###/)![1]);
  expect(deps).toEqual({
    'a.test.ts': ['helperA.ts'],
    'b.test.ts': ['helperA.ts', 'helperB.ts'],
  });
});

test('should print dependencies in ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        globalTeardown: './globalTeardown.ts',
      });
    `,
    'helperA.ts': `export function foo() {}`,
    'helperB.ts': `import './helperA.js';`,
    'a.test.ts': `
      import './helperA.js';
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'b.test.ts': `
      import './helperB.js';
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'globalTeardown.ts': `
      import { fileDependencies } from 'playwright/lib/internalsForTest';
      export default () => {
        console.log('###' + JSON.stringify(fileDependencies()) + '###');
      };
    `
  }, {});

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  const output = result.output;
  const deps = JSON.parse(output.match(/###(.*)###/)![1]);
  expect(deps).toEqual({
    'a.test.ts': ['helperA.ts'],
    'b.test.ts': ['helperA.ts', 'helperB.ts'],
  });
});

test('should print dependencies in mixed CJS/ESM mode 1', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        globalTeardown: './globalTeardown.ts',
      });
    `,
    'helperA.cjs': `exports.foo = () => {}`,
    'helperB.cjs': `require('./helperA');`,
    'a.test.ts': `
      import './helperA';
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'b.test.cjs': `
      require('./helperB');
      const { test, expect } = require('@playwright/test');
      test('passes', () => {});
    `,
    'globalTeardown.ts': `
      import { fileDependencies } from 'playwright/lib/internalsForTest';
      export default () => {
        console.log('###' + JSON.stringify(fileDependencies()) + '###');
      };
    `
  }, {});

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  const output = result.output;
  const deps = JSON.parse(output.match(/###(.*)###/)![1]);
  expect(deps).toEqual({
    'a.test.ts': ['helperA.cjs'],
    'b.test.cjs': ['helperA.cjs', 'helperB.cjs'],
  });
});

test('should print dependencies in mixed CJS/ESM mode 2', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.mts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        globalTeardown: './globalTeardown.ts',
      });
    `,
    'helperA.cjs': `exports.foo = () => {}`,
    'helperB.cts': `import './helperA';`,
    'a.test.mts': `
      import './helperA';
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'b.test.ts': `
      import './helperB';
      const { test, expect } = require('@playwright/test');
      test('passes', () => {});
    `,
    'globalTeardown.ts': `
      import { fileDependencies } from 'playwright/lib/internalsForTest';
      export default () => {
        console.log('###' + JSON.stringify(fileDependencies()) + '###');
      };
    `
  }, {});

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  const output = result.output;
  const deps = JSON.parse(output.match(/###(.*)###/)![1]);
  expect(deps).toEqual({
    'a.test.mts': ['helperA.cjs'],
    'b.test.ts': ['helperA.cjs', 'helperB.cts'],
  });
});

test('should not perform initial run', async ({ runWatchTest }) => {
  const testProcess = await runWatchTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');

  expect(testProcess.output).not.toContain('a.test.ts');
});

test('should quit on Q', async ({ runWatchTest }) => {
  const testProcess = await runWatchTest({});
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.write('q');
  await testProcess!.exited;
});

test('should print help on H', async ({ runWatchTest }) => {
  const testProcess = await runWatchTest({});
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.write('h');
  await testProcess.waitForOutput('to quit');
});

test('should run tests on Enter', async ({ runWatchTest }) => {
  const testProcess = await runWatchTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('\r\n');
  await testProcess.waitForOutput('npx playwright test #1');
  await testProcess.waitForOutput('a.test.ts:3:11 › passes');
  await testProcess.waitForOutput('Waiting for file changes.');
});

test('should not print show-report command of HTML reporter', async ({ runWatchTest }) => {
  const testProcess = await runWatchTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({ reporter: 'html' });
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('\r\n');
  await testProcess.waitForOutput('Waiting for file changes.');
  expect(testProcess.output).not.toContain('To open last HTML report run:');
});

test('should run tests on R', async ({ runWatchTest }) => {
  const testProcess = await runWatchTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('r');
  await testProcess.waitForOutput('npx playwright test (re-running tests) #1');
  await testProcess.waitForOutput('a.test.ts:3:11 › passes');
  await testProcess.waitForOutput('Waiting for file changes.');
});

test('should run failed tests on F', async ({ runWatchTest }) => {
  const testProcess = await runWatchTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'c.test.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', () => { expect(1).toBe(2); });
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.write('\r\n');

  await testProcess.waitForOutput('npx playwright test #1');
  await testProcess.waitForOutput('a.test.ts:3:11 › passes');
  await testProcess.waitForOutput('b.test.ts:3:11 › passes');
  await testProcess.waitForOutput('c.test.ts:3:11 › fails');
  await testProcess.waitForOutput('Error: expect(received).toBe(expected)');
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('f');
  await testProcess.waitForOutput('npx playwright test (running failed tests) #2');
  await testProcess.waitForOutput('c.test.ts:3:11 › fails');
  expect(testProcess.output).not.toContain('a.test.ts:3:11');
});

test('should respect file filter P', async ({ runWatchTest }) => {
  const testProcess = await runWatchTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('p');
  await testProcess.waitForOutput('Input filename pattern (regex)');
  testProcess.write('b.test\r\n');
  await testProcess.waitForOutput('npx playwright test b.test #1');
  await testProcess.waitForOutput('b.test.ts:3:11 › passes');
  expect(testProcess.output).not.toContain('a.test.ts:3:11');
  await testProcess.waitForOutput('Waiting for file changes.');
});

test('should respect project filter C', async ({ runWatchTest, writeFiles }) => {
  const files = {
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({ projects: [{name: 'foo'}, {name: 'bar'}] });
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  };
  const testProcess = await runWatchTest(files, { project: 'foo' });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('\r\n');

  await testProcess.waitForOutput('npx playwright test --project foo #1');
  await testProcess.waitForOutput('[foo] › a.test.ts:3:11 › passes');
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('c');
  await testProcess.waitForOutput('Select projects');
  await testProcess.waitForOutput('foo');
  await testProcess.waitForOutput('bar');
  testProcess.write(' ');
  testProcess.write('\r\n');
  await testProcess.waitForOutput('npx playwright test --project foo #2');
  await testProcess.waitForOutput('[foo] › a.test.ts:3:11 › passes');
  expect(testProcess.output).not.toContain('[bar] › a.test.ts:3:11 › passes');

  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();

  await writeFiles(files); // file change triggers listTests with project filter
  await testProcess.waitForOutput('[foo] › a.test.ts:3:11 › passes');

  testProcess.clearOutput();
  await testProcess.waitForOutput('Waiting for file changes.');

  testProcess.write('c');
  testProcess.clearOutput();
  await testProcess.waitForOutput('Select projects');
  await testProcess.waitForOutput('foo');
  await testProcess.waitForOutput('bar'); // second selection should still show all
});

test('should respect file filter P and split files', async ({ runWatchTest }) => {
  const testProcess = await runWatchTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('p');
  await testProcess.waitForOutput('Input filename pattern (regex)');
  testProcess.write('a.test b.test\r\n');
  await testProcess.waitForOutput('npx playwright test a.test b.test #1');
  await testProcess.waitForOutput('a.test.ts:3:11 › passes');
  await testProcess.waitForOutput('b.test.ts:3:11 › passes');
  await testProcess.waitForOutput('Waiting for file changes.');
});

test('should respect title filter T', async ({ runWatchTest }) => {
  const testProcess = await runWatchTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('title 1', () => {});
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('title 2', () => {});
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('t');
  await testProcess.waitForOutput('Input test name pattern (regex)');
  testProcess.write('title 2\r\n');
  await testProcess.waitForOutput('npx playwright test --grep title 2 #1');
  await testProcess.waitForOutput('b.test.ts:3:11 › title 2');
  expect(testProcess.output).not.toContain('a.test.ts:3:11');
  await testProcess.waitForOutput('Waiting for file changes.');
});

test('should re-run failed tests on F > R', async ({ runWatchTest }) => {
  const testProcess = await runWatchTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'c.test.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', () => { expect(1).toBe(2); });
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('\r\n');

  await testProcess.waitForOutput('npx playwright test #1');
  await testProcess.waitForOutput('a.test.ts:3:11 › passes');
  await testProcess.waitForOutput('b.test.ts:3:11 › passes');
  await testProcess.waitForOutput('c.test.ts:3:11 › fails');
  await testProcess.waitForOutput('Error: expect(received).toBe(expected)');
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('f');
  await testProcess.waitForOutput('npx playwright test (running failed tests) #2');
  await testProcess.waitForOutput('c.test.ts:3:11 › fails');
  expect(testProcess.output).not.toContain('a.test.ts:3:11');
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('r');
  await testProcess.waitForOutput('npx playwright test (re-running tests) #3');
  await testProcess.waitForOutput('c.test.ts:3:11 › fails');
  expect(testProcess.output).not.toContain('a.test.ts:3:11');
});

test('should run on changed files', async ({ runWatchTest, writeFiles }) => {
  const testProcess = await runWatchTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'c.test.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', () => { expect(1).toBe(2); });
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  await writeFiles({
    'c.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  });
  await testProcess.waitForOutput('c.test.ts:3:11 › passes');
  expect(testProcess.output).not.toContain('a.test.ts:3:11 › passes');
  expect(testProcess.output).not.toContain('b.test.ts:3:11 › passes');
  await testProcess.waitForOutput('Waiting for file changes.');

  testProcess.clearOutput();
  await writeFiles({
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  });

  await testProcess.waitForOutput('b.test.ts:3:11 › passes');
  expect(testProcess.output).not.toContain('c.test.ts:3:11 › passes');
});

test('should run on changed deps', async ({ runWatchTest, writeFiles }) => {
  const testProcess = await runWatchTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'b.test.ts': `
      import './helper';
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'helper.ts': `
      console.log('old helper');
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  await writeFiles({
    'helper.ts': `
      console.log('new helper');
    `,
  });
  await testProcess.waitForOutput('b.test.ts:4:11 › passes');
  expect(testProcess.output).not.toContain('a.test.ts:3:11 › passes');
  await testProcess.waitForOutput('new helper');
  await testProcess.waitForOutput('Waiting for file changes.');
});

test('should run on changed deps in ESM', async ({ runWatchTest, writeFiles }) => {
  const testProcess = await runWatchTest({
    'playwright.config.ts': `export default {};`,
    'package.json': `{ "type": "module" }`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('passes', () => {});
    `,
    'b.test.ts': `
      import './helper.js';
      import { test } from '@playwright/test';
      test('passes', () => {});
    `,
    'helper.ts': `
      console.log('old helper');
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  await writeFiles({
    'helper.ts': `
      console.log('new helper');
    `,
  });
  await testProcess.waitForOutput('b.test.ts:4:7 › passes');
  expect(testProcess.output).not.toContain('a.test.ts:3:7 › passes');
  await testProcess.waitForOutput('new helper');
  await testProcess.waitForOutput('Waiting for file changes.');
});

test('should re-run changed files on R', async ({ runWatchTest, writeFiles }) => {
  const testProcess = await runWatchTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'c.test.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', () => { expect(1).toBe(2); });
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  await writeFiles({
    'c.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  });
  await testProcess.waitForOutput('c.test.ts:3:11 › passes');
  expect(testProcess.output).not.toContain('a.test.ts:3:11 › passes');
  expect(testProcess.output).not.toContain('b.test.ts:3:11 › passes');
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('r');
  await testProcess.waitForOutput('c.test.ts:3:11 › passes');
  expect(testProcess.output).not.toContain('a.test.ts:3:11 › passes');
  expect(testProcess.output).not.toContain('b.test.ts:3:11 › passes');
  await testProcess.waitForOutput('Waiting for file changes.');
});

test('should not trigger on changes to non-tests', async ({ runWatchTest, writeFiles }) => {
  const testProcess = await runWatchTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');

  testProcess.clearOutput();
  await writeFiles({
    'helper.ts': `
      console.log('helper');
    `,
  });

  await timers.setTimeout(1000);
  expect(testProcess.output).not.toContain('Waiting for file changes.');
});

test('should only watch selected projects', async ({ runWatchTest, writeFiles }) => {
  const testProcess = await runWatchTest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({ projects: [{name: 'foo'}, {name: 'bar'}] });
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  }, undefined, undefined, { additionalArgs: ['--project=foo'] });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('\r\n');

  await testProcess.waitForOutput('npx playwright test --project foo');
  await testProcess.waitForOutput('[foo] › a.test.ts:3:11 › passes');
  expect(testProcess.output).not.toContain('[bar]');
  await testProcess.waitForOutput('Waiting for file changes.');

  testProcess.clearOutput();
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  });

  await testProcess.waitForOutput('npx playwright test --project foo');
  await testProcess.waitForOutput('[foo] › a.test.ts:3:11 › passes');
  await testProcess.waitForOutput('Waiting for file changes.');
  expect(testProcess.output).not.toContain('[bar]');
});

test('should watch filtered files', async ({ runWatchTest, writeFiles }) => {
  const testProcess = await runWatchTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  }, undefined, undefined, { additionalArgs: ['a.test.ts'] });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('\r\n');

  await testProcess.waitForOutput('npx playwright test a.test.ts');
  await testProcess.waitForOutput('a.test.ts:3:11 › passes');
  expect(testProcess.output).not.toContain('b.test');
  await testProcess.waitForOutput('Waiting for file changes.');

  testProcess.clearOutput();
  await writeFiles({
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  });

  await timers.setTimeout(1000);
  expect(testProcess.output).not.toContain('Waiting for file changes.');
});

test('should not watch unfiltered files', async ({ runWatchTest, writeFiles }) => {
  const testProcess = await runWatchTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  }, undefined, undefined, { additionalArgs: ['a.test.ts'] });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('\r\n');

  await testProcess.waitForOutput('npx playwright test a.test.ts');
  await testProcess.waitForOutput('a.test.ts:3:11 › passes');
  expect(testProcess.output).not.toContain('b.test');
  await testProcess.waitForOutput('Waiting for file changes.');

  testProcess.clearOutput();
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  });

  testProcess.clearOutput();
  await testProcess.waitForOutput('npx playwright test a.test.ts (files changed)');
  await testProcess.waitForOutput('a.test.ts:3:11 › passes');
  expect(testProcess.output).not.toContain('b.test');
  await testProcess.waitForOutput('Waiting for file changes.');
});

test('should run CT on changed deps', async ({ runWatchTest, writeFiles }) => {
  const testProcess = await runWatchTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/button.tsx': `
      export const Button = () => <button>Button</button>;
    `,
    'src/button.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';
      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button', { timeout: 1000 });
      });
    `,
    'src/link.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      test('pass', async ({ mount }) => {
        const component = await mount(<a>hello</a>);
        await expect(component).toHaveText('hello');
      });
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');
  await writeFiles({
    'src/button.tsx': `
      export const Button = () => <button>Button 2</button>;
    `,
  });

  await testProcess.waitForOutput(`src${path.sep}button.spec.tsx:4:11 › pass`);
  expect(testProcess.output).not.toContain(`src${path.sep}link.spec.tsx`);
  await testProcess.waitForOutput(`Error: expect(locator).toHaveText(expected) failed`);
  await testProcess.waitForOutput('Timeout: 1000ms');
  await testProcess.waitForOutput('Waiting for file changes.');
});

test('should run CT on indirect deps change', async ({ runWatchTest, writeFiles }) => {
  const testProcess = await runWatchTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/button.css': `
      button { color: red; }
    `,
    'src/button.tsx': `
      import './button.css';
      export const Button = () => <button>Button</button>;
    `,
    'src/helper.tsx': `
      import { Button } from "./button";
      export const buttonInstance = <Button></Button>
    `,
    'src/button.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { buttonInstance } from './helper';
      test('pass', async ({ mount }) => {
        const component = await mount(buttonInstance);
        await expect(component).toHaveText('Button', { timeout: 1000 });
      });
    `,
    'src/link.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      test('pass', async ({ mount }) => {
        const component = await mount(<a>hello</a>);
        await expect(component).toHaveText('hello');
      });
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');
  await writeFiles({
    'src/button.css': `
      button { color: blue; }
    `,
  });

  await testProcess.waitForOutput(`src${path.sep}button.spec.tsx:4:11 › pass`);
  expect(testProcess.output).not.toContain(`src${path.sep}link.spec.tsx`);
  await testProcess.waitForOutput('Waiting for file changes.');
});

test('should run CT on indirect deps change ESM mode', async ({ runWatchTest, writeFiles }) => {
  const testProcess = await runWatchTest({
    'playwright.config.ts': playwrightCtConfigText,
    'package.json': `{ "type": "module" }`,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/button.css': `
      button { color: red; }
    `,
    'src/button.tsx': `
      import './button.css';
      export const Button = () => <button>Button</button>;
    `,
    'src/button.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button.jsx';
      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button', { timeout: 1000 });
      });
    `,
    'src/link.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      test('pass', async ({ mount }) => {
        const component = await mount(<a>hello</a>);
        await expect(component).toHaveText('hello');
      });
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');
  await writeFiles({
    'src/button.css': `
      button { color: blue; }
    `,
  });

  await testProcess.waitForOutput(`src${path.sep}button.spec.tsx:4:7 › pass`);
  expect(testProcess.output).not.toContain(`src${path.sep}link.spec.tsx`);
  await testProcess.waitForOutput('Waiting for file changes.');
});

test('should run global teardown before exiting', async ({ runWatchTest }) => {
  const testProcess = await runWatchTest({
    'playwright.config.ts': `
      export default {
        globalTeardown: './global-teardown.ts',
      };
    `,
    'global-teardown.ts': `
      export default async function() {
        console.log('running teardown');
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', async () => {
      });
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('\r\n');

  await testProcess.waitForOutput('a.test.ts:3:11 › passes');
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.write('\x1B');
  await testProcess.waitForOutput('running teardown');
});

test('should stop testrun on pressing escape', async ({ runWatchTest }) => {
  const testProcess = await runWatchTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('stalls', async () => {
        console.log('test started')
        await new Promise(() => {});
      });
    `,
  });
  await testProcess.waitForOutput('Waiting for file changes.');
  testProcess.clearOutput();
  testProcess.write('\r\n');

  await testProcess.waitForOutput('test started');
  testProcess.write('\x1B');
  await testProcess.waitForOutput('1 interrupted');
});

test('buffer mode', async ({ runWatchTest, writeFiles }) => {
  const testProcess = await runWatchTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes in b', () => {});
    `,
  });

  testProcess.clearOutput();
  testProcess.write('b');
  await testProcess.waitForOutput('Waiting for file changes. Press q to quit');


  testProcess.clearOutput();
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes again', () => {});
    `,
  });

  await testProcess.waitForOutput('1 test file changed:');
  await testProcess.waitForOutput('a.test.ts');

  testProcess.clearOutput();
  await writeFiles({
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes in b again', () => {});
    `,
  });
  await testProcess.waitForOutput('2 test files changed:');
  await testProcess.waitForOutput('a.test.ts');
  await testProcess.waitForOutput('b.test.ts');

  testProcess.clearOutput();
  testProcess.write('\r\n');

  await testProcess.waitForOutput('a.test.ts:3:11 › passes');
  await testProcess.waitForOutput('b.test.ts:3:11 › passes');
});
