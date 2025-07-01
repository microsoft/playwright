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

import { test, expect, stripAnsi } from './playwright-test-fixtures';

const stepIndentReporter = `
import { FullConfig, Location, Reporter, Suite, TestStep } from '@playwright/test/reporter';
import * as path from 'path';

function formatPrefix(str: string) {
  return str.padEnd(10, ' ') + '|';
}

function formatLocation(location?: Location) {
  if (!location)
    throw new Error('Location is missing');
  return ' @ ' + path.basename(location.file) + ':' + location.line;
}

function formatStack(indent: string, rawStack: string) {
  let stack = rawStack.split('\\n').filter(s => s.startsWith('    at '));
  stack = stack.map(s => {
    const match =  /^(    at.* )\\(?([^ )]+)\\)?/.exec(s);
    let location = match![2];
    location = location.substring(location.lastIndexOf(path.sep) + 1);
    return '    at ' + location;
  });
  return indent + stack.join('\\n' + indent);
}

export default class MyReporter implements Reporter {
  printErrorLocation: boolean;
  skipErrorMessage: boolean;
  suite!: Suite;

  constructor(options: { printErrorLocation: boolean, skipErrorMessage: boolean }) {
    this.printErrorLocation = options.printErrorLocation;
    this.skipErrorMessage = options.skipErrorMessage;
  }

  trimError(message: string) {
    if (this.skipErrorMessage)
      return '<error message>';
    const lines = message.split('\\n');
    return lines[0];
  }

  onBegin(config: FullConfig, suite: Suite) {
    this.suite = suite;
  }

  // For easier debugging.
  onStdOut(data: string|Buffer) {
    process.stdout.write(data.toString());
  }
  // For easier debugging.
  onStdErr(data: string|Buffer) {
    process.stderr.write(data.toString());
  }

  printStep(step: TestStep, indent: string) {
    let location = '';
    if (step.location)
      location = formatLocation(step.location);
    const skip = step.annotations?.find(a => a.type === 'skip');
    const skipped = skip?.description ? ' (skipped: ' + skip.description + ')' : skip ? ' (skipped)' : '';
    console.log(formatPrefix(step.category) + indent + step.title + location + skipped);
    if (step.error) {
      const errorLocation = this.printErrorLocation ? formatLocation(step.error.location) : '';
      console.log(formatPrefix(step.category) + indent + '↪ error: ' + this.trimError(step.error.message!) + errorLocation);
      if (this.printErrorLocation)
        console.log(formatStack(formatPrefix(step.category) + indent, step.error.stack!));
    }
    indent += '  ';
    for (const child of step.steps)
      this.printStep(child, indent);
  }

  async onEnd() {
    console.log(); // for nicer expectations
    const processSuite = (suite: Suite) => {
      for (const child of suite.suites)
        processSuite(child);
      for (const test of suite.tests) {
        for (const result of test.results) {
          for (const step of result.steps)
            this.printStep(step, '');
          for (const error of result.errors) {
            const errorLocation = this.printErrorLocation ? formatLocation(error.location) : '';
            console.log(formatPrefix('') + this.trimError(error.message!) + errorLocation);
            if (this.printErrorLocation)
              console.log(formatStack(formatPrefix(''), error.stack!));
          }
        }
      }
    };
    processSuite(this.suite);
  }
}
`;

test('should report api step hierarchy', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
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
  expect(result.output).toBe(`
hook      |Before Hooks
fixture   |  browser
pw:api    |    Launch browser
fixture   |  context
pw:api    |    Create context
fixture   |  page
pw:api    |    Create page
test.step |outer step 1 @ a.test.ts:4
test.step |  inner step 1.1 @ a.test.ts:5
test.step |  inner step 1.2 @ a.test.ts:6
test.step |outer step 2 @ a.test.ts:8
test.step |  inner step 2.1 @ a.test.ts:9
test.step |  inner step 2.2 @ a.test.ts:10
hook      |After Hooks
fixture   |  page
fixture   |  context
`);
});

test('should report before hooks step error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
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
  expect(result.output).toBe(`
hook      |Before Hooks
hook      |↪ error: Error: oh my
hook      |  beforeEach hook @ a.test.ts:3
hook      |  ↪ error: Error: oh my
hook      |After Hooks
hook      |Worker Cleanup
          |Error: oh my
`);
});

