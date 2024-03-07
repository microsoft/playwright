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
const asciiRegex = new RegExp('[\\\\u001B\\\\u009B][[\\\\]()#;?]*(?:(?:(?:[a-zA-Z\\\\d]*(?:;[-a-zA-Z\\\\d\\\\/#&.:=?%@~_]*)*)?\\\\u0007)|(?:(?:\\\\d{1,4}(?:;\\\\d{0,4})*)?[\\\\dA-PR-TZcf-ntqry=><~]))', 'g');
export function stripAnsi(str) {
  return str.replace(asciiRegex, '');
}

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
        line: step.location.line,
        column: step.location.column
      } : undefined,
      steps: step.steps.length ? step.steps.map(s => this.distillStep(s)) : undefined,
      error: step.error ? stripAnsi(step.error.stack || '') : undefined,
    };
  }

  distillError(error) {
    return {
      error: {
        message: stripAnsi(error.message || ''),
        stack: stripAnsi(error.stack || ''),
      }
    };
  }

  onStdOut(data) {
    process.stdout.write(data.toString());
  }

  onStdErr(data) {
    process.stderr.write(data.toString());
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
          for (const error of result.errors) {
            console.log('%% ' + JSON.stringify(this.distillError(error)));
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
      import { test, expect } from '@playwright/test';
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
  const objects = result.outputLines.map(line => JSON.parse(line));
  expect(objects).toEqual([
    {
      category: 'hook',
      title: 'Before Hooks',
      steps: [
        {
          category: 'fixture',
          title: 'fixture: browser',
          steps: [
            {
              category: 'pw:api',
              title: 'browserType.launch',
            },
          ]
        },
        {
          category: 'fixture',
          title: 'fixture: context',
          steps: [
            {
              category: 'pw:api',
              title: 'browser.newContext',
            },
          ]
        },
        {
          category: 'fixture',
          title: 'fixture: page',
          steps: [
            {
              category: 'pw:api',
              title: 'browserContext.newPage',
            },
          ]
        },
      ],
    },
    {
      category: 'test.step',
      title: 'outer step 1',
      location: {
        column: expect.any(Number),
        file: 'a.test.ts',
        line: expect.any(Number),
      },
      steps: [
        {
          category: 'test.step',
          location: {
            column: expect.any(Number),
            file: 'a.test.ts',
            line: expect.any(Number),
          },
          title: 'inner step 1.1',
        },
        {
          category: 'test.step',
          location: {
            column: expect.any(Number),
            file: 'a.test.ts',
            line: expect.any(Number),
          },
          title: 'inner step 1.2',
        },
      ],
    },
    {
      category: 'test.step',
      title: 'outer step 2',
      location: {
        column: expect.any(Number),
        file: 'a.test.ts',
        line: expect.any(Number),
      },
      steps: [
        {
          category: 'test.step',
          location: {
            column: expect.any(Number),
            file: 'a.test.ts',
            line: expect.any(Number),
          },
          title: 'inner step 2.1',
        },
        {
          category: 'test.step',
          location: {
            column: expect.any(Number),
            file: 'a.test.ts',
            line: expect.any(Number),
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
          category: 'fixture',
          title: 'fixture: page',
        },
        {
          category: 'fixture',
          title: 'fixture: context',
        },
      ],
    },
  ]);
});

test('should report before hooks step error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepHierarchyReporter,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.beforeEach(async ({}) => {
        throw new Error('oh my');
      });
      test('pass', async ({}) => {
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(1);
  const objects = result.outputLines.map(line => JSON.parse(line));
  expect(objects).toEqual([
    {
      category: 'hook',
      title: 'Before Hooks',
      error: expect.any(String),
      steps: [
        {
          category: 'hook',
          title: 'beforeEach hook',
          error: expect.any(String),
          location: {
            column: expect.any(Number),
            file: 'a.test.ts',
            line: expect.any(Number),
          },
        }
      ],
    },
    {
      category: 'hook',
      title: 'After Hooks',
    },
    {
      category: 'hook',
      title: 'Worker Cleanup',
    },
    {
      error: expect.any(Object)
    }
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
      import { test, expect } from '@playwright/test';
      test('timeout', async ({ page }) => {
        await test.step('my step', async () => {
          await new Promise(() => {});
        });
      });
    `
  }, { reporter: '', workers: 1, timeout: 2000 });

  expect(result.exitCode).toBe(1);
  const objects = result.outputLines.map(line => JSON.parse(line));
  expect(objects).toEqual([
    {
      category: 'hook',
      title: 'Before Hooks',
      steps: [
        {
          category: 'fixture',
          title: 'fixture: browser',
          steps: [
            {
              category: 'pw:api',
              title: 'browserType.launch',
            },
          ]
        },
        {
          category: 'fixture',
          title: 'fixture: context',
          steps: [
            {
              category: 'pw:api',
              title: 'browser.newContext',
            },
          ]
        },
        {
          category: 'fixture',
          title: 'fixture: page',
          steps: [
            {
              category: 'pw:api',
              title: 'browserContext.newPage',
            },
          ]
        },
      ],
    },
    {
      category: 'test.step',
      title: 'my step',
      location: {
        column: expect.any(Number),
        file: 'a.test.ts',
        line: expect.any(Number),
      },
    },
    {
      category: 'hook',
      title: 'After Hooks',
      steps: [
        {
          category: 'fixture',
          title: 'fixture: page',
        },
        {
          category: 'fixture',
          title: 'fixture: context',
        },
      ],
    },
    {
      category: 'hook',
      title: 'Worker Cleanup',
      steps: [
        {
          category: 'fixture',
          title: 'fixture: browser',
        },
      ],
    },
    {
      error: {
        message: 'Test timeout of 2000ms exceeded.',
        stack: 'Test timeout of 2000ms exceeded.',
      },
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
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: async ({}, use) => {
          await base.step('setup foo', () => {});
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
  expect(result.outputLines).toEqual([
    `begin Before Hooks`,
    `begin fixture: foo`,
    `begin setup foo`,
    `end setup foo`,
    `end fixture: foo`,
    `end Before Hooks`,
    `begin test step`,
    `begin inside foo`,
    `end inside foo`,
    `end test step`,
    `begin After Hooks`,
    `begin fixture: foo`,
    `begin teardown foo`,
    `end teardown foo`,
    `end fixture: foo`,
    `end After Hooks`,
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
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page }) => {
        expect(true).toBeTruthy();
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  const objects = result.outputLines.map(line => JSON.parse(line));
  expect(objects).toEqual([
    {
      category: 'hook',
      title: 'Before Hooks',
      steps: [
        {
          category: 'fixture',
          title: 'fixture: browser',
          steps: [
            {
              category: 'pw:api',
              title: 'browserType.launch',
            },
          ]
        },
        {
          category: 'fixture',
          title: 'fixture: context',
          steps: [
            {
              category: 'pw:api',
              title: 'browser.newContext',
            },
          ]
        },
        {
          category: 'fixture',
          title: 'fixture: page',
          steps: [
            {
              category: 'pw:api',
              title: 'browserContext.newPage',
            },
          ]
        },
      ],
    },
    {
      category: 'expect',
      title: 'expect.toBeTruthy',
      location: {
        column: expect.any(Number),
        file: 'a.test.ts',
        line: expect.any(Number),
      },
    },
    {
      category: 'hook',
      title: 'After Hooks',
      steps: [
        {
          category: 'fixture',
          title: 'fixture: page',
        },
        {
          category: 'fixture',
          title: 'fixture: context',
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
        reporter: [['./reporter'], ['line']],
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

        async toBeFailingAsync(received) {
          await new Promise(f => setTimeout(f, 0));
          return {
            message: () => "It fails!",
            pass: false,
          };
        },
      });

      import { test, expect } from '@playwright/test';
      test('fail', async ({}) => {
        expect(15).toBeWithinRange(10, 20);
        await expect(1).toBeFailingAsync(22);
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('It fails!');
  const objects = result.outputLines.map(line => JSON.parse(line));
  expect(objects).toEqual([
    {
      category: 'hook',
      title: 'Before Hooks',
    },
    {
      category: 'expect',
      location: {
        column: expect.any(Number),
        file: 'a.test.ts',
        line: expect.any(Number),
      },
      title: 'expect.toBeWithinRange',
    },
    {
      category: 'expect',
      location: {
        column: expect.any(Number),
        file: 'a.test.ts',
        line: expect.any(Number),
      },
      title: 'expect.toBeFailingAsync',
      error: expect.any(String),
    },
    {
      category: 'hook',
      title: 'After Hooks',
    },
    {
      category: 'hook',
      title: 'Worker Cleanup',
    },
    {
      error: expect.any(Object)
    }
  ]);
});

test('should not pass arguments and return value from step', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('steps with return values', async ({ page }) => {
        const v1 = await test.step('my step', (...args) => {
          expect(args.length).toBe(0);
          return 10;
        });
        console.log('v1 = ' + v1);
        const v2 = await test.step('my step', async (...args) => {
          expect(args.length).toBe(0);
          return new Promise(f => setTimeout(() => f(v1 + 10), 100));
        });
        console.log('v2 = ' + v2);
      });
    `
  }, { reporter: '', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('v1 = 10');
  expect(result.output).toContain('v2 = 20');
});

test('should mark step as failed when soft expect fails', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepHierarchyReporter,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}) => {
        await test.step('outer', async () => {
          await test.step('inner', async () => {
            expect.soft(1).toBe(2);
          });
        });
        await test.step('passing', () => {});
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(1);
  const objects = result.outputLines.map(line => JSON.parse(line));
  expect(objects).toEqual([
    { title: 'Before Hooks', category: 'hook' },
    {
      title: 'outer',
      category: 'test.step',
      error: expect.any(String),
      steps: [{
        title: 'inner',
        category: 'test.step',
        error: expect.any(String),
        steps: [
          {
            title: 'expect.soft.toBe',
            category: 'expect',
            location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) },
            error: expect.any(String)
          }
        ],
        location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) }
      }],
      location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) }
    },
    {
      title: 'passing',
      category: 'test.step',
      location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) }
    },
    { title: 'After Hooks', category: 'hook' },
    { title: 'Worker Cleanup', category: 'hook' },
    { error: expect.any(Object) }
  ]);
});

