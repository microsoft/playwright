/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from 'path';
import { test, expect, parseTestRunnerOutput, stripAnsi } from './playwright-test-fixtures';
const { spawnAsync } = require('../../packages/playwright-core/lib/utils');

test('should not expand huge arrays', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('numeric ranges', () => {
        const a1 = Array(100000).fill(1);
        const a2 = Array(100000).fill(1);
        a2[500] = 2;
        test.expect(a1).toEqual(a2);
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output.length).toBeLessThan(100000);
});

test('should include custom expect message', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('custom expect message', () => {
        test.expect(1+1, 'one plus one should be two!').toEqual(3);
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain([
    `    Error: one plus one should be two!\n`,
    `    expect(received).toEqual(expected) // deep equality\n`,
    `    Expected: 3`,
    `    Received: 2`,
  ].join('\n'));
});

test('should include custom expect message with web-first assertions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('custom expect message', async ({page}) => {
        await expect(page.locator('x-foo'), { message: 'x-foo must be visible' }).toBeVisible({timeout: 1});
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);

  expect(result.output).toContain('Error: x-foo must be visible');
  expect(result.output).toContain(`Timed out 1ms waiting for expect(locator).toBeVisible()`);
  expect(result.output).toContain('Call log:');
});

test('should work with generic matchers', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      import { expect } from '@playwright/test';
      expect(42).toBe(42);
      expect(0.1 + 0.2).toBeCloseTo(0.3, 5);
      expect(null).toBeDefined();
      expect(null).toBeFalsy();
      expect(42).toBeGreaterThan(1);
      expect(42).toBeGreaterThanOrEqual(42);
      expect({}).toBeInstanceOf(Object);
      expect(42).toBeLessThan(100);
      expect(42).toBeLessThanOrEqual(42);
      expect(null).toBeNull();
      expect(42).toBeTruthy();
      expect(undefined).toBeUndefined();
      expect(NaN).toBeNaN();
      expect('abc').toContain('a');
      expect(['abc']).toContain('abc');
      expect(['abc']).toContainEqual('abc');
      expect({}).toEqual({});
      expect([1, 2]).toHaveLength(2);
      expect('abc').toMatch(/a.?c/);
      expect('abc').toMatch('abc');
      expect({ a: 1, b: 2 }).toMatchObject({ a: 1 });
      expect({}).toStrictEqual({});
      expect(() => { throw new Error('Something bad'); }).toThrow('something');
      expect(() => { throw new Error('Something bad'); }).toThrowError('something');

      expect(['Bob', 'Eve']).not.toEqual(expect.arrayContaining(['Alice', 'Bob']));
      expect({}).toEqual(expect.anything());
      expect({ sum: 0.1 + 0.2 }).toEqual({ sum: expect.closeTo(0.3, 5) });
      class Cat {}
      expect(new Cat()).toEqual(expect.any(Cat));
      expect({ x: 2, y: 3, foo: 'bar' }).toEqual(expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
      }));
      expect('abc').toEqual(expect.stringContaining('bc'));
      expect('hello world').toEqual(expect.not.stringContaining('text'));
      expect(['Alicia', 'Roberto', 'Evelina']).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^Alic/),
          expect.stringMatching('Roberto'),
        ]),
      );
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should compile generic matchers', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      import { expect } from '@playwright/test';
      expect(42).toBe(42);
      expect(42).toBeCloseTo(42);
      expect(42).toBeCloseTo(42, 5);
      expect(42).toBeDefined();
      expect(42).toBeFalsy();
      expect(42).toBeGreaterThan(1);
      expect(42n).toBeGreaterThan(1n);
      expect(42).toBeGreaterThanOrEqual(1);
      expect(42n).toBeGreaterThanOrEqual(1n);
      expect({}).toBeInstanceOf(Object);
      expect(42).toBeLessThan(1);
      expect(42n).toBeLessThan(1n);
      expect(42).toBeLessThanOrEqual(1);
      expect(42n).toBeLessThanOrEqual(1n);
      expect(42).toBeNull();
      expect(42).toBeTruthy();
      expect(42).toBeUndefined();
      expect(42).toBeNaN();
      expect('abc').toContain('b');
      expect([1, 2]).toContain(1);
      expect(new Set([1, 2])).toContain(1);
      expect([{}, { a: 1 }]).toContainEqual({});
      expect({}).toEqual({});
      expect([1, 2]).toHaveLength(2);
      expect('abc').toMatch(/a.?c/);
      expect({ a: 1, b: 2 }).toMatchObject({ a: 1 });
      expect([]).toMatchObject([]);
      expect({}).toStrictEqual({});
      expect(() => { throw new Error('Something bad'); }).toThrow('something');
      expect(() => { throw new Error('Something bad'); }).toThrow();
      expect(() => { throw new Error('Something bad'); }).toThrowError('something');
      expect(() => { throw new Error('Something bad'); }).toThrowError();

      expect(['Bob', 'Eve']).not.toEqual(expect.arrayContaining(['Alice', 'Bob']));
      expect({}).toEqual(expect.anything());
      expect({ sum: 0.1 + 0.2 }).toEqual({ sum: expect.closeTo(0.3, 5) });
      class Cat {}
      expect(new Cat()).toEqual(expect.any(Cat));
      expect({ x: 2, y: 3, foo: 'bar' }).toEqual(expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
      }));
      expect('abc').toEqual(expect.stringContaining('bc'));
      expect(['Alicia', 'Roberto', 'Evelina']).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^Alic/),
          expect.stringMatching('Roberto'),
        ]),
      );

      // @ts-expect-error
      expect(42).toBe(123, 456);
      // @ts-expect-error
      expect(42).toBeCloseTo(42, '5');
      // @ts-expect-error
      expect(42).toBeFalsy(123);
      // @ts-expect-error
      expect({}).toBeInstanceOf({});
    `,
  });
  expect(result.exitCode).toBe(0);
});

test('should work when passing a ReadonlyArray', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('example', async ({ page }) => {
        const readonlyArray: ReadonlyArray<string> = ['1', '2', '3'];
        expect(page.locator('.foo')).toHaveText(readonlyArray);
        await page.locator('.foo').setInputFiles(readonlyArray);
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should work with expect message', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test.expect(42, 'this is expect message').toBe(42);
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should work with default expect matchers and esModuleInterop=false', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test.expect(42).toBe(42);
    `,
    'tsconfig.json': JSON.stringify({
      'compilerOptions': {
        'target': 'ESNext',
        'moduleResolution': 'node',
        'module': 'commonjs',
        'strict': true,
        'rootDir': '.',
        'esModuleInterop': false,
        'allowSyntheticDefaultImports': false,
        'lib': ['esnext', 'dom', 'DOM.Iterable']
      },
      'exclude': [
        'node_modules'
      ]
    }),
  });
  expect(result.exitCode).toBe(0);
});