test('should not report nested after hooks', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
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
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
fixture   |  browser
pw:api    |    Launch browser
fixture   |  context
pw:api    |    Create context
fixture   |  page
pw:api    |    Create page
test.step |my step @ a.test.ts:4
hook      |After Hooks
fixture   |  page
fixture   |  context
hook      |Worker Cleanup
fixture   |  browser
          |Test timeout of 2000ms exceeded.
`);
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
    `begin foo`,
    `begin setup foo`,
    `end setup foo`,
    `end foo`,
    `end Before Hooks`,
    `begin test step`,
    `begin inside foo`,
    `end inside foo`,
    `end test step`,
    `begin After Hooks`,
    `begin foo`,
    `begin teardown foo`,
    `end teardown foo`,
    `end foo`,
    `end After Hooks`,
  ]);
});

test('should report expect step locations', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}) => {
        expect(true).toBeTruthy();
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.output).toBe(`
hook      |Before Hooks
expect    |toBeTruthy @ a.test.ts:4
hook      |After Hooks
`);
});

test('should report custom expect steps', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `
      module.exports = {
        reporter: [['./reporter']],
      };
    `,
    'a.test.ts': `
      import { test, expect as baseExpect } from '@playwright/test';

      const expect = baseExpect.extend({
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

      test('fail', async ({}) => {
        expect(15).toBeWithinRange(10, 20);
        await expect(1).toBeFailingAsync(22);
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.output).toBe(`
hook      |Before Hooks
expect    |toBeWithinRange @ a.test.ts:32
expect    |toBeFailingAsync @ a.test.ts:33
expect    |↪ error: Error: It fails!
hook      |After Hooks
hook      |Worker Cleanup
          |Error: It fails!
`);
});

test('should not pass return value from step', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('steps with return values', async ({ page }) => {
        const v1 = await test.step('my step', () => {
          return 10;
        });
        console.log('v1 = ' + v1);
        const v2 = await test.step('my step', async () => {
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

test('step timeout option', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('step with timeout', async () => {
        await test.step('my step', async () => {
          await new Promise(() => {});
        }, { timeout: 100 });
      });
    `
  }, { reporter: '', workers: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Error: Step timeout of 100ms exceeded.');
});

test('step timeout longer than test timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({ timeout: 900 });
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('step with timeout', async () => {
        await test.step('my step', async () => {
          await new Promise(() => {});
        }, { timeout: 5000 });
      });
    `
  }, { reporter: '', workers: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Test timeout of 900ms exceeded.');
});

test('step timeout includes interrupted action errors', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('step with timeout', async ({ page }) => {
        await test.step('my step', async () => {
          await page.waitForTimeout(100_000);
        }, { timeout: 1000 });
      });
    `
  }, { reporter: '', workers: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  // Should include 2 errors, one for the step timeout and one for the aborted action.
  expect.soft(result.output).toContain('TimeoutError: Step timeout of 1000ms exceeded.');
  expect.soft(result.output).toContain(`> 4 |         await test.step('my step', async () => {`);
  expect.soft(result.output).toContain('Error: page.waitForTimeout: Test ended.');
  expect.soft(result.output.split('Error: page.waitForTimeout: Test ended.').length).toBe(2);
  expect.soft(result.output).toContain('> 5 |           await page.waitForTimeout(100_000);');
});

test('step timeout is errors.TimeoutError', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect, errors } from '@playwright/test';
      test('step timeout error type', async () => {
        const e = await test.step('my step', async () => {
          await new Promise(() => {});
        }, { timeout: 100 }).catch(e => e);
        expect(e).toBeInstanceOf(errors.TimeoutError);
      });
    `
  }, { reporter: '', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should mark step as failed when soft expect fails', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
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
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
test.step |outer @ a.test.ts:4
test.step |↪ error: Error: expect(received).toBe(expected) // Object.is equality
test.step |  inner @ a.test.ts:5
test.step |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |    soft toBe @ a.test.ts:6
expect    |    ↪ error: Error: expect(received).toBe(expected) // Object.is equality
test.step |passing @ a.test.ts:9
hook      |After Hooks
hook      |Worker Cleanup
          |Error: expect(received).toBe(expected) // Object.is equality
`);
});

test('should nest steps based on zones', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
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
  expect(result.output).toBe(`
hook      |Before Hooks
hook      |  beforeAll hook @ a.test.ts:3
test.step |    in beforeAll @ a.test.ts:4
hook      |  beforeEach hook @ a.test.ts:11
test.step |    in beforeEach @ a.test.ts:12
fixture   |  browser
pw:api    |    Launch browser
fixture   |  context
pw:api    |    Create context
fixture   |  page
pw:api    |    Create page
test.step |grand @ a.test.ts:20
test.step |  parent1 @ a.test.ts:22
test.step |    child1 @ a.test.ts:23
pw:api    |      Click locator('body') @ a.test.ts:24
test.step |  parent2 @ a.test.ts:27
test.step |    child2 @ a.test.ts:28
expect    |      toBeVisible @ a.test.ts:29
hook      |After Hooks
hook      |  afterEach hook @ a.test.ts:15
test.step |    in afterEach @ a.test.ts:16
fixture   |  page
fixture   |  context
hook      |  afterAll hook @ a.test.ts:7
test.step |    in afterAll @ a.test.ts:8
`);
});

test('should not mark page.close as failed when page.click fails', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
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
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
hook      |  beforeAll hook @ a.test.ts:5
fixture   |    browser
pw:api    |      Launch browser
pw:api    |    Create page @ a.test.ts:6
pw:api    |Set content @ a.test.ts:15
pw:api    |Click locator('div') @ a.test.ts:16
pw:api    |↪ error: Error: page.click: Target page, context or browser has been closed
hook      |After Hooks
hook      |  afterAll hook @ a.test.ts:9
pw:api    |    Close context @ a.test.ts:10
hook      |Worker Cleanup
fixture   |  browser
          |Test timeout of 2000ms exceeded.
          |Error: page.click: Target page, context or browser has been closed
`);
});

test('should not propagate errors from within toPass', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
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
  expect(result.output).toBe(`
hook      |Before Hooks
test.step |Expect "toPass" @ a.test.ts:7
expect    |  toBe @ a.test.ts:6
expect    |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |  toBe @ a.test.ts:6
expect    |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |  toBe @ a.test.ts:6
hook      |After Hooks
`);
});

test('should show final toPass error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
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
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
test.step |Expect "toPass" @ a.test.ts:6
test.step |↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |  toBe @ a.test.ts:5
expect    |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality
hook      |After Hooks
hook      |Worker Cleanup
          |Error: expect(received).toBe(expected) // Object.is equality
`);
});

test('should propagate nested soft errors', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
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
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
test.step |first outer @ a.test.ts:4
test.step |↪ error: Error: expect(received).toBe(expected) // Object.is equality
test.step |  first inner @ a.test.ts:5
test.step |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |    soft toBe @ a.test.ts:6
expect    |    ↪ error: Error: expect(received).toBe(expected) // Object.is equality
test.step |second outer @ a.test.ts:10
test.step |↪ error: Error: expect(received).toBe(expected) // Object.is equality
test.step |  second inner @ a.test.ts:11
test.step |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |    toBe @ a.test.ts:12
expect    |    ↪ error: Error: expect(received).toBe(expected) // Object.is equality
hook      |After Hooks
hook      |Worker Cleanup
          |Error: expect(received).toBe(expected) // Object.is equality
          |Error: expect(received).toBe(expected) // Object.is equality
`);
});

test('should not propagate nested hard errors', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
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
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
test.step |first outer @ a.test.ts:4
test.step |  first inner @ a.test.ts:5
expect    |    toBe @ a.test.ts:7
expect    |    ↪ error: Error: expect(received).toBe(expected) // Object.is equality
test.step |second outer @ a.test.ts:13
test.step |↪ error: Error: expect(received).toBe(expected) // Object.is equality
test.step |  second inner @ a.test.ts:14
test.step |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |    toBe @ a.test.ts:15
expect    |    ↪ error: Error: expect(received).toBe(expected) // Object.is equality
hook      |After Hooks
hook      |Worker Cleanup
          |Error: expect(received).toBe(expected) // Object.is equality
`);
});

test('should step w/o box', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `module.exports = { reporter: [['./reporter', { printErrorLocation: true }]], };`,
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
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
test.step |boxed step @ a.test.ts:3
test.step |↪ error: Error: expect(received).toBe(expected) // Object.is equality @ a.test.ts:4
test.step |    at a.test.ts:4:27
test.step |    at a.test.ts:3:26
expect    |  toBe @ a.test.ts:4
expect    |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality @ a.test.ts:4
expect    |      at a.test.ts:4:27
expect    |      at a.test.ts:3:26
hook      |After Hooks
hook      |Worker Cleanup
          |Error: expect(received).toBe(expected) // Object.is equality @ a.test.ts:4
          |    at a.test.ts:4:27
          |    at a.test.ts:3:26
`);
});

test('should step w/ box', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `module.exports = { reporter: [['./reporter', { printErrorLocation: true }]], };`,
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
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
test.step |boxed step @ a.test.ts:8
test.step |↪ error: Error: expect(received).toBe(expected) // Object.is equality @ a.test.ts:8
test.step |    at a.test.ts:8:21
expect    |  toBe @ a.test.ts:5
expect    |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality @ a.test.ts:8
expect    |      at a.test.ts:8:21
hook      |After Hooks
hook      |Worker Cleanup
          |Error: expect(received).toBe(expected) // Object.is equality @ a.test.ts:8
          |    at a.test.ts:8:21
`);
});

test('should soft step w/ box', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `module.exports = { reporter: [['./reporter', { printErrorLocation: true }]], };`,
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
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
test.step |boxed step @ a.test.ts:8
test.step |↪ error: Error: expect(received).toBe(expected) // Object.is equality @ a.test.ts:8
test.step |    at a.test.ts:8:21
expect    |  soft toBe @ a.test.ts:5
expect    |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality @ a.test.ts:8
expect    |      at a.test.ts:8:21
hook      |After Hooks
hook      |Worker Cleanup
          |Error: expect(received).toBe(expected) // Object.is equality @ a.test.ts:8
          |    at a.test.ts:8:21
`);
});

