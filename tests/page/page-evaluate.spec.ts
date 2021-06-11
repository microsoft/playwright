/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

it('should work', async ({ page }) => {
  const result = await page.evaluate(() => 7 * 3);
  expect(result).toBe(21);
});

it('should transfer NaN', async ({ page }) => {
  const result = await page.evaluate(a => a, NaN);
  expect(Object.is(result, NaN)).toBe(true);
});

it('should transfer -0', async ({ page }) => {
  const result = await page.evaluate(a => a, -0);
  expect(Object.is(result, -0)).toBe(true);
});

it('should transfer Infinity', async ({ page }) => {
  const result = await page.evaluate(a => a, Infinity);
  expect(Object.is(result, Infinity)).toBe(true);
});

it('should transfer -Infinity', async ({ page }) => {
  const result = await page.evaluate(a => a, -Infinity);
  expect(Object.is(result, -Infinity)).toBe(true);
});

it('should roundtrip unserializable values', async ({ page }) => {
  const value = {
    infinity: Infinity,
    nInfinity: -Infinity,
    nZero: -0,
    nan: NaN,
  };
  const result = await page.evaluate(value => value, value);
  expect(result).toEqual(value);
});

it('should roundtrip promise to value', async ({ page }) => {
  {
    const result = await page.evaluate(value => Promise.resolve(value), null);
    expect(result === null).toBeTruthy();
  }
  {
    const result = await page.evaluate(value => Promise.resolve(value), Infinity);
    expect(result === Infinity).toBeTruthy();
  }
  {
    const result = await page.evaluate(value => Promise.resolve(value), -0);
    expect(result === -0).toBeTruthy();
  }
  {
    const result = await page.evaluate(value => Promise.resolve(value), undefined);
    expect(result === undefined).toBeTruthy();
  }
});

it('should roundtrip promise to unserializable values', async ({ page }) => {
  const value = {
    infinity: Infinity,
    nInfinity: -Infinity,
    nZero: -0,
    nan: NaN,
  };
  const result = await page.evaluate(value => Promise.resolve(value), value);
  expect(result).toEqual(value);
});

it('should transfer arrays', async ({ page }) => {
  const result = await page.evaluate(a => a, [1, 2, 3]);
  expect(result).toEqual([1, 2, 3]);
});

it('should transfer arrays as arrays, not objects', async ({ page }) => {
  const result = await page.evaluate(a => Array.isArray(a), [1, 2, 3]);
  expect(result).toBe(true);
});

it('should transfer maps as empty objects', async ({ page }) => {
  const result = await page.evaluate(a => a.x.constructor.name + ' ' + JSON.stringify(a.x), { x: new Map([[1, 2]]) });
  expect(result).toBe('Object {}');
});

it('should modify global environment', async ({ page }) => {
  await page.evaluate(() => window['globalVar'] = 123);
  expect(await page.evaluate('globalVar')).toBe(123);
});

it('should evaluate in the page context', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/global-var.html');
  expect(await page.evaluate('globalVar')).toBe(123);
});

it('should return undefined for objects with symbols', async ({ page }) => {
  expect(await page.evaluate(() => [Symbol('foo4')])).toEqual([undefined]);
  expect(await page.evaluate(() => {
    const a = {};
    a[Symbol('foo4')] = 42;
    return a;
  })).toEqual({});
  expect(await page.evaluate(() => {
    return { foo: [{ a: Symbol('foo4') }] };
  })).toEqual({ foo: [{ a: undefined }] });
});

it('should work with function shorthands', async ({ page }) => {
  const a = {
    sum([a, b]: number[]) { return a + b; },
    async mult([a, b]: number[]) { return a * b; }
  };
  expect(await page.evaluate(a.sum, [1, 2])).toBe(3);
  expect(await page.evaluate(a.mult, [2, 4])).toBe(8);
});

it('should work with unicode chars', async ({ page }) => {
  const result = await page.evaluate(a => a['中文字符'], { '中文字符': 42 });
  expect(result).toBe(42);
});

it('should throw when evaluation triggers reload', async ({ page }) => {
  let error = null;
  await page.evaluate(() => {
    location.reload();
    return new Promise(() => { });
  }).catch(e => error = e);
  expect(error.message).toContain('navigation');
});

it('should await promise', async ({ page }) => {
  const result = await page.evaluate(() => Promise.resolve(8 * 7));
  expect(result).toBe(56);
});

it('should work right after framenavigated', async ({ page, server }) => {
  let frameEvaluation = null;
  page.on('framenavigated', async frame => {
    frameEvaluation = frame.evaluate(() => 6 * 7);
  });
  await page.goto(server.EMPTY_PAGE);
  expect(await frameEvaluation).toBe(42);
});

