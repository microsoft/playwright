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
import { attachFrame } from '../config/utils';

it('should evaluate before anything else on the page', async ({ page, server }) => {
  await page.addInitScript(function() {
    window['injected'] = 123;
  });
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => window['result'])).toBe(123);
});

it('should work with a path', async ({ page, server, asset }) => {
  await page.addInitScript({ path: asset('injectedfile.js') });
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => window['result'])).toBe(123);
});

it('should work with content @smoke', async ({ page, server }) => {
  await page.addInitScript({ content: 'window["injected"] = 123' });
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => window['result'])).toBe(123);
});

it('should throw without path and content', async ({ page }) => {
  // @ts-expect-error foo is not a real option of addInitScript
  const error = await page.addInitScript({ foo: 'bar' }).catch(e => e);
  expect(error.message).toContain('Either path or content property must be present');
});

it('should work with trailing comments', async ({ page, asset }) => {
  await page.addInitScript({ content: '// comment' });
  await page.addInitScript({ content: 'window.secret = 42;' });
  await page.goto('data:text/html,<html></html>');
  expect(await page.evaluate('secret')).toBe(42);
});

it('should support multiple scripts', async ({ page, server }) => {
  await page.addInitScript(function() {
    window['script1'] = 1;
  });
  await page.addInitScript(function() {
    window['script2'] = 2;
  });
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => window['script1'])).toBe(1);
  expect(await page.evaluate(() => window['script2'])).toBe(2);
});

it('should work with CSP', async ({ page, server }) => {
  server.setCSP('/empty.html', 'script-src ' + server.PREFIX);
  await page.addInitScript(function() {
    window['injected'] = 123;
  });
  await page.goto(server.PREFIX + '/empty.html');
  expect(await page.evaluate(() => window['injected'])).toBe(123);

  // Make sure CSP works.
  await page.addScriptTag({ content: 'window.e = 10;' }).catch(e => void e);
  expect(await page.evaluate(() => window['e'])).toBe(undefined);
});

it('should work after a cross origin navigation', async ({ page, server }) => {
  await page.goto(server.CROSS_PROCESS_PREFIX);
  await page.addInitScript(function() {
    window['injected'] = 123;
  });
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => window['result'])).toBe(123);
});

it('should remove init script after dispose', async ({ page, server }) => {
  const disposable = await page.addInitScript(function() {
    window['injected'] = 123;
  });
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => window['result'])).toBe(123);

  await disposable.dispose();
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => window['result'])).toBe(undefined);
});

it('should remove one of multiple init scripts after dispose', async ({ page, server }) => {
  const disposable1 = await page.addInitScript(function() {
    window['script1'] = 1;
  });
  await page.addInitScript(function() {
    window['script2'] = 2;
  });
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => window['script1'])).toBe(1);
  expect(await page.evaluate(() => window['script2'])).toBe(2);

  await disposable1.dispose();
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => window['script1'])).toBe(undefined);
  expect(await page.evaluate(() => window['script2'])).toBe(2);
});

it('init script should run only once in iframe', async ({ page, server, browserName, isBidi }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/26992' });
  const messages = [];
  page.on('console', event => {
    if (event.text().startsWith('init script:'))
      messages.push(event.text());
  });
  await page.addInitScript(() => console.log('init script:', location.pathname || 'no url yet'));
  await page.goto(server.PREFIX + '/frames/one-frame.html');
  expect(messages).toEqual([
    'init script: /frames/one-frame.html',
    'init script: ' + (browserName === 'firefox' && !isBidi ? 'no url yet' : '/frames/frame.html'),
  ]);
});

it('should report data back to a node callback on every navigation', async ({ page, server }) => {
  const reports = [];
  await page.addInitScript(arg => {
    void arg.report(`${location.pathname}:${arg.tag}`);
  }, { tag: 'x', report: (message: string) => {
    reports.push(message);
  } });
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => reports).toContain('/empty.html:x');
  await page.goto(server.CROSS_PROCESS_PREFIX + '/grid.html');
  await expect.poll(() => reports).toContain('/grid.html:x');
});

it('should expose multiple callbacks anywhere in the arg', async ({ page, server }) => {
  const calls = [];
  await page.addInitScript(arg => {
    void arg.report('report:' + location.pathname);
    void arg.handlers.onLoad('nested:' + location.pathname);
  }, {
    report: (message: string) => calls.push(message),
    handlers: { onLoad: (message: string) => calls.push(message) },
  });
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => calls).toContain('report:/empty.html');
  await expect.poll(() => calls).toContain('nested:/empty.html');
});

it('should preserve non-callback values in the arg', async ({ page, server }) => {
  await page.addInitScript(arg => {
    (window as any)['__reported'] = { tag: arg.tag, when: arg.when instanceof Date };
    void arg.report();
  }, { tag: 'x', when: new Date(), report: () => {} });
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => page.evaluate(() => (window as any)['__reported'])).toEqual({ tag: 'x', when: true });
});

it('callback should work from a child frame', async ({ page, server }) => {
  const reports = [];
  await page.addInitScript(report => {
    void report(window === window.top ? 'top' : 'child');
  }, (where: string) => {
    reports.push(where);
  });
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  await expect.poll(() => [...new Set(reports)].sort()).toEqual(['child', 'top']);
});

it('in-page callback should resolve to the node callback return value', async ({ page, server }) => {
  await page.addInitScript(async report => {
    (window as any)['__reported'] = await report(21);
  }, async (value: number) => value * 2);
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => page.evaluate(() => (window as any)['__reported'])).toBe(42);
});

it('should tear down the binding on dispose', async ({ page, server }) => {
  const reports = [];
  const bindingsBefore = (page as any)._bindings.size;
  const handle = await page.addInitScript(report => {
    (window as any)['__report'] = report;
    void report(location.pathname);
  }, (pathname: string) => {
    reports.push(pathname);
  });
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => reports).toContain('/empty.html');
  expect((page as any)._bindings.size).toBe(bindingsBefore + 1);

  await handle.dispose();
  expect((page as any)._bindings.size).toBe(bindingsBefore);
  const error = await page.evaluate(async () => {
    try {
      await (window as any)['__report']('late');
      return 'no error';
    } catch (e) {
      return String(e.message || e);
    }
  });
  expect(error).toContain('has been removed');

  await page.goto(server.PREFIX + '/grid.html');
  expect(await page.evaluate(() => typeof (window as any)['__report'])).toBe('undefined');
  expect(reports).not.toContain('/grid.html');
});

it('should support multiple independent callbacks disposed independently', async ({ page, server }) => {
  const a = [];
  const b = [];
  const handleA = await page.addInitScript(report => {
    void report('a:' + location.pathname);
  }, (message: string) => {
    a.push(message);
  });
  await page.addInitScript(report => {
    void report('b:' + location.pathname);
  }, (message: string) => {
    b.push(message);
  });
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => a).toContain('a:/empty.html');
  await expect.poll(() => b).toContain('b:/empty.html');

  await handleA.dispose();
  await page.goto(server.PREFIX + '/grid.html');
  await expect.poll(() => b).toContain('b:/grid.html');
  expect(a).not.toContain('a:/grid.html');
});

it('should not register the callback on the global object', async ({ page, server }) => {
  await page.addInitScript(report => {
    void report();
  }, () => {});
  await page.goto(server.EMPTY_PAGE);
  const globals = await page.evaluate(() => Object.getOwnPropertyNames(globalThis).filter(name => name.startsWith('__pw_fn_')));
  expect(globals).toEqual([]);
});
