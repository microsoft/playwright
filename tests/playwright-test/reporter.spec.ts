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

import { test, expect } from './playwright-test-fixtures';

const smallReporterJS = `
class Reporter {
  onBegin(config, suite) {
    console.log('\\n%%begin');
  }
  onTestBegin(test) {}
  onStdOut() {}
  onStdErr() {}
  onTestEnd(test, result) {}
  onTimeout() {}
  onError() {}
  onEnd() {
    console.log('\\n%%end');
  }
}
module.exports = Reporter;
`;

test('should work with custom reporter', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        constructor(options) {
          this.options = options;
        }
        onBegin(config, suite) {
          console.log('\\n%%reporter-begin-' + this.options.begin + '%%');
        }
        onTestBegin(test) {
          console.log('\\n%%reporter-testbegin-' + test.title + '-' + test.titlePath()[1] + '%%');
        }
        onStdOut() {
          console.log('\\n%%reporter-stdout%%');
        }
        onStdErr() {
          console.log('\\n%%reporter-stderr%%');
        }
        onTestEnd(test, result) {
          console.log('\\n%%reporter-testend-' + test.title + '-' + test.titlePath()[1] + '%%');
          if (!result.startTime)
            console.log('\\n%%error-no-start-time');
        }
        onTimeout() {
          console.log('\\n%%reporter-timeout%%');
        }
        onError() {
          console.log('\\n%%reporter-error%%');
        }
        async onEnd() {
          await new Promise(f => setTimeout(f, 500));
          console.log('\\n%%reporter-end-' + this.options.end + '%%');
        }
      }
      export default Reporter;
    `,
    'playwright.config.ts': `
      module.exports = {
        reporter: [
          [ './reporter.ts', { begin: 'begin', end: 'end' } ]
        ],
        projects: [
          { name: 'foo', repeatEach: 2 },
          { name: 'bar' },
        ],
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('not run', async ({}) => {
        console.log('log');
        console.error('error');
      });
      test.only('is run', async ({}) => {
        console.log('log');
        console.error('error');
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%reporter-begin-begin%%',
    '%%reporter-testbegin-is run-foo%%',
    '%%reporter-stdout%%',
    '%%reporter-stderr%%',
    '%%reporter-testend-is run-foo%%',
    '%%reporter-testbegin-is run-foo%%',
    '%%reporter-stdout%%',
    '%%reporter-stderr%%',
    '%%reporter-testend-is run-foo%%',
    '%%reporter-testbegin-is run-bar%%',
    '%%reporter-stdout%%',
    '%%reporter-stderr%%',
    '%%reporter-testend-is run-bar%%',
    '%%reporter-end-end%%',
  ]);
});

test('should work without a file extension', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': smallReporterJS,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({}) => {
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%begin',
    '%%end',
  ]);
});

