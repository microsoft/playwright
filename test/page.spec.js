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

const path = require('path');
const vm = require('vm');
const {FFOX, CHROMIUM, WEBKIT} = require('./utils').testOptions(browserType);

describe('Page.close', function() {
  it('should reject all promises when page is closed', async({context}) => {
    const newPage = await context.newPage();
    let error = null;
    await Promise.all([
      newPage.evaluate(() => new Promise(r => {})).catch(e => error = e),
      newPage.close(),
    ]);
    expect(error.message).toContain('Protocol error');
  });
  it('should not be visible in context.pages', async({context}) => {
    const newPage = await context.newPage();
    expect(context.pages()).toContain(newPage);
    await newPage.close();
    expect(context.pages()).not.toContain(newPage);
  });
  it('should run beforeunload if asked for', async({context, server}) => {
    const newPage = await context.newPage();
    await newPage.goto(server.PREFIX + '/beforeunload.html');
    // We have to interact with a page so that 'beforeunload' handlers
    // fire.
    await newPage.click('body');
    const pageClosingPromise = newPage.close({ runBeforeUnload: true });
    const dialog = await newPage.waitForEvent('dialog');
    expect(dialog.type()).toBe('beforeunload');
    expect(dialog.defaultValue()).toBe('');
    if (CHROMIUM)
      expect(dialog.message()).toBe('');
    else if (WEBKIT)
      expect(dialog.message()).toBe('Leave?');
    else
      expect(dialog.message()).toBe('This page is asking you to confirm that you want to leave - data you have entered may not be saved.');
    await dialog.accept();
    await pageClosingPromise;
  });
  it('should *not* run beforeunload by default', async({context, server}) => {
    const newPage = await context.newPage();
    await newPage.goto(server.PREFIX + '/beforeunload.html');
    // We have to interact with a page so that 'beforeunload' handlers
    // fire.
    await newPage.click('body');
    await newPage.close();
  });
  it('should set the page close state', async({context}) => {
    const newPage = await context.newPage();
    expect(newPage.isClosed()).toBe(false);
    await newPage.close();
    expect(newPage.isClosed()).toBe(true);
  });
  it('should terminate network waiters', async({context, server}) => {
    const newPage = await context.newPage();
    const results = await Promise.all([
      newPage.waitForRequest(server.EMPTY_PAGE).catch(e => e),
      newPage.waitForResponse(server.EMPTY_PAGE).catch(e => e),
      newPage.close()
    ]);
    for (let i = 0; i < 2; i++) {
      const message = results[i].message;
      expect(message).toContain('Target closed');
      expect(message).not.toContain('Timeout');
    }
  });
});

describe('Page.Events.Load', function() {
  it('should fire when expected', async({page, server}) => {
    await Promise.all([
      page.goto('about:blank'),
      page.waitForEvent('load'),
    ]);
  });
});

describe('Async stacks', () => {
  it('should work', async({page, server}) => {
    server.setRoute('/empty.html', (req, res) => {
      req.socket.end();
    });
    let error = null;
    await page.goto(server.EMPTY_PAGE).catch(e => error = e);
    expect(error).not.toBe(null);
    expect(error.stack).toContain(__filename);
  });
});

describe('Page.Events.Crash', function() {
  function crash(page) {
    if (CHROMIUM)
      page.goto('chrome://crash').catch(e => {});
    else if (WEBKIT)
      page._delegate._session.send('Page.crash', {}).catch(e => {});
    else if (FFOX)
      page._delegate._session.send('Page.crash', {}).catch(e => {});
  }

  it('should emit crash event when page crashes', async({page}) => {
    await page.setContent(`<div>This page should crash</div>`);
    crash(page);
    await new Promise(f => page.on('crash', f));
  });
  it('should throw on any action after page crashes', async({page}) => {
    await page.setContent(`<div>This page should crash</div>`);
    crash(page);
    await page.waitForEvent('crash');
    const err = await page.evaluate(() => {}).then(() => null, e => e);
    expect(err).toBeTruthy();
    expect(err.message).toContain('crash');
  });
});

describe('Page.opener', function() {
  it('should provide access to the opener page', async({page}) => {
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => window.open('about:blank')),
    ]);
    const opener = await popup.opener();
    expect(opener).toBe(page);
  });
  it('should return null if parent page has been closed', async({page}) => {
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => window.open('about:blank')),
    ]);
    await page.close();
    const opener = await popup.opener();
    expect(opener).toBe(null);
  });
});