test('should nest steps based on zones', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepHierarchyReporter,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.beforeAll(async () => {
        await test.step('in beforeAll', () => {});
      });

      test.afterAll(async () => {
        await test.step('in afterAll', () => {});
      });

      test.beforeEach(async () => {
        await test.step('in beforeEach', () => {});
      });

      test.afterEach(async () => {
        await test.step('in afterEach', () => {});
      });

      test.only('foo', async ({ page }) => {
        await test.step('grand', async () => {
          await Promise.all([
            test.step('parent1', async () => {
              await test.step('child1', async () => {
                await page.click('body');
              });
            }),
            test.step('parent2', async () => {
              await test.step('child2', async () => {
                await expect(page.locator('body')).toBeVisible();
              });
            }),
          ]);
        });
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  const objects = result.outputLines.map(line => JSON.parse(line));
  expect(objects).toEqual([
    {
      title: 'Before Hooks',
      category: 'hook',
      steps: [
        {
          title: 'beforeAll hook',
          category: 'hook',
          steps: [
            {
              title: 'in beforeAll',
              category: 'test.step',
              location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) }
            }
          ],
          location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) }
        },
        {
          title: 'beforeEach hook',
          category: 'hook',
          steps: [
            {
              title: 'in beforeEach',
              category: 'test.step',
              location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) }
            }
          ],
          location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) }
        },
        {
          category: 'fixture',
          title: 'fixture: browser',
          steps: [
            {
              category: 'pw:api',
              title: 'browserType.launch',
            },
          ]
        },
        {
          category: 'fixture',
          title: 'fixture: context',
          steps: [
            {
              category: 'pw:api',
              title: 'browser.newContext',
            },
          ]
        },
        {
          category: 'fixture',
          title: 'fixture: page',
          steps: [
            {
              category: 'pw:api',
              title: 'browserContext.newPage',
            },
          ]
        },
      ]
    },
    {
      title: 'grand',
      category: 'test.step',
      steps: [
        {
          title: 'parent1',
          category: 'test.step',
          steps: [
            {
              title: 'child1',
              category: 'test.step',
              location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) },
              steps: [
                {
                  title: 'page.click(body)',
                  category: 'pw:api',
                  location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) }
                }
              ]
            }
          ],
          location: {
            file: 'a.test.ts',
            line: expect.any(Number),
            column: expect.any(Number)
          }
        },
        {
          title: 'parent2',
          category: 'test.step',
          steps: [
            {
              title: 'child2',
              category: 'test.step',
              location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) },
              steps: [
                {
                  title: 'expect.toBeVisible',
                  category: 'expect',
                  location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) }
                }
              ]
            }
          ],
          location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) }
        }
      ],
      location: {
        file: 'a.test.ts',
        line: expect.any(Number),
        column: expect.any(Number)
      }
    },
    {
      title: 'After Hooks',
      category: 'hook',
      steps: [
        {
          title: 'afterEach hook',
          category: 'hook',
          steps: [
            {
              title: 'in afterEach',
              category: 'test.step',
              location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) }
            }
          ],
          location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) }
        },
        {
          category: 'fixture',
          title: 'fixture: page',
        },
        {
          category: 'fixture',
          title: 'fixture: context',
        },
        {
          title: 'afterAll hook',
          category: 'hook',
          steps: [
            {
              title: 'in afterAll',
              category: 'test.step',
              location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) }
            }
          ],
          location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) }
        },
      ]
    }
  ]);
});