test('should load reporter from node_modules', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'node_modules/my-reporter/index.js': smallReporterJS,
    'playwright.config.ts': `
      module.exports = {
        reporter: 'my-reporter',
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({}) => {
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%begin',
    '%%end',
  ]);
});

test('should report expect steps', async ({ runInlineTest }) => {
  const expectReporterJS = `
    class Reporter {
      onStdOut(chunk) {
        process.stdout.write(chunk);
      }
      onStepBegin(test, result, step) {
        const copy = { ...step, startTime: undefined, duration: undefined, steps: undefined };
        console.log('%%%% begin', JSON.stringify(copy));
      }
      onStepEnd(test, result, step) {
        const copy = { ...step, startTime: undefined, duration: undefined, steps: undefined };
        if (copy.error?.stack)
          copy.error.stack = '<stack>';
        console.log('%%%% end', JSON.stringify(copy));
      }
    }
    module.exports = Reporter;
  `;

  const result = await runInlineTest({
    'reporter.ts': expectReporterJS,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('fail', async ({}) => {
        expect(true).toBeTruthy();
        expect(false).toBeTruthy();
      });
      test('pass', async ({}) => {
        expect(false).not.toBeTruthy();
      });
      test('async', async ({ page }) => {
        await expect(page).not.toHaveTitle('False');
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.output.split('\n').filter(line => line.startsWith('%%')).map(stripEscapedAscii)).toEqual([
    `%% begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% end {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"expect.toBeTruthy\",\"category\":\"expect\"}`,
    `%% end {\"title\":\"expect.toBeTruthy\",\"category\":\"expect\"}`,
    `%% begin {\"title\":\"expect.toBeTruthy\",\"category\":\"expect\"}`,
    `%% end {\"title\":\"expect.toBeTruthy\",\"category\":\"expect\",\"error\":{\"message\":\"expect(received).toBeTruthy()\\n\\nReceived: false\",\"stack\":\"<stack>\"}}`,
    `%% begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% end {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% end {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"expect.not.toBeTruthy\",\"category\":\"expect\"}`,
    `%% end {\"title\":\"expect.not.toBeTruthy\",\"category\":\"expect\"}`,
    `%% begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% end {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"expect.not.toHaveTitle\",\"category\":\"expect\"}`,
    `%% begin {\"title\":\"page.title\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.title\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"expect.not.toHaveTitle\",\"category\":\"expect\"}`,
    `%% begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
  ]);
});

test('should report api steps', async ({ runInlineTest }) => {
  const expectReporterJS = `
    class Reporter {
      onStdOut(chunk) {
        process.stdout.write(chunk);
      }
      onTestBegin(test) {
        console.log('%%%% test begin ' + test.title);
      }
      onTestEnd(test) {
        console.log('%%%% test end ' + test.title);
      }
      onStepBegin(test, result, step) {
        const copy = { ...step, startTime: undefined, duration: undefined, steps: undefined };
        console.log('%%%% begin', JSON.stringify(copy));
      }
      onStepEnd(test, result, step) {
        const copy = { ...step, startTime: undefined, duration: undefined, steps: undefined };
        if (copy.error?.stack)
          copy.error.stack = '<stack>';
        console.log('%%%% end', JSON.stringify(copy));
      }
    }
    module.exports = Reporter;
  `;

  const result = await runInlineTest({
    'reporter.ts': expectReporterJS,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ page }) => {
        await page.setContent('<button></button>');
        await page.click('button');
      });

      test.describe('suite', () => {
        let myPage;
        test.beforeAll(async ({ browser }) => {
          myPage = await browser.newPage();
          await myPage.setContent('<button></button>');
        });

        test('pass1', async () => {
          await myPage.click('button');
        });
        test('pass2', async () => {
          await myPage.click('button');
        });

        test.afterAll(async () => {
          await myPage.close();
        });
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.output.split('\n').filter(line => line.startsWith('%%')).map(stripEscapedAscii)).toEqual([
    `%%%% test begin pass`,
    `%% begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"page.setContent\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.setContent\",\"category\":\"pw:api\"}`,
    `%% begin {\"title\":\"page.click\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.click\",\"category\":\"pw:api\"}`,
    `%% begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%%%% test end pass`,
    `%%%% test begin pass1`,
    `%% begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% end {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"page.click\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.click\",\"category\":\"pw:api\"}`,
    `%% begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% end {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%%%% test end pass1`,
    `%%%% test begin pass2`,
    `%% begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% end {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"page.click\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.click\",\"category\":\"pw:api\"}`,
    `%% begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% end {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%%%% test end pass2`,
  ]);
});


