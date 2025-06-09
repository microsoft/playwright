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

import fs from 'fs';
import path from 'path';
import { expect, test } from './playwright-test-fixtures';

const markdownReporter = require.resolve('../../packages/playwright/lib/reporters/markdown');

test('simple report', async ({ runInlineTest }) => {
  const files = {
    'playwright.config.ts': `
      module.exports = {
        retries: 1,
        reporter: ${JSON.stringify(markdownReporter)},
      };
    `,
    'dir1/a.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 1', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('failing 1', async ({}) => {
        expect(1).toBe(2);
      });
      test('flaky 1', async ({}) => {
        expect(test.info().retry).toBe(1);
      });
      test.skip('skipped 1', async ({}) => {});
    `,
    'dir2/b.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 2', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('failing 2', async ({}) => {
        expect(1).toBe(2);
      });
      test.skip('skipped 2', async ({}) => {});
    `,
    'c.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 3', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('flaky 2', async ({}) => {
        expect(test.info().retry).toBe(1);
      });
      test.skip('skipped 3', async ({}) => {});
    `
  };
  const { exitCode } = await runInlineTest(files);
  expect(exitCode).toBe(1);
  const reportFile = await fs.promises.readFile(test.info().outputPath('report.md'));
  expect(reportFile.toString()).toContain(`**2 failed**
:x: dir1${path.sep}a.test.js:6:11 › failing 1
:x: dir2${path.sep}b.test.js:6:11 › failing 2

<details>
<summary><b>2 flaky</b></summary>
:warning: c.test.js:6:11 › flaky 2 <br/>
:warning: dir1${path.sep}a.test.js:9:11 › flaky 1 <br/>

</details>

**3 passed, 3 skipped**
:heavy_check_mark::heavy_check_mark::heavy_check_mark:
`);
});

test('custom report file', async ({ runInlineTest }) => {
  const files = {
    'playwright.config.ts': `
      module.exports = {
        reporter: [[${JSON.stringify(markdownReporter)}, { outputFile: 'my-report.md' }]],
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 1', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `,
  };

  const { exitCode } = await runInlineTest(files);
  expect(exitCode).toBe(0);
  const reportFile = await fs.promises.readFile(test.info().outputPath('my-report.md'));
  expect(reportFile.toString()).toBe(`**1 passed**
:heavy_check_mark::heavy_check_mark::heavy_check_mark:
`);
});

test('report error without snippet', async ({ runInlineTest }) => {
  const files = {
    'playwright.config.ts': `
      module.exports = {
        retries: 1,
        reporter: ${JSON.stringify(markdownReporter)},
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 1', async ({}) => {
        const e = new Error('My error');
        e.stack = null;
        throw e;
      });
    `,
  };

  await runInlineTest(files);
  const reportFile = await fs.promises.readFile(test.info().outputPath('report.md'));
  expect(reportFile.toString()).toContain(`**1 failed**
:x: a.test.js:3:11 › math 1

**0 passed**
:heavy_check_mark::heavy_check_mark::heavy_check_mark:
`);
});

test('report with worker error', async ({ runInlineTest }) => {
  const files = {
    'playwright.config.ts': `
      module.exports = {
        retries: 1,
        reporter: ${JSON.stringify(markdownReporter)},
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      throw new Error('My error 1');
    `,
    'b.test.js': `
      import { test, expect } from '@playwright/test';
      throw new Error('My error 2');
    `,
  };

  const { exitCode } = await runInlineTest(files);
  expect(exitCode).toBe(1);
  const reportFile = await fs.promises.readFile(test.info().outputPath('report.md'));
  expect(reportFile.toString()).toContain(`**3 fatal errors, not part of any test**
**0 passed**
:heavy_check_mark::heavy_check_mark::heavy_check_mark:
`);
});
