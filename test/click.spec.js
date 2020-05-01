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

const utils = require('./utils');
const {FFOX, CHROMIUM, WEBKIT, WIN} = utils.testOptions(browserType);

describe('Page.click', function() {
  it('should click the button', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.click('button');
    expect(await page.evaluate(() => result)).toBe('Clicked');
  });
  it('should click svg', async({page, server}) => {
    await page.setContent(`
      <svg height="100" width="100">
        <circle onclick="javascript:window.__CLICKED=42" cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
      </svg>
    `);
    await page.click('circle');
    expect(await page.evaluate(() => window.__CLICKED)).toBe(42);
  });
  it('should click the button if window.Node is removed', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.evaluate(() => delete window.Node);
    await page.click('button');
    expect(await page.evaluate(() => result)).toBe('Clicked');
  });
  // @see https://github.com/GoogleChrome/puppeteer/issues/4281
  it('should click on a span with an inline element inside', async({page, server}) => {
    await page.setContent(`
      <style>
      span::before {
        content: 'q';
      }
      </style>
      <span onclick='javascript:window.CLICKED=42'></span>
    `);
    await page.click('span');
    expect(await page.evaluate(() => window.CLICKED)).toBe(42);
  });
  it('should not throw UnhandledPromiseRejection when page closes', async({browser, server}) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await Promise.all([
      page.close(),
      page.mouse.click(1, 2),
    ]).catch(e => {});
    await context.close();
  });
  it('should click the button after navigation ', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.click('button');
    await page.goto(server.PREFIX + '/input/button.html');
    await page.click('button');
    expect(await page.evaluate(() => result)).toBe('Clicked');
  });
  it('should click the button after a cross origin navigation ', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.click('button');
    await page.goto(server.CROSS_PROCESS_PREFIX + '/input/button.html');
    await page.click('button');
    expect(await page.evaluate(() => result)).toBe('Clicked');
  });
  it('should click with disabled javascript', async({browser, server}) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/wrappedlink.html');
    await Promise.all([
      page.click('a'),
      page.waitForNavigation()
    ]);
    expect(page.url()).toBe(server.PREFIX + '/wrappedlink.html#clicked');
    await context.close();
  });
  it('should click when one of inline box children is outside of viewport', async({page, server}) => {
    await page.setContent(`
      <style>
      i {
        position: absolute;
        top: -1000px;
      }
      </style>
      <span onclick='javascript:window.CLICKED = 42;'><i>woof</i><b>doggo</b></span>
    `);
    await page.click('span');
    expect(await page.evaluate(() => window.CLICKED)).toBe(42);
  });
  it('should select the text by triple clicking', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    const text = 'This is the text that we are going to try to select. Let\'s see how it goes.';
    await page.fill('textarea', text);
    await page.click('textarea', { clickCount: 3 });
    expect(await page.evaluate(() => {
      const textarea = document.querySelector('textarea');
      return textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    })).toBe(text);
  });
  it('should click offscreen buttons', async({page, server}) => {
    await page.goto(server.PREFIX + '/offscreenbuttons.html');
    const messages = [];
    page.on('console', msg => messages.push(msg.text()));
    for (let i = 0; i < 11; ++i) {
      // We might've scrolled to click a button - reset to (0, 0).
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.click(`#btn${i}`);
    }
    expect(messages).toEqual([
      'button #0 clicked',
      'button #1 clicked',
      'button #2 clicked',
      'button #3 clicked',
      'button #4 clicked',
      'button #5 clicked',
      'button #6 clicked',
      'button #7 clicked',
      'button #8 clicked',
      'button #9 clicked',
      'button #10 clicked'
    ]);
  });

  it('should waitFor visible when already visible', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.click('button');
    expect(await page.evaluate(() => result)).toBe('Clicked');
  });
  it('should not wait with false waitFor', async({page, server}) => {
    let error = null;
    await page.goto(server.PREFIX + '/input/button.html');
    await page.$eval('button', b => b.style.display = 'none');
    await page.click('button', { force: true }).catch(e => error = e);
    expect(error.message).toBe('Node is either not visible or not an HTMLElement');
    expect(await page.evaluate(() => result)).toBe('Was not clicked');
  });
  it('should waitFor display:none to be gone', async({page, server}) => {
    let done = false;
    await page.goto(server.PREFIX + '/input/button.html');
    await page.$eval('button', b => b.style.display = 'none');
    const clicked = page.click('button', { timeout: 0 }).then(() => done = true);
    for (let i = 0; i < 10; i++) {
      // Do enough double rafs to check for possible races.
      await page.evaluate(() => new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f))));
    }
    expect(await page.evaluate(() => result)).toBe('Was not clicked');
    expect(done).toBe(false);
    await page.$eval('button', b => b.style.display = 'block');
    await clicked;
    expect(done).toBe(true);
    expect(await page.evaluate(() => result)).toBe('Clicked');
  });
  it('should waitFor visibility:hidden to be gone', async({page, server}) => {
    let done = false;
    await page.goto(server.PREFIX + '/input/button.html');
    await page.$eval('button', b => b.style.visibility = 'hidden');
    const clicked = page.click('button', { timeout: 0 }).then(() => done = true);
    for (let i = 0; i < 10; i++) {
      // Do enough double rafs to check for possible races.
      await page.evaluate(() => new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f))));
    }
    expect(await page.evaluate(() => result)).toBe('Was not clicked');
    expect(done).toBe(false);
    await page.$eval('button', b => b.style.visibility = 'visible');
    await clicked;
    expect(done).toBe(true);
    expect(await page.evaluate(() => result)).toBe('Clicked');
  });
  it('should timeout waiting for display:none to be gone', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.$eval('button', b => b.style.display = 'none');
    const error = await page.click('button', { timeout: 100 }).catch(e => e);
    expect(error.message).toContain('timeout exceeded');
  });
  it('should timeout waiting for visbility:hidden to be gone', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.$eval('button', b => b.style.visibility = 'hidden');
    const error = await page.click('button', { timeout: 100 }).catch(e => e);
    expect(error.message).toContain('timeout exceeded');
  });
  it('should waitFor visible when parent is hidden', async({page, server}) => {
    let done = false;
    await page.goto(server.PREFIX + '/input/button.html');
    await page.$eval('button', b => b.parentElement.style.display = 'none');
    const clicked = page.click('button', { timeout: 0 }).then(() => done = true);
    for (let i = 0; i < 10; i++) {
      // Do enough double rafs to check for possible races.
      await page.evaluate(() => new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f))));
    }
    expect(done).toBe(false);
    await page.$eval('button', b => b.parentElement.style.display = 'block');
    await clicked;
    expect(done).toBe(true);
    expect(await page.evaluate(() => result)).toBe('Clicked');
  });

  it('should click wrapped links', async({page, server}) => {
    await page.goto(server.PREFIX + '/wrappedlink.html');
    await page.click('a');
    expect(await page.evaluate(() => window.__clicked)).toBe(true);
  });

  it('should click on checkbox input and toggle', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/checkbox.html');
    expect(await page.evaluate(() => result.check)).toBe(null);
    await page.click('input#agree');
    expect(await page.evaluate(() => result.check)).toBe(true);
    expect(await page.evaluate(() => result.events)).toEqual([
      'mouseover',
      'mouseenter',
      'mousemove',
      'mousedown',
      'mouseup',
      'click',
      'input',
      'change',
    ]);
    await page.click('input#agree');
    expect(await page.evaluate(() => result.check)).toBe(false);
  });

  it('should click on checkbox label and toggle', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/checkbox.html');
    expect(await page.evaluate(() => result.check)).toBe(null);
    await page.click('label[for="agree"]');
    expect(await page.evaluate(() => result.check)).toBe(true);
    expect(await page.evaluate(() => result.events)).toEqual([
      'click',
      'input',
      'change',
    ]);
    await page.click('label[for="agree"]');
    expect(await page.evaluate(() => result.check)).toBe(false);
  });
  it('should not hang with touch-enabled viewports', async({server, browser}) => {
    // @see https://github.com/GoogleChrome/puppeteer/issues/161
    const { viewport, hasTouch } = playwright.devices['iPhone 6'];
    const context = await browser.newContext({ viewport, hasTouch });
    const page = await context.newPage();
    await page.mouse.down();
    await page.mouse.move(100, 10);
    await page.mouse.up();
    await context.close();
  });
  it('should scroll and click the button', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/scrollable.html');
    await page.click('#button-5');
    expect(await page.evaluate(() => document.querySelector('#button-5').textContent)).toBe('clicked');
    await page.click('#button-80');
    expect(await page.evaluate(() => document.querySelector('#button-80').textContent)).toBe('clicked');
  });
  it('should double click the button', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.evaluate(() => {
      window.double = false;
      const button = document.querySelector('button');
      button.addEventListener('dblclick', event => {
        window.double = true;
      });
    });
    await page.dblclick('button');
    expect(await page.evaluate('double')).toBe(true);
    expect(await page.evaluate('result')).toBe('Clicked');
  });
  it('should click a partially obscured button', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.evaluate(() => {
      const button = document.querySelector('button');
      button.textContent = 'Some really long text that will go offscreen';
      button.style.position = 'absolute';
      button.style.left = '368px';
    });
    await page.click('button');
    expect(await page.evaluate(() => window.result)).toBe('Clicked');
  });
  it('should click a rotated button', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/rotatedButton.html');
    await page.click('button');
    expect(await page.evaluate(() => result)).toBe('Clicked');
  });
  it('should fire contextmenu event on right click', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/scrollable.html');
    await page.click('#button-8', {button: 'right'});
    expect(await page.evaluate(() => document.querySelector('#button-8').textContent)).toBe('context menu');
  });
  // @see https://github.com/GoogleChrome/puppeteer/issues/206
  it('should click links which cause navigation', async({page, server}) => {
    await page.setContent(`<a href="${server.EMPTY_PAGE}">empty.html</a>`);
    // This await should not hang.
    await page.click('a');
  });
  it('should click the button inside an iframe', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent('<div style="width:100px;height:100px">spacer</div>');
    await utils.attachFrame(page, 'button-test', server.PREFIX + '/input/button.html');
    const frame = page.frames()[1];
    const button = await frame.$('button');
    await button.click();
    expect(await frame.evaluate(() => window.result)).toBe('Clicked');
  });
  // @see https://github.com/GoogleChrome/puppeteer/issues/4110
  // @see https://bugs.chromium.org/p/chromium/issues/detail?id=986390
  // @see https://chromium-review.googlesource.com/c/chromium/src/+/1742784
  it.fail(CHROMIUM || WEBKIT)('should click the button with fixed position inside an iframe', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.setViewportSize({width: 500, height: 500});
    await page.setContent('<div style="width:100px;height:2000px">spacer</div>');
    await utils.attachFrame(page, 'button-test', server.CROSS_PROCESS_PREFIX + '/input/button.html');
    const frame = page.frames()[1];
    await frame.$eval('button', button => button.style.setProperty('position', 'fixed'));
    await frame.click('button');
    expect(await frame.evaluate(() => window.result)).toBe('Clicked');
  });
  it('should click the button with deviceScaleFactor set', async({browser, server}) => {
    const context = await browser.newContext({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 5 });
    const page = await context.newPage();
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(5);
    await page.setContent('<div style="width:100px;height:100px">spacer</div>');
    await utils.attachFrame(page, 'button-test', server.PREFIX + '/input/button.html');
    const frame = page.frames()[1];
    const button = await frame.$('button');
    await button.click();
    expect(await frame.evaluate(() => window.result)).toBe('Clicked');
    await context.close();
  });
  it('should click the button with px border with offset', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.$eval('button', button => button.style.borderWidth = '8px');
    await page.click('button', { position: { x: 20, y: 10 } });
    expect(await page.evaluate(() => result)).toBe('Clicked');
    // Safari reports border-relative offsetX/offsetY.
    expect(await page.evaluate(() => offsetX)).toBe(WEBKIT ? 20 + 8 : 20);
    expect(await page.evaluate(() => offsetY)).toBe(WEBKIT ? 10 + 8 : 10);
  });
  it('should click the button with em border with offset', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.$eval('button', button => button.style.borderWidth = '2em');
    await page.$eval('button', button => button.style.fontSize = '12px');
    await page.click('button', { position: { x: 20, y: 10 } });
    expect(await page.evaluate(() => result)).toBe('Clicked');
    // Safari reports border-relative offsetX/offsetY.
    expect(await page.evaluate(() => offsetX)).toBe(WEBKIT ? 12 * 2 + 20 : 20);
    expect(await page.evaluate(() => offsetY)).toBe(WEBKIT ? 12 * 2 + 10 : 10);
  });
  it('should click a very large button with offset', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.$eval('button', button => button.style.borderWidth = '8px');
    await page.$eval('button', button => button.style.height = button.style.width = '2000px');
    await page.click('button', { position: { x: 1900, y: 1910 } });
    expect(await page.evaluate(() => window.result)).toBe('Clicked');
    // Safari reports border-relative offsetX/offsetY.
    expect(await page.evaluate(() => offsetX)).toBe(WEBKIT ? 1900 + 8 : 1900);
    expect(await page.evaluate(() => offsetY)).toBe(WEBKIT ? 1910 + 8 : 1910);
  });
  it('should click a button in scrolling container with offset', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.$eval('button', button => {
      const container = document.createElement('div');
      container.style.overflow = 'auto';
      container.style.width = '200px';
      container.style.height = '200px';
      button.parentElement.insertBefore(container, button);
      container.appendChild(button);
      button.style.height = '2000px';
      button.style.width = '2000px';
      button.style.borderWidth = '8px';
    });
    await page.click('button', { position: { x: 1900, y: 1910 } });
    expect(await page.evaluate(() => window.result)).toBe('Clicked');
    // Safari reports border-relative offsetX/offsetY.
    expect(await page.evaluate(() => offsetX)).toBe(WEBKIT ? 1900 + 8 : 1900);
    expect(await page.evaluate(() => offsetY)).toBe(WEBKIT ? 1910 + 8 : 1910);
  });
  it.skip(FFOX)('should click the button with offset with page scale', async({browser, server}) => {
    const context = await browser.newContext({ viewport: { width: 400, height: 400 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/input/button.html');
    await page.$eval('button', button => {
      button.style.borderWidth = '8px';
      document.body.style.margin = '0';
    });
    await page.click('button', { position: { x: 20, y: 10 } });
    expect(await page.evaluate(() => result)).toBe('Clicked');
    let expected = { x: 28, y: 18 };  // 20;10 + 8px of border in each direction
    if (WEBKIT) {
      // WebKit rounds up during css -> dip -> css conversion.
      expected = { x: 29, y: 19 };
    } else if (CHROMIUM) {
      // Chromium rounds down during css -> dip -> css conversion.
      expected = { x: 27, y: 18 };
    }
    expect(await page.evaluate(() => pageX)).toBe(expected.x);
    expect(await page.evaluate(() => pageY)).toBe(expected.y);
    await context.close();
  });

  it.fail(WEBKIT && WIN)('should wait for stable position', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.$eval('button', button => {
      button.style.transition = 'margin 500ms linear 0s';
      button.style.marginLeft = '200px';
      button.style.borderWidth = '0';
      button.style.width = '200px';
      button.style.height = '20px';
      // Set display to "block" - otherwise Firefox layouts with non-even
      // values on Linux.
      button.style.display = 'block';
      document.body.style.margin = '0';
    });
    await page.click('button');
    expect(await page.evaluate(() => window.result)).toBe('Clicked');
    expect(await page.evaluate(() => pageX)).toBe(300);
    expect(await page.evaluate(() => pageY)).toBe(10);
  });
  it.fail(WEBKIT && WIN)('should timeout waiting for stable position', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    const button = await page.$('button');
    await button.evaluate(button => {
      button.style.transition = 'margin 5s linear 0s';
      button.style.marginLeft = '200px';
    });
    const error = await button.click({ timeout: 100 }).catch(e => e);
    expect(error.message).toContain('timeout exceeded');
  });
  it('should wait for becoming hit target', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.$eval('button', button => {
      button.style.borderWidth = '0';
      button.style.width = '200px';
      button.style.height = '20px';
      document.body.style.margin = '0';
      document.body.style.position = 'relative';
      const flyOver = document.createElement('div');
      flyOver.className = 'flyover';
      flyOver.style.position = 'absolute';
      flyOver.style.width = '400px';
      flyOver.style.height = '20px';
      flyOver.style.left = '-200px';
      flyOver.style.top = '0';
      flyOver.style.background = 'red';
      document.body.appendChild(flyOver);
    });
    let clicked = false;
    const clickPromise = page.click('button').then(() => clicked = true);
    expect(clicked).toBe(false);

    await page.$eval('.flyover', flyOver => flyOver.style.left = '0');
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.evaluate(() => new Promise(requestAnimationFrame));
    expect(clicked).toBe(false);

    await page.$eval('.flyover', flyOver => flyOver.style.left = '200px');
    await clickPromise;
    expect(clicked).toBe(true);
    expect(await page.evaluate(() => window.result)).toBe('Clicked');
  });
  it('should timeout waiting for hit target', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    const button = await page.$('button');
    await page.evaluate(() => {
      document.body.style.position = 'relative';
      const blocker = document.createElement('div');
      blocker.style.position = 'absolute';
      blocker.style.width = '400px';
      blocker.style.height = '20px';
      blocker.style.left = '0';
      blocker.style.top = '0';
      document.body.appendChild(blocker);
    });
    const error = await button.click({ timeout: 100 }).catch(e => e);
    expect(error.message).toContain('timeout exceeded');
  });
  it('should fail when obscured and not waiting for hit target', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    const button = await page.$('button');
    await page.evaluate(() => {
      document.body.style.position = 'relative';
      const blocker = document.createElement('div');
      blocker.style.position = 'absolute';
      blocker.style.width = '400px';
      blocker.style.height = '20px';
      blocker.style.left = '0';
      blocker.style.top = '0';
      document.body.appendChild(blocker);
    });
    await button.click({ force: true });
    expect(await page.evaluate(() => window.result)).toBe('Was not clicked');
  });

  it('should climb dom for pointer-events:none targets', async({page, server}) => {
    await page.setContent('<button><label style="pointer-events:none">Click target</label></button>')
    await page.click('text=Click target');
  });
  it('should update modifiers correctly', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.click('button', { modifiers: ['Shift'] });
    expect(await page.evaluate(() => shiftKey)).toBe(true);
    await page.click('button', { modifiers: [] });
    expect(await page.evaluate(() => shiftKey)).toBe(false);

    await page.keyboard.down('Shift');
    await page.click('button', { modifiers: [] });
    expect(await page.evaluate(() => shiftKey)).toBe(false);
    await page.click('button');
    expect(await page.evaluate(() => shiftKey)).toBe(true);
    await page.keyboard.up('Shift');
    await page.click('button');
    expect(await page.evaluate(() => shiftKey)).toBe(false);
  });
  it('should click an offscreen element when scroll-behavior is smooth', async({page}) => {
    await page.setContent(`
      <div style="border: 1px solid black; height: 500px; overflow: auto; width: 500px; scroll-behavior: smooth">
      <button style="margin-top: 2000px" onClick="window.clicked = true">hi</button>
      </div>
    `);
    await page.click('button');
    expect(await page.evaluate('window.clicked')).toBe(true);
  });
  it('should report nice error when element is detached and force-clicked', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/animating-button.html');
    await page.evaluate(() => addButton());
    const handle = await page.$('button');
    await page.evaluate(() => stopButton(true));
    const promise = handle.click({ force: true }).catch(e => e);
    const error = await promise;
    expect(await page.evaluate(() => window.clicked)).toBe(undefined);
    expect(error.message).toContain('Element is not attached to the DOM');
    expect(error.name).toContain('NotConnectedError');
  });
  it('should fail when element detaches after animation', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/animating-button.html');
    await page.evaluate(() => addButton());
    const handle = await page.$('button');
    const promise = handle.click().catch(e => e);
    await page.evaluate(() => stopButton(true));
    const error = await promise;
    expect(await page.evaluate(() => window.clicked)).toBe(undefined);
    expect(error.message).toContain('Element is not attached to the DOM');
    expect(error.name).toContain('NotConnectedError');
  });
  it('should retry when element detaches after animation', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/animating-button.html');
    await page.evaluate(() => addButton());
    let clicked = false;
    const promise = page.click('button').then(() => clicked = true);
    expect(clicked).toBe(false);
    expect(await page.evaluate(() => window.clicked)).toBe(undefined);
    await page.evaluate(() => stopButton(true));
    await page.evaluate(() => addButton());
    expect(clicked).toBe(false);
    expect(await page.evaluate(() => window.clicked)).toBe(undefined);
    await page.evaluate(() => stopButton(true));
    await page.evaluate(() => addButton());
    expect(clicked).toBe(false);
    expect(await page.evaluate(() => window.clicked)).toBe(undefined);
    await page.evaluate(() => stopButton(false));
    await promise;
    expect(clicked).toBe(true);
    expect(await page.evaluate(() => window.clicked)).toBe(true);
  });
  it('should fail when element jumps during hit testing', async({page, server}) => {
    await page.setContent('<button>Click me</button>');
    let clicked = false;
    const handle = await page.$('button');
    const __testHookBeforeHitTarget = () => page.evaluate(() => {
      const margin = parseInt(document.querySelector('button').style.marginLeft || 0) + 100;
      document.querySelector('button').style.marginLeft = margin + 'px';
    });
    const promise = handle.click({ timeout: 1000, __testHookBeforeHitTarget }).then(() => clicked = true).catch(e => e);
    const error = await promise;
    expect(clicked).toBe(false);
    expect(await page.evaluate(() => window.clicked)).toBe(undefined);
    expect(error.message).toContain('timeout exceeded');
  });
  it.skip(true)('should pause animations', async({page}) => {
    // This test requires pausing the page.
    await page.setContent(`<style>
      @keyframes spinner {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .spinner {
        animation: spinner 2s linear infinite;
        animation-delay: 500ms;
      }
      </style>
      <div class="spinner" style="width: 500px; height: 500px; display: flex; justify-content: center;" >
        <button id="target"
                style="width: 30px; height: 30px; background-color: green"
                onclick="window.clicked=true"></button>
      </div>
    `);
    await page.click('#target', { __testHookBeforeHitTarget: () => new Promise(f => setTimeout(f, 1000)) });
    expect(await page.evaluate(() => window.clicked)).toBe(true);
  });
  it.skip(true)('should defer timers', async({page}) => {
    // This test requires pausing the page.
    await page.setContent(`<button id=button onclick="window.clicked=true">Click me</button>`);
    await page.click('button', { __testHookBeforeHitTarget: async () => {
      // Schedule a timer that hides the element
      await page.evaluate(() => setTimeout(() => button.style.display = 'none', 0));
      // Allow enough time for timer to fire
      await page.waitForTimeout(500);
    }});
    expect(await page.evaluate(() => window.clicked)).toBe(true);
  });
  it.skip(true)('should defer rafs', async({page}) => {
    // This test requires pausing the page.
    await page.setContent(`<button id=button onclick="window.clicked=true">Click me</button>`);
    await page.click('button', { __testHookBeforeHitTarget: async () => {
      // Schedule a timer that hides the element
      await page.evaluate(() => requestAnimationFrame(() => button.style.display = 'none'));
      // Allow enough time for raf to fire
      await page.waitForTimeout(500);
    }});
    expect(await page.evaluate(() => window.clicked)).toBe(true);
  });
  it.skip(true)('should defer fetch', async({page, server}) => {
    // This test requires pausing the page.
    await page.goto(server.EMPTY_PAGE);
    await page.setContent(`<button id=button onclick="window.clicked=true">Click me</button>`);
    await page.click('button', { __testHookBeforeHitTarget: async () => {
      // Fetch that would immediately delete button.
      page.evaluate(() => fetch(window.location.href).then(() => button.style.display = 'none'));
      // Allow enough time for raf to fire
      await page.waitForTimeout(500);
    }});
    expect(await page.evaluate(() => window.clicked)).toBe(true);
  });
  it('should dispatch microtasks in order', async({page, server}) => {
    await page.setContent(`
      <button id=button>Click me</button>
      <script>
        let mutationCount = 0;
        const observer = new MutationObserver((mutationsList, observer) => {
          for(let mutation of mutationsList)
            ++mutationCount;
        });
        observer.observe(document.body, { attributes: true, childList: true, subtree: true });
        button.addEventListener('mousedown', () => {
          mutationCount = 0;
          document.body.appendChild(document.createElement('div'));
        });
        button.addEventListener('mouseup', () => {
          window.result = mutationCount;
        });
      </script>
    `);
    await page.click('button');
    expect(await page.evaluate(() => window.result)).toBe(1);
  });
});

