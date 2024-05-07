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
const path = require('path');

function formatLocation(location) {
  if (!location)
    return ' @ <no location>';
  return ' @ ' + path.basename(location.file) + ':' + location.line;
}

function formatTitle(test) {
  let titlePath = test.titlePath();
  if (!titlePath[0])
    [, ...titlePath] = titlePath;
  return titlePath.join(' > ');
}

const asciiRegex = new RegExp('[\\\\u001B\\\\u009B][[\\\\]()#;?]*(?:(?:(?:[a-zA-Z\\\\d]*(?:;[-a-zA-Z\\\\d\\\\/#&.:=?%@~_]*)*)?\\\\u0007)|(?:(?:\\\\d{1,4}(?:;\\\\d{0,4})*)?[\\\\dA-PR-TZcf-ntqry=><~]))', 'g');
function stripAnsi(str) {
  return str.replace(asciiRegex, '');
}

class Reporter {
  constructor(options) {
    this.options = options;
  }

  trimError(message) {
    if (this.options.skipErrorMessage)
      return '<error message>';
    const lines = message.split('\\n');
    return lines[0].trimEnd();
  }

  printErrors(errors, prefix) {
    for (const error of errors) {
      const errorLocation = this.options.skipErrorLocation ? '' : formatLocation(error.location);
      console.log((prefix || '  error: ') + this.trimError(error.message) + errorLocation);
      if (this.options.printErrorSnippet && error.snippet) {
        const lines = ['======', ...error.snippet.split('\\n'), '======'];
        console.log(lines.map(line => stripAnsi('  ' + line).trimEnd()).join('\\n'));
      }
    }
  }

  printsToStdio() {
    return true;
  }

  onBegin(config, suite) {
    console.log(); // for nicer expectations
    console.log('onBegin: ' + suite.allTests().length + ' tests total');
    if (this.options.onBegin)
      console.log('  options.onBegin=' + this.options.onBegin);
  }

  onTestBegin(test, result) {
    console.log('onTestBegin: ' + formatTitle(test) + '; retry #' + result.retry);
  }

  onTestEnd(test, result) {
    const status = this.options.printTestStatus ? '[' + result.status + '] ' : '';
    console.log('onTestEnd: ' + status + formatTitle(test) + '; retry #' + result.retry);
    this.printErrors(result.errors);
  }

  onStepBegin(test, result, step) {
  }

  onStepEnd(test, result, step) {
    if (this.options.printSteps) {
      console.log('onStepEnd: ' + step.title);
      if (step.error)
        this.printErrors([step.error]);
    }
  }

  // For easier debugging.
  onStdOut(data) {
    process.stdout.write(data.toString());
  }

  // For easier debugging.
  onStdErr(data) {
    process.stderr.write(data.toString());
  }

  onError(error) {
    this.printErrors([error], 'onError: ');
  }

  async onEnd() {
    await new Promise(f => setTimeout(f, 500));
    console.log('onEnd');
    if (this.options.onEnd)
      console.log('  options.onEnd=' + this.options.onEnd);
  }

  async onExit() {
    console.log('onExit');
  }
}
module.exports = Reporter;
`;

for (const useIntermediateMergeReport of [false, true] as const) {
  test.describe(`${useIntermediateMergeReport ? 'merged' : 'created'}`, () => {
    test.use({ useIntermediateMergeReport });

    test('should work with custom reporter', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'reporter.ts': smallReporterJS,
        'playwright.config.ts': `
          module.exports = {
            reporter: [
              [ './reporter.ts', { onBegin: 'begin-data', onEnd: 'end-data' } ]
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
          });
          test.only('is run', async ({}) => {
          });
        `
      }, { reporter: '', workers: 1 });

      expect(result.exitCode).toBe(0);
      expect(result.output).toBe(`
onBegin: 3 tests total
  options.onBegin=begin-data
onTestBegin: foo > a.test.ts > is run; retry #0
onTestEnd: foo > a.test.ts > is run; retry #0
onTestBegin: foo > a.test.ts > is run; retry #0
onTestEnd: foo > a.test.ts > is run; retry #0
onTestBegin: bar > a.test.ts > is run; retry #0
onTestEnd: bar > a.test.ts > is run; retry #0
onEnd
  options.onEnd=end-data
