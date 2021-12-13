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
  onError(error) {
    console.log('\\n%%got error: ' + error.message);
  }
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
      location: undefined,
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
          console.log('\\n%%version-' + config.version);
        }
        onTestBegin(test) {
          const projectName = test.titlePath()[1];
          console.log('\\n%%reporter-testbegin-' + test.title + '-' + projectName + '%%');
          const suite = test.parent;
          if (!suite.tests.includes(test))
            console.log('\\n%%error-inconsistent-parent');
          if (test.parent.project().name !== projectName)
            console.log('\\n%%error-inconsistent-project-name');
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
    '%%version-' + require('../../packages/playwright-test/package.json').version,
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
        await Promise.all([
          page.waitForNavigation(),
          page.goto('data:text/html,<button></button>'),
        ]);
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
    `%% begin {\"title\":\"page.waitForNavigation\",\"category\":\"pw:api\"}`,
    `%% begin {\"title\":\"page.goto(data:text/html,<button></button>)\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.waitForNavigation\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.goto(data:text/html,<button></button>)\",\"category\":\"pw:api\"}`,
    `%% begin {\"title\":\"page.click(button)\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.click(button)\",\"category\":\"pw:api\"}`,
    `%% begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"After Hooks\",\"category\":\"hook\",\"steps\":[{\"title\":\"browserContext.close\",\"category\":\"pw:api\"}]}`,
    `%% begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% end {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"page.click(button)\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.click(button)\",\"category\":\"pw:api\"}`,
    `%% begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% end {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% end {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `%% begin {\"title\":\"page.click(button)\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.click(button)\",\"category\":\"pw:api\"}`,
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
    `%% begin {\"title\":\"page.click(input)\",\"category\":\"pw:api\"}`,
    `%% end {\"title\":\"page.click(input)\",\"category\":\"pw:api\",\"error\":{\"message\":\"page.click: Timeout 1ms exceeded.\\n=========================== logs ===========================\\nwaiting for selector \\\"input\\\"\\n============================================================\",\"stack\":\"<stack>\"}}`,
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

test('should show nice stacks for locators', async ({ runInlineTest }) => {
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
        const locator = page.locator('button');
        await locator.evaluate(e => e.innerText);
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(0);
  expect(result.output).not.toContain('Internal error');
  expect(result.output.split('\n').filter(line => line.startsWith('%%')).map(stripEscapedAscii)).toEqual([
    `%% begin {"title":"Before Hooks","category":"hook"}`,
    `%% begin {"title":"browserContext.newPage","category":"pw:api"}`,
    `%% end {"title":"browserContext.newPage","category":"pw:api"}`,
    `%% end {"title":"Before Hooks","category":"hook","steps":[{"title":"browserContext.newPage","category":"pw:api"}]}`,
    `%% begin {"title":"page.setContent","category":"pw:api"}`,
    `%% end {"title":"page.setContent","category":"pw:api"}`,
    `%% begin {"title":"locator.evaluate(button)","category":"pw:api"}`,
    `%% end {"title":"locator.evaluate(button)","category":"pw:api"}`,
    `%% begin {"title":"After Hooks","category":"hook"}`,
    `%% begin {"title":"browserContext.close","category":"pw:api"}`,
    `%% end {"title":"browserContext.close","category":"pw:api"}`,
    `%% end {"title":"After Hooks","category":"hook","steps":[{"title":"browserContext.close","category":"pw:api"}]}`,
  ]);
});

test('should report forbid-only error to reporter', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': smallReporterJS,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      pwt.test.only('pass', () => {});
    `
  }, { 'reporter': '', 'forbid-only': true });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`%%got error: =====================================\n --forbid-only found a focused test.`);
});

test('should report no-tests error to reporter', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': smallReporterJS,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `
  }, { 'reporter': '' });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`%%got error: =================\n no tests found.`);
});

test('should report require error to reporter', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': smallReporterJS,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.spec.js': `
      throw new Error('Oh my!');
    `,
  }, { 'reporter': '' });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`%%got error: Oh my!`);
});

test('should report global setup error to reporter', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': smallReporterJS,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
        globalSetup: './globalSetup',
      };
    `,
    'globalSetup.ts': `
      module.exports = () => {
        throw new Error('Oh my!');
      };
    `,
    'a.spec.js': `
      pwt.test('test', () => {});
    `,
  }, { 'reporter': '' });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`%%got error: Oh my!`);
});

test('should report correct tests/suites when using grep', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;

      test.describe('@foo', () => {
        test('test1', async ({ }) => {
          console.log('%%test1');
        });
        test('test2', async ({ }) => {
          console.log('%%test2');
        });
      });

      test('test3', async ({ }) => {
        console.log('%%test3');
      });
    `,
  }, { 'grep': '@foo' });

  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('%%test1');
  expect(result.output).toContain('%%test2');
  expect(result.output).not.toContain('%%test3');
  const fileSuite = result.report.suites[0];
  expect(fileSuite.suites.length).toBe(1);
  expect(fileSuite.suites[0].specs.length).toBe(2);
  expect(fileSuite.specs.length).toBe(0);
});

function stripEscapedAscii(str: string) {
  return str.replace(/\\u00[a-z0-9][a-z0-9]\[[^m]+m/g, '');
}