test('should not mark page.close as failed when page.click fails', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepHierarchyReporter,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      let page: Page;

      test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
      });

      test.afterAll(async () => {
        await page.close();
      });

      test('fails', async () => {
        test.setTimeout(2000);
        await page.setContent('hello');
        await page.click('div');
      });
    `
  }, { reporter: '' });

  expect(result.exitCode).toBe(1);
  const objects = result.outputLines.map(line => JSON.parse(line));
  expect(objects).toEqual([
    {
      category: 'hook',
      title: 'Before Hooks',
      steps: [
        {
          category: 'hook',
          title: 'beforeAll hook',
          location: {
            column: expect.any(Number),
            file: 'a.test.ts',
            line: expect.any(Number),
          },
          steps: [
            {
              category: 'fixture',
              title: 'fixture: browser',
              steps: [
                { title: 'browserType.launch', category: 'pw:api' },
              ]
            },
            {
              category: 'pw:api',
              title: 'browser.newPage',
              location: {
                column: expect.any(Number),
                file: 'a.test.ts',
                line: expect.any(Number),
              },
            },
          ],
        },
      ],
    },
    {
      category: 'pw:api',
      title: 'page.setContent',
      location: {
        column: expect.any(Number),
        file: 'a.test.ts',
        line: expect.any(Number),
      },
    },
    {
      category: 'pw:api',
      title: 'page.click(div)',
      location: {
        column: expect.any(Number),
        file: 'a.test.ts',
        line: expect.any(Number),
      },
      error: expect.any(String),
    },

    {
      category: 'hook',
      title: 'After Hooks',
      steps: [
        {
          category: 'hook',
          title: 'afterAll hook',
          location: {
            column: expect.any(Number),
            file: 'a.test.ts',
            line: expect.any(Number),
          },
          steps: [
            {
              category: 'pw:api',
              title: 'page.close',
              location: {
                column: expect.any(Number),
                file: 'a.test.ts',
                line: expect.any(Number),
              },
            },
          ],
        },
      ],
    },
    {
      category: 'hook',
      title: 'Worker Cleanup',
      steps: [
        {
          category: 'fixture',
          title: 'fixture: browser',
        },
      ],
    },
    {
      error: {
        message: 'Test timeout of 2000ms exceeded.',
        stack: 'Test timeout of 2000ms exceeded.',
      },
    },
    {
      error: {
        message: expect.stringContaining('Error: page.click'),
        stack: expect.stringContaining('Error: page.click'),
      },
    },
  ]);
});

test('should nest page.continue inside page.goto steps', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepHierarchyReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter', };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page }) => {
        await page.route('**/*', route => route.fulfill('<html></html>'));
        await page.goto('http://localhost:1234');
      });
    `
  }, { reporter: '' });

  expect(result.exitCode).toBe(0);
  const objects = result.outputLines.map(line => JSON.parse(line));
  expect(objects).toEqual([
    {
      title: 'Before Hooks',
      category: 'hook',
      steps: [
        {
          category: 'fixture',
          title: 'fixture: browser',
          steps: [
            { title: 'browserType.launch', category: 'pw:api' },
          ]
        },
        {
          category: 'fixture',
          title: 'fixture: context',
          steps: [
            {
              category: 'pw:api',
              title: 'browser.newContext',
            },
          ]
        },
        {
          category: 'fixture',
          title: 'fixture: page',
          steps: [
            {
              category: 'pw:api',
              title: 'browserContext.newPage',
            },
          ]
        },
      ],
    },
    {
      title: 'page.route',
      category: 'pw:api',
      location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) },
    },
    {
      title: 'page.goto(http://localhost:1234)',
      category: 'pw:api',
      location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) },
      steps: [
        {
          title: 'route.fulfill',
          category: 'pw:api',
          location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) },
        },
      ]
    },
    {
      title: 'After Hooks',
      category: 'hook',
      steps: [
        {
          category: 'fixture',
          title: 'fixture: page',
        },
        {
          category: 'fixture',
          title: 'fixture: context',
        },
      ],
    },
  ]);
});

