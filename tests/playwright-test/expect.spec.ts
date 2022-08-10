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
import { test, expect, stripAnsi } from './playwright-test-fixtures';

test('should be able to call expect.extend in config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      pwt.expect.extend({
        toBeWithinRange(received, floor, ceiling) {
          const pass = received >= floor && received <= ceiling;
          if (pass) {
            return {
              message: () =>
                'passed',
              pass: true,
            };
          } else {
            return {
              message: () => 'failed',
              pass: false,
            };
          }
        },
      });
      export const test = pwt.test;
    `,
    'expect-test.spec.ts': `
      import { test } from './helper';
      test('numeric ranges', () => {
        test.expect(100).toBeWithinRange(90, 110);
        test.expect(101).not.toBeWithinRange(0, 100);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should not expand huge arrays', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      const { test } = pwt;
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

test('should include custom error message', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      const { test } = pwt;
      test('custom expect message', () => {
        test.expect(1+1, 'one plus one is two!').toEqual(3);
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(stripAnsi(result.output)).toContain([
    `    Error: one plus one is two!`,
    ``,
    `    Expected: 3`,
    `    Received: 2`,
  ].join('\n'));
});

test('should include custom error message with web-first assertions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      const { test } = pwt;
      test('custom expect message', async ({page}) => {
        await expect(page.locator('x-foo'), { message: 'x-foo must be visible' }).toBeVisible({timeout: 1});
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain([
    `    Error: x-foo must be visible`,
    ``,
    `    Call log:`,
  ].join('\n'));
});

test('should work with default expect prototype functions', async ({ runTSC, runInlineTest }) => {
  const spec = `
    const { test } = pwt;
    test('pass', async () => {
      const expected = [1, 2, 3, 4, 5, 6];
      test.expect([4, 1, 6, 7, 3, 5, 2, 5, 4, 6]).toEqual(
        expect.arrayContaining(expected),
      );
      expect('foo').toEqual(expect.any(String));
      expect('foo').toEqual(expect.anything());
      expect('hello world').toEqual(expect.not.stringContaining('text'));
    });
  `;
  {
    const result = await runTSC({
      'a.spec.ts': spec,
    });
    expect(result.exitCode).toBe(0);
  }
  {
    const result = await runInlineTest({
      'a.spec.ts': spec,
    });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
  }
});

test('should work with default expect matchers', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      const { test } = pwt;
      test.expect(42).toBe(42);
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should work with expect message', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      const { test } = pwt;
      test.expect(42, 'this is expect message').toBe(42);
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should work with default expect matchers and esModuleInterop=false', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      const { test } = pwt;
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
      const { test } = pwt;
      test.expect.extend({
        toBeWithinRange() { },
      });

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
    const { test } = pwt;
    test('custom matchers', async ({ page }) => {
      await test.expect(page).toHaveURL('https://example.com');
      await test.expect(page).not.toHaveURL('https://example.com');
      await test.expect(page).toBe(true);
      // @ts-expect-error
      await test.expect(page).toBeEnabled();
      // @ts-expect-error
      await test.expect(page).not.toBeEnabled();

      await test.expect(page.locator('foo')).toBeEnabled();
      await test.expect(page.locator('foo')).toBe(true);
      // @ts-expect-error
      await test.expect(page.locator('foo')).toHaveURL('https://example.com');

      const res = await page.request.get('http://i-do-definitely-not-exist.com');
      await test.expect(res).toBeOK();
      await test.expect(res).toBe(true);
      // @ts-expect-error
      await test.expect(res).toHaveURL('https://example.com');

      await test.expect(res as any).toHaveURL('https://example.com');
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
      type AssertType<T, S> = S extends T ? AssertNotAny<S> : false;
      type AssertNotAny<S> = {notRealProperty: number} extends S ? false : true;

      pwt.test('example', async ({ page }) => {
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
        const { test } = pwt;
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
        const { test } = pwt;
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
        const { test } = pwt;
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
        const { test } = pwt;
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
        const { test } = pwt;
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
      const { expect } = pwt;
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
      const { test } = pwt;
      test('skipped', () => {});
    `,
  });

  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).toContain('> 11 |         expect(1).toBe(2);');
});

test('should support toHaveURL with baseURL from webServer', async ({ runInlineTest }, testInfo) => {
  const port = testInfo.workerIndex + 10500;
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

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
  const output = stripAnsi(result.output);
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
      const { test } = pwt;

      test('timeout', async ({ page }) => {
        await page.goto('data:text/html,<div>A</div>');
        await Promise.all([
          expect(page).toHaveURL('data:text/html,<div>B</div>'),
          new Promise(f => setTimeout(f, 2000)).then(() => expect(true).toBe(false))
        ]);
      });
      `,
  }, { workers: 1 });
  const output = stripAnsi(result.output);
  expect(output).toContain('expect(received).toHaveURL(expected)');
  expect(output).toContain('expect.toHaveURL with timeout 1000ms');
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should log scale the time', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<div id=div>Wrong</div>');
        await expect(page.locator('div')).toHaveText('Text', { timeout: 2000 });
      });
      `,
  }, { workers: 1 });
  const output = stripAnsi(result.output);
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
      const { test } = pwt;

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
  expect(stripAnsi(result.output)).toContain('Expected string: "Text 2"');
  expect(stripAnsi(result.output)).toContain('Received string: "Text content"');
});

test('should print pending operations for toHaveText', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('fail', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        await expect(page.locator('no-such-thing')).toHaveText('Text');
      });
      `,
  }, { workers: 1, timeout: 2000 });
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
  const output = stripAnsi(result.output);
  expect(output).toContain('Pending operations:');
  expect(output).toContain('Error: expect(received).toHaveText(expected)');
  expect(output).toContain('Expected string: "Text"');
  expect(output).toContain('Received string: ""');
  expect(output).toContain('waiting for selector "no-such-thing"');
});

test('should print expected/received on Ctrl+C', async ({ runInlineTest }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('times out waiting for text', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        const promise = expect(page.locator('#node')).toHaveText('Text 2');
        await new Promise(f => setTimeout(f, 500));
        console.log('\\n%%SEND-SIGINT%%');
        await promise;
      });
      `,
  }, { workers: 1 }, {}, { sendSIGINTAfter: 1 });
  expect(result.exitCode).toBe(130);
  expect(result.passed).toBe(0);
  expect(result.interrupted).toBe(1);
  expect(stripAnsi(result.output)).toContain('Expected string: "Text 2"');
  expect(stripAnsi(result.output)).toContain('Received string: "Text content"');
});