it('should work right after a cross-origin navigation', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  let frameEvaluation = null;
  page.on('framenavigated', async frame => {
    frameEvaluation = frame.evaluate(() => 6 * 7);
  });
  await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
  expect(await frameEvaluation).toBe(42);
});

it('should work from-inside an exposed function', async ({ page }) => {
  // Setup inpage callback, which calls Page.evaluate
  await page.exposeFunction('callController', async function(a, b) {
    return await page.evaluate(({ a, b }) => a * b, { a, b });
  });
  const result = await page.evaluate(async function() {
    return await window['callController'](9, 3);
  });
  expect(result).toBe(27);
});

it('should reject promise with exception', async ({ page }) => {
  let error = null;
  // @ts-ignore
  await page.evaluate(() => not_existing_object.property).catch(e => error = e);
  expect(error).toBeTruthy();
  expect(error.message).toContain('not_existing_object');
});

it('should support thrown strings as error messages', async ({ page }) => {
  let error = null;
  await page.evaluate(() => { throw 'qwerty'; }).catch(e => error = e);
  expect(error).toBeTruthy();
  expect(error.message).toContain('qwerty');
});

it('should support thrown numbers as error messages', async ({ page }) => {
  let error = null;
  await page.evaluate(() => { throw 100500; }).catch(e => error = e);
  expect(error).toBeTruthy();
  expect(error.message).toContain('100500');
});

it('should return complex objects', async ({ page }) => {
  const object = { foo: 'bar!' };
  const result = await page.evaluate(a => a, object);
  expect(result).not.toBe(object);
  expect(result).toEqual(object);
});

it('should return NaN', async ({ page }) => {
  const result = await page.evaluate(() => NaN);
  expect(Object.is(result, NaN)).toBe(true);
});

it('should return -0', async ({ page }) => {
  const result = await page.evaluate(() => -0);
  expect(Object.is(result, -0)).toBe(true);
});

it('should return Infinity', async ({ page }) => {
  const result = await page.evaluate(() => Infinity);
  expect(Object.is(result, Infinity)).toBe(true);
});

it('should return -Infinity', async ({ page }) => {
  const result = await page.evaluate(() => -Infinity);
  expect(Object.is(result, -Infinity)).toBe(true);
});

it('should work with overwritten Promise', async ({ page }) => {
  await page.evaluate(() => {
    const originalPromise = window.Promise;
    class Promise2 {
      _promise: Promise<any>;
      static all(arg) {
        return wrap(originalPromise.all(arg));
      }
      static race(arg) {
        return wrap(originalPromise.race(arg));
      }
      static resolve(arg) {
        return wrap(originalPromise.resolve(arg));
      }
      constructor(f) {
        this._promise = new originalPromise(f);
      }
      then(f, r) {
        return wrap(this._promise.then(f, r));
      }
      catch(f) {
        return wrap(this._promise.catch(f));
      }
      finally(f) {
        return wrap(this._promise.finally(f));
      }
    }
    const wrap = p => {
      const result = new Promise2(() => { });
      result._promise = p;
      return result;
    };
    // @ts-ignore;
    window.Promise = Promise2;
    window['__Promise2'] = Promise2;
  });

  // Sanity check.
  expect(await page.evaluate(() => {
    const p = Promise.all([Promise.race([]), new Promise(() => { }).then(() => { })]);
    return p instanceof window['__Promise2'];
  })).toBe(true);

  // Now, the new promise should be awaitable.
  expect(await page.evaluate(() => Promise.resolve(42))).toBe(42);
});

it('should throw when passed more than one parameter', async ({ page }) => {
  const expectThrow = async f => {
    let error;
    await f().catch(e => error = e);
    expect('' + error).toContain('Too many arguments');
  };
  // @ts-ignore
  await expectThrow(() => page.evaluate((a, b) => false, 1, 2));
  // @ts-ignore
  await expectThrow(() => page.evaluateHandle((a, b) => false, 1, 2));
  // @ts-ignore
  await expectThrow(() => page.$eval('sel', (a, b) => false, 1, 2));
  // @ts-ignore
  await expectThrow(() => page.$$eval('sel', (a, b) => false, 1, 2));
  // @ts-ignore
  await expectThrow(() => page.evaluate((a, b) => false, 1, 2));
  const frame = page.mainFrame();
  // @ts-ignore
  await expectThrow(() => frame.evaluate((a, b) => false, 1, 2));
  // @ts-ignore
  await expectThrow(() => frame.evaluateHandle((a, b) => false, 1, 2));
  // @ts-ignore
  await expectThrow(() => frame.$eval('sel', (a, b) => false, 1, 2));
  // @ts-ignore
  await expectThrow(() => frame.$$eval('sel', (a, b) => false, 1, 2));
  // @ts-ignore
  await expectThrow(() => frame.evaluate((a, b) => false, 1, 2));
});