describe('Page.Events.Console', function() {
  it('should work', async({page, server}) => {
    let message = null;
    page.once('console', m => message = m);
    await Promise.all([
      page.evaluate(() => console.log('hello', 5, {foo: 'bar'})),
      page.waitForEvent('console')
    ]);
    expect(message.text()).toEqual('hello 5 JSHandle@object');
    expect(message.type()).toEqual('log');
    expect(await message.args()[0].jsonValue()).toEqual('hello');
    expect(await message.args()[1].jsonValue()).toEqual(5);
    expect(await message.args()[2].jsonValue()).toEqual({foo: 'bar'});
  });
  it('should emit same log twice', async({page, server}) => {
    const messages = [];
    page.on('console', m => messages.push(m.text()));
    await page.evaluate(() => { for (let i = 0; i < 2; ++i ) console.log('hello'); } );
    expect(messages).toEqual(['hello', 'hello']);
  });
  it('should work for different console API calls', async({page, server}) => {
    const messages = [];
    page.on('console', msg => messages.push(msg));
    // All console events will be reported before `page.evaluate` is finished.
    await page.evaluate(() => {
      // A pair of time/timeEnd generates only one Console API call.
      console.time('calling console.time');
      console.timeEnd('calling console.time');
      console.trace('calling console.trace');
      console.dir('calling console.dir');
      console.warn('calling console.warn');
      console.error('calling console.error');
      console.log(Promise.resolve('should not wait until resolved!'));
    });
    expect(messages.map(msg => msg.type())).toEqual([
      'timeEnd', 'trace', 'dir', 'warning', 'error', 'log'
    ]);
    expect(messages[0].text()).toContain('calling console.time');
    expect(messages.slice(1).map(msg => msg.text())).toEqual([
      'calling console.trace',
      'calling console.dir',
      'calling console.warn',
      'calling console.error',
      'JSHandle@promise',
    ]);
  });
  it('should not fail for window object', async({page, server}) => {
    let message = null;
    page.once('console', msg => message = msg);
    await Promise.all([
      page.evaluate(() => console.error(window)),
      page.waitForEvent('console')
    ]);
    expect(message.text()).toBe('JSHandle@object');
  });
  it('should trigger correct Log', async({page, server}) => {
    await page.goto('about:blank');
    const [message] = await Promise.all([
      page.waitForEvent('console'),
      page.evaluate(async url => fetch(url).catch(e => {}), server.EMPTY_PAGE)
    ]);
    expect(message.text()).toContain('Access-Control-Allow-Origin');
    expect(message.type()).toEqual('error');
  });
  it('should have location for console API calls', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const [message] = await Promise.all([
      page.waitForEvent('console'),
      page.goto(server.PREFIX + '/consolelog.html'),
    ]);
    expect(message.text()).toBe('yellow');
    expect(message.type()).toBe('log');
    const location = message.location();
    // Engines have different column notion.
    delete location.columnNumber;
    expect(location).toEqual({
      url: server.PREFIX + '/consolelog.html',
      lineNumber: 7,
    });
  });
  // @see https://github.com/GoogleChrome/puppeteer/issues/3865
  it('should not throw when there are console messages in detached iframes', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(async() => {
        // 1. Create a popup that Playwright is not connected to.
        const win = window.open('');
        window._popup = win;
        if (window.document.readyState !== 'complete')
          await new Promise(f => window.addEventListener('load', f));
        // 2. In this popup, create an iframe that console.logs a message.
        win.document.body.innerHTML = `<iframe src='/consolelog.html'></iframe>`;
        const frame = win.document.querySelector('iframe');
        if (!frame.contentDocument || frame.contentDocument.readyState !== 'complete')
          await new Promise(f => frame.addEventListener('load', f));
        // 3. After that, remove the iframe.
        frame.remove();
      }),
    ]);
    // 4. Connect to the popup and make sure it doesn't throw.
    expect(await popup.evaluate('1 + 1')).toBe(2);
  });
});

describe('Page.Events.DOMContentLoaded', function() {
  it('should fire when expected', async({page, server}) => {
    const navigatedPromise = page.goto('about:blank');
    await page.waitForEvent('domcontentloaded');
    await navigatedPromise;
  });
});

describe('Page.waitForRequest', function() {
  it('should work', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const [request] = await Promise.all([
      page.waitForRequest(server.PREFIX + '/digits/2.png'),
      page.evaluate(() => {
        fetch('/digits/1.png');
        fetch('/digits/2.png');
        fetch('/digits/3.png');
      })
    ]);
    expect(request.url()).toBe(server.PREFIX + '/digits/2.png');
  });
  it('should work with predicate', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const [request] = await Promise.all([
      page.waitForEvent('request', request => request.url() === server.PREFIX + '/digits/2.png'),
      page.evaluate(() => {
        fetch('/digits/1.png');
        fetch('/digits/2.png');
        fetch('/digits/3.png');
      })
    ]);
    expect(request.url()).toBe(server.PREFIX + '/digits/2.png');
  });
  it('should respect timeout', async({page, server}) => {
    let error = null;
    await page.waitForEvent('request', { predicate: () => false, timeout: 1 }).catch(e => error = e);
    expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
  });
  it('should respect default timeout', async({page, server}) => {
    let error = null;
    page.setDefaultTimeout(1);
    await page.waitForEvent('request', () => false).catch(e => error = e);
    expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
  });
  it('should work with no timeout', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const [request] = await Promise.all([
      page.waitForRequest(server.PREFIX + '/digits/2.png', {timeout: 0}),
      page.evaluate(() => setTimeout(() => {
        fetch('/digits/1.png');
        fetch('/digits/2.png');
        fetch('/digits/3.png');
      }, 50))
    ]);
    expect(request.url()).toBe(server.PREFIX + '/digits/2.png');
  });
  it('should work with url match', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const [request] = await Promise.all([
      page.waitForRequest(/digits\/\d\.png/),
      page.evaluate(() => {
        fetch('/digits/1.png');
      })
    ]);
    expect(request.url()).toBe(server.PREFIX + '/digits/1.png');
  });
  it('should work with url match regular expression from a different context', async({page, server}) => {
    const ctx = vm.createContext();
    const regexp = vm.runInContext('new RegExp(/digits\\/\\d\\.png/)', ctx);

    await page.goto(server.EMPTY_PAGE);
    const [request] = await Promise.all([
      page.waitForRequest(regexp),
      page.evaluate(() => {
        fetch('/digits/1.png');
      })
    ]);
    expect(request.url()).toBe(server.PREFIX + '/digits/1.png');
  });
});