test('should not generate dupes for named expects', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
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
  expect(result.output).toBe(`
hook      |Before Hooks
fixture   |  browser
pw:api    |    Launch browser
fixture   |  context
pw:api    |    Create context
fixture   |  page
pw:api    |    Create page
pw:api    |Set content @ a.test.ts:4
expect    |Checking color @ a.test.ts:6
hook      |After Hooks
fixture   |  page
fixture   |  context
`);
});

test('step inside toPass', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30322' });
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}) => {
        await test.step('step 1', async () => {
          let counter = 0
          await expect(async () => {
            await test.step('step 2, attempt: ' + counter, async () => {
              counter++;
              expect(counter).toBe(2);
            });
          }).toPass();
          await test.step('step 3', async () => {
            await test.step('step 4', async () => {
              expect(1).toBe(1);
            });
          });
        });
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
test.step |step 1 @ a.test.ts:4
test.step |  Expect "toPass" @ a.test.ts:11
test.step |    step 2, attempt: 0 @ a.test.ts:7
test.step |    ↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |      toBe @ a.test.ts:9
expect    |      ↪ error: Error: expect(received).toBe(expected) // Object.is equality
test.step |    step 2, attempt: 1 @ a.test.ts:7
expect    |      toBe @ a.test.ts:9
test.step |  step 3 @ a.test.ts:12
test.step |    step 4 @ a.test.ts:13
expect    |      toBe @ a.test.ts:14
hook      |After Hooks
`);
});

test('library API call inside toPass', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30322' });
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({page}) => {
        let counter = 0
        await expect(async () => {
          await page.goto('about:blank');
          await test.step('inner step attempt: ' + counter, async () => {
            counter++;
            expect(counter).toBe(2);
          });
        }).toPass();
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
fixture   |  browser
pw:api    |    Launch browser
fixture   |  context
pw:api    |    Create context
fixture   |  page
pw:api    |    Create page
test.step |Expect "toPass" @ a.test.ts:11
pw:api    |  Navigate to "about:blank" @ a.test.ts:6
test.step |  inner step attempt: 0 @ a.test.ts:7
test.step |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |    toBe @ a.test.ts:9
expect    |    ↪ error: Error: expect(received).toBe(expected) // Object.is equality
pw:api    |  Navigate to "about:blank" @ a.test.ts:6
test.step |  inner step attempt: 1 @ a.test.ts:7
expect    |    toBe @ a.test.ts:9
hook      |After Hooks
fixture   |  page
fixture   |  context
`);
});

