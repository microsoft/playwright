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

const stepHierarchyReporter = `
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
      location: step.location ? {
        file: step.location.file.substring(step.location.file.lastIndexOf(require('path').sep) + 1).replace('.js', '.ts'),
        line: step.location.line ? typeof step.location.line : 0,
        column: step.location.column ? typeof step.location.column : 0
      } : undefined,
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

test('should report api step hierarchy', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepHierarchyReporter,
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
      location: {
        column: 'number',
        file: 'a.test.ts',
        line: 'number',
      },
      steps: [
        {
          category: 'test.step',
          location: {
            column: 'number',
            file: 'a.test.ts',
            line: 'number',
          },
          title: 'inner step 1.1',
        },
        {
          category: 'test.step',
          location: {
            column: 'number',
            file: 'a.test.ts',
            line: 'number',
          },
          title: 'inner step 1.2',
        },
      ],
    },
    {
      category: 'test.step',
      title: 'outer step 2',
      location: {
        column: 'number',
        file: 'a.test.ts',
        line: 'number',
      },
      steps: [
        {
          category: 'test.step',
          location: {
            column: 'number',
            file: 'a.test.ts',
            line: 'number',
          },
          title: 'inner step 2.1',
        },
        {
          category: 'test.step',
          location: {
            column: 'number',
            file: 'a.test.ts',
            line: 'number',
          },
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

test('should not report nested after hooks', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepHierarchyReporter,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('timeout', async ({ page }) => {
        await test.step('my step', async () => {
          await new Promise(() => {});
        });
      });
    `
  }, { reporter: '', workers: 1, timeout: 2000 });

  expect(result.exitCode).toBe(1);
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
      title: 'my step',
      location: {
        column: 'number',
        file: 'a.test.ts',
        line: 'number',
      },
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

test('should report test.step from fixtures', async ({ runInlineTest }) => {
  const expectReporterJS = `
    class Reporter {
      onStepBegin(test, result, step) {
        console.log('%% begin ' + step.title);
      }
      onStepEnd(test, result, step) {
        console.log('%% end ' + step.title);
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
      const test = pwt.test.extend({
        foo: async ({}, use) => {
          await pwt.test.step('setup foo', () => {});
          await use(async () => {
            await test.step('inside foo', () => {});
          });
          await test.step('teardown foo', () => {});
        },
      });
      test('pass', async ({ foo }) => {
        await test.step('test step', async () => {
          await foo();
        });
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    `%% begin Before Hooks`,
    `%% begin setup foo`,
    `%% end setup foo`,
    `%% end Before Hooks`,
    `%% begin test step`,
    `%% begin inside foo`,
    `%% end inside foo`,
    `%% end test step`,
    `%% begin After Hooks`,
    `%% begin teardown foo`,
    `%% end teardown foo`,
    `%% end After Hooks`,
  ]);
});

test('should report expect step locations', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepHierarchyReporter,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ page }) => {
        expect(true).toBeTruthy();
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
      category: 'expect',
      title: 'expect.toBeTruthy',
      location: {
        column: 'number',
        file: 'a.test.ts',
        line: 'number',
      },
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

test('should report custom expect steps', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepHierarchyReporter,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      expect.extend({
        toBeWithinRange(received, floor, ceiling) {
          const pass = received >= floor && received <= ceiling;
          if (pass) {
            return {
              message: () =>
                "expected " + received + " not to be within range " + floor + " - " + ceiling,
              pass: true,
            };
          } else {
            return {
              message: () =>
                "expected " + received + " to be within range " + floor + " - " + ceiling,
              pass: false,
            };
          }
        },
      });

      const { test } = pwt;
      test('pass', async ({}) => {
        expect(15).toBeWithinRange(10, 20);
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  const objects = result.output.split('\n').filter(line => line.startsWith('%% ')).map(line => line.substring(3).trim()).filter(Boolean).map(line => JSON.parse(line));
  expect(objects).toEqual([
    {
      category: 'hook',
      title: 'Before Hooks',
    },
    {
      category: 'expect',
      location: {
        column: 'number',
        file: 'a.test.ts',
        line: 'number',
      },
      title: 'expect.toBeWithinRange',
    },
    {
      category: 'hook',
      title: 'After Hooks',
    },
  ]);
});