test('should work with custom PlaywrightTest namespace', async ({ runTSC }) => {
  const result = await runTSC({
    'global.d.ts': `
      declare namespace PlaywrightTest {
        interface Matchers<R> {
          toBeEmpty(): R;
        }
        interface Matchers<R, T> {
          toBeNonEmpty(): R;
        }
      }
    `,
    'a.spec.ts': `
      import { test, expect, type Page, type APIResponse } from '@playwright/test';
      test.expect.extend({
        toBeWithinRange() {
          return {
            pass: true,
            message: () => '',
          };
        },
      });

      const page = {} as Page;
      const locator = page.locator('');
      const apiResponse = {} as APIResponse;
      test.expect(page).toBeEmpty();
      test.expect(page).not.toBeEmpty();
      test.expect(locator).toBeEmpty();
      test.expect(locator).not.toBeEmpty();
      test.expect(apiResponse).toBeEmpty();
      test.expect(apiResponse).not.toBeEmpty();

      test.expect('').toBeEmpty();
      test.expect('hello').not.toBeEmpty();
      test.expect([]).toBeEmpty();
      test.expect(['hello']).not.toBeEmpty();
      test.expect({}).toBeEmpty();
      test.expect({ hello: 'world' }).not.toBeEmpty();
      test.expect('').toBeNonEmpty();
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should propose only the relevant matchers when custom expect matcher classes were passed', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
    import { test, expect } from '@playwright/test';
    test('custom matchers', async ({ page }) => {
      // Page-specific assertions apply to Page.
      await test.expect(page).toHaveURL('https://example.com');
      await test.expect(page).not.toHaveURL('https://example.com');
      // Some generic assertions also apply to Page.
      test.expect(page).toBe(true);
      test.expect(page).toBeDefined();
      test.expect(page).toBeFalsy();
      test.expect(page).toBeNull();
      test.expect(page).toBeTruthy();
      test.expect(page).toBeUndefined();

      // Locator-specific and most generic assertions do not apply to Page.
      // @ts-expect-error
      await test.expect(page).toBeEnabled();
      // @ts-expect-error
      await test.expect(page).not.toBeEnabled();
      // @ts-expect-error
      test.expect(page).toEqual();

      // Locator-specific assertions apply to Locator.
      await test.expect(page.locator('foo')).toBeEnabled();
      await test.expect(page.locator('foo')).toBeEnabled({ enabled: false });
      await test.expect(page.locator('foo')).not.toBeEnabled({ enabled: true });
      await test.expect(page.locator('foo')).toBeChecked();
      await test.expect(page.locator('foo')).not.toBeChecked({ checked: true });
      await test.expect(page.locator('foo')).not.toBeEditable();
      await test.expect(page.locator('foo')).toBeEditable({ editable: false });
      await test.expect(page.locator('foo')).toBeVisible();
      await test.expect(page.locator('foo')).not.toBeVisible({ visible: false });
      // Some generic assertions also apply to Locator.
      test.expect(page.locator('foo')).toBe(true);

      // Page-specific and most generic assertions do not apply to Locator.
      // @ts-expect-error
      await test.expect(page.locator('foo')).toHaveURL('https://example.com');
      // @ts-expect-error
      await test.expect(page.locator('foo')).toHaveLength(1);

      // Wrong arguments for assertions do not compile.
      // @ts-expect-error
      await test.expect(page.locator('foo')).toBeEnabled({ unknown: false });
      // @ts-expect-error
      await test.expect(page.locator('foo')).toBeEnabled({ enabled: 'foo' });

      // Generic assertions work.
      test.expect([123]).toHaveLength(1);
      test.expect('123').toMatchSnapshot('name');
      test.expect(await page.screenshot()).toMatchSnapshot('screenshot.png');

      // All possible assertions apply to "any" type.
      const x: any = 123;
      test.expect(x).toHaveLength(1);
      await test.expect(x).toHaveURL('url');
      await test.expect(x).toBeEnabled();
      test.expect(x).toMatchSnapshot('snapshot name');

      // APIResponse-specific assertions apply to APIResponse.
      const res = await page.request.get('http://i-do-definitely-not-exist.com');
      await test.expect(res).toBeOK();
      // Some generic assertions also apply to APIResponse.
      test.expect(res).toBe(true);
      // Page-specific and most generic assertions do not apply to APIResponse.
      // @ts-expect-error
      await test.expect(res).toHaveURL('https://example.com');
      // @ts-expect-error
      test.expect(res).toEqual(123);

      // Explicitly casting to "any" supports all assertions.
      await test.expect(res as any).toHaveURL('https://example.com');

      // Playwright-specific assertions do not apply to generic values.
      // @ts-expect-error
      await test.expect(123).toHaveURL('https://example.com');
    });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should return void/Promise when appropriate', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      type AssertType<T, S> = S extends T ? AssertNotAny<S> : false;
      type AssertNotAny<S> = {notRealProperty: number} extends S ? false : true;

      test('example', async ({ page }) => {
        {
          const value = expect(1).toBe(2);
          const assertion: AssertType<void, typeof value> = true;
        }

        {
          const value = expect(1).not.toBe(2);
          const assertion: AssertType<void, typeof value> = true;
        }

        {
          const value = expect(page).toHaveURL('');
          const assertion: AssertType<Promise<void>, typeof value> = true;
        }

        {
          const value = expect(Promise.resolve(1)).resolves.toBe(1);
          const assertion: AssertType<Promise<void>, typeof value> = true;
        }

        {
          const value = expect.soft(1).toBe(2);
          const assertion: AssertType<void, typeof value> = true;
        }

        {
          const value = expect.poll(() => true).toBe(2);
          const assertion: AssertType<Promise<void>, typeof value> = true;
        }
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test.describe('helpful expect errors', () => {
  test('top-level', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'a.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('explodes', () => {
          expect(1).nope();
        });
      `
    });

    expect(result.output).toContain(`expect: Property 'nope' not found.`);
  });

  test('soft', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'a.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('explodes', () => {
          expect.soft(1).nope();
        });
      `
    });

    expect(result.output).toContain(`expect: Property 'nope' not found.`);
  });

  test('poll', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'a.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('explodes', () => {
          expect.poll(() => {}).nope();
        });
      `
    });

    expect(result.output).toContain(`expect: Property 'nope' not found.`);
  });

  test('not', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'a.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('explodes', () => {
          expect(1).not.nope();
        });
      `
    });

    expect(result.output).toContain(`expect: Property 'nope' not found.`);
  });

  test('bare', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'a.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('explodes', () => {
          expect('');
        });
      `
    });

    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
  });
});