describe('Page.waitForResponse', function() {
  it('should work', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const [response] = await Promise.all([
      page.waitForResponse(server.PREFIX + '/digits/2.png'),
      page.evaluate(() => {
        fetch('/digits/1.png');
        fetch('/digits/2.png');
        fetch('/digits/3.png');
      })
    ]);
    expect(response.url()).toBe(server.PREFIX + '/digits/2.png');
  });
  it('should respect timeout', async({page, server}) => {
    let error = null;
    await page.waitForEvent('response', { predicate: () => false, timeout: 1 }).catch(e => error = e);
    expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
  });
  it('should respect default timeout', async({page, server}) => {
    let error = null;
    page.setDefaultTimeout(1);
    await page.waitForEvent('response', () => false).catch(e => error = e);
    expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
  });
  it('should work with predicate', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const [response] = await Promise.all([
      page.waitForEvent('response', response => response.url() === server.PREFIX + '/digits/2.png'),
      page.evaluate(() => {
        fetch('/digits/1.png');
        fetch('/digits/2.png');
        fetch('/digits/3.png');
      })
    ]);
    expect(response.url()).toBe(server.PREFIX + '/digits/2.png');
  });
  it('should work with no timeout', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const [response] = await Promise.all([
      page.waitForResponse(server.PREFIX + '/digits/2.png', { timeout: 0 }),
      page.evaluate(() => setTimeout(() => {
        fetch('/digits/1.png');
        fetch('/digits/2.png');
        fetch('/digits/3.png');
      }, 50))
    ]);
    expect(response.url()).toBe(server.PREFIX + '/digits/2.png');
  });
});

describe('Page.exposeFunction', function() {
  it('should work', async({page, server}) => {
    await page.exposeFunction('compute', function(a, b) {
      return a * b;
    });
    const result = await page.evaluate(async function() {
      return await compute(9, 4);
    });
    expect(result).toBe(36);
  });
  it('should throw exception in page context', async({page, server}) => {
    await page.exposeFunction('woof', function() {
      throw new Error('WOOF WOOF');
    });
    const {message, stack} = await page.evaluate(async() => {
      try {
        await woof();
      } catch (e) {
        return {message: e.message, stack: e.stack};
      }
    });
    expect(message).toBe('WOOF WOOF');
    expect(stack).toContain(__filename);
  });
  it('should support throwing "null"', async({page, server}) => {
    await page.exposeFunction('woof', function() {
      throw null;
    });
    const thrown = await page.evaluate(async() => {
      try {
        await woof();
      } catch (e) {
        return e;
      }
    });
    expect(thrown).toBe(null);
  });
  it('should be callable from-inside addInitScript', async({page, server}) => {
    let called = false;
    await page.exposeFunction('woof', function() {
      called = true;
    });
    await page.addInitScript(() => woof());
    await page.reload();
    expect(called).toBe(true);
  });
  it('should survive navigation', async({page, server}) => {
    await page.exposeFunction('compute', function(a, b) {
      return a * b;
    });

    await page.goto(server.EMPTY_PAGE);
    const result = await page.evaluate(async function() {
      return await compute(9, 4);
    });
    expect(result).toBe(36);
  });
  it('should await returned promise', async({page, server}) => {
    await page.exposeFunction('compute', function(a, b) {
      return Promise.resolve(a * b);
    });

    const result = await page.evaluate(async function() {
      return await compute(3, 5);
    });
    expect(result).toBe(15);
  });
  it('should work on frames', async({page, server}) => {
    await page.exposeFunction('compute', function(a, b) {
      return Promise.resolve(a * b);
    });

    await page.goto(server.PREFIX + '/frames/nested-frames.html');
    const frame = page.frames()[1];
    const result = await frame.evaluate(async function() {
      return await compute(3, 5);
    });
    expect(result).toBe(15);
  });
  it('should work on frames before navigation', async({page, server}) => {
    await page.goto(server.PREFIX + '/frames/nested-frames.html');
    await page.exposeFunction('compute', function(a, b) {
      return Promise.resolve(a * b);
    });

    const frame = page.frames()[1];
    const result = await frame.evaluate(async function() {
      return await compute(3, 5);
    });
    expect(result).toBe(15);
  });
  it('should work after cross origin navigation', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.exposeFunction('compute', function(a, b) {
      return a * b;
    });

    await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
    const result = await page.evaluate(async function() {
      return await compute(9, 4);
    });
    expect(result).toBe(36);
  });
  it('should work with complex objects', async({page, server}) => {
    await page.exposeFunction('complexObject', function(a, b) {
      return {x: a.x + b.x};
    });
    const result = await page.evaluate(async() => complexObject({x: 5}, {x: 2}));
    expect(result.x).toBe(7);
  });
});