test('should not propagate errors from within toPass', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepHierarchyReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter', };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async () => {
        let i = 0;
        await expect(() => {
          expect(i++).toBe(2);
        }).toPass();
      });
    `
  }, { reporter: '' });

  expect(result.exitCode).toBe(0);
  const objects = result.outputLines.map(line => JSON.parse(line));
  expect(objects).toEqual([
    {
      title: 'Before Hooks',
      category: 'hook',
    },
    {
      title: 'expect.toPass',
      category: 'expect',
      location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) },
      steps: [
        {
          category: 'expect',
          error: expect.any(String),
          location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) },
          title: 'expect.toBe',
        },
        {
          category: 'expect',
          error: expect.any(String),
          location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) },
          title: 'expect.toBe',
        },
        {
          category: 'expect',
          location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) },
          title: 'expect.toBe',
        },
      ],
    },
    {
      title: 'After Hooks',
      category: 'hook',
    },
  ]);
});

test('should show final toPass error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepHierarchyReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter', };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('fail', async () => {
        await expect(() => {
          expect(true).toBe(false);
        }).toPass({ timeout: 1 });
      });
    `
  }, { reporter: '' });

  expect(result.exitCode).toBe(1);
  const objects = result.outputLines.map(line => JSON.parse(line));
  expect(objects).toEqual([
    {
      title: 'Before Hooks',
      category: 'hook',
    },
    {
      title: 'expect.toPass',
      category: 'expect',
      error: expect.any(String),
      location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) },
      steps: [
        {
          category: 'expect',
          error: expect.any(String),
          location: { file: 'a.test.ts', line: expect.any(Number), column: expect.any(Number) },
          title: 'expect.toBe',
        },
      ],
    },
    {
      title: 'After Hooks',
      category: 'hook',
    },
    {
      title: 'Worker Cleanup',
      category: 'hook',
    },
    {
      error: {
        message: expect.stringContaining('Error: expect(received).toBe(expected)'),
        stack: expect.stringContaining('a.test.ts:6'),
      }
    }

  ]);
});