test('should reasonably work in global setup', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default { globalSetup: './global-setup' };
    `,
    'global-setup.ts': `
      import { test, expect } from '@playwright/test';
      export default async () => {
        expect(1).toBe(1);
        await expect.poll(async () => {
          await new Promise(f => setTimeout(f, 50));
          return 42;
        }).toBe(42);
        expect(1).toBe(2);
      };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('skipped', () => {});
    `,
  });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('>  9 |         expect(1).toBe(2);');
});

test('should support toHaveURL with baseURL from webServer', async ({ runInlineTest }, testInfo) => {
  const port = testInfo.workerIndex + 10500;
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';

      test('pass', async ({ page }) => {
        await page.goto('/foobar');
        await expect(page).toHaveURL('/foobar');
        await expect(page).toHaveURL('http://localhost:${port}/foobar');
      });

      test('fail', async ({ page }) => {
        await page.goto('/foobar');
        await expect(page).toHaveURL('/kek', { timeout: 1000 });
      });
      `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(path.join(__dirname, 'assets', 'simple-server.js'))} ${port}',
          port: ${port},
        },
      };
  `,
  }, { workers: 1 });
  const output = result.output;
  expect(output).toContain('expect(page).toHaveURL');
  expect(output).toContain(`Expected string: \"http://localhost:${port}/kek\"`);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should respect expect.timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `module.exports = { expect: { timeout: 1000 } }`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';

      test('timeout', async ({ page }) => {
        await page.goto('data:text/html,<div>A</div>');
        const error = await expect(page).toHaveURL('data:text/html,<div>B</div>').catch(e => e);
        expect(error.message).toContain('expect.toHaveURL with timeout 1000ms');
        expect(error.message).toContain('data:text/html,<div>');
      });
      `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should log scale the time', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';

      test('pass', async ({ page }) => {
        await page.setContent('<div id=div>Wrong</div>');
        await expect(page.locator('div')).toHaveText('Text', { timeout: 2000 });
      });
      `,
  }, { workers: 1 });
  const output = result.output;
  const tokens = output.split('unexpected value');
  // Log scale: 0, 100, 250, 500, 1000, 1000, should be less than 8.
  expect(tokens.length).toBeGreaterThan(1);
  expect(tokens.length).toBeLessThan(8);
  expect(result.passed).toBe(0);
  expect(result.exitCode).toBe(1);
});