describe('Page.Events.PageError', function() {
  it('should fire', async({page, server}) => {
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.goto(server.PREFIX + '/error.html'),
    ]);
    expect(error.name).toBe('Error');
    expect(error.message).toBe('Fancy error!');
    let stack = await page.evaluate(() => window.e.stack);
    // Note that WebKit reports the stack of the 'throw' statement instead of the Error constructor call.
    if (WEBKIT)
      stack = stack.replace('14:25', '15:19');
    expect(error.stack).toBe(stack);
  });
  it.fail(WEBKIT)('should contain sourceURL', async({page, server}) => {
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.goto(server.PREFIX + '/error.html'),
    ]);
    expect(error.stack).toContain('myscript.js');
  });
});

describe('Page.setContent', function() {
  const expectedOutput = '<html><head></head><body><div>hello</div></body></html>';
  it('should work', async({page, server}) => {
    await page.setContent('<div>hello</div>');
    const result = await page.content();
    expect(result).toBe(expectedOutput);
  });
  it('should work with domcontentloaded', async({page, server}) => {
    await page.setContent('<div>hello</div>', { waitUntil: 'domcontentloaded' });
    const result = await page.content();
    expect(result).toBe(expectedOutput);
  });
  it('should work with doctype', async({page, server}) => {
    const doctype = '<!DOCTYPE html>';
    await page.setContent(`${doctype}<div>hello</div>`);
    const result = await page.content();
    expect(result).toBe(`${doctype}${expectedOutput}`);
  });
  it('should work with HTML 4 doctype', async({page, server}) => {
    const doctype = '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" ' +
      '"http://www.w3.org/TR/html4/strict.dtd">';
    await page.setContent(`${doctype}<div>hello</div>`);
    const result = await page.content();
    expect(result).toBe(`${doctype}${expectedOutput}`);
  });
  it('should respect timeout', async({page, server}) => {
    const imgPath = '/img.png';
    // stall for image
    server.setRoute(imgPath, (req, res) => {});
    let error = null;
    await page.setContent(`<img src="${server.PREFIX + imgPath}"></img>`, {timeout: 1}).catch(e => error = e);
    expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
  });
  it('should respect default navigation timeout', async({page, server}) => {
    page.setDefaultNavigationTimeout(1);
    const imgPath = '/img.png';
    // stall for image
    server.setRoute(imgPath, (req, res) => {});
    let error = null;
    await page.setContent(`<img src="${server.PREFIX + imgPath}"></img>`).catch(e => error = e);
    expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
  });
  it('should await resources to load', async({page, server}) => {
    const imgPath = '/img.png';
    let imgResponse = null;
    server.setRoute(imgPath, (req, res) => imgResponse = res);
    let loaded = false;
    const contentPromise = page.setContent(`<img src="${server.PREFIX + imgPath}"></img>`).then(() => loaded = true);
    await server.waitForRequest(imgPath);
    expect(loaded).toBe(false);
    imgResponse.end();
    await contentPromise;
  });
  it('should work fast enough', async({page, server}) => {
    for (let i = 0; i < 20; ++i)
      await page.setContent('<div>yo</div>');
  });
  it('should work with tricky content', async({page, server}) => {
    await page.setContent('<div>hello world</div>' + '\x7F');
    expect(await page.$eval('div', div => div.textContent)).toBe('hello world');
  });
  it('should work with accents', async({page, server}) => {
    await page.setContent('<div>aberración</div>');
    expect(await page.$eval('div', div => div.textContent)).toBe('aberración');
  });
  it('should work with emojis', async({page, server}) => {
    await page.setContent('<div>🐥</div>');
    expect(await page.$eval('div', div => div.textContent)).toBe('🐥');
  });
  it('should work with newline', async({page, server}) => {
    await page.setContent('<div>\n</div>');
    expect(await page.$eval('div', div => div.textContent)).toBe('\n');
  });
});