test('should propagate nested soft errors', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepHierarchyReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter', };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('fail', async () => {
        await test.step('first outer', async () => {
          await test.step('first inner', async () => {
            expect.soft(1).toBe(2);
          });
        });

        await test.step('second outer', async () => {
          await test.step('second inner', async () => {
            expect(1).toBe(2);
          });
        });
      });
    `
  }, { reporter: '' });

  expect(result.exitCode).toBe(1);
  const objects = result.outputLines.map(line => JSON.parse(line));
  expect(objects).toEqual([
    {
      category: 'hook',
      title: 'Before Hooks',
    },
    {
      category: 'test.step',
      title: 'first outer',
      error: expect.any(String),
      location: { column: expect.any(Number), file: 'a.test.ts', line: expect.any(Number) },
      steps: [
        {
          category: 'test.step',
          title: 'first inner',
          error: expect.any(String),
          location: { column: expect.any(Number), file: 'a.test.ts', line: expect.any(Number) },
          steps: [
            {
              category: 'expect',
              title: 'expect.soft.toBe',
              error: expect.any(String),
              location: { column: expect.any(Number), file: 'a.test.ts', line: expect.any(Number) },
            },
          ],
        },
      ],
    },
    {
      category: 'test.step',
      title: 'second outer',
      error: expect.any(String),
      location: { column: expect.any(Number), file: 'a.test.ts', line: expect.any(Number) },
      steps: [
        {
          category: 'test.step',
          title: 'second inner',
          error: expect.any(String),
          location: { column: expect.any(Number), file: 'a.test.ts', line: expect.any(Number) },
          steps: [
            {
              category: 'expect',
              title: 'expect.toBe',
              error: expect.any(String),
              location: { column: expect.any(Number), file: 'a.test.ts', line: expect.any(Number) },
            },
          ],
        },
      ],
    },
    {
      category: 'hook',
      title: 'After Hooks',
    },
    {
      category: 'hook',
      title: 'Worker Cleanup',
    },
    {
      error: {
        message: expect.stringContaining('Error: expect(received).toBe(expected)'),
        stack: expect.stringContaining('a.test.ts:6'),
      }
    },
    {
      error: {
        message: expect.stringContaining('Error: expect(received).toBe(expected)'),
        stack: expect.stringContaining('a.test.ts:12'),
      }
    }
  ]);
});

test('should not propagate nested hard errors', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepHierarchyReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter', };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('fail', async () => {
        await test.step('first outer', async () => {
          await test.step('first inner', async () => {
            try {
              expect(1).toBe(2);
            } catch (e) {
            }
          });
        });

        await test.step('second outer', async () => {
          await test.step('second inner', async () => {
            expect(1).toBe(2);
          });
        });
      });
    `
  }, { reporter: '' });

  expect(result.exitCode).toBe(1);
  const objects = result.outputLines.map(line => JSON.parse(line));
  expect(objects).toEqual([
    {
      category: 'hook',
      title: 'Before Hooks',
    },
    {
      category: 'test.step',
      title: 'first outer',
      location: { column: expect.any(Number), file: 'a.test.ts', line: expect.any(Number) },
      steps: [
        {
          category: 'test.step',
          title: 'first inner',
          location: { column: expect.any(Number), file: 'a.test.ts', line: expect.any(Number) },
          steps: [
            {
              category: 'expect',
              title: 'expect.toBe',
              error: expect.any(String),
              location: { column: expect.any(Number), file: 'a.test.ts', line: expect.any(Number) },
            },
          ],
        },
      ],
    },
    {
      category: 'test.step',
      title: 'second outer',
      error: expect.any(String),
      location: { column: expect.any(Number), file: 'a.test.ts', line: expect.any(Number) },
      steps: [
        {
          category: 'test.step',
          title: 'second inner',
          error: expect.any(String),
          location: { column: expect.any(Number), file: 'a.test.ts', line: expect.any(Number) },
          steps: [
            {
              category: 'expect',
              title: 'expect.toBe',
              error: expect.any(String),
              location: { column: expect.any(Number), file: 'a.test.ts', line: expect.any(Number) },
            },
          ],
        },
      ],
    },
    {
      category: 'hook',
      title: 'After Hooks',
    },
    {
      category: 'hook',
      title: 'Worker Cleanup',
    },
    {
      error: {
        message: expect.stringContaining('Error: expect(received).toBe(expected)'),
        stack: expect.stringContaining('a.test.ts:13'),
      }
    }
  ]);
});