test('should print expected/received before timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';

      test('times out waiting for text', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        await expect(page.locator('#node')).toHaveText('Text 2');
      });
      `,
  }, { workers: 1, timeout: 2000 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Test timeout of 2000ms exceeded.');
  expect(result.output).toContain('Expected string: "Text 2"');
  expect(result.output).toContain('Received string: "Text content"');
});

test('should print pending operations for toHaveText', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';

      test('fail', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        await expect(page.locator('no-such-thing')).toHaveText('Text');
      });
      `,
  }, { workers: 1, timeout: 2000 });
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
  const output = result.output;
  expect(output).toContain(`expect(locator).toHaveText(expected)`);
  expect(output).toContain('Expected string: "Text"');
  expect(output).toContain('Received: <element(s) not found>');
  expect(output).toContain('waiting for locator(\'no-such-thing\')');
});

test('should print expected/received on Ctrl+C', async ({ interactWithTestRunner }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const testProcess = await interactWithTestRunner({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';

      test('times out waiting for text', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        const promise = expect(page.locator('#node')).toHaveText('Text 2');
        await new Promise(f => setTimeout(f, 1000));
        console.log('\\n%%SEND-SIGINT%%');
        await promise;
      });
      `,
  }, { workers: 1 });
  await testProcess.waitForOutput('%%SEND-SIGINT%%');
  process.kill(-testProcess.process.pid!, 'SIGINT');
  const { exitCode } = await testProcess.exited;
  expect(exitCode).toBe(130);

  const result = parseTestRunnerOutput(testProcess.output);
  expect(result.passed).toBe(0);
  expect(result.interrupted).toBe(1);
  expect(result.output).toContain('Expected string: "Text 2"');
  expect(result.output).toContain('Received string: "Text content"');
});

test('should not print timed out error message when test times out', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';

      test('fail', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        await expect(page.locator('no-such-thing')).toHaveText('hey', { timeout: 5000 });
      });
      `,
  }, { workers: 1, timeout: 3000 });
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
  const output = result.output;
  expect(output).toContain('Test timeout of 3000ms exceeded');
  expect(output).not.toContain('Timed out 5000ms waiting for expect');
  expect(output).toContain(`Error: expect(locator).toHaveText(expected)`);
});