describe('Page.addScriptTag', function() {
  it('should throw an error if no options are provided', async({page, server}) => {
    let error = null;
    try {
      await page.addScriptTag('/injectedfile.js');
    } catch (e) {
      error = e;
    }
    expect(error.message).toBe('Provide an object with a `url`, `path` or `content` property');
  });

  it('should work with a url', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const scriptHandle = await page.addScriptTag({ url: '/injectedfile.js' });
    expect(scriptHandle.asElement()).not.toBeNull();
    expect(await page.evaluate(() => __injected)).toBe(42);
  });

  it('should work with a url and type=module', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.addScriptTag({ url: '/es6/es6import.js', type: 'module' });
    expect(await page.evaluate(() => __es6injected)).toBe(42);
  });

  it('should work with a path and type=module', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.addScriptTag({ path: path.join(__dirname, 'assets/es6/es6pathimport.js'), type: 'module' });
    await page.waitForFunction('window.__es6injected');
    expect(await page.evaluate(() => __es6injected)).toBe(42);
  });

  it('should work with a content and type=module', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.addScriptTag({ content: `import num from '/es6/es6module.js';window.__es6injected = num;`, type: 'module' });
    await page.waitForFunction('window.__es6injected');
    expect(await page.evaluate(() => __es6injected)).toBe(42);
  });

  it('should throw an error if loading from url fail', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    let error = null;
    try {
      await page.addScriptTag({ url: '/nonexistfile.js' });
    } catch (e) {
      error = e;
    }
    expect(error).not.toBe(null);
  });

  it('should work with a path', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const scriptHandle = await page.addScriptTag({ path: path.join(__dirname, 'assets/injectedfile.js') });
    expect(scriptHandle.asElement()).not.toBeNull();
    expect(await page.evaluate(() => __injected)).toBe(42);
  });

  it.skip(WEBKIT)('should include sourceURL when path is provided', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.addScriptTag({ path: path.join(__dirname, 'assets/injectedfile.js') });
    const result = await page.evaluate(() => __injectedError.stack);
    expect(result).toContain(path.join('assets', 'injectedfile.js'));
  });

  it('should work with content', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const scriptHandle = await page.addScriptTag({ content: 'window.__injected = 35;' });
    expect(scriptHandle.asElement()).not.toBeNull();
    expect(await page.evaluate(() => __injected)).toBe(35);
  });

  // Firefox fires onload for blocked script before it issues the CSP console error.
  it('should throw when added with content to the CSP page', async({page, server}) => {
    await page.goto(server.PREFIX + '/csp.html');
    let error = null;
    await page.addScriptTag({ content: 'window.__injected = 35;' }).catch(e => error = e);
    expect(error).toBeTruthy();
  });

  it('should throw when added with URL to the CSP page', async({page, server}) => {
    await page.goto(server.PREFIX + '/csp.html');
    let error = null;
    await page.addScriptTag({ url: server.CROSS_PROCESS_PREFIX + '/injectedfile.js' }).catch(e => error = e);
    expect(error).toBeTruthy();
  });
  it('should throw a nice error when the request fails', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const url = server.PREFIX + '/this_does_not_exist.js';
    const error = await page.addScriptTag({url}).catch(e => e);
    expect(error.message).toContain(url);
  });
});

describe('Page.addStyleTag', function() {
  it('should throw an error if no options are provided', async({page, server}) => {
    let error = null;
    try {
      await page.addStyleTag('/injectedstyle.css');
    } catch (e) {
      error = e;
    }
    expect(error.message).toBe('Provide an object with a `url`, `path` or `content` property');
  });

  it('should work with a url', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const styleHandle = await page.addStyleTag({ url: '/injectedstyle.css' });
    expect(styleHandle.asElement()).not.toBeNull();
    expect(await page.evaluate(`window.getComputedStyle(document.querySelector('body')).getPropertyValue('background-color')`)).toBe('rgb(255, 0, 0)');
  });

  it('should throw an error if loading from url fail', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    let error = null;
    try {
      await page.addStyleTag({ url: '/nonexistfile.js' });
    } catch (e) {
      error = e;
    }
    expect(error).not.toBe(null);
  });

  it('should work with a path', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const styleHandle = await page.addStyleTag({ path: path.join(__dirname, 'assets/injectedstyle.css') });
    expect(styleHandle.asElement()).not.toBeNull();
    expect(await page.evaluate(`window.getComputedStyle(document.querySelector('body')).getPropertyValue('background-color')`)).toBe('rgb(255, 0, 0)');
  });

  it('should include sourceURL when path is provided', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.addStyleTag({ path: path.join(__dirname, 'assets/injectedstyle.css') });
    const styleHandle = await page.$('style');
    const styleContent = await page.evaluate(style => style.innerHTML, styleHandle);
    expect(styleContent).toContain(path.join('assets', 'injectedstyle.css'));
  });

  it('should work with content', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const styleHandle = await page.addStyleTag({ content: 'body { background-color: green; }' });
    expect(styleHandle.asElement()).not.toBeNull();
    expect(await page.evaluate(`window.getComputedStyle(document.querySelector('body')).getPropertyValue('background-color')`)).toBe('rgb(0, 128, 0)');
  });

  it('should throw when added with content to the CSP page', async({page, server}) => {
    await page.goto(server.PREFIX + '/csp.html');
    let error = null;
    await page.addStyleTag({ content: 'body { background-color: green; }' }).catch(e => error = e);
    expect(error).toBeTruthy();
  });

  it('should throw when added with URL to the CSP page', async({page, server}) => {
    await page.goto(server.PREFIX + '/csp.html');
    let error = null;
    await page.addStyleTag({ url: server.CROSS_PROCESS_PREFIX + '/injectedstyle.css' }).catch(e => error = e);
    expect(error).toBeTruthy();
  });
});

describe('Page.url', function() {
  it('should work', async({page, server}) => {
    expect(page.url()).toBe('about:blank');
    await page.goto(server.EMPTY_PAGE);
    expect(page.url()).toBe(server.EMPTY_PAGE);
  });
});

