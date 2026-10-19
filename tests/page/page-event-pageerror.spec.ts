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

it('ER-001 should fire', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43450' },
}, async ({ page, server, browserName, isBidi, isAndroid }) => {
  const url = server.PREFIX + '/error.html';
  const [error] = await Promise.all([
    page.waitForEvent('pageerror'),
    page.goto(url),
  ]);
  expect(error.name).toBe('Error');
  expect(error.message).toBe('Fancy error!');
  if (browserName === 'chromium' || (browserName === 'firefox' && isBidi)) {
    expect(error.stack).toBe(`Error: Fancy error!
    at c (myscript.js:14:11)
    at b (myscript.js:10:5)
    at a (myscript.js:6:5)
    at myscript.js:3:1`);
  } else if (browserName === 'webkit') {
    expect(error.stack).toBe(`Error: Fancy error!
    at c (${url}:14:36)
    at b (${url}:10:6)
    at a (${url}:6:6)
    at global code (${url}:3:2)`);
  } else if (browserName === 'firefox') {
    expect(error.stack).toBe(`Error: Fancy error!
    at c (myscript.js:14:11)
    at b (myscript.js:10:5)
    at a (myscript.js:6:5)
    at  (myscript.js:3:1)`);
  }

  // The same script from another origin: desktop Chromium reports it without an exception object,
  // so the stack is built from the CDP call frames, which are zero-based.
  const crossOriginUrl = server.CROSS_PROCESS_PREFIX + '/error.js';
  server.setRoute('/error.js', (req, res) => {
    res.setHeader('Content-Type', 'text/javascript');
    // Same lines as error.html, so the stack has the same locations.
    res.end(`
console.error('Not a JS error');
a();

function a() {
    b();
}

function b() {
    c();
}

function c() {
    throw new Error('Fancy error!');
}
`);
  });
  server.setRoute('/cross-origin-error.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<script src="${crossOriginUrl}"></script>`);
  });
  const [crossOriginError] = await Promise.all([
    page.waitForEvent('pageerror'),
    page.goto(server.PREFIX + '/cross-origin-error.html'),
  ]);
  expect(crossOriginError.message).toBe('Fancy error!');
  if (browserName === 'chromium') {
    const errorPrefix = isAndroid ? 'Error:' : 'Uncaught Error:';
    const anonymousFrame = isAndroid ? `${crossOriginUrl}:3:1` : `<anonymous> (${crossOriginUrl}:3:1)`;
    expect(crossOriginError.stack).toBe(`${errorPrefix} Fancy error!
    at c (${crossOriginUrl}:14:11)
    at b (${crossOriginUrl}:10:5)
    at a (${crossOriginUrl}:6:5)
    at ${anonymousFrame}`);
  } else if (browserName === 'webkit') {
    expect(crossOriginError.stack).toBe(`Error: Fancy error!
    at c (${crossOriginUrl}:14:36)
    at b (${crossOriginUrl}:10:6)
    at a (${crossOriginUrl}:6:6)
    at global code (${crossOriginUrl}:3:2)`);
  } else if (browserName === 'firefox' && !isBidi) {
    expect(crossOriginError.stack).toBe(`Error: Fancy error!
    at c (${crossOriginUrl}:14:11)
    at b (${crossOriginUrl}:10:5)
    at a (${crossOriginUrl}:6:5)
    at  (${crossOriginUrl}:3:1)`);
  }
});

it('ER-002 should not receive console message for pageError', async ({ page, server }) => {
  const messages = [];
  page.on('console', e => messages.push(e));
  await Promise.all([
    page.waitForEvent('pageerror'),
    page.goto(server.PREFIX + '/error.html'),
  ]);
  expect(messages.length).toBe(1);
});

it('ER-003 should contain sourceURL', async ({ page, server, browserName }) => {
  it.fail(browserName === 'webkit');

  const [error] = await Promise.all([
    page.waitForEvent('pageerror'),
    page.goto(server.PREFIX + '/error.html'),
  ]);
  expect(error.stack).toContain('myscript.js');
});

it('ER-004 should contain the Error.name property', async ({ page }) => {
  const [error] = await Promise.all([
    page.waitForEvent('pageerror'),
    page.evaluate(() => {
      window.builtins.setTimeout(() => {
        const error = new Error('my-message');
        error.name = 'my-name';
        throw error;
      }, 0);
    })
  ]);
  expect(error.name).toBe('my-name');
  expect(error.message).toBe('my-message');
});

