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

const stepsReporterJS = `
class Reporter {
  onStdOut(chunk) {
    process.stdout.write(chunk);
  }
  distillStep(step) {
    return {
      ...step,
      startTime: undefined,
      duration: undefined,
      parent: undefined,
      data: undefined,
      steps: step.steps.length ? step.steps.map(s => this.distillStep(s)) : undefined,
    };
  }
  onStepBegin(test, result, step) {
    console.log('%%%% begin', JSON.stringify(this.distillStep(step)));
  }
  onStepEnd(test, result, step) {
    if (step.error?.stack)
      step.error.stack = '<stack>';
    console.log('%%%% end', JSON.stringify(this.distillStep(step)));
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
  const result = await runInlineTest({
    'reporter.ts': stepsReporterJS,
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
    `%% end {\"title\":\"Before Hooks\",\"category\":\"hook\",\"steps\":[{\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}]}`,
    `%% begin {\"title\":\"expect.not.toHaveTitle\",\"category\":\"expect\"}`,
    `%% end {\"title\":\"expect.not.toHaveTitle\",\"category\":\"expect\"}`,
    `%% begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"After Hooks\",\"category\":\"hook\",\"steps\":[{\"title\":\"browserContext.close\",\"category\":\"pw:api\"}]}`,
  ]);
});

test('should report api steps', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepsReporterJS,
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
    `%% begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"Before Hooks\",\"category\":\"hook\",\"steps\":[{\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}]}`,
    `%% begin {\"title\":\"page.setContent\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.setContent\",\"category\":\"pw:api\"}`,
    `%% begin {\"title\":\"page.click\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.click\",\"category\":\"pw:api\"}`,
    `%% begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"After Hooks\",\"category\":\"hook\",\"steps\":[{\"title\":\"browserContext.close\",\"category\":\"pw:api\"}]}`,
    `%% begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% end {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"page.click\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.click\",\"category\":\"pw:api\"}`,
    `%% begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% end {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% end {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"page.click\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.click\",\"category\":\"pw:api\"}`,
    `%% begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% end {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
  ]);
});


test('should report api step failure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepsReporterJS,
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
    `%% end {\"title\":\"Before Hooks\",\"category\":\"hook\",\"steps\":[{\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}]}`,
    `%% begin {\"title\":\"page.setContent\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.setContent\",\"category\":\"pw:api\"}`,
    `%% begin {\"title\":\"page.click\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.click\",\"category\":\"pw:api\",\"error\":{\"message\":\"page.click: Timeout 1ms exceeded.\\n=========================== logs ===========================\\nwaiting for selector \\\"input\\\"\\n============================================================\",\"stack\":\"<stack>\"}}`,
    `%% begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"After Hooks\",\"category\":\"hook\",\"steps\":[{\"title\":\"browserContext.close\",\"category\":\"pw:api\"}]}`,
  ]);
});

test('should report test.step', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepsReporterJS,
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
    `%% end {\"title\":\"Before Hooks\",\"category\":\"hook\",\"steps\":[{\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}]}`,
    `%% begin {\"title\":\"First step\",\"category\":\"test.step\"}`,
    `%% begin {\"title\":\"expect.toBe\",\"category\":\"expect\"}`,
    `%% end {\"title\":\"expect.toBe\",\"category\":\"expect\",\"error\":{\"message\":\"expect(received).toBe(expected) // Object.is equality\\n\\nExpected: 2\\nReceived: 1\",\"stack\":\"<stack>\"}}`,
    `%% end {\"title\":\"First step\",\"category\":\"test.step\",\"steps\":[{\"title\":\"expect.toBe\",\"category\":\"expect\",\"error\":{\"message\":\"expect(received).toBe(expected) // Object.is equality\\n\\nExpected: 2\\nReceived: 1\",\"stack\":\"<stack>\"}}],\"error\":{\"message\":\"expect(received).toBe(expected) // Object.is equality\\n\\nExpected: 2\\nReceived: 1\",\"stack\":\"<stack>\"}}`,
    `%% begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"After Hooks\",\"category\":\"hook\",\"steps\":[{\"title\":\"browserContext.close\",\"category\":\"pw:api\"}]}`,
  ]);
});