onExit
`);
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
      expect(result.output).toBe(`
onBegin: 1 tests total
onTestBegin:  > a.test.ts > pass; retry #0
onTestEnd:  > a.test.ts > pass; retry #0
onEnd
onExit
`);
    });

    test('should report onEnd after global teardown', async ({ runInlineTest }) => {
      test.skip(useIntermediateMergeReport);
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
      expect(result.output).toBe(`
onBegin: 1 tests total
onTestBegin:  > a.test.ts > pass; retry #0
onTestEnd:  > a.test.ts > pass; retry #0

%%global teardown
onEnd
onExit
`);
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
      expect(result.output).toBe(`
onBegin: 1 tests total
onTestBegin:  > a.test.ts > pass; retry #0
onTestEnd:  > a.test.ts > pass; retry #0
onEnd
onExit
`);
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
      expect(result.output).toBe(`
onBegin: 0 tests total
onError: Error: item focused with '.only' is not allowed due to the '--forbid-only' CLI flag: "a.test.ts pass" @ a.test.ts:3
onEnd
onExit
`);
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
      expect(result.output).toBe(`
onBegin: 0 tests total
onError: Error: No tests found @ <no location>
onEnd
onExit
`);
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
      expect(result.output).toBe(`
onBegin: 0 tests total
onError: Error: Oh my! @ a.spec.js:2
onError: Error: No tests found @ <no location>
onEnd
onExit
`);
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
      expect(result.output).toBe(`
onBegin: 0 tests total
onError: Error: Oh my! @ globalSetup.ts:3
onEnd
onExit
`);
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

    test('test and step error should have code snippet', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'reporter.ts': smallReporterJS,
        'playwright.config.ts': `module.exports = { reporter: [['./reporter', { printSteps: true, printErrorSnippet: true }]] };`,
        'a.spec.js': `
          const { test, expect } = require('@playwright/test');
          test('test', async () => {
            await test.step('step', async () => {
              expect(1).toBe(2);
            });
          });
        `,
      }, { 'reporter': '', 'workers': 1 });
      expect(result.output).toBe(`
onBegin: 1 tests total
onTestBegin:  > a.spec.js > test; retry #0
onStepEnd: Before Hooks
onStepEnd: expect.toBe
  error: Error: expect(received).toBe(expected) // Object.is equality @ a.spec.js:5
  ======
    3 |           test('test', async () => {
    4 |             await test.step('step', async () => {
  > 5 |               expect(1).toBe(2);
      |                         ^
    6 |             });
    7 |           });
    8 |
  ======
onStepEnd: step
  error: Error: expect(received).toBe(expected) // Object.is equality @ a.spec.js:5
  ======
    3 |           test('test', async () => {
    4 |             await test.step('step', async () => {
  > 5 |               expect(1).toBe(2);
      |                         ^
    6 |             });
    7 |           });
    8 |
  ======
onStepEnd: After Hooks
onStepEnd: Worker Cleanup
onTestEnd:  > a.spec.js > test; retry #0
  error: Error: expect(received).toBe(expected) // Object.is equality @ a.spec.js:5
  ======
    3 |           test('test', async () => {
    4 |             await test.step('step', async () => {
  > 5 |               expect(1).toBe(2);
      |                         ^
    6 |             });
    7 |           });
    8 |
  ======
onEnd
onExit
`);
    });

    test('onError should have code snippet', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'reporter.ts': smallReporterJS,
        'playwright.config.ts': `module.exports = { reporter: [['./reporter', { printSteps: true, printErrorSnippet: true }]] };`,
        'a.spec.js': `
          const { test, expect } = require('@playwright/test');
          throw new Error('test');
        `,
      }, { 'reporter': '', 'workers': 1 });

      expect(result.output).toBe(`
onBegin: 0 tests total
onError: Error: test @ a.spec.js:3
  ======
     at a.spec.js:3

    1 |
    2 |           const { test, expect } = require('@playwright/test');
  > 3 |           throw new Error('test');
      |                 ^
    4 |
  ======