test('library API call inside expect.poll', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30322' });
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({page}) => {
        let counter = 0
        const a = [];
        await expect.poll(async () => {
          await page.goto('about:blank');
          await test.step('inner step attempt: ' + counter, async () => {
            counter++;
            expect(1).toBe(1);
          });
          a.push(1);
          return a;
        }).toHaveLength(2);
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
fixture   |  browser
pw:api    |    Launch browser
fixture   |  context
pw:api    |    Create context
fixture   |  page
pw:api    |    Create page
test.step |Expect "poll toHaveLength" @ a.test.ts:14
pw:api    |  Navigate to "about:blank" @ a.test.ts:7
test.step |  inner step attempt: 0 @ a.test.ts:8
expect    |    toBe @ a.test.ts:10
expect    |  toHaveLength @ a.test.ts:6
expect    |  ↪ error: Error: expect(received).toHaveLength(expected)
pw:api    |  Navigate to "about:blank" @ a.test.ts:7
test.step |  inner step attempt: 1 @ a.test.ts:8
expect    |    toBe @ a.test.ts:10
expect    |  toHaveLength @ a.test.ts:6
hook      |After Hooks
fixture   |  page
fixture   |  context
`);
});

test('web assertion inside expect.poll', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30322' });
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page }) => {
        await page.setContent('<div>foo</div>');
        let counter = 0
        await expect.poll(async () => {
          await expect(page.locator('div')).toHaveText('foo');
          ++counter;
          await test.step('iteration ' + counter, async () => {
            await expect(page.locator('div')).toBeVisible();
          });
          return counter;
        }).toBe(2);
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
fixture   |  browser
pw:api    |    Launch browser
fixture   |  context
pw:api    |    Create context
fixture   |  page
pw:api    |    Create page
pw:api    |Set content @ a.test.ts:4
test.step |Expect "poll toBe" @ a.test.ts:13
expect    |  toHaveText @ a.test.ts:7
test.step |  iteration 1 @ a.test.ts:9
expect    |    toBeVisible @ a.test.ts:10
expect    |  toBe @ a.test.ts:6
expect    |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |  toHaveText @ a.test.ts:7
test.step |  iteration 2 @ a.test.ts:9
expect    |    toBeVisible @ a.test.ts:10
expect    |  toBe @ a.test.ts:6
hook      |After Hooks
fixture   |  page
fixture   |  context
`);
});