describe('Page.title', function() {
  it('should return the page title', async({page, server}) => {
    await page.goto(server.PREFIX + '/title.html');
    expect(await page.title()).toBe('Woof-Woof');
  });
});

describe('Page.select', function() {
  it('should select single option', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    await page.selectOption('select', 'blue');
    expect(await page.evaluate(() => result.onInput)).toEqual(['blue']);
    expect(await page.evaluate(() => result.onChange)).toEqual(['blue']);
  });
  it('should select single option by value', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    await page.selectOption('select', { value: 'blue' });
    expect(await page.evaluate(() => result.onInput)).toEqual(['blue']);
    expect(await page.evaluate(() => result.onChange)).toEqual(['blue']);
  });
  it('should select single option by label', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    await page.selectOption('select', { label: 'Indigo' });
    expect(await page.evaluate(() => result.onInput)).toEqual(['indigo']);
    expect(await page.evaluate(() => result.onChange)).toEqual(['indigo']);
  });
  it('should select single option by handle', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    await page.selectOption('select', await page.$('[id=whiteOption]'));
    expect(await page.evaluate(() => result.onInput)).toEqual(['white']);
    expect(await page.evaluate(() => result.onChange)).toEqual(['white']);
  });
  it('should select single option by index', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    await page.selectOption('select', { index: 2 });
    expect(await page.evaluate(() => result.onInput)).toEqual(['brown']);
    expect(await page.evaluate(() => result.onChange)).toEqual(['brown']);
  });
  it('should select single option by multiple attributes', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    await page.selectOption('select', { value: 'green', label: 'Green' });
    expect(await page.evaluate(() => result.onInput)).toEqual(['green']);
    expect(await page.evaluate(() => result.onChange)).toEqual(['green']);
  });
  it('should not select single option when some attributes do not match', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    await page.selectOption('select', { value: 'green', label: 'Brown' });
    expect(await page.evaluate(() => document.querySelector('select').value)).toEqual('');
  });
  it('should select only first option', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    await page.selectOption('select', 'blue', 'green', 'red');
    expect(await page.evaluate(() => result.onInput)).toEqual(['blue']);
    expect(await page.evaluate(() => result.onChange)).toEqual(['blue']);
  });
  it('should not throw when select causes navigation', async({page, server}) => { await page.goto(server.PREFIX + '/input/select.html');
    await page.$eval('select', select => select.addEventListener('input', () => window.location = '/empty.html'));
    await Promise.all([
      page.selectOption('select', 'blue'),
      page.waitForNavigation(),
    ]);
    expect(page.url()).toContain('empty.html');
  });
  it('should select multiple options', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    await page.evaluate(() => makeMultiple());
    await page.selectOption('select', ['blue', 'green', 'red']);
    expect(await page.evaluate(() => result.onInput)).toEqual(['blue', 'green', 'red']);
    expect(await page.evaluate(() => result.onChange)).toEqual(['blue', 'green', 'red']);
  });
  it('should select multiple options with attributes', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    await page.evaluate(() => makeMultiple());
    await page.selectOption('select', ['blue', { label: 'Green' }, { index: 4 }]);
    expect(await page.evaluate(() => result.onInput)).toEqual(['blue', 'gray', 'green']);
    expect(await page.evaluate(() => result.onChange)).toEqual(['blue', 'gray', 'green']);
  });
  it('should respect event bubbling', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    await page.selectOption('select', 'blue');
    expect(await page.evaluate(() => result.onBubblingInput)).toEqual(['blue']);
    expect(await page.evaluate(() => result.onBubblingChange)).toEqual(['blue']);
  });
  it('should throw when element is not a <select>', async({page, server}) => {
    let error = null;
    await page.goto(server.PREFIX + '/input/select.html');
    await page.selectOption('body', '').catch(e => error = e);
    expect(error.message).toContain('Element is not a <select> element.');
  });
  it('should return [] on no matched values', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    const result = await page.selectOption('select','42','abc');
    expect(result).toEqual([]);
  });
  it('should return an array of matched values', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    await page.evaluate(() => makeMultiple());
    const result = await page.selectOption('select','blue','black','magenta');
    expect(result.reduce((accumulator,current) => ['blue', 'black', 'magenta'].includes(current) && accumulator, true)).toEqual(true);
  });
  it('should return an array of one element when multiple is not set', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    const result = await page.selectOption('select',['42','blue','black','magenta']);
    expect(result.length).toEqual(1);
  });
  it('should return [] on no values',async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    const result = await page.selectOption('select', []);
    expect(result).toEqual([]);
  });
  it('should deselect all options when passed no values for a multiple select',async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    await page.evaluate(() => makeMultiple());
    await page.selectOption('select', ['blue','black','magenta']);
    await page.selectOption('select', []);
    expect(await page.$eval('select', select => Array.from(select.options).every(option => !option.selected))).toEqual(true);
  });
  it('should deselect all options when passed no values for a select without multiple',async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    await page.selectOption('select', ['blue','black','magenta']);
    await page.selectOption('select', []);
    expect(await page.$eval('select', select => Array.from(select.options).every(option => !option.selected))).toEqual(true);
  });
  it('should throw if passed wrong types', async({page, server}) => {
    let error;
    await page.setContent('<select><option value="12"/></select>');

    error = null;
    try {
      await page.selectOption('select', 12);
    } catch (e) {
      error = e;
    }
    expect(error.message).toContain('Values must be strings');

    error = null;
    try {
      await page.selectOption('select', { value: 12 });
    } catch (e) {
      error = e;
    }
    expect(error.message).toContain('Values must be strings');

    error = null;
    try {
      await page.selectOption('select', { label: 12 });
    } catch (e) {
      error = e;
    }
    expect(error.message).toContain('Labels must be strings');

    error = null;
    try {
      await page.selectOption('select', { index: '12' });
    } catch (e) {
      error = e;
    }
    expect(error.message).toContain('Indices must be numbers');
  });
  // @see https://github.com/GoogleChrome/puppeteer/issues/3327
  it('should work when re-defining top-level Event class', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    await page.evaluate(() => window.Event = null);
    await page.selectOption('select', 'blue');
    expect(await page.evaluate(() => result.onInput)).toEqual(['blue']);
    expect(await page.evaluate(() => result.onChange)).toEqual(['blue']);
  });
});