onError: Error: No tests found @ <no location>
onEnd
onExit
`);
    });
  });
}

test('should report a stable test.id', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        onTestBegin(test) {
          console.log('\\n%%testbegin-' + test.id);
        }
      }
      export default Reporter;
    `,
    'playwright.config.ts': `
      module.exports = { reporter: [[ './reporter.ts' ]] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('example test', async ({}) => {
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'testbegin-20289bcdad95a5e18c38-8b63c3695b9c8bd62d98',
  ]);
});

test('should report annotations from test declaration', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      export default class Reporter {
        onBegin(config, suite) {
          const visit = suite => {
            for (const test of suite.tests || []) {
              const annotations = test.annotations.map(a => {
                return a.description ? a.type + '=' + a.description : a.type;
              });
              console.log('\\n%%title=' + test.title + ', annotations=' + annotations.join(','));
            }
            for (const child of suite.suites || [])
              visit(child);
          };
          visit(suite);
        }
        onError(error) {
          console.log(error);
        }
      }
    `,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'stdio.spec.js': `
      import { test, expect } from '@playwright/test';
      test('none', () => {
        expect(test.info().annotations).toEqual([]);
      });
      test('foo', { annotation: { type: 'foo' } }, () => {
        expect(test.info().annotations).toEqual([{ type: 'foo' }]);
      });
      test('foo-bar', {
        annotation: [
          { type: 'foo', description: 'desc' },
          { type: 'bar' },
        ],
      }, () => {
        expect(test.info().annotations).toEqual([
          { type: 'foo', description: 'desc' },
          { type: 'bar' },
        ]);
      });
      test.skip('skip-foo', { annotation: { type: 'foo' } }, () => {
      });
      test.fixme('fixme-bar', { annotation: { type: 'bar' } }, () => {
      });
      test.fail('fail-foo-bar', {
        annotation: [
          { type: 'foo' },
          { type: 'bar', description: 'desc' },
        ],
      }, () => {
        expect(1).toBe(2);
      });
      test.describe('suite', { annotation: { type: 'foo' } }, () => {
        test('foo-suite', () => {
          expect(test.info().annotations).toEqual([{ type: 'foo' }]);
        });
        test.describe('inner', { annotation: { type: 'bar' } }, () => {
          test('foo-bar-suite', () => {
            expect(test.info().annotations).toEqual([{ type: 'foo' }, { type: 'bar' }]);
          });
        });
      });
      test.describe.skip('skip-foo-suite', { annotation: { type: 'foo' } }, () => {
        test('skip-foo-suite', () => {
        });
      });
      test.describe.fixme('fixme-bar-suite', { annotation: { type: 'bar' } }, () => {
        test('fixme-bar-suite', () => {
        });
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    `title=none, annotations=`,
    `title=foo, annotations=foo`,
    `title=foo-bar, annotations=foo=desc,bar`,
    `title=skip-foo, annotations=foo,skip`,
    `title=fixme-bar, annotations=bar,fixme`,
    `title=fail-foo-bar, annotations=foo,bar=desc,fail`,
    `title=foo-suite, annotations=foo`,
    `title=foo-bar-suite, annotations=foo,bar`,
    `title=skip-foo-suite, annotations=foo,skip`,
    `title=fixme-bar-suite, annotations=bar,fixme`,
  ]);
});

test('tests skipped in serial mode receive onTestBegin/onTestEnd', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/28321' });

  const result = await runInlineTest({
    'reporter.ts': smallReporterJS,
    'playwright.config.ts': `module.exports = { reporter: [['./reporter', { printTestStatus: true }]] };`,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';

      test.describe.configure({ mode: 'serial', retries: 1 });

      test('test1', () => {
        expect(test.info().retry).toBe(1);
      });

      test('test2', () => {
      });
    `,
  }, { 'reporter': '', 'workers': 1 });

  expect(result.output).toBe(`
onBegin: 2 tests total
onTestBegin:  > a.spec.ts > test1; retry #0
onTestEnd: [failed]  > a.spec.ts > test1; retry #0
  error: Error: expect(received).toBe(expected) // Object.is equality @ a.spec.ts:7
onTestBegin:  > a.spec.ts > test2; retry #0
onTestEnd: [skipped]  > a.spec.ts > test2; retry #0
onTestBegin:  > a.spec.ts > test1; retry #1
onTestEnd: [passed]  > a.spec.ts > test1; retry #1
onTestBegin:  > a.spec.ts > test2; retry #1
onTestEnd: [passed]  > a.spec.ts > test2; retry #1
onEnd
onExit
`);
});