it('should accept "undefined" as one of multiple parameters', async ({ page }) => {
  const result = await page.evaluate(({ a, b }) => Object.is(a, undefined) && Object.is(b, 'foo'), { a: undefined, b: 'foo' });
  expect(result).toBe(true);
});

it('should properly serialize undefined arguments', async ({ page }) => {
  expect(await page.evaluate(x => ({ a: x }), undefined)).toEqual({});
});

it('should properly serialize undefined fields', async ({ page }) => {
  expect(await page.evaluate(() => ({ a: undefined }))).toEqual({});
});

it('should return undefined properties', async ({ page }) => {
  const value = await page.evaluate(() => ({ a: undefined }));
  expect('a' in value).toBe(true);
});

it('should properly serialize null arguments', async ({ page }) => {
  expect(await page.evaluate(x => x, null)).toEqual(null);
});

it('should properly serialize null fields', async ({ page }) => {
  expect(await page.evaluate(() => ({ a: null }))).toEqual({ a: null });
});

it('should return undefined for non-serializable objects', async ({ page }) => {
  expect(await page.evaluate(() => window)).toBe(undefined);
});

it('should fail for circular object', async ({ page }) => {
  const result = await page.evaluate(() => {
    const a = {} as any;
    const b = { a };
    a.b = b;
    return a;
  });
  expect(result).toBe(undefined);
});

it('should be able to throw a tricky error', async ({ page }) => {
  const windowHandle = await page.evaluateHandle(() => window);
  const errorText = await windowHandle.jsonValue().catch(e => e.message);
  const error = await page.evaluate(errorText => {
    throw new Error(errorText);
  }, errorText).catch(e => e);
  expect(error.message).toContain(errorText);
});

it('should accept a string', async ({ page }) => {
  const result = await page.evaluate('1 + 2');
  expect(result).toBe(3);
});

it('should accept a string with semi colons', async ({ page }) => {
  const result = await page.evaluate('1 + 5;');
  expect(result).toBe(6);
});

it('should accept a string with comments', async ({ page }) => {
  const result = await page.evaluate('2 + 5;\n// do some math!');
  expect(result).toBe(7);
});

it('should accept element handle as an argument', async ({ page }) => {
  await page.setContent('<section>42</section>');
  const element = await page.$('section');
  const text = await page.evaluate(e => e.textContent, element);
  expect(text).toBe('42');
});

it('should throw if underlying element was disposed', async ({ page }) => {
  await page.setContent('<section>39</section>');
  const element = await page.$('section');
  expect(element).toBeTruthy();
  await element.dispose();
  let error = null;
  await page.evaluate(e => e.textContent, element).catch(e => error = e);
  expect(error.message).toContain('JSHandle is disposed');
});

it('should simulate a user gesture', async ({ page }) => {
  const result = await page.evaluate(() => {
    document.body.appendChild(document.createTextNode('test'));
    document.execCommand('selectAll');
    return document.execCommand('copy');
  });
  expect(result).toBe(true);
});

it('should throw a nice error after a navigation', async ({ page }) => {
  const errorPromise = page.evaluate(() => new Promise(f => window['__resolve'] = f)).catch(e => e) as Promise<Error>;
  await Promise.all([
    page.waitForNavigation(),
    page.evaluate(() => {
      window.location.reload();
      setTimeout(() => window['__resolve'](42), 1000);
    })
  ]);
  const error = await errorPromise;
  expect(error.message).toContain('navigation');
});

it('should not throw an error when evaluation does a navigation', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/one-style.html');
  const result = await page.evaluate(() => {
    window.location.href = '/empty.html';
    return [42];
  });
  expect(result).toEqual([42]);
});

it('should not throw an error when evaluation does a synchronous navigation and returns an object', async ({ page, server, browserName }) => {
  // It is imporant to be on about:blank for sync reload.
  const result = await page.evaluate(() => {
    window.location.reload();
    return { a: 42 };
  });
  expect(result).toEqual({ a: 42 });
});

it('should not throw an error when evaluation does a synchronous navigation and returns undefined', async ({ page }) => {
  // It is imporant to be on about:blank for sync reload.
  const result = await page.evaluate(() => {
    window.location.reload();
    return undefined;
  });
  expect(result).toBe(undefined);
});

it('should transfer 100Mb of data from page to node.js', async ({ mode, page }) => {
  it.skip(mode !== 'default');

  // This is too slow with wire.
  const a = await page.evaluate(() => Array(100 * 1024 * 1024 + 1).join('a'));
  expect(a.length).toBe(100 * 1024 * 1024);
});