test('should report expect steps', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
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
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
expect    |toBeTruthy @ a.test.ts:4
expect    |toBeTruthy @ a.test.ts:5
expect    |↪ error: Error: expect(received).toBeTruthy()
hook      |After Hooks
hook      |Worker Cleanup
          |Error: expect(received).toBeTruthy()
hook      |Before Hooks
expect    |not toBeTruthy @ a.test.ts:8
hook      |After Hooks
hook      |Before Hooks
fixture   |  browser
pw:api    |    Launch browser
fixture   |  context
pw:api    |    Create context
fixture   |  page
pw:api    |    Create page
expect    |not toHaveTitle @ a.test.ts:11
hook      |After Hooks
fixture   |  page
fixture   |  context
`);
});

test('should report api steps', async ({ runInlineTest, server }) => {
  server.setRoute('/empty.html', (req, res) => {
    req.socket.end();
  });
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `module.exports = { reporter: [['./reporter', { skipErrorMessage: true }]] };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page, request }) => {
        await Promise.all([
          page.waitForNavigation(),
          page.goto('data:text/html,<button></button>'),
        ]);
        await page.click('button');
        await page.getByRole('button').click();
        await page.request.get('${server.EMPTY_PAGE}').catch(() => {});
        await request.get('${server.EMPTY_PAGE}').catch(() => {});
      });

      test.describe('suite', () => {
        let myPage;
        test.beforeAll(async ({ browser }) => {
          myPage = await browser.newPage();
          await myPage.setContent('<button></button><input/>');
        });

        test('pass1', async () => {
          await myPage.click('button');
        });
        test('pass2', async () => {
          await myPage.click('button');
        });
        test('pass3', async () => {
          await myPage.getByRole('textbox').fill('foo');
          await myPage.getByRole('textbox').fill('');
          await myPage.getByRole('textbox').clear();
        });

        test.afterAll(async () => {
          await myPage.close();
        });
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
hook      |  beforeAll hook @ a.test.ts:16
pw:api    |    Create page @ a.test.ts:17
pw:api    |    Set content @ a.test.ts:18
pw:api    |Click locator('button') @ a.test.ts:22
hook      |After Hooks
hook      |Before Hooks
pw:api    |Click locator('button') @ a.test.ts:25
hook      |After Hooks
hook      |Before Hooks
pw:api    |Fill "foo" getByRole('textbox') @ a.test.ts:28
pw:api    |Fill "" getByRole('textbox') @ a.test.ts:29
pw:api    |Clear getByRole('textbox') @ a.test.ts:30
hook      |After Hooks
hook      |  afterAll hook @ a.test.ts:33
pw:api    |    Close context @ a.test.ts:34
hook      |Before Hooks
fixture   |  browser
pw:api    |    Launch browser
fixture   |  context
pw:api    |    Create context
fixture   |  page
pw:api    |    Create page
fixture   |  request
pw:api    |    Create request context
pw:api    |Wait for navigation @ a.test.ts:5
pw:api    |Navigate to "data:" @ a.test.ts:6
pw:api    |Click locator('button') @ a.test.ts:8
pw:api    |Click getByRole('button') @ a.test.ts:9
pw:api    |GET "/empty.html" @ a.test.ts:10
pw:api    |↪ error: <error message>
pw:api    |GET "/empty.html" @ a.test.ts:11
pw:api    |↪ error: <error message>
hook      |After Hooks
fixture   |  request
fixture   |  page
fixture   |  context
`);
});

test('should report api step failure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
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
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
fixture   |  browser
pw:api    |    Launch browser
fixture   |  context
pw:api    |    Create context
fixture   |  page
pw:api    |    Create page
pw:api    |Set content @ a.test.ts:4
pw:api    |Click locator('input') @ a.test.ts:5
pw:api    |↪ error: TimeoutError: page.click: Timeout 1ms exceeded.
hook      |After Hooks
fixture   |  page
fixture   |  context
hook      |Worker Cleanup
fixture   |  browser
          |TimeoutError: page.click: Timeout 1ms exceeded.
`);
});

