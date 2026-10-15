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

import { attachFrame } from '../config/utils';
import { test as it, expect } from './pageTest';

it('should throw without the exposeFunctions option', async ({ page }) => {
  await expect(page.evaluate(({ cb }) => cb(), { cb: () => {} }))
      .rejects.toThrow(/Attempting to serialize unexpected value at position "cb": \(\) => {}/);
});

it('should call a function passed as an argument', async ({ page }) => {
  const received: number[] = [];
  await page.evaluate(async ({ cb }) => {
    await cb(1);
    await cb(2);
  }, { cb: (n: number) => { received.push(n); } }, { exposeFunctions: true });
  expect(received).toEqual([1, 2]);
});

it('should accept a function as the whole argument', async ({ page }) => {
  const received: string[] = [];
  await page.evaluate(async cb => {
    await cb('a');
    await cb('b');
  }, async (s: string) => { received.push(s); }, { exposeFunctions: true });
  expect(received).toEqual(['a', 'b']);
});

it('should pass arguments to the callback', async ({ page }) => {
  const args = await new Promise<any[]>(resolve => {
    page.evaluate(({ cb }) => cb(1, 'two', { three: 3 }, [4]), {
      cb: (...a: any[]) => resolve(a),
    }, { exposeFunctions: true }).catch(() => {});
  });
  expect(args).toEqual([1, 'two', { three: 3 }, [4]]);
});

it('should return the callback result to the page', async ({ page }) => {
  const doubled = await page.evaluate(async ({ cb }) => await cb(21), {
    cb: async (n: number) => n * 2,
  }, { exposeFunctions: true });
  expect(doubled).toBe(42);
});

it('should support handle as a callback result', async ({ page }) => {
  const result = await page.evaluate(async cb => {
    const value = await cb(42);
    return value + 17;
  }, (n: number) => page.evaluateHandle(x => 2 * x, n), { exposeFunctions: true });
  expect(result).toBe(101);
});

it('should support nested handles in the callback result', async ({ page }) => {
  const result = await page.evaluate(async cb => {
    const res = await cb(42);
    return res.mul[0] + res.mul[1] + res.add;
  }, async (n: number) => {
    const double = await page.evaluateHandle(x => 2 * x, n);
    const triple = await page.evaluateHandle(x => 3 * x, n);
    return { mul: [double, triple] as const, add: 17 };
  }, { exposeFunctions: true });
  expect(result).toBe(227);
});

it('should await an async callback result', async ({ page }) => {
  const value = await page.evaluate(async ({ cb }) => await cb(20), {
    cb: async (n: number) => { await new Promise(f => setTimeout(f, 10)); return n + 1; },
  }, { exposeFunctions: true });
  expect(value).toBe(21);
});

it('should propagate callback errors to the page', async ({ page }) => {
  const message = await page.evaluate(async ({ cb }) => {
    try {
      await cb();
      return 'no error';
    } catch (e) {
      return (e as Error).message;
    }
  }, { cb: async () => { throw new Error('boom'); } }, { exposeFunctions: true });
  expect(message).toContain('boom');
});

it('should work with a fire-and-forget setTimeout callback', async ({ page }) => {
  const value = await new Promise<number>(resolve => {
    page.evaluate(({ cb }) => { setTimeout(() => cb(5), 0); }, {
      cb: (n: number) => resolve(n),
    }, { exposeFunctions: true }).catch(() => {});
  });
  expect(value).toBe(5);
});

it('should support multiple callbacks', async ({ page }) => {
  const result = await page.evaluate(async ({ add, mul }) => {
    return (await add(2, 3)) + (await mul(2, 3));
  }, {
    add: async (a: number, b: number) => a + b,
    mul: async (a: number, b: number) => a * b,
  }, { exposeFunctions: true });
  expect(result).toBe(11);
});

it('should work with evaluateHandle', async ({ page }) => {
  const received: number[] = [];
  const handle = await page.evaluateHandle(async ({ cb }) => {
    await cb(7);
    return { done: true };
  }, { cb: async (n: number) => { received.push(n); } }, { exposeFunctions: true });
  expect(await handle.jsonValue()).toEqual({ done: true });
  expect(received).toEqual([7]);
});