test('should not leak long expect message strings', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';

      let logs: string = 'Ab';
      const consoleLogWatcher = (msg: ConsoleMessage) => {
        if (logs.length < (1<<28))
          logs += logs;
        expect(msg.text(), logs).toMatch(/^\\d+$/);
      }

      test('main', async ({ page }) => {
        page.on('console', consoleLogWatcher);
        await page.evaluate(() => {
          for (let i = 0; i < 20; i++)
            console.log(i);
        });
      });
      `,
  }, { workers: 1 });
  // expect(result.output).toBe('');
  expect(result.failed).toBe(0);
  expect(result.exitCode).toBe(0);
});

test('should chain expect matchers and expose matcher utils (TSC)', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
    import { test, expect as baseExpect } from '@playwright/test';
    import type { Page, Locator, ExpectMatcherState, Expect } from '@playwright/test';

    function callLogText(log: string[] | undefined): string {
      if (!log)
        return '';
      return log.join('\\n');
    }

    const dummy: Expect = baseExpect;
    const dummy2: Expect<{}> = baseExpect;

    const expect = baseExpect.extend({
      async toHaveAmount(locator: Locator, expected: string, options?: { timeout?: number }) {
        // Make sure "this" is inferred as ExpectMatcherState.
        const self: ExpectMatcherState = this;
        const self2: ReturnType<Expect['getState']> = self;

        const baseAmount = locator.locator('.base-amount');

        let pass: boolean;
        let matcherResult: any;
        try {
          await baseExpect(baseAmount).toHaveAttribute('data-amount', expected, options);
          pass = true;
        } catch (e: any) {
          matcherResult = e.matcherResult;
          pass = false;
        }

        const expectOptions = {
          isNot: this.isNot,
        };

        const log = callLogText(matcherResult?.log);
        const message = pass
          ? () => this.utils.matcherHint('toBe', locator, expected, expectOptions) +
              '\\n\\n' +
              \`Expected: \${this.isNot ? 'not' : ''}\${this.utils.printExpected(expected)}\\n\` +
              (matcherResult ? \`Received: \${this.utils.printReceived(matcherResult.actual)}\` : '') +
              log
          : () =>  this.utils.matcherHint('toBe', locator, expected, expectOptions) +
              '\\n\\n' +
              \`Expected: \${this.utils.printExpected(expected)}\n\` +
              (matcherResult ? \`Received: \${this.utils.printReceived(matcherResult.actual)}\` : '') +
              log;

        return {
          name: 'toHaveAmount',
          expected,
          message,
          pass,
          actual: matcherResult?.actual,
          log: matcherResult?.log,
        };
      },

      async toBeANicePage(page: Page) {
        return {
          name: 'toBeANicePage',
          expected: 1,
          message: () => '',
          pass: true,
        };
      }
    });

    test('custom matchers', async ({ page }) => {
      await page.setContent(\`
        <div>
          <div class='base-amount' data-amount='2'></div>
        </div>
      \`);
      await expect(page.locator('div')).toHaveAmount('3', { timeout: 1000 });
      await expect(page).toBeANicePage();
      // @ts-expect-error
      await expect(page).toHaveAmount('3', { timeout: 1000 });
      // @ts-expect-error
      await expect(page.locator('div')).toBeANicePage();
    });`
  });
  expect(result.exitCode).toBe(0);
});