test('should step w/o box', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepHierarchyReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter', };`,
    'a.test.ts':
    ` /*1*/ import { test, expect } from '@playwright/test';
      /*2*/ test('fail', async () => {
      /*3*/   await test.step('boxed step', async () => {
      /*4*/     expect(1).toBe(2);
      /*5*/   });
      /*6*/ });
    `
  }, { reporter: '' });

  expect(result.exitCode).toBe(1);
  const objects = result.outputLines.map(line => JSON.parse(line));
  expect(objects).toEqual([
    {
      category: 'hook',
      title: 'Before Hooks',
    },
    {
      category: 'test.step',
      error: expect.stringContaining('a.test.ts:4:27'),
      location: {
        column: 26,
        file: 'a.test.ts',
        line: 3,
      },
      steps: [
        {
          category: 'expect',
          error: expect.stringContaining('a.test.ts:4:27'),
          location: {
            column: 27,
            file: 'a.test.ts',
            line: 4,
          },
          title: 'expect.toBe',
        },
      ],
      title: 'boxed step',
    },
    {
      category: 'hook',
      title: 'After Hooks',
    },
    {
      category: 'hook',
      title: 'Worker Cleanup',
    },
    {
      error: {
        message: expect.stringContaining('Error: expect(received).toBe(expected)'),
        stack: expect.stringContaining('a.test.ts:3'),
      }
    }
  ]);
});

