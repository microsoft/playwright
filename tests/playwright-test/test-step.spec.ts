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
    console.log(formatPrefix(step.category) + indent + step.title + location);
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
fixture   |  fixture: browser
pw:api    |    browserType.launch
fixture   |  fixture: context
pw:api    |    browser.newContext
fixture   |  fixture: page
pw:api    |    browserContext.newPage
test.step |outer step 1 @ a.test.ts:4
test.step |  inner step 1.1 @ a.test.ts:5
test.step |  inner step 1.2 @ a.test.ts:6
test.step |outer step 2 @ a.test.ts:8
test.step |  inner step 2.1 @ a.test.ts:9
test.step |  inner step 2.2 @ a.test.ts:10
hook      |After Hooks
fixture   |  fixture: page
fixture   |  fixture: context
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
fixture   |  fixture: browser
pw:api    |    browserType.launch
fixture   |  fixture: context
pw:api    |    browser.newContext
fixture   |  fixture: page
pw:api    |    browserContext.newPage
test.step |my step @ a.test.ts:4
hook      |After Hooks
fixture   |  fixture: page
fixture   |  fixture: context
hook      |Worker Cleanup
fixture   |  fixture: browser
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
expect    |expect.toBeTruthy @ a.test.ts:4
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
expect    |expect.toBeWithinRange @ a.test.ts:32
expect    |expect.toBeFailingAsync @ a.test.ts:33
expect    |↪ error: Error: It fails!
hook      |After Hooks
hook      |Worker Cleanup
          |Error: It fails!
`);
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
expect    |    expect.soft.toBe @ a.test.ts:6
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
fixture   |  fixture: browser
pw:api    |    browserType.launch
fixture   |  fixture: context
pw:api    |    browser.newContext
fixture   |  fixture: page
pw:api    |    browserContext.newPage
test.step |grand @ a.test.ts:20
test.step |  parent1 @ a.test.ts:22
test.step |    child1 @ a.test.ts:23
pw:api    |      page.click(body) @ a.test.ts:24
test.step |  parent2 @ a.test.ts:27
test.step |    child2 @ a.test.ts:28
expect    |      expect.toBeVisible @ a.test.ts:29
hook      |After Hooks
hook      |  afterEach hook @ a.test.ts:15
test.step |    in afterEach @ a.test.ts:16
fixture   |  fixture: page
fixture   |  fixture: context
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
fixture   |    fixture: browser
pw:api    |      browserType.launch
pw:api    |    browser.newPage @ a.test.ts:6
pw:api    |page.setContent @ a.test.ts:15
pw:api    |page.click(div) @ a.test.ts:16
pw:api    |↪ error: Error: page.click: Target page, context or browser has been closed
hook      |After Hooks
hook      |  afterAll hook @ a.test.ts:9
pw:api    |    page.close @ a.test.ts:10
hook      |Worker Cleanup
fixture   |  fixture: browser
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
expect    |expect.toPass @ a.test.ts:7
expect    |  expect.toBe @ a.test.ts:6
expect    |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |  expect.toBe @ a.test.ts:6
expect    |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |  expect.toBe @ a.test.ts:6
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
expect    |expect.toPass @ a.test.ts:6
expect    |↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |  expect.toBe @ a.test.ts:5
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
expect    |    expect.soft.toBe @ a.test.ts:6
expect    |    ↪ error: Error: expect(received).toBe(expected) // Object.is equality
test.step |second outer @ a.test.ts:10
test.step |↪ error: Error: expect(received).toBe(expected) // Object.is equality
test.step |  second inner @ a.test.ts:11
test.step |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |    expect.toBe @ a.test.ts:12
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
expect    |    expect.toBe @ a.test.ts:7
expect    |    ↪ error: Error: expect(received).toBe(expected) // Object.is equality
test.step |second outer @ a.test.ts:13
test.step |↪ error: Error: expect(received).toBe(expected) // Object.is equality
test.step |  second inner @ a.test.ts:14
test.step |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |    expect.toBe @ a.test.ts:15
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
expect    |  expect.toBe @ a.test.ts:4
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
expect    |  expect.toBe @ a.test.ts:5
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
expect    |  expect.soft.toBe @ a.test.ts:5
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
fixture   |  fixture: browser
pw:api    |    browserType.launch
fixture   |  fixture: context
pw:api    |    browser.newContext
fixture   |  fixture: page
pw:api    |    browserContext.newPage
pw:api    |page.setContent @ a.test.ts:4
expect    |Checking color @ a.test.ts:6
hook      |After Hooks
fixture   |  fixture: page
fixture   |  fixture: context
`);
});

