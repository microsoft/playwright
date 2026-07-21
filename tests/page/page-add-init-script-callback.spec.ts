/**
 * Copyright (c) Microsoft Corporation.
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

import { test as it, expect } from './pageTest';

it('should drop functions without the exposeFunctions option', async ({ page, server }) => {
  await page.addInitScript(({ cb }) => {
    (window as any).cbType = typeof cb;
  }, { cb: () => {} });
  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate(() => (window as any).cbType)).toBe('undefined');
});

it('should throw when the script is not a function', async ({ page }) => {
  await expect(page.addInitScript({ content: 'window.foo = 1;' }, undefined, { exposeFunctions: true }))
      .rejects.toThrow('Passing functions requires the init script to be a function');
});

it('should call a function passed as an argument', async ({ page, server }) => {
  const received: number[] = [];
  await page.addInitScript(async ({ cb }) => {
    await cb(1);
    await cb(2);
  }, { cb: async (n: number) => { received.push(n); } }, { exposeFunctions: true });
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => received).toEqual([1, 2]);
});

it('should accept a function as the whole argument', async ({ page, server }) => {
  await page.addInitScript(async cb => {
    (window as any).result = await cb('a');
  }, async (s: string) => s + 'b', { exposeFunctions: true });
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => page.evaluate(() => (window as any).result)).toBe('ab');
});

it('should pass arguments to the callback', async ({ page, server }) => {
  const argsPromise = new Promise<any[]>(resolve => {
    void page.addInitScript(({ cb }) => cb(1, 'two', { three: 3 }, [4]), {
      cb: (...a: any[]) => resolve(a),
    }, { exposeFunctions: true }).then(() => page.goto(server.EMPTY_PAGE));
  });
  expect(await argsPromise).toEqual([1, 'two', { three: 3 }, [4]]);
});

it('should return the callback result to the page', async ({ page, server }) => {
  await page.addInitScript(async ({ double }) => {
    (window as any).result = await double(21);
  }, { double: async (n: number) => n * 2 }, { exposeFunctions: true });
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => page.evaluate(() => (window as any).result)).toBe(42);
});

it('should propagate callback errors to the page', async ({ page, server }) => {
  await page.addInitScript(async ({ cb }) => {
    try {
      await cb();
      (window as any).result = 'no error';
    } catch (e) {
      (window as any).result = (e as Error).message;
    }
  }, { cb: async () => { throw new Error('boom'); } }, { exposeFunctions: true });
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => page.evaluate(() => (window as any).result)).toContain('boom');
});

it('should support multiple callbacks', async ({ page, server }) => {
  await page.addInitScript(async ({ add, mul }) => {
    (window as any).result = (await add(2, 3)) + (await mul(2, 3));
  }, {
    add: async (a: number, b: number) => a + b,
    mul: async (a: number, b: number) => a * b,
  }, { exposeFunctions: true });
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => page.evaluate(() => (window as any).result)).toBe(11);
});

it('should survive a navigation and keep working', async ({ page, server }) => {
  const received: number[] = [];
  await page.addInitScript(({ cb }) => {
    (window as any).cb = cb;
  }, { cb: (n: number) => { received.push(n); return n * 2; } }, { exposeFunctions: true });
  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate(() => (window as any).cb(1))).toBe(2);
  await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
  expect(await page.evaluate(() => (window as any).cb(2))).toBe(4);
  expect(received).toEqual([1, 2]);
});

it('should work in a child frame', async ({ page, server }) => {
  const received: number[] = [];
  await page.addInitScript(async ({ cb }) => {
    await cb(42);
  }, { cb: async (n: number) => { received.push(n); } }, { exposeFunctions: true });
  await page.goto(server.PREFIX + '/frames/one-frame.html');
  // Once for the main frame document, once for the child frame document.
  await expect.poll(() => received).toEqual([42, 42]);
});

it('should not register the callback on the global object', async ({ page, server }) => {
  await page.addInitScript(async ({ cb }) => {
    await cb();
    (window as any).result = Object.getOwnPropertyNames(globalThis).filter(name => name.startsWith('__pw_fn_'));
  }, { cb: async () => {} }, { exposeFunctions: true });
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => page.evaluate(() => (window as any).result)).toEqual([]);
});

it('should remove exposed functions after dispose', async ({ page, server }) => {
  const received: number[] = [];
  const disposable = await page.addInitScript(({ cb }) => {
    (window as any).cb = cb;
  }, { cb: (n: number) => { received.push(n); } }, { exposeFunctions: true });
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => (window as any).cb(1));
  await disposable.dispose();
  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate(() => typeof (window as any).cb)).toBe('undefined');
  expect(received).toEqual([1]);
});