test('should report api step failure', async ({ runInlineTest }) => {
  const expectReporterJS = `
    class Reporter {
      onStdOut(chunk) {
        process.stdout.write(chunk);
      }
      onStepBegin(test, result, step) {
        const copy = { ...step, startTime: undefined, duration: undefined, steps: undefined };
        console.log('%%%% begin', JSON.stringify(copy));
      }
      onStepEnd(test, result, step) {
        const copy = { ...step, startTime: undefined, duration: undefined, steps: undefined };
        if (copy.error?.stack)
          copy.error.stack = '<stack>';
        console.log('%%%% end', JSON.stringify(copy));
      }
    }
    module.exports = Reporter;
  `;

  const result = await runInlineTest({
    'reporter.ts': expectReporterJS,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('fail', async ({ page }) => {
        await page.setContent('<button></button>');
        await page.click('input', { timeout: 1 });
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.output.split('\n').filter(line => line.startsWith('%%')).map(stripEscapedAscii)).toEqual([
    `%% begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"page.setContent\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.setContent\",\"category\":\"pw:api\"}`,
    `%% begin {\"title\":\"page.click\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.click\",\"category\":\"pw:api\",\"error\":{\"message\":\"page.click: Timeout 1ms exceeded.\\n=========================== logs ===========================\\nwaiting for selector \\\"input\\\"\\n============================================================\",\"stack\":\"<stack>\"}}`,
    `%% begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
  ]);
});

test('should report test.step', async ({ runInlineTest }) => {
  const expectReporterJS = `
    class Reporter {
      onStdOut(chunk) {
        process.stdout.write(chunk);
      }
      onStepBegin(test, result, step) {
        const copy = { ...step, startTime: undefined, duration: undefined, steps: undefined };
        console.log('%%%% begin', JSON.stringify(copy));
      }
      onStepEnd(test, result, step) {
        const copy = { ...step, startTime: undefined, duration: undefined, steps: undefined };
        if (copy.error?.stack)
          copy.error.stack = '<stack>';
        console.log('%%%% end', JSON.stringify(copy));
      }
    }
    module.exports = Reporter;
  `;

  const result = await runInlineTest({
    'reporter.ts': expectReporterJS,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ page }) => {
        await test.step('First step', async () => {
          expect(1).toBe(2);
        });
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.output.split('\n').filter(line => line.startsWith('%%')).map(stripEscapedAscii)).toEqual([
    `%% begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"First step\",\"category\":\"test.step\"}`,
    `%% begin {\"title\":\"expect.toBe\",\"category\":\"expect\"}`,
    `%% end {\"title\":\"expect.toBe\",\"category\":\"expect\",\"error\":{\"message\":\"expect(received).toBe(expected) // Object.is equality\\n\\nExpected: 2\\nReceived: 1\",\"stack\":\"<stack>\"}}`,
    `%% end {\"title\":\"First step\",\"category\":\"test.step\",\"error\":{\"message\":\"expect(received).toBe(expected) // Object.is equality\\n\\nExpected: 2\\nReceived: 1\",\"stack\":\"<stack>\"}}`,
    `%% begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
  ]);
});

test('should report api step hierarchy', async ({ runInlineTest }) => {
  const expectReporterJS = `
    class Reporter {
      onBegin(config: FullConfig, suite: Suite) {
        this.suite = suite;
      }

      async onEnd() {
        const processSuite = (suite: Suite) => {
          for (const child of suite.suites)
            processSuite(child);
          for (const test of suite.tests) {
            for (const result of test.results) {
              for (const step of result.steps) {
                console.log('%% ' + JSON.stringify(step));
              }
            }
          }
        };
        processSuite(this.suite);
      }
    }
    module.exports = Reporter;
  `;

  const result = await runInlineTest({
    'reporter.ts': expectReporterJS,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ page }) => {
        await test.step('outer step 1', async () => {
          await test.step('inner step 1.1', async () => {});
          await test.step('inner step 1.2', async () => {});
        });
        await test.step('outer step 2', async () => {
          await test.step('inner step 2.1', async () => {});
          await test.step('inner step 2.2', async () => {});
        });
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  const objects = result.output.split('\n').filter(line => line.startsWith('%% ')).map(line => line.substring(3).trim()).filter(Boolean).map(line => JSON.parse(line));
  const distill = step => {
    step.duration = 1;
    step.startTime = 'time';
    step.steps.forEach(distill);
  };
  objects.forEach(distill);
  expect(objects).toEqual([
    {
      category: 'hook',
      title: 'Before Hooks',
      duration: 1,
      startTime: 'time',
      steps: [
        {
          category: 'pw:api',
          title: 'browserContext.newPage',
          duration: 1,
          startTime: 'time',
          steps: [],
        },
      ],
    },
    {
      category: 'test.step',
      title: 'outer step 1',
      duration: 1,
      startTime: 'time',
      steps: [
        {
          category: 'test.step',
          title: 'inner step 1.1',
          duration: 1,
          startTime: 'time',
          steps: [],
        },
        {
          category: 'test.step',
          title: 'inner step 1.2',
          duration: 1,
          startTime: 'time',
          steps: [],
        },
      ],
    },
    {
      category: 'test.step',
      title: 'outer step 2',
      duration: 1,
      startTime: 'time',
      steps: [
        {
          category: 'test.step',
          title: 'inner step 2.1',
          duration: 1,
          startTime: 'time',
          steps: [],
        },
        {
          category: 'test.step',
          title: 'inner step 2.2',
          duration: 1,
          startTime: 'time',
          steps: [],
        },
      ],
    },
    {
      category: 'hook',
      title: 'After Hooks',
      duration: 1,
      startTime: 'time',
      steps: [
        {
          category: 'pw:api',
          title: 'browserContext.close',
          duration: 1,
          startTime: 'time',
          steps: [],
        },
      ],
    },
  ]);
});

function stripEscapedAscii(str: string) {
  return str.replace(/\\u00[a-z0-9][a-z0-9]\[[^m]+m/g, '');
}
