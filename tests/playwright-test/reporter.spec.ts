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
    if (step.error?.message.includes('getaddrinfo'))
      step.error.message = '<message>';
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
      import { test, expect } from '@playwright/test';
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
  expect(result.outputLines).toEqual([
    'reporter-begin-begin%%',
    'version-' + require('../../packages/playwright-test/package.json').version,
    'reporter-testbegin-is run-foo%%',
    'reporter-stdout%%',
    'reporter-stderr%%',
    'reporter-testend-is run-foo%%',
    'reporter-testbegin-is run-foo%%',
    'reporter-stdout%%',
    'reporter-stderr%%',
    'reporter-testend-is run-foo%%',
    'reporter-testbegin-is run-bar%%',
    'reporter-stdout%%',
    'reporter-stderr%%',
    'reporter-testend-is run-bar%%',
    'reporter-end-end%%',
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
      import { test, expect } from '@playwright/test';
      test('pass', async ({}) => {
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'begin',
    'end',
  ]);
});

test('should report onEnd after global teardown', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': smallReporterJS,
    'globalSetup.ts': `
      module.exports = () => {
        return () => console.log('\\n%%global teardown');
      };
    `,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
        globalSetup: './globalSetup',
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}) => {
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'begin',
    'global teardown',
    'end',
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
      import { test, expect } from '@playwright/test';
      test('pass', async ({}) => {
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'begin',
    'end',
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
      import { test, expect } from '@playwright/test';
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
  expect(result.outputLines).toEqual([
    `begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `end {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `begin {\"title\":\"expect.toBeTruthy\",\"category\":\"expect\"}`,
    `end {\"title\":\"expect.toBeTruthy\",\"category\":\"expect\"}`,
    `begin {\"title\":\"expect.toBeTruthy\",\"category\":\"expect\"}`,
    `end {\"title\":\"expect.toBeTruthy\",\"category\":\"expect\",\"error\":{\"message\":\"\\u001b[2mexpect(\\u001b[22m\\u001b[31mreceived\\u001b[39m\\u001b[2m).\\u001b[22mtoBeTruthy\\u001b[2m()\\u001b[22m\\n\\nReceived: \\u001b[31mfalse\\u001b[39m\",\"stack\":\"<stack>\"}}`,
    `begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `end {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `end {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `begin {\"title\":\"expect.not.toBeTruthy\",\"category\":\"expect\"}`,
    `end {\"title\":\"expect.not.toBeTruthy\",\"category\":\"expect\"}`,
    `begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `end {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `begin {\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"Before Hooks\",\"category\":\"hook\",\"steps\":[{\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}]}`,
    `begin {\"title\":\"expect.not.toHaveTitle\",\"category\":\"expect\"}`,
    `end {\"title\":\"expect.not.toHaveTitle\",\"category\":\"expect\"}`,
    `begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `begin {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"After Hooks\",\"category\":\"hook\",\"steps\":[{\"title\":\"browserContext.close\",\"category\":\"pw:api\"}]}`,
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
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page, request }) => {
        await Promise.all([
          page.waitForNavigation(),
          page.goto('data:text/html,<button></button>'),
        ]);
        await page.click('button');
        await page.request.get('http://localhost2').catch(() => {});
        await request.get('http://localhost2').catch(() => {});
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
  expect(result.outputLines).toEqual([
    `begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `begin {\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"Before Hooks\",\"category\":\"hook\",\"steps\":[{\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}]}`,
    `begin {\"title\":\"page.waitForNavigation\",\"category\":\"pw:api\"}`,
    `begin {\"title\":\"page.goto(data:text/html,<button></button>)\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"page.waitForNavigation\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"page.goto(data:text/html,<button></button>)\",\"category\":\"pw:api\"}`,
    `begin {\"title\":\"page.click(button)\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"page.click(button)\",\"category\":\"pw:api\"}`,
    `begin {"title":"apiRequestContext.get(http://localhost2)","category":"pw:api"}`,
    `end {"title":"apiRequestContext.get(http://localhost2)","category":"pw:api","error":{"message":"<message>","stack":"<stack>"}}`,
    `begin {"title":"apiRequestContext.get(http://localhost2)","category":"pw:api"}`,
    `end {"title":"apiRequestContext.get(http://localhost2)","category":"pw:api","error":{"message":"<message>","stack":"<stack>"}}`,
    `begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `begin {\"title\":\"apiRequestContext.dispose\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"apiRequestContext.dispose\",\"category\":\"pw:api\"}`,
    `begin {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"After Hooks\",\"category\":\"hook\",\"steps\":[{\"title\":\"apiRequestContext.dispose\",\"category\":\"pw:api\"},{\"title\":\"browserContext.close\",\"category\":\"pw:api\"}]}`,
    `begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `begin {\"title\":\"beforeAll hook\",\"category\":\"hook\"}`,
    `begin {\"title\":\"browser.newPage\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"browser.newPage\",\"category\":\"pw:api\"}`,
    `begin {\"title\":\"page.setContent\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"page.setContent\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"beforeAll hook\",\"category\":\"hook\",\"steps\":[{\"title\":\"browser.newPage\",\"category\":\"pw:api\"},{\"title\":\"page.setContent\",\"category\":\"pw:api\"}]}`,
    `end {\"title\":\"Before Hooks\",\"category\":\"hook\",\"steps\":[{\"title\":\"beforeAll hook\",\"category\":\"hook\",\"steps\":[{\"title\":\"browser.newPage\",\"category\":\"pw:api\"},{\"title\":\"page.setContent\",\"category\":\"pw:api\"}]}]}`,
    `begin {\"title\":\"page.click(button)\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"page.click(button)\",\"category\":\"pw:api\"}`,
    `begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `end {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `end {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `begin {\"title\":\"page.click(button)\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"page.click(button)\",\"category\":\"pw:api\"}`,
    `begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `begin {\"title\":\"afterAll hook\",\"category\":\"hook\"}`,
    `begin {\"title\":\"page.close\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"page.close\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"afterAll hook\",\"category\":\"hook\",\"steps\":[{\"title\":\"page.close\",\"category\":\"pw:api\"}]}`,
    `end {\"title\":\"After Hooks\",\"category\":\"hook\",\"steps\":[{\"title\":\"afterAll hook\",\"category\":\"hook\",\"steps\":[{\"title\":\"page.close\",\"category\":\"pw:api\"}]}]}`,
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
      import { test, expect } from '@playwright/test';
      test('fail', async ({ page }) => {
        await page.setContent('<button></button>');
        await page.click('input', { timeout: 1 });
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.outputLines).toEqual([
    `begin {\"title\":\"Before Hooks\",\"category\":\"hook\"}`,
    `begin {\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"Before Hooks\",\"category\":\"hook\",\"steps\":[{\"title\":\"browserContext.newPage\",\"category\":\"pw:api\"}]}`,
    `begin {\"title\":\"page.setContent\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"page.setContent\",\"category\":\"pw:api\"}`,
    `begin {\"title\":\"page.click(input)\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"page.click(input)\",\"category\":\"pw:api\",\"error\":{\"message\":\"page.click: Timeout 1ms exceeded.\\n=========================== logs ===========================\\nwaiting for locator('input')\\n============================================================\",\"stack\":\"<stack>\"}}`,
    `begin {\"title\":\"After Hooks\",\"category\":\"hook\"}`,
    `begin {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"browserContext.close\",\"category\":\"pw:api\"}`,
    `end {\"title\":\"After Hooks\",\"category\":\"hook\",\"steps\":[{\"title\":\"browserContext.close\",\"category\":\"pw:api\"}]}`,
  ]);
});

test('should not have internal error when steps are finished after timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
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
      import { test, expect } from '@playwright/test';
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
  expect(result.outputLines).toEqual([
    `begin {"title":"Before Hooks","category":"hook"}`,
    `begin {"title":"browserContext.newPage","category":"pw:api"}`,
    `end {"title":"browserContext.newPage","category":"pw:api"}`,
    `end {"title":"Before Hooks","category":"hook","steps":[{"title":"browserContext.newPage","category":"pw:api"}]}`,
    `begin {"title":"page.setContent","category":"pw:api"}`,
    `end {"title":"page.setContent","category":"pw:api"}`,
    `begin {"title":"locator.evaluate(button)","category":"pw:api"}`,
    `end {"title":"locator.evaluate(button)","category":"pw:api"}`,
    `begin {"title":"After Hooks","category":"hook"}`,
    `begin {"title":"browserContext.close","category":"pw:api"}`,
    `end {"title":"browserContext.close","category":"pw:api"}`,
    `end {"title":"After Hooks","category":"hook","steps":[{"title":"browserContext.close","category":"pw:api"}]}`,
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
      import { test, expect } from '@playwright/test';
      test.only('pass', () => {});
    `
  }, { 'reporter': '', 'forbid-only': true });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`%%got error: Error: focused item found in the --forbid-only mode`);
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
  expect(result.output).toContain(`%%got error: No tests found`);
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
      const { test, expect } = require('@playwright/test');
      test('test', () => {});
    `,
  }, { 'reporter': '' });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`%%got error: Oh my!`);
});

test('should report correct tests/suites when using grep', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      import { test, expect } from '@playwright/test';

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
  expect(fileSuite.suites!.length).toBe(1);
  expect(fileSuite.suites![0].specs.length).toBe(2);
  expect(fileSuite.specs.length).toBe(0);
});

test('should use sourceMap-based file suite names', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/11028' });
  const result = await runInlineTest({
    'reporter.js': `
      class Reporter {
        onBegin(config, suite) {
          console.log(suite.suites[0].suites[0].location.file);
        }
      }
      module.exports = Reporter;
    `,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.spec.js':
`var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
};
var import_test = __toModule(require("@playwright/test"));
(0, import_test.test)("pass", async () => {
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2Euc3BlYy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgdGVzdCB9IGZyb20gXCJAcGxheXdyaWdodC90ZXN0XCI7XG5cbnRlc3QoJ3Bhc3MnLCBhc3luYyAoKSA9PiB7fSk7Il0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsa0JBQXFCO0FBRXJCLHNCQUFLLFFBQVEsWUFBWTtBQUFBOyIsCiAgIm5hbWVzIjogW10KfQo=`,
  }, { 'reporter': '' });

  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('a.spec.ts');
});

test('parallelIndex is presented in onTestEnd', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
    class Reporter {
      onTestEnd(test, result) {
        console.log('parallelIndex: ' + result.parallelIndex)
      }
    }
    module.exports = Reporter;`,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('test', () => {});
    `,
  }, { 'reporter': '', 'workers': 1 });

  expect(result.output).toContain('parallelIndex: 0');
});