describe('Page.fill', function() {
  it('should fill textarea', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    await page.fill('textarea', 'some value');
    expect(await page.evaluate(() => result)).toBe('some value');
  });
  it('should fill input', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    await page.fill('input', 'some value');
    expect(await page.evaluate(() => result)).toBe('some value');
  });
  it('should throw on unsupported inputs', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    for (const type of ['color', 'file']) {
      await page.$eval('input', (input, type) => input.setAttribute('type', type), type);
      let error = null;
      await page.fill('input', '').catch(e => error = e);
      expect(error.message).toContain('Cannot fill input of type');
    }
  });
  it('should fill different input types', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    for (const type of ['password', 'search', 'tel', 'text', 'url']) {
      await page.$eval('input', (input, type) => input.setAttribute('type', type), type);
      await page.fill('input', 'text ' + type);
      expect(await page.evaluate(() => result)).toBe('text ' + type);
    }
  });
  it('should fill date input after clicking', async({page, server}) => {
    await page.setContent('<input type=date>');
    await page.click('input');
    await page.fill('input', '2020-03-02');
    expect(await page.$eval('input', input => input.value)).toBe('2020-03-02');
  });
  it.skip(WEBKIT)('should throw on incorrect date', async({page, server}) => {
    await page.setContent('<input type=date>');
    const error = await page.fill('input', '2020-13-05').catch(e => e);
    expect(error.message).toBe('Malformed date "2020-13-05"');
  });
  it('should fill time input', async({page, server}) => {
    await page.setContent('<input type=time>');
    await page.fill('input', '13:15');
    expect(await page.$eval('input', input => input.value)).toBe('13:15');
  });
  it.skip(WEBKIT)('should throw on incorrect time', async({page, server}) => {
    await page.setContent('<input type=time>');
    const error = await page.fill('input', '25:05').catch(e => e);
    expect(error.message).toBe('Malformed time "25:05"');
  });
  it('should fill datetime-local input', async({page, server}) => {
    await page.setContent('<input type=datetime-local>');
    await page.fill('input', '2020-03-02T05:15');
    expect(await page.$eval('input', input => input.value)).toBe('2020-03-02T05:15');
  });
  it.skip(WEBKIT || FFOX)('should throw on incorrect datetime-local', async({page, server}) => {
    await page.setContent('<input type=datetime-local>');
    const error = await page.fill('input', 'abc').catch(e => e);
    expect(error.message).toBe('Malformed datetime-local "abc"');
  });
  it('should fill contenteditable', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    await page.fill('div[contenteditable]', 'some value');
    expect(await page.$eval('div[contenteditable]', div => div.textContent)).toBe('some value');
  });
  it('should fill elements with existing value and selection', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');

    await page.$eval('input', input => input.value = 'value one');
    await page.fill('input', 'another value');
    expect(await page.evaluate(() => result)).toBe('another value');

    await page.$eval('input', input => {
      input.selectionStart = 1;
      input.selectionEnd = 2;
    });
    await page.fill('input', 'maybe this one');
    expect(await page.evaluate(() => result)).toBe('maybe this one');

    await page.$eval('div[contenteditable]', div => {
      div.innerHTML = 'some text <span>some more text<span> and even more text';
      const range = document.createRange();
      range.selectNodeContents(div.querySelector('span'));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await page.fill('div[contenteditable]', 'replace with this');
    expect(await page.$eval('div[contenteditable]', div => div.textContent)).toBe('replace with this');
  });
  it('should throw when element is not an <input>, <textarea> or [contenteditable]', async({page, server}) => {
    let error = null;
    await page.goto(server.PREFIX + '/input/textarea.html');
    await page.fill('body', '').catch(e => error = e);
    expect(error.message).toContain('Element is not an <input>');
  });
  it('should throw if passed a non-string value', async({page, server}) => {
    let error = null;
    await page.goto(server.PREFIX + '/input/textarea.html');
    await page.fill('textarea', 123).catch(e => error = e);
    expect(error.message).toContain('Value must be string.');
  });
  it('should throw on disabled and readonly elements', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    await page.$eval('input', i => i.disabled = true);
    const disabledError = await page.fill('input', 'some value').catch(e => e);
    expect(disabledError.message).toBe('Cannot fill a disabled input.');

    await page.goto(server.PREFIX + '/input/textarea.html');
    await page.$eval('textarea', i => i.readOnly = true);
    const readonlyError = await page.fill('textarea', 'some value').catch(e => e);
    expect(readonlyError.message).toBe('Cannot fill a readonly textarea.');
  });
  it('should throw on hidden and invisible elements', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    await page.$eval('input', i => i.style.display = 'none');
    const invisibleError = await page.fill('input', 'some value', { force: true }).catch(e => e);
    expect(invisibleError.message).toBe('Element is not visible');

    await page.goto(server.PREFIX + '/input/textarea.html');
    await page.$eval('input', i => i.style.visibility = 'hidden');
    const hiddenError = await page.fill('input', 'some value', { force: true }).catch(e => e);
    expect(hiddenError.message).toBe('Element is not visible');
  });
  it('should be able to fill the body', async({page}) => {
    await page.setContent(`<body contentEditable="true"></body>`);
    await page.fill('body', 'some value');
    expect(await page.evaluate(() => document.body.textContent)).toBe('some value');
  });
  it('should fill fixed position input', async ({page}) => {
    await page.setContent(`<input style='position: fixed;' />`);
    await page.fill('input', 'some value');
    expect(await page.evaluate(() => document.querySelector('input').value)).toBe('some value');
  });
  it('should be able to fill when focus is in the wrong frame', async({page}) => {
    await page.setContent(`
      <div contentEditable="true"></div>
      <iframe></iframe>
    `);
    await page.focus('iframe');
    await page.fill('div', 'some value');
    expect(await page.$eval('div', d => d.textContent)).toBe('some value');
  });
  it('should be able to fill the input[type=number]', async({page}) => {
    await page.setContent(`<input id="input" type="number"></input>`);
    await page.fill('input', '42');
    expect(await page.evaluate(() => input.value)).toBe('42');
  });
  it('should be able to fill exponent into the input[type=number]', async({page}) => {
    await page.setContent(`<input id="input" type="number"></input>`);
    await page.fill('input', '-10e5');
    expect(await page.evaluate(() => input.value)).toBe('-10e5');
  });
  it('should not be able to fill input[type=number] with empty string', async({page}) => {
    await page.setContent(`<input id="input" type="number"></input>`);
    let error = null;
    await page.fill('input', '').catch(e => error = e);
    expect(error.message).toContain('Cannot type text into input[type=number].');
  });
  it('should not be able to fill text into the input[type=number]', async({page}) => {
    await page.setContent(`<input id="input" type="number"></input>`);
    let error = null;
    await page.fill('input', '').catch(e => error = e);
    expect(error.message).toContain('Cannot type text into input[type=number].');
  });
  it('should be able to clear', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    await page.fill('input', 'some value');
    expect(await page.evaluate(() => result)).toBe('some value');
    await page.fill('input', '');
    expect(await page.evaluate(() => result)).toBe('');
  });
});