test('should not have internal error when steps are finished after timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const test = pwt.test.extend({
        page: async ({ page }, use) => {
          await use(page);
          // Timeout in fixture teardown that will resolve on browser.close.
          await page.waitForNavigation();
        },
      });
      test('pass', async ({ page }) => {
        // Timeout in the test.
        await page.click('foo');
      });
    `
  }, { workers: 1, timeout: 1000, reporter: 'dot', retries: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).not.toContain('Internal error');
});

test('should report api step hierarchy', async ({ runInlineTest }) => {
  const expectReporterJS = `
    class Reporter {
      onBegin(config: FullConfig, suite: Suite) {
        this.suite = suite;
      }

      distillStep(step) {
        return {
          ...step,
          startTime: undefined,
          duration: undefined,
          parent: undefined,
          data: undefined,
          steps: step.steps.length ? step.steps.map(s => this.distillStep(s)) : undefined,
        };
      }

      async onEnd() {
        const processSuite = (suite: Suite) => {
          for (const child of suite.suites)
            processSuite(child);
          for (const test of suite.tests) {
            for (const result of test.results) {
              for (const step of result.steps) {
                console.log('%% ' + JSON.stringify(this.distillStep(step)));
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
  expect(objects).toEqual([
    {
      category: 'hook',
      title: 'Before Hooks',
      steps: [
        {
          category: 'pw:api',
          title: 'browserContext.newPage',
        },
      ],
    },
    {
      category: 'test.step',
      title: 'outer step 1',
      steps: [
        {
          category: 'test.step',
          title: 'inner step 1.1',
        },
        {
          category: 'test.step',
          title: 'inner step 1.2',
        },
      ],
    },
    {
      category: 'test.step',
      title: 'outer step 2',
      steps: [
        {
          category: 'test.step',
          title: 'inner step 2.1',
        },
        {
          category: 'test.step',
          title: 'inner step 2.2',
        },
      ],
    },
    {
      category: 'hook',
      title: 'After Hooks',
      steps: [
        {
          category: 'pw:api',
          title: 'browserContext.close',
        },
      ],
    },
  ]);
});

test('should report expect and pw:api stacks and logs', async ({ runInlineTest }, testInfo) => {
  const expectReporterJS = `
    class Reporter {
      stepStack(step) {
        if (!step.data.stack || !step.data.stack[0])
          return step.title + ' <no stack>';
        const frame = step.data.stack[0]
        return step.title + ' stack: ' + frame.file + ':' + frame.line + ':' + frame.column;
      }
      onStepEnd(test, result, step) {
        console.log('%%%% ' + this.stepStack(step));
        console.log('%%%% ' + step.title + ' log: ' + (step.data.log || []).join(''));
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
        await page.setContent('<title>hello</title><body><div>Click me</div></body>');
        await page.click('text=Click me');
        expect(1).toBe(1);
        await expect(page.locator('div')).toHaveText('Click me');
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.output).toContain(`%% page.setContent stack: ${testInfo.outputPath('a.test.ts:7:20')}`);
  expect(result.output).toContain(`%% page.setContent log: setting frame content, waiting until "load"`);
  expect(result.output).toContain(`%% page.click stack: ${testInfo.outputPath('a.test.ts:8:20')}`);
  expect(result.output).toContain(`%% page.click log: waiting for selector "text=Click me"`);
  expect(result.output).toContain(`%% expect.toBe stack: ${testInfo.outputPath('a.test.ts:9:19')}`);
  expect(result.output).toContain(`%% expect.toHaveText stack: ${testInfo.outputPath('a.test.ts:10:43')}`);
  expect(result.output).toContain(`%% expect.toHaveText log:   retrieving textContent from "div"`);
});

function stripEscapedAscii(str: string) {
  return str.replace(/\\u00[a-z0-9][a-z0-9]\[[^m]+m/g, '');
}