test('should show nice stacks for locators', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `module.exports = { reporter: [['./reporter', { printErrorLocation: true }]] };`,
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
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
fixture   |  browser
pw:api    |    Launch browser
fixture   |  context
pw:api    |    Create context
fixture   |  page
pw:api    |    Create page
pw:api    |Set content @ a.test.ts:4
pw:api    |Evaluate locator('button') @ a.test.ts:6
hook      |After Hooks
fixture   |  page
fixture   |  context
`);
});

test('should allow passing location to test.step', async ({ runInlineTest, runTSC }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'helper.ts': `
      import { Location, TestType } from '@playwright/test';

      export async function dummyStep(test: TestType<{}, {}>, title: string, action: () => void, location: Location) {
        await test.step(title, action, { location });
      }

      export function getCustomLocation() {
        return { file: 'dummy-file.ts', line: 123, column: 45 };
      }
    `,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      import { dummyStep, getCustomLocation } from './helper';

      test('custom location test', async () => {
        const location = getCustomLocation();
        await dummyStep(test, 'Perform a dummy step', async () => {}, location);
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
test.step |Perform a dummy step @ dummy-file.ts:123
hook      |After Hooks
`);

  const { exitCode } = await runTSC({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('should work', async () => {
        const location = { file: 'dummy-file.ts', line: 123, column: 45 };
        await test.step('step1', () => {}, { location });
      });
    `
  });
  expect(exitCode).toBe(0);
});

test('should show tracing.group nested inside test.step', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `module.exports = { reporter: [['./reporter', { printErrorLocation: true }]] };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page }) => {
        await test.step('my step 1', async () => {
          await test.step('my step 2', async () => {
            await page.context().tracing.group('my group 1');
            await page.context().tracing.group('my group 2');
            await page.setContent('<button></button>');
            await page.context().tracing.groupEnd();
            await page.context().tracing.groupEnd();
          });
        });
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
fixture   |  browser
pw:api    |    Launch browser
fixture   |  context
pw:api    |    Create context
fixture   |  page
pw:api    |    Create page
test.step |my step 1 @ a.test.ts:4
test.step |  my step 2 @ a.test.ts:5
pw:api    |    Trace "my group 1" @ a.test.ts:6
pw:api    |      Trace "my group 2" @ a.test.ts:7
pw:api    |        Set content @ a.test.ts:8
hook      |After Hooks
fixture   |  page
fixture   |  context
`);
});

test('calls from waitForEvent callback should be under its parent step', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/33186' }
}, async ({ runInlineTest, server }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('waitForResponse step nesting', async ({ page }) => {
        await page.goto('${server.EMPTY_PAGE}');
        await page.setContent('<div onclick="fetch(\\'/simple.json\\').then(r => r.text());">Go!</div>');
        const responseJson = await test.step('custom step', async () => {
          const responsePromise = page.waitForResponse(async response => {
            await page.content();
            await page.content();  // second time a charm!
            await expect(page.locator('div')).toContainText('Go');
            return true;
          });

          await page.click('div');
          const response = await responsePromise;
          return await response.text();
        });
        expect(responseJson).toBe('{"foo": "bar"}\\n');
      });
      `
  }, { reporter: '', workers: 1, timeout: 3000 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(0);
  expect(result.output).not.toContain('Internal error');
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
fixture   |  browser
pw:api    |    Launch browser
fixture   |  context
pw:api    |    Create context
fixture   |  page
pw:api    |    Create page
pw:api    |Navigate to "/empty.html" @ a.test.ts:4
pw:api    |Set content @ a.test.ts:5
test.step |custom step @ a.test.ts:6
pw:api    |  Wait for event "response" @ a.test.ts:7
pw:api    |  Click locator('div') @ a.test.ts:14
pw:api    |  Get content @ a.test.ts:8
pw:api    |  Get content @ a.test.ts:9
expect    |  toContainText @ a.test.ts:10
expect    |toBe @ a.test.ts:18
hook      |After Hooks
fixture   |  page
fixture   |  context
`);
});

test('reading network request / response should not be listed as step', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/33558' }
}, async ({ runInlineTest, server }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('waitForResponse step nesting', async ({ page }) => {
        page.on('request', async request => {
          await request.allHeaders();
        });
        page.on('response', async response => {
          await response.text();
        });
        await page.goto('${server.EMPTY_PAGE}');
      });
      `
  }, { reporter: '', workers: 1, timeout: 3000 });

  expect(result.exitCode).toBe(0);
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
fixture   |  browser
pw:api    |    Launch browser
fixture   |  context
pw:api    |    Create context
fixture   |  page
pw:api    |    Create page
pw:api    |Navigate to "/empty.html" @ a.test.ts:10
hook      |After Hooks
fixture   |  page
fixture   |  context
`);
});

test('calls from page.route callback should be under its parent step', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/33186' }
}, async ({ runInlineTest, server }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('waitForResponse step nesting', async ({ page }) => {
        await test.step('custom step', async () => {
          await page.route('**/empty.html', async route => {
            const response = await route.fetch();
            const text = await response.text();
            expect(text).toBe('');
            await response.text();  // second time a charm!
            await route.fulfill({ response });
          });
          await page.goto('${server.EMPTY_PAGE}');
        });
      });
      `
  }, { reporter: '', workers: 1, timeout: 3000 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(0);
  expect(result.output).not.toContain('Internal error');
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
fixture   |  browser
pw:api    |    Launch browser
fixture   |  context
pw:api    |    Create context
fixture   |  page
pw:api    |    Create page
test.step |custom step @ a.test.ts:4
pw:api    |  Navigate to "/empty.html" @ a.test.ts:12
pw:api    |  GET "/empty.html" @ a.test.ts:6
expect    |  toBe @ a.test.ts:8
hook      |After Hooks
fixture   |  page
fixture   |  context
`);
});

test('test.step.skip should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ }) => {
        await test.step.skip('outer step 1', async () => {
          await test.step('inner step 1.1', async () => {
            throw new Error('inner step 1.1 failed');
          });
          await test.step.skip('inner step 1.2', async () => {});
          await test.step('inner step 1.3', async () => {});
        });
        await test.step('outer step 2', async () => {
          await test.step.skip('inner step 2.1', async () => {});
          await test.step('inner step 2.2', async () => {
            expect(1).toBe(1);
          });
        });
      });
      `
  }, { reporter: '' });

  expect(result.exitCode).toBe(0);
  expect(result.report.stats.expected).toBe(1);
  expect(result.report.stats.unexpected).toBe(0);
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
test.step |outer step 1 @ a.test.ts:4 (skipped)
test.step |outer step 2 @ a.test.ts:11
test.step |  inner step 2.1 @ a.test.ts:12 (skipped)
test.step |  inner step 2.2 @ a.test.ts:13
expect    |    toBe @ a.test.ts:14
hook      |After Hooks
`);
});

test('skip test.step.skip body', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ }) => {
        let didRun = false;
        await test.step('outer step 2', async () => {
          await test.step.skip('inner step 2', async () => {
            didRun = true;
          });
        });
        expect(didRun).toBe(false);
      });
      `
  }, { reporter: '' });

  expect(result.exitCode).toBe(0);
  expect(result.report.stats.expected).toBe(1);
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
test.step |outer step 2 @ a.test.ts:5
test.step |  inner step 2 @ a.test.ts:6 (skipped)
expect    |toBe @ a.test.ts:10
hook      |After Hooks
`);
});

test('step.skip should work at runtime', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ }) => {
        await test.step('outer step 1', async () => {
          await test.step('inner step 1.1', async (step) => {
            step.skip();
          });
          await test.step('inner step 1.2', async (step) => {
            step.skip(true, 'condition is true');
          });
          await test.step('inner step 1.3', async () => {});
        });
        await test.step('outer step 2', async () => {
          await test.step.skip('inner step 2.1', async () => {});
          await test.step('inner step 2.2', async () => {
            expect(1).toBe(1);
          });
        });
      });
      `
  }, { reporter: '' });

  expect(result.exitCode).toBe(0);
  expect(result.report.stats.expected).toBe(1);
  expect(result.report.stats.unexpected).toBe(0);
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
test.step |outer step 1 @ a.test.ts:4
test.step |  inner step 1.1 @ a.test.ts:5 (skipped)
test.step |  inner step 1.2 @ a.test.ts:8 (skipped: condition is true)
test.step |  inner step 1.3 @ a.test.ts:11
test.step |outer step 2 @ a.test.ts:13
test.step |  inner step 2.1 @ a.test.ts:14 (skipped)
test.step |  inner step 2.2 @ a.test.ts:15
expect    |    toBe @ a.test.ts:16
hook      |After Hooks
`);
});

test('should differentiate test.skip and step.skip', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ }) => {
        await test.step('outer step', async () => {
          await test.info().skip();
        });
      });
      `
  }, { reporter: '' });

  expect(result.exitCode).toBe(0);
  expect(result.report.stats.expected).toBe(0);
  expect(result.report.stats.unexpected).toBe(0);
  expect(result.report.stats.skipped).toBe(1);
});