it('should throw error with detailed information on exception inside promise ', async ({ page }) => {
  let error = null;
  await page.evaluate(() => new Promise(() => {
    throw new Error('Error in promise');
  })).catch(e => error = e);
  expect(error.message).toContain('Error in promise');
});

it('should work even when JSON is set to null', async ({ page }) => {
  await page.evaluate(() => { window.JSON.stringify = null; window.JSON = null; });
  const result = await page.evaluate(() => ({ abc: 123 }));
  expect(result).toEqual({ abc: 123 });
});

it('should await promise from popup', async ({ page, server }) => {
  // Something is wrong about the way Firefox waits for the chained promise
  await page.goto(server.EMPTY_PAGE);
  const result = await page.evaluate(() => {
    const win = window.open('about:blank');
    return new win['Promise'](f => f(42));
  });
  expect(result).toBe(42);
});

it('should work with new Function() and CSP', async ({ page, server }) => {
  server.setCSP('/empty.html', 'script-src ' + server.PREFIX);
  await page.goto(server.PREFIX + '/empty.html');
  expect(await page.evaluate(() => new Function('return true')())).toBe(true);
});

it('should work with non-strict expressions', async ({ page, server }) => {
  expect(await page.evaluate(() => {
    // @ts-ignore
    y = 3.14;
    // @ts-ignore
    return y;
  })).toBe(3.14);
});

it('should respect use strict expression', async ({ page }) => {
  const error = await page.evaluate(() => {
    'use strict';
    // @ts-ignore
    variableY = 3.14;
    // @ts-ignore
    return variableY;
  }).catch(e => e);
  expect(error.message).toContain('variableY');
});

it('should not leak utility script', async function({ page }) {
  expect(await page.evaluate(() => this === window)).toBe(true);
});

it('should not leak handles', async ({ page }) => {
  const error = await page.evaluate('handles.length').catch(e => e);
  expect((error as Error).message).toContain(' handles');
});

it('should work with CSP', async ({ page, server }) => {
  server.setCSP('/empty.html', `script-src 'self'`);
  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate(() => 2 + 2)).toBe(4);
});

it('should evaluate exception', async ({ page }) => {
  const error = await page.evaluate(() => {
    return (function functionOnStack() {
      return new Error('error message');
    })();
  });
  expect(error).toContain('Error: error message');
  expect(error).toContain('functionOnStack');
});

it('should evaluate exception', async ({ page }) => {
  const error = await page.evaluate(`new Error('error message')`);
  expect(error).toContain('Error: error message');
});

it('should evaluate date', async ({ page }) => {
  const result = await page.evaluate(() => ({ date: new Date('2020-05-27T01:31:38.506Z') }));
  expect(result).toEqual({ date: new Date('2020-05-27T01:31:38.506Z') });
});

it('should roundtrip date', async ({ page }) => {
  const date = new Date('2020-05-27T01:31:38.506Z');
  const result = await page.evaluate(date => date, date);
  expect(result.toUTCString()).toEqual(date.toUTCString());
});

it('should roundtrip regex', async ({ page }) => {
  const regex = /hello/im;
  const result = await page.evaluate(regex => regex, regex);
  expect(result.toString()).toEqual(regex.toString());
});

it('should jsonValue() date', async ({ page }) => {
  const resultHandle = await page.evaluateHandle(() => ({ date: new Date('2020-05-27T01:31:38.506Z') }));
  expect(await resultHandle.jsonValue()).toEqual({ date: new Date('2020-05-27T01:31:38.506Z') });
});

it('should not use toJSON when evaluating', async ({ page }) => {
  const result = await page.evaluate(() => ({ toJSON: () => 'string', data: 'data' }));
  expect(result).toEqual({ data: 'data', toJSON: {} });
});

it('should not use Array.prototype.toJSON when evaluating', async ({ page }) => {
  const result = await page.evaluate(() => {
    (Array.prototype as any).toJSON = () => 'busted';
    return [1, 2, 3];
  });
  expect(result).toEqual([1,2,3]);
});

it('should not add a toJSON property to newly created Arrays after evaluation', async ({ page, browserName }) => {
  await page.evaluate(() => []);
  const hasToJSONProperty = await page.evaluate(() => "toJSON" in []);
  expect(hasToJSONProperty).toEqual(false);
});

it('should not use toJSON in jsonValue', async ({ page }) => {
  const resultHandle = await page.evaluateHandle(() => ({ toJSON: () => 'string', data: 'data' }));
  expect(await resultHandle.jsonValue()).toEqual({ data: 'data', toJSON: {} });
});

it('should not expose the injected script export', async ({ page }) => {
  expect(await page.evaluate('typeof pwExport === "undefined"')).toBe(true);
});
