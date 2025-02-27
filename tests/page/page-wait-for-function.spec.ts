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

import { attachFrame, detachFrame } from '../config/utils';
import { test as it, expect } from './pageTest';

it('should timeout', async ({ page }) => {
  const startTime = Date.now();
  const timeout = 42;
  await page.waitForTimeout(timeout);
  expect(Date.now() - startTime).not.toBeLessThan(timeout / 2);
});

it('should accept a string', async ({ page }) => {
  const watchdog = page.waitForFunction('window.__FOO === 1');
  await page.evaluate(() => window['__FOO'] = 1);
  await watchdog;
});

it('should work when resolved right before execution context disposal', async ({ page }) => {
  await page.addInitScript(() => window['__RELOADED'] = true);
  await page.waitForFunction(() => {
    if (!window['__RELOADED'])
      window.location.reload();
    return true;
  });
});

it('should poll on interval', async ({ page, server }) => {
  const polling = 100;
  const timeDelta = await page.waitForFunction(() => {
    if (!window['__startTime']) {
      window['__startTime'] = window.builtins.Date.now();
      return false;
    }
    return window.builtins.Date.now() - window['__startTime'];
  }, {}, { polling });
  expect(await timeDelta.jsonValue()).not.toBeLessThan(polling);
});

it('should avoid side effects after timeout', async ({ page }) => {
  let counter = 0;
  page.on('console', () => ++counter);

  const error = await page.waitForFunction(() => {
    window['counter'] = (window['counter'] || 0) + 1;
    console.log(window['counter']);
  }, {}, { polling: 1, timeout: 1000 }).catch(e => e);

  const savedCounter = counter;
  await page.waitForTimeout(2000); // Give it some time to produce more logs.

  expect(error.message).toContain('page.waitForFunction: Timeout 1000ms exceeded');
  expect(counter).toBe(savedCounter);
});

it('should throw on polling:mutation', async ({ page }) => {
  // @ts-expect-error mutation is not a valid polling strategy
  const error = await page.waitForFunction(() => true, {}, { polling: 'mutation' }).catch(e => e);
  expect(error.message).toContain('Unknown polling option: mutation');
});

it('should poll on raf', async ({ page }) => {
  const watchdog = page.waitForFunction(() => window['__FOO'] === 'hit', {}, { polling: 'raf' });
  await page.evaluate(() => window['__FOO'] = 'hit');
  await watchdog;
});

it('should fail with predicate throwing on first call', async ({ page }) => {
  const error = await page.waitForFunction(() => { throw new Error('oh my'); }).catch(e => e);
  expect(error.message).toContain('oh my');
});

it('should fail with predicate throwing sometimes', async ({ page }) => {
  const error = await page.waitForFunction(() => {
    window['counter'] = (window['counter'] || 0) + 1;
    if (window['counter'] === 3)
      throw new Error('Bad counter!');
    return window['counter'] === 5 ? 'result' : false;
  }).catch(e => e);
  expect(error.message).toContain('Bad counter!');
});

it('should fail with ReferenceError on wrong page', async ({ page }) => {
  // @ts-ignore
  const error = await page.waitForFunction(() => globalVar === 123).catch(e => e);
  expect(error.message).toContain('globalVar');
});

it('should work with strict CSP policy', async ({ page, server }) => {
  server.setCSP('/empty.html', 'script-src ' + server.PREFIX);
  await page.goto(server.EMPTY_PAGE);
  let error = null;
  await Promise.all([
    page.waitForFunction(() => window['__FOO'] === 'hit', {}, { polling: 'raf' }).catch(e => error = e),
    page.evaluate(() => window['__FOO'] = 'hit')
  ]);
  expect(error).toBe(null);
});

it('should throw on bad polling value', async ({ page }) => {
  let error = null;
  try {
    // @ts-expect-error 'unknown' is not a valid polling strategy
    await page.waitForFunction(() => !!document.body, {}, { polling: 'unknown' });
  } catch (e) {
    error = e;
  }
  expect(error).toBeTruthy();
  expect(error.message).toContain('polling');
});

it('should throw negative polling interval', async ({ page }) => {
  let error = null;
  try {
    await page.waitForFunction(() => !!document.body, {}, { polling: -10 });
  } catch (e) {
    error = e;
  }
  expect(error).toBeTruthy();
  expect(error.message).toContain('Cannot poll with non-positive interval');
});

it('should return the success value as a JSHandle', async ({ page }) => {
  expect(await (await page.waitForFunction(() => 5)).jsonValue()).toBe(5);
});