test('show api calls inside expects', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': stepIndentReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.test.ts': `
      import { test, expect as baseExpect } from '@playwright/test';

      const expect = baseExpect.extend({
        async toBeInvisible(locator: Locator) {
          try {
            await expect.poll(() => locator.isVisible()).toBe(false);
            return { name: 'toBeInvisible', pass: true, message: '' };
          } catch (e) {
            return { name: 'toBeInvisible', pass: false, message: () => 'Expected to be invisible, got visible!' };
          }
        },
      });

      test('test', async ({ page }) => {
        await page.setContent('<div>hello</div>');
        const promise = expect(page.locator('div')).toBeInvisible();
        await page.waitForTimeout(1100);
        await page.setContent('<div style="display:none">hello</div>');
        await promise;
      });
      `
  }, { reporter: '' });

  expect(result.exitCode).toBe(0);
  expect(result.report.stats.expected).toBe(1);
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
fixture   |  browser
pw:api    |    Launch browser
fixture   |  context
pw:api    |    Create context
fixture   |  page
pw:api    |    Create page
pw:api    |Set content @ a.test.ts:16
expect    |toBeInvisible @ a.test.ts:17
test.step |  Expect "poll toBe" @ a.test.ts:7
pw:api    |    Is visible locator('div') @ a.test.ts:7
expect    |    toBe @ a.test.ts:7
expect    |    ↪ error: Error: expect(received).toBe(expected) // Object.is equality
pw:api    |    Is visible locator('div') @ a.test.ts:7
expect    |    toBe @ a.test.ts:7
expect    |    ↪ error: Error: expect(received).toBe(expected) // Object.is equality
pw:api    |    Is visible locator('div') @ a.test.ts:7
expect    |    toBe @ a.test.ts:7
expect    |    ↪ error: Error: expect(received).toBe(expected) // Object.is equality
pw:api    |    Is visible locator('div') @ a.test.ts:7
expect    |    toBe @ a.test.ts:7
expect    |    ↪ error: Error: expect(received).toBe(expected) // Object.is equality
pw:api    |    Is visible locator('div') @ a.test.ts:7
expect    |    toBe @ a.test.ts:7
pw:api    |Wait for timeout @ a.test.ts:18
pw:api    |Set content @ a.test.ts:19
hook      |After Hooks
fixture   |  page
fixture   |  context
`);
});