test('step inside expect.toPass', async ({ runInlineTest }) => {
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
expect    |  expect.toPass @ a.test.ts:11
test.step |    step 2, attempt: 0 @ a.test.ts:7
test.step |    ↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |      expect.toBe @ a.test.ts:9
expect    |      ↪ error: Error: expect(received).toBe(expected) // Object.is equality
test.step |    step 2, attempt: 1 @ a.test.ts:7
expect    |      expect.toBe @ a.test.ts:9
test.step |  step 3 @ a.test.ts:12
test.step |    step 4 @ a.test.ts:13
expect    |      expect.toBe @ a.test.ts:14
hook      |After Hooks
`);
});

test('library API call inside expect.toPass', async ({ runInlineTest }) => {
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
fixture   |  fixture: browser
pw:api    |    browserType.launch
fixture   |  fixture: context
pw:api    |    browser.newContext
fixture   |  fixture: page
pw:api    |    browserContext.newPage
expect    |expect.toPass @ a.test.ts:11
pw:api    |  page.goto(about:blank) @ a.test.ts:6
test.step |  inner step attempt: 0 @ a.test.ts:7
test.step |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |    expect.toBe @ a.test.ts:9
expect    |    ↪ error: Error: expect(received).toBe(expected) // Object.is equality
pw:api    |  page.goto(about:blank) @ a.test.ts:6
test.step |  inner step attempt: 1 @ a.test.ts:7
expect    |    expect.toBe @ a.test.ts:9
hook      |After Hooks
fixture   |  fixture: page
fixture   |  fixture: context
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
fixture   |  fixture: browser
pw:api    |    browserType.launch
fixture   |  fixture: context
pw:api    |    browser.newContext
fixture   |  fixture: page
pw:api    |    browserContext.newPage
expect    |expect.poll.toHaveLength @ a.test.ts:14
pw:api    |  page.goto(about:blank) @ a.test.ts:7
test.step |  inner step attempt: 0 @ a.test.ts:8
expect    |    expect.toBe @ a.test.ts:10
expect    |  expect.toHaveLength @ a.test.ts:6
expect    |  ↪ error: Error: expect(received).toHaveLength(expected)
pw:api    |  page.goto(about:blank) @ a.test.ts:7
test.step |  inner step attempt: 1 @ a.test.ts:8
expect    |    expect.toBe @ a.test.ts:10
expect    |  expect.toHaveLength @ a.test.ts:6
hook      |After Hooks
fixture   |  fixture: page
fixture   |  fixture: context
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
fixture   |  fixture: browser
pw:api    |    browserType.launch
fixture   |  fixture: context
pw:api    |    browser.newContext
fixture   |  fixture: page
pw:api    |    browserContext.newPage
pw:api    |page.setContent @ a.test.ts:4
expect    |expect.poll.toBe @ a.test.ts:13
expect    |  expect.toHaveText @ a.test.ts:7
test.step |  iteration 1 @ a.test.ts:9
expect    |    expect.toBeVisible @ a.test.ts:10
expect    |  expect.toBe @ a.test.ts:6
expect    |  ↪ error: Error: expect(received).toBe(expected) // Object.is equality
expect    |  expect.toHaveText @ a.test.ts:7
test.step |  iteration 2 @ a.test.ts:9
expect    |    expect.toBeVisible @ a.test.ts:10
expect    |  expect.toBe @ a.test.ts:6
hook      |After Hooks
fixture   |  fixture: page
fixture   |  fixture: context
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
expect    |expect.toBeTruthy @ a.test.ts:4
expect    |expect.toBeTruthy @ a.test.ts:5
expect    |↪ error: Error: expect(received).toBeTruthy()
hook      |After Hooks
hook      |Worker Cleanup
          |Error: expect(received).toBeTruthy()
hook      |Before Hooks
expect    |expect.not.toBeTruthy @ a.test.ts:8
hook      |After Hooks
hook      |Before Hooks
fixture   |  fixture: browser
pw:api    |    browserType.launch
fixture   |  fixture: context
pw:api    |    browser.newContext
fixture   |  fixture: page
pw:api    |    browserContext.newPage
expect    |expect.not.toHaveTitle @ a.test.ts:11
hook      |After Hooks
fixture   |  fixture: page
fixture   |  fixture: context
`);
});

test('should report api steps', async ({ runInlineTest }) => {
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
  expect(stripAnsi(result.output)).toBe(`
hook      |Before Hooks
hook      |  beforeAll hook @ a.test.ts:16
pw:api    |    browser.newPage @ a.test.ts:17
pw:api    |    page.setContent @ a.test.ts:18
pw:api    |page.click(button) @ a.test.ts:22
hook      |After Hooks
hook      |Before Hooks
pw:api    |page.click(button) @ a.test.ts:25
hook      |After Hooks
hook      |  afterAll hook @ a.test.ts:28
pw:api    |    page.close @ a.test.ts:29
hook      |Before Hooks
fixture   |  fixture: browser
pw:api    |    browserType.launch
fixture   |  fixture: context
pw:api    |    browser.newContext
fixture   |  fixture: page
pw:api    |    browserContext.newPage
fixture   |  fixture: request
pw:api    |    apiRequest.newContext
pw:api    |page.waitForNavigation @ a.test.ts:5
pw:api    |page.goto(data:text/html,<button></button>) @ a.test.ts:6
pw:api    |page.click(button) @ a.test.ts:8
pw:api    |locator.getByRole('button').click @ a.test.ts:9
pw:api    |apiRequestContext.get(http://localhost2) @ a.test.ts:10
pw:api    |↪ error: <error message>
pw:api    |apiRequestContext.get(http://localhost2) @ a.test.ts:11
pw:api    |↪ error: <error message>
hook      |After Hooks
fixture   |  fixture: request
pw:api    |    apiRequestContext.dispose
fixture   |  fixture: page
fixture   |  fixture: context
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
fixture   |  fixture: browser
pw:api    |    browserType.launch
fixture   |  fixture: context
pw:api    |    browser.newContext
fixture   |  fixture: page
pw:api    |    browserContext.newPage
pw:api    |page.setContent @ a.test.ts:4
pw:api    |page.click(input) @ a.test.ts:5
pw:api    |↪ error: TimeoutError: page.click: Timeout 1ms exceeded.
hook      |After Hooks
fixture   |  fixture: page
fixture   |  fixture: context
hook      |Worker Cleanup
fixture   |  fixture: browser
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
fixture   |  fixture: browser
pw:api    |    browserType.launch
fixture   |  fixture: context
pw:api    |    browser.newContext
fixture   |  fixture: page
pw:api    |    browserContext.newPage
pw:api    |page.setContent @ a.test.ts:4
pw:api    |locator.evaluate(button) @ a.test.ts:6
hook      |After Hooks
fixture   |  fixture: page
fixture   |  fixture: context
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