test('should chain expect matchers and expose matcher utils', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
    import { test, expect as baseExpect } from '@playwright/test';
    import type { Page, Locator } from '@playwright/test';

    function callLogText(log: string[] | undefined): string {
      if (!log)
        return '';
      return log.join('\\n');
    }

    const expect = baseExpect.extend({
      async toHaveAmount(locator: Locator, expected: string, options?: { timeout?: number }) {
        const baseAmount = locator.locator('.base-amount');

        let pass: boolean;
        let matcherResult: any;
        try {
          await baseExpect(baseAmount).toHaveAttribute('data-amount', expected, options);
          pass = true;
        } catch (e: any) {
          matcherResult = e.matcherResult;
          pass = false;
        }

        const expectOptions = {
          isNot: this.isNot,
        };

        const log = callLogText(matcherResult?.log);
        const message = pass
          ? () => this.utils.matcherHint('toHaveAmount', undefined, undefined, expectOptions) +
              '\\n\\n' +
              \`Expected: \${this.isNot ? 'not' : ''}\${this.utils.printExpected(expected)}\\n\` +
              (matcherResult ? \`Received: \${this.utils.printReceived(matcherResult.actual)}\` : '') +
              '\\n\\n' +log
          : () =>  this.utils.matcherHint('toHaveAmount', undefined, undefined, expectOptions) +
              '\\n\\n' +
              \`Expected: \${this.utils.printExpected(expected)}\n\` +
              (matcherResult ? \`Received: \${this.utils.printReceived(matcherResult.actual)}\` : '') +
              '\\n\\n' +log;

        return {
          name: 'toHaveAmount',
          expected,
          message,
          pass,
          actual: matcherResult?.actual,
          log: matcherResult?.log,
        };
      },
    });

    test('custom matchers', async ({ page }) => {
      await page.setContent(\`
        <div>
          <div class='base-amount' data-amount='2'></div>
        </div>
      \`);
      await expect(page.locator('div')).toHaveAmount('3', { timeout: 1000 });
    });`
  }, { workers: 1 });
  const output = stripAnsi(result.output);
  expect(output).toContain(`await expect(page.locator('div')).toHaveAmount('3', { timeout: 1000 });`);
  expect(output).toContain('a.spec.ts:60');
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should support toHaveAttribute without optional value', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
    import { test, expect as baseExpect } from '@playwright/test';
    test('custom matchers', async ({ page }) => {
      const locator = page.locator('#node');
      await test.expect(locator).toHaveAttribute('name', 'value');
      await test.expect(locator).toHaveAttribute('name', 'value', { timeout: 10 });
      await test.expect(locator).toHaveAttribute('disabled');
      await test.expect(locator).toHaveAttribute('disabled', { timeout: 10 });
      // @ts-expect-error
      await test.expect(locator).toHaveAttribute('disabled', { foo: 1 });
      // @ts-expect-error
      await test.expect(locator).toHaveAttribute('name', 'value', 'opt');
    });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should support mergeExpects (TSC)', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      import { test, mergeExpects, expect as baseExpect } from '@playwright/test';
      import type { Page } from '@playwright/test';

      const expect1 = baseExpect.extend({
        async toBeAGoodPage(page: Page, x: number) {
          return { pass: true, message: () => '' };
        }
      });

      const expect2 = baseExpect.extend({
        async toBeABadPage(page: Page, y: string) {
          return { pass: true, message: () => '' };
        }
      });

      const expect = mergeExpects(expect1, expect2);

      test('custom matchers', async ({ page }) => {
        await expect(page).toBeAGoodPage(123);
        await expect(page).toBeABadPage('123');
        // @ts-expect-error
        await expect(page).toBeAMediocrePage();
        // @ts-expect-error
        await expect(page).toBeABadPage(123);
        // @ts-expect-error
        await expect(page).toBeAGoodPage('123');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should support mergeExpects', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, mergeExpects, expect as baseExpect } from '@playwright/test';
      import type { Page } from '@playwright/test';

      const expect1 = baseExpect.extend({
        async toBeAGoodPage(page: Page, x: number) {
          return { pass: true, message: () => '' };
        }
      });

      const expect2 = baseExpect.extend({
        async toBeABadPage(page: Page, y: string) {
          return { pass: true, message: () => '' };
        }
      });

      const expect = mergeExpects(expect1, expect2);

      test('custom matchers', async ({ page }) => {
        await expect(page).toBeAGoodPage(123);
        await expect(page).toBeABadPage('123');
      });
    `
  }, { workers: 1 });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should respect timeout from configured expect when used outside of the test runner', async ({ runInlineTest, writeFiles, runTSC }) => {

  const files = {
    'script.mjs': `
      import { test, expect as baseExpect, chromium } from '@playwright/test';

      const configuredExpect = baseExpect.configure({
        timeout: 10,
      });

      let browser;
      try {
        browser = await chromium.launch();
        const context = await browser.newContext();
        const page = await context.newPage();
        await configuredExpect(page.getByTestId("does-not-exist")).toBeAttached();
      } catch(e) {
        console.error(e);
        process.exit(1);
      }
      finally {
        await browser?.close();
      }

    `
  };
  const baseDir = await writeFiles(files);
  const { code, stdout, stderr } = await spawnAsync('node', ['script.mjs'], { stdio: 'pipe', cwd: baseDir });


  expect(code).toBe(1);
  expect(stdout).toBe('');
  expect(stripAnsi(stderr)).toContain('Timed out 10ms waiting for expect(locator).toBeAttached()');
});

test('should expose timeout to custom matchers', async ({ runInlineTest, runTSC }) => {
  const files = {
    'playwright.config.ts': `
      export default {
        expect: { timeout: 1100 }
      };
    `,
    'a.test.ts': `
      import type { ExpectMatcherState, MatcherReturnType } from '@playwright/test';
      import { test, expect as base } from '@playwright/test';

      const expect = base.extend({
        assertTimeout(page: any, value: number) {
          const pass = this.timeout === value;
          return {
            message: () => 'Unexpected timeout: ' + this.timeout,
            pass,
            name: 'assertTimeout',
          };
        }
      });

      test('from config', async ({ page }) => {
        expect(page).assertTimeout(1100);
      });
      test('from expect.configure', async ({ page }) => {
        expect.configure({ timeout: 2200 })(page).assertTimeout(2200);
      });
      `,
  };
  const { exitCode } = await runTSC(files);
  expect(exitCode).toBe(0);

  const result = await runInlineTest(files);
  expect(result.exitCode).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.passed).toBe(2);
});

test('should throw error when using .equals()', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      import { test as base, expect as baseExpect } from '@playwright/test';
      export const expect = baseExpect.extend({
        toBeWithinRange(received, floor, ceiling) {
          this.equals(1, 2);
        },
      });
      export const test = base;
    `,
    'expect-test.spec.ts': `
      import { test, expect } from './helper';
      test('numeric ranges', () => {
        expect(() => {
          expect(100).toBeWithinRange(90, 110);
        }).toThrowError('It looks like you are using custom expect matchers that are not compatible with Playwright. See https://aka.ms/playwright/expect-compatibility');
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('expect.extend should be immutable', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      import { test, expect } from '@playwright/test';
      const expectFoo = expect.extend({
        toFoo() {
          console.log('%%foo');
          return { pass: true };
        }
      });
      const expectFoo2 = expect.extend({
        toFoo() {
          console.log('%%foo2');
          return { pass: true };
        }
      });
      const expectBar = expectFoo.extend({
        toBar() {
          console.log('%%bar');
          return { pass: true };
        }
      });
      test('logs', () => {
        expect(expectFoo).not.toBe(expectFoo2);
        expect(expectFoo).not.toBe(expectBar);

        expectFoo().toFoo();
        expectFoo2().toFoo();
        expectBar().toFoo();
        expectBar().toBar();
      });
    `
  });
  expect(result.outputLines).toEqual([
    'foo',
    'foo2',
    'foo',
    'bar',
  ]);
});

test('expect.extend should fall back to legacy behavior', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      import { test, expect } from '@playwright/test';
      expect.extend({
        toFoo() {
          console.log('%%foo');
          return { pass: true };
        }
      });
      expect.extend({
        toFoo() {
          console.log('%%foo2');
          return { pass: true };
        }
      });
      expect.extend({
        toBar() {
          console.log('%%bar');
          return { pass: true };
        }
      });
      test('logs', () => {
        expect().toFoo();
        expect().toBar();
      });
    `
  });
  expect(result.outputLines).toEqual([
    'foo2',
    'bar',
  ]);
});