test('should step w/ box', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepHierarchyReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter', };`,
    'a.test.ts':
    ` /*1*/ import { test, expect } from '@playwright/test';
      /*2*/ test('fail', async () => {
      /*3*/   const helper = async () => {
      /*4*/     await test.step('boxed step', async () => {
      /*5*/       expect(1).toBe(2);
      /*6*/     }, { box: true });
      /*7*/   };
      /*8*/   await helper();
      /*9*/ });
    `
  }, { reporter: '' });

  expect(result.exitCode).toBe(1);
  const objects = result.outputLines.map(line => JSON.parse(line));
  expect(objects).toEqual([
    {
      category: 'hook',
      title: 'Before Hooks',
    },
    {
      title: 'boxed step',
      category: 'test.step',
      error: expect.not.stringMatching(/a.test.ts:[^8]/),
      location: { file: 'a.test.ts', line: 8, column: 21 },
      steps: [{
        title: 'expect.toBe',
        category: 'expect',
        error: expect.stringContaining('expect(received).toBe(expected)'),
        location: { file: 'a.test.ts', column: 29, line: 5 }
      }],
    },
    {
      category: 'hook',
      title: 'After Hooks',
    },
    {
      category: 'hook',
      title: 'Worker Cleanup',
    },
    {
      error: {
        message: expect.stringContaining('expect(received).toBe(expected)'),
        stack: expect.not.stringMatching(/a.test.ts:[^8]/),
      }
    }
  ]);
});

test('should soft step w/ box', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepHierarchyReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter', };`,
    'a.test.ts':
    ` /*1*/ import { test, expect } from '@playwright/test';
      /*2*/ test('fail', async () => {
      /*3*/   const helper = async () => {
      /*4*/     await test.step('boxed step', async () => {
      /*5*/       expect.soft(1).toBe(2);
      /*6*/     }, { box: true });
      /*7*/   };
      /*8*/   await helper();
      /*9*/ });
    `
  }, { reporter: '' });

  expect(result.exitCode).toBe(1);
  const objects = result.outputLines.map(line => JSON.parse(line));
  expect(objects).toEqual([
    {
      category: 'hook',
      title: 'Before Hooks',
    },
    {
      title: 'boxed step',
      category: 'test.step',
      error: expect.not.stringMatching(/a.test.ts:[^8]/),
      location: { file: 'a.test.ts', line: 8, column: 21 },
      steps: [{
        title: 'expect.soft.toBe',
        category: 'expect',
        error: expect.stringContaining('expect(received).toBe(expected)'),
        location: { file: 'a.test.ts', column: 34, line: 5, }
      }],
    },
    {
      category: 'hook',
      title: 'After Hooks',
    },
    {
      category: 'hook',
      title: 'Worker Cleanup',
    },
    {
      error: {
        message: expect.stringContaining('Error: expect(received).toBe(expected)'),
        stack: expect.not.stringMatching(/a.test.ts:[^8]/),
      }
    }
  ]);
});

test('should not generate dupes for named expects', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepHierarchyReporter,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('timeout', async ({ page }) => {
        await page.setContent('<div style="background:rgb(1,2,3)">hi</div>');
        await expect(page.locator('div'), 'Checking color')
            .toHaveCSS('background-color', 'rgb(1, 2, 3)');
      });
    `
  }, { reporter: '', workers: 1, timeout: 2000 });

  expect(result.exitCode).toBe(0);
  const objects = result.outputLines.map(line => JSON.parse(line));
  expect(objects).toEqual([
    {
      category: 'hook',
      title: 'Before Hooks',
      steps: [
        {
          category: 'fixture',
          title: 'fixture: browser',
          steps: [
            {
              category: 'pw:api',
              title: 'browserType.launch',
            },
          ]
        },
        {
          category: 'fixture',
          title: 'fixture: context',
          steps: [
            {
              category: 'pw:api',
              title: 'browser.newContext',
            },
          ]
        },
        {
          category: 'fixture',
          title: 'fixture: page',
          steps: [
            {
              category: 'pw:api',
              title: 'browserContext.newPage',
            },
          ]
        },
      ],
    },
    {
      category: 'pw:api',
      title: 'page.setContent',
      location: {
        column: expect.any(Number),
        file: 'a.test.ts',
        line: expect.any(Number),
      },
    },
    {
      category: 'expect',
      title: 'Checking color',
      location: {
        column: expect.any(Number),
        file: 'a.test.ts',
        line: expect.any(Number),
      },
    },
    {
      category: 'hook',
      title: 'After Hooks',
      steps: [
        {
          category: 'fixture',
          title: 'fixture: page',
        },
        {
          category: 'fixture',
          title: 'fixture: context',
        },
      ],
    },
  ]);
});