it('should return the window as a success value', async ({ page }) => {
  expect(await page.waitForFunction(() => window)).toBeTruthy();
});

it('should accept ElementHandle arguments', async ({ page }) => {
  await page.setContent('<div></div>');
  const div = await page.$('div');
  let resolved = false;
  const waitForFunction = page.waitForFunction(element => !element.parentElement, div).then(() => resolved = true);
  expect(resolved).toBe(false);
  await page.evaluate(element => element.remove(), div);
  await waitForFunction;
});

it('should respect timeout', async ({ page, playwright }) => {
  let error = null;
  await page.waitForFunction('false', {}, { timeout: 10 }).catch(e => error = e);
  expect(error).toBeTruthy();
  expect(error.message).toContain('page.waitForFunction: Timeout 10ms exceeded');
  expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
});

it('should respect default timeout', async ({ page, playwright }) => {
  page.setDefaultTimeout(1);
  let error = null;
  await page.waitForFunction('false').catch(e => error = e);
  expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
  expect(error.message).toContain('page.waitForFunction: Timeout 1ms exceeded');
});

it('should disable timeout when its set to 0', async ({ page }) => {
  const watchdog = page.waitForFunction(() => {
    window['__counter'] = (window['__counter'] || 0) + 1;
    return window['__injected'];
  }, {}, { timeout: 0, polling: 10 });
  await page.waitForFunction(() => window['__counter'] > 10);
  await page.evaluate(() => window['__injected'] = true);
  await watchdog;
});

it('should survive cross-process navigation', async ({ page, server }) => {
  let fooFound = false;
  const waitForFunction = page.waitForFunction('window.__FOO === 1').then(() => fooFound = true);
  await page.goto(server.EMPTY_PAGE);
  expect(fooFound).toBe(false);
  await page.reload();
  expect(fooFound).toBe(false);
  await page.goto(server.CROSS_PROCESS_PREFIX + '/grid.html');
  expect(fooFound).toBe(false);
  await page.evaluate(() => window['__FOO'] = 1);
  await waitForFunction;
  expect(fooFound).toBe(true);
});

it('should survive navigations', async ({ page, server }) => {
  const watchdog = page.waitForFunction(() => window['__done']);
  await page.goto(server.EMPTY_PAGE);
  await page.goto(server.PREFIX + '/consolelog.html');
  await page.evaluate(() => window['__done'] = true);
  await watchdog;
});

it('should work with multiline body', async ({ page }) => {
  const result = await page.waitForFunction(`
    (() => true)()
  `);
  expect(await result.jsonValue()).toBe(true);
});

it('should wait for predicate with arguments', async ({ page }) => {
  await page.waitForFunction(({ arg1, arg2 }) => arg1 + arg2 === 3, { arg1: 1, arg2: 2 });
});

it('should not be called after finishing successfully', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);

  const messages = [];
  page.on('console', msg => {
    if (msg.text().startsWith('waitForFunction'))
      messages.push(msg.text());
  });

  await page.waitForFunction(() => {
    console.log('waitForFunction1');
    return true;
  });
  await page.reload();
  await page.waitForFunction(() => {
    console.log('waitForFunction2');
    return true;
  });
  await page.reload();
  await page.waitForFunction(() => {
    console.log('waitForFunction3');
    return true;
  });

  expect(messages.join('|')).toBe('waitForFunction1|waitForFunction2|waitForFunction3');
});

it('should not be called after finishing unsuccessfully', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);

  const messages = [];
  page.on('console', msg => {
    if (msg.text().startsWith('waitForFunction'))
      messages.push(msg.text());
  });

  await page.waitForFunction(() => {
    console.log('waitForFunction1');
    throw new Error('waitForFunction1');
  }).catch(e => null);
  await page.reload();
  await page.waitForFunction(() => {
    console.log('waitForFunction2');
    throw new Error('waitForFunction2');
  }).catch(e => null);
  await page.reload();
  await page.waitForFunction(() => {
    console.log('waitForFunction3');
    throw new Error('waitForFunction3');
  }).catch(e => null);

  expect(messages.join('|')).toBe('waitForFunction1|waitForFunction2|waitForFunction3');
});

it('should throw when frame is detached', async ({ page, server }) => {
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  const frame = page.frames()[1];
  const promise = frame.waitForFunction(() => false).catch(e => e);
  await detachFrame(page, 'frame1');
  const error = await promise;
  expect(error).toBeTruthy();
  expect(error.message).toMatch(/frame.waitForFunction: (Frame was detached|Execution context was destroyed)/);
});