describe('Page.check', function() {
  it('should check the box', async({page}) => {
    await page.setContent(`<input id='checkbox' type='checkbox'></input>`);
    await page.check('input');
    expect(await page.evaluate(() => checkbox.checked)).toBe(true);
  });
  it('should not check the checked box', async({page}) => {
    await page.setContent(`<input id='checkbox' type='checkbox' checked></input>`);
    await page.check('input');
    expect(await page.evaluate(() => checkbox.checked)).toBe(true);
  });
  it('should uncheck the box', async({page}) => {
    await page.setContent(`<input id='checkbox' type='checkbox' checked></input>`);
    await page.uncheck('input');
    expect(await page.evaluate(() => checkbox.checked)).toBe(false);
  });
  it('should not uncheck the unchecked box', async({page}) => {
    await page.setContent(`<input id='checkbox' type='checkbox'></input>`);
    await page.uncheck('input');
    expect(await page.evaluate(() => checkbox.checked)).toBe(false);
  });
  it('should check the box by label', async({page}) => {
    await page.setContent(`<label for='checkbox'><input id='checkbox' type='checkbox'></input></label>`);
    await page.check('label');
    expect(await page.evaluate(() => checkbox.checked)).toBe(true);
  });
  it('should check the box outside label', async({page}) => {
    await page.setContent(`<label for='checkbox'>Text</label><div><input id='checkbox' type='checkbox'></input></div>`);
    await page.check('label');
    expect(await page.evaluate(() => checkbox.checked)).toBe(true);
  });
  it('should check the box inside label w/o id', async({page}) => {
    await page.setContent(`<label>Text<span><input id='checkbox' type='checkbox'></input></span></label>`);
    await page.check('label');
    expect(await page.evaluate(() => checkbox.checked)).toBe(true);
  });
  it('should check radio', async({page}) => {
    await page.setContent(`
      <input type='radio'>one</input>
      <input id='two' type='radio'>two</input>
      <input type='radio'>three</input>`);
    await page.check('#two');
    expect(await page.evaluate(() => two.checked)).toBe(true);
  });
  it('should check the box by aria role', async({page}) => {
    await page.setContent(`<div role='checkbox' id='checkbox'>CHECKBOX</div>
      <script>
        checkbox.addEventListener('click', () => checkbox.setAttribute('aria-checked', 'true'));
      </script>`);
    await page.check('div');
    expect(await page.evaluate(() => checkbox.getAttribute('aria-checked'))).toBe('true');
  });
});