describe('Page.Events.Close', function() {
  it('should work with window.close', async function({ page, context, server }) {
    const newPagePromise = page.waitForEvent('popup');
    await page.evaluate(() => window['newPage'] = window.open('about:blank'));
    const newPage = await newPagePromise;
    const closedPromise = new Promise(x => newPage.on('close', x));
    await page.evaluate(() => window['newPage'].close());
    await closedPromise;
  });
  it('should work with page.close', async function({ page, context, server }) {
    const newPage = await context.newPage();
    const closedPromise = new Promise(x => newPage.on('close', x));
    await newPage.close();
    await closedPromise;
  });
});

describe('Page.browserContext', function() {
  it('should return the correct browser instance', async function({page, context}) {
    expect(page.context()).toBe(context);
  });
});

describe('Page.frame', function() {
  it('should respect name', async function({page, server}) {
    await page.setContent(`<iframe name=target></iframe>`);
    expect(page.frame({ name: 'bogus' })).toBe(null);
    const frame = page.frame({ name: 'target' });
    expect(frame).toBeTruthy();
    expect(frame === page.mainFrame().childFrames()[0]).toBeTruthy();
  });
  it('should respect url', async function({page, server}) {
    await page.setContent(`<iframe src="${server.EMPTY_PAGE}"></iframe>`);
    expect(page.frame({ url: /bogus/ })).toBe(null);
    expect(page.frame({ url: /empty/ }).url()).toBe(server.EMPTY_PAGE);
  });
});

describe('Page api coverage', function() {
  it('Page.press should work', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    await page.press('textarea', 'a');
    expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('a');
  });
  it('Frame.press should work', async({page, server}) => {
    await page.setContent(`<iframe name=inner src="${server.PREFIX}/input/textarea.html"></iframe>`);
    const frame = page.frame('inner');
    await frame.press('textarea', 'a');
    expect(await frame.evaluate(() => document.querySelector('textarea').value)).toBe('a');
  });
});