it('ER-005 should support an empty Error.name property', async ({ page }) => {
  const [error] = await Promise.all([
    page.waitForEvent('pageerror'),
    page.evaluate(() => {
      window.builtins.setTimeout(() => {
        const error = new Error('my-message');
        error.name = '';
        throw error;
      }, 0);
    })
  ]);
  expect(error.name).toBe('');
  expect(error.message).toBe('my-message');
});

it('ER-006 should handle odd values', async ({ page }) => {
  const cases = [
    [null, 'null'],
    [undefined, 'undefined'],
    [0, '0'],
    ['', ''],
  ];
  for (const [value, message] of cases) {
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.evaluate(value => {
        window.builtins.setTimeout(() => { throw value; }, 0);
      }, value),
    ]);
    expect(error.message).toBe(message);
  }
});

it('ER-007 should handle object', async ({ page, browserName }) => {
  const [error] = await Promise.all([
    page.waitForEvent('pageerror'),
    page.evaluate(() => {
      window.builtins.setTimeout(() => { throw {}; }, 0);
    }),
  ]);
  expect(error.message).toBe(browserName === 'chromium' ? 'Object' : '[object Object]');
});

it('ER-008 should handle window', async ({ page, browserName }) => {
  const [error] = await Promise.all([
    page.waitForEvent('pageerror'),
    page.evaluate(() => {
      window.builtins.setTimeout(() => { throw window; }, 0);
    }),
  ]);
  expect(error.message).toBe(browserName === 'chromium' ? 'Window' : '[object Window]');
});

it('ER-009 should remove a listener of a non-existing event handler', async ({ page }) => {
  page.removeListener('pageerror', () => {});
});

it('ER-010 should emit error from unhandled rejects', async ({ page, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/14165' });
  const [error] = await Promise.all([
    page.waitForEvent('pageerror'),
    page.setContent(`
        <script>
          Promise.reject(new Error('sad :('));
        </script>
    `),
  ]);
  expect(error.message).toContain('sad :(');
});

it('ER-011 pageErrors should work', async ({ page }) => {
  await page.evaluate(async () => {
    for (let i = 0; i < 301; i++)
      window.builtins.setTimeout(() => { throw new Error('error' + i); }, 0);
    await new Promise(f => window.builtins.setTimeout(f, 2000));
  });

  const errors = await page.pageErrors();
  const messages = errors.map(e => e.message);

  const expected = [];
  for (let i = 201; i < 301; i++)
    expected.push('error' + i);

  expect(messages.length, 'should be at least 100 errors').toBeGreaterThanOrEqual(100);
  expect(messages.slice(messages.length - expected.length), 'should return last errors').toEqual(expected);
});

it('ER-012 clearPageErrors should work', async ({ page }) => {
  await page.evaluate(() => {
    window.builtins.setTimeout(() => { throw new Error('error1'); }, 0);
    window.builtins.setTimeout(() => { throw new Error('error2'); }, 0);
  });
  await page.waitForTimeout(1000);

  let errors = await page.pageErrors();
  expect(errors.map(e => e.message)).toContain('error1');
  expect(errors.map(e => e.message)).toContain('error2');

  await page.clearPageErrors();

  errors = await page.pageErrors();
  expect(errors).toEqual([]);

  await page.evaluate(() => {
    window.builtins.setTimeout(() => { throw new Error('error3'); }, 0);
  });
  await page.waitForTimeout(1000);

  errors = await page.pageErrors();
  expect(errors.length).toBe(1);
  expect(errors[0].message).toContain('error3');
});

it('ER-013 should fire illegal character error', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/38388' },
}, async ({ page, server, browserName, isWindows, channel }) => {
  server.setRoute('/error.html', (req, res) => {
    res.end(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>vite-project</title>
        </head>
        <body>
          <div id="app"></div>
          <script >
            let a=10；//   !!!note: ； not ;
          </script>
        </body>
      </html>
    `);
  });
  const url = server.PREFIX + '/error.html';
  const [error] = await Promise.all([
    page.waitForEvent('pageerror'),
    page.goto(url),
  ]);
  if (browserName === 'chromium')
    expect(error.message).toContain('Invalid or unexpected token');
  else if (browserName === 'webkit' && isWindows && channel !== 'webkit-wsl')
    expect(error.message).toContain('No identifiers allowed directly after numeric literal');
  else if (browserName === 'webkit')
    expect(error.message).toContain('Invalid character');
  else
    expect(error.message).toContain('illegal character');
});
