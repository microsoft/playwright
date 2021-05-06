/**
 * Copyright 2017 Google Inc. All rights reserved.
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
import { attachFrame } from '../config/utils';
import type { ElementHandle } from '../../index';

it('exposeBinding should work', async ({page}) => {
  let bindingSource;
  await page.exposeBinding('add', (source, a, b) => {
    bindingSource = source;
    return a + b;
  });
  const result = await page.evaluate(async function() {
    return window['add'](5, 6);
  });
  expect(bindingSource.context).toBe(page.context());
  expect(bindingSource.page).toBe(page);
  expect(bindingSource.frame).toBe(page.mainFrame());
  expect(result).toEqual(11);
});

it('should work', async ({page, server}) => {
  await page.exposeFunction('compute', function(a, b) {
    return a * b;
  });
  const result = await page.evaluate(async function() {
    return await window['compute'](9, 4);
  });
  expect(result).toBe(36);
});

it('should work with handles and complex objects', async ({page, server}) => {
  const fooHandle = await page.evaluateHandle(() => {
    window['fooValue'] = { bar: 2 };
    return window['fooValue'];
  });
  await page.exposeFunction('handle', () => {
    return [{ foo: fooHandle }];
  });
  const equals = await page.evaluate(async function() {
    const value = await window['handle']();
    const [{ foo }] = value;
    return foo === window['fooValue'];
  });
  expect(equals).toBe(true);
});

it('should throw exception in page context', async ({page, server}) => {
  await page.exposeFunction('woof', function() {
    throw new Error('WOOF WOOF');
  });
  const {message, stack} = await page.evaluate(async () => {
    try {
      await window['woof']();
    } catch (e) {
      return {message: e.message, stack: e.stack};
    }
  });
  expect(message).toBe('WOOF WOOF');
  expect(stack).toContain(__filename);
});

it('should support throwing "null"', async ({page, server}) => {
  await page.exposeFunction('woof', function() {
    throw null;
  });
  const thrown = await page.evaluate(async () => {
    try {
      await window['woof']();
    } catch (e) {
      return e;
    }
  });
  expect(thrown).toBe(null);
});

it('should be callable from-inside addInitScript', async ({page, server}) => {
  let called = false;
  await page.exposeFunction('woof', function() {
    called = true;
  });
  await page.addInitScript(() => window['woof']());
  await page.reload();
  expect(called).toBe(true);
});

it('should survive navigation', async ({page, server}) => {
  await page.exposeFunction('compute', function(a, b) {
    return a * b;
  });

  await page.goto(server.EMPTY_PAGE);
  const result = await page.evaluate(async function() {
    return await window['compute'](9, 4);
  });
  expect(result).toBe(36);
});

it('should await returned promise', async ({page, server}) => {
  await page.exposeFunction('compute', function(a, b) {
    return Promise.resolve(a * b);
  });

  const result = await page.evaluate(async function() {
    return await window['compute'](3, 5);
  });
  expect(result).toBe(15);
});

it('should work on frames', async ({page, server}) => {
  await page.exposeFunction('compute', function(a, b) {
    return Promise.resolve(a * b);
  });

  await page.goto(server.PREFIX + '/frames/nested-frames.html');
  const frame = page.frames()[1];
  const result = await frame.evaluate(async function() {
    return await window['compute'](3, 5);
  });
  expect(result).toBe(15);
});

it('should work on frames before navigation', async ({page, server}) => {
  await page.goto(server.PREFIX + '/frames/nested-frames.html');
  await page.exposeFunction('compute', function(a, b) {
    return Promise.resolve(a * b);
  });

  const frame = page.frames()[1];
  const result = await frame.evaluate(async function() {
    return await window['compute'](3, 5);
  });
  expect(result).toBe(15);
});

it('should work after cross origin navigation', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  await page.exposeFunction('compute', function(a, b) {
    return a * b;
  });

  await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
  const result = await page.evaluate(async function() {
    return await window['compute'](9, 4);
  });
  expect(result).toBe(36);
});

it('should work with complex objects', async ({page, server}) => {
  await page.exposeFunction('complexObject', function(a, b) {
    return {x: a.x + b.x};
  });
  const result = await page.evaluate(async () => window['complexObject']({x: 5}, {x: 2}));
  expect(result.x).toBe(7);
});

it('exposeBindingHandle should work', async ({page}) => {
  let target;
  await page.exposeBinding('logme', (source, t) => {
    target = t;
    return 17;
  }, { handle: true });
  const result = await page.evaluate(async function() {
    return window['logme']({ foo: 42 });
  });
  expect(await target.evaluate(x => x.foo)).toBe(42);
  expect(result).toEqual(17);
});

it('exposeBindingHandle should not throw during navigation', async ({page, server}) => {
  await page.exposeBinding('logme', (source, t) => {
    return 17;
  }, { handle: true });
  await page.goto(server.EMPTY_PAGE);
  await Promise.all([
    page.evaluate(async url => {
      window['logme']({ foo: 42 });
      window.location.href = url;
    }, server.PREFIX + '/one-style.html'),
    page.waitForNavigation({ waitUntil: 'load' }),
  ]);
});

it('should throw for duplicate registrations', async ({page}) => {
  await page.exposeFunction('foo', () => {});
  const error = await page.exposeFunction('foo', () => {}).catch(e => e);
  expect(error.message).toContain('page.exposeFunction: Function "foo" has been already registered');
});

it('exposeBindingHandle should throw for multiple arguments', async ({page}) => {
  await page.exposeBinding('logme', (source, t) => {
    return 17;
  }, { handle: true });
  expect(await page.evaluate(async function() {
    return window['logme']({ foo: 42 });
  })).toBe(17);
  expect(await page.evaluate(async function() {
    return window['logme']({ foo: 42 }, undefined, undefined);
  })).toBe(17);
  expect(await page.evaluate(async function() {
    return window['logme'](undefined, undefined, undefined);
  })).toBe(17);

  const error = await page.evaluate(async function() {
    return window['logme'](1, 2);
  }).catch(e => e);
  expect(error.message).toContain('exposeBindingHandle supports a single argument, 2 received');
});

it('should not result in unhandled rejection', async ({page, isAndroid}) => {
  it.fixme(isAndroid);

  const closedPromise = page.waitForEvent('close');
  await page.exposeFunction('foo', async () => {
    await page.close();
  });
  await page.evaluate(() => {
    setTimeout(() => (window as any).foo(), 0);
    return undefined;
  });
  await closedPromise;
  // Make a round-trip to be sure we did not throw immediately after closing.
  expect(await page.evaluate('1 + 1').catch(e => e)).toBeInstanceOf(Error);
});

it('should work with internal bindings', async ({page, toImpl, server, mode, browserName, isElectron, isAndroid}) => {
  it.skip(mode !== 'default');
  it.skip(browserName !== 'chromium');
  it.skip(isAndroid);
  it.skip(isElectron);

  const implPage: import('../../src/server/page').Page = toImpl(page);
  let foo;
  await implPage.exposeBinding('foo', false, ({}, arg) => {
    foo = arg;
  }, 'utility');
  expect(await page.evaluate('!!window.foo')).toBe(false);
  expect(await implPage.mainFrame().evaluateExpression('!!window.foo', false, {}, 'utility')).toBe(true);
  expect(foo).toBe(undefined);
  await implPage.mainFrame().evaluateExpression('window.foo(123)', false, {}, 'utility');
  expect(foo).toBe(123);

  // should work after reload
  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate('!!window.foo')).toBe(false);
  await implPage.mainFrame().evaluateExpression('window.foo(456)', false, {}, 'utility');
  expect(foo).toBe(456);

  // should work inside frames
  const frame = await attachFrame(page, 'myframe', server.CROSS_PROCESS_PREFIX + '/empty.html');
  expect(await frame.evaluate('!!window.foo')).toBe(false);
  const implFrame: import('../../src/server/frames').Frame = toImpl(frame);
  await implFrame.evaluateExpression('window.foo(789)', false, {}, 'utility');
  expect(foo).toBe(789);
});

it('exposeBinding(handle) should work with element handles', async ({ page}) => {
  let cb;
  const promise = new Promise(f => cb = f);
  await page.exposeBinding('clicked', async (source, element: ElementHandle) => {
    cb(await element.innerText().catch(e => e));
  }, { handle: true });
  await page.goto('about:blank');
  await page.setContent(`
    <script>
      document.addEventListener('click', event => window.clicked(event.target));
    </script>
    <div id="a1">Click me</div>
  `);
  await page.click('#a1');
  expect(await promise).toBe('Click me');
});

it('should work with setContent', async ({page, server}) => {
  await page.exposeFunction('compute', function(a, b) {
    return Promise.resolve(a * b);
  });
  await page.setContent('<script>window.result = compute(3, 2)</script>');
  expect(await page.evaluate('window.result')).toBe(6);
});