it('should work in a child frame', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const frame = await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  const received: number[] = [];
  await frame.evaluate(async ({ cb }) => { await cb(42); }, { cb: async (n: number) => { received.push(n); } }, { exposeFunctions: true });
  expect(received).toEqual([42]);
});

it('should route callbacks back to the calling frame', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const frame = await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  const greet = async (where: string) => `hello ${where}`;
  const [fromMain, fromChild] = await Promise.all([
    page.evaluate(async ({ cb }) => await cb('main'), { cb: greet }, { exposeFunctions: true }),
    frame.evaluate(async ({ cb }) => await cb('child'), { cb: greet }, { exposeFunctions: true }),
  ]);
  expect(fromMain).toBe('hello main');
  expect(fromChild).toBe('hello child');
});

it('should work with jsHandle.evaluate', async ({ page }) => {
  const handle = await page.evaluateHandle(() => window);
  const received: number[] = [];
  await handle.evaluate(async (win, { cb }) => { await cb(99); }, { cb: async (n: number) => { received.push(n); } }, { exposeFunctions: true });
  expect(received).toEqual([99]);
});

it('should work with locator.evaluate', async ({ page }) => {
  await page.setContent('<div id=target>hello</div>');
  const received: string[] = [];
  await page.locator('#target').evaluate(async (element, { cb }) => { await cb(element.id); }, { cb: async (s: string) => { received.push(s); } }, { exposeFunctions: true });
  expect(received).toEqual(['target']);
});

it('should return the callback result with locator.evaluate', async ({ page }) => {
  await page.setContent('<div id=target>7</div>');
  const result = await page.locator('#target').evaluate(async (element, { double }) => {
    return await double(+element.textContent!);
  }, { double: async (n: number) => n * 2 }, { exposeFunctions: true });
  expect(result).toBe(14);
});

it('should propagate callback errors with locator.evaluate', async ({ page }) => {
  await page.setContent('<div id=target></div>');
  const message = await page.locator('#target').evaluate(async (element, { cb }) => {
    try {
      await cb();
      return 'no error';
    } catch (e) {
      return (e as Error).message;
    }
  }, { cb: async () => { throw new Error('boom'); } }, { exposeFunctions: true });
  expect(message).toContain('boom');
});

it('should work with locator.evaluateHandle', async ({ page }) => {
  await page.setContent('<div id=target>hello</div>');
  const received: string[] = [];
  const handle = await page.locator('#target').evaluateHandle(async (element, { cb }) => {
    await cb(element.id);
    return element;
  }, { cb: async (s: string) => { received.push(s); } }, { exposeFunctions: true });
  expect(received).toEqual(['target']);
  expect(await handle.evaluate(element => element.id)).toBe('target');
});

it('should work with locator.evaluate inside an iframe', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const frame = await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  await frame.evaluate(() => { document.body.innerHTML = '<div id=target>in-frame</div>'; });
  const received: (string | null)[] = [];
  await page.frameLocator('#frame1').locator('#target').evaluate(async (element, { cb }) => {
    await cb(element.textContent);
  }, { cb: async (text: string | null) => { received.push(text); } }, { exposeFunctions: true });
  expect(received).toEqual(['in-frame']);
});

it('should survive a navigation and keep working', async ({ page, server }) => {
  const received: number[] = [];
  await page.evaluate(async ({ cb }) => { await cb(1); }, { cb: async (n: number) => { received.push(n); } }, { exposeFunctions: true });
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(async ({ cb }) => { await cb(2); }, { cb: async (n: number) => { received.push(n); } }, { exposeFunctions: true });
  expect(received).toEqual([1, 2]);
});

it('should not register the callback on the global object', async ({ page }) => {
  const result = await page.evaluate(async ({ cb }) => {
    await cb();
    return Object.getOwnPropertyNames(globalThis).filter(name => name.startsWith('__pw_fn_'));
  }, { cb: async () => {} }, { exposeFunctions: true });
  expect(result).toEqual([]);
});

it('should scope the page-side callback to the execution context', async ({ page, server }) => {
  await page.evaluate(({ cb }) => { (window as any).__cb = cb; }, { cb: () => {} }, { exposeFunctions: true });
  expect(await page.evaluate(() => typeof (window as any).__cb)).toBe('function');
  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate(() => typeof (window as any).__cb)).toBe('undefined');
});
