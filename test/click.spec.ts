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

import { it, expect } from './fixtures';
import { attachFrame } from './utils';

async function giveItAChanceToClick(page) {
  for (let i = 0; i < 5; i++)
    await page.evaluate(() => new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f))));
}

it('should click the button', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should click svg', async ({page, server}) => {
  await page.setContent(`
    <svg height="100" width="100">
      <circle onclick="javascript:window.__CLICKED=42" cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
    </svg>
  `);
  await page.click('circle');
  expect(await page.evaluate('__CLICKED')).toBe(42);
});

it('should click the button if window.Node is removed', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.evaluate(() => delete window.Node);
  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
});

// @see https://github.com/GoogleChrome/puppeteer/issues/4281
it('should click on a span with an inline element inside', async ({page, server}) => {
  await page.setContent(`
    <style>
    span::before {
      content: 'q';
    }
    </style>
    <span onclick='javascript:window.CLICKED=42'></span>
  `);
  await page.click('span');
  expect(await page.evaluate('CLICKED')).toBe(42);
});

it('should not throw UnhandledPromiseRejection when page closes', async ({browser, server}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await Promise.all([
    page.close(),
    page.mouse.click(1, 2),
  ]).catch(e => {});
  await context.close();
});

it('should click the 1x1 div', async ({page, server}) => {
  await page.setContent(`<div style="width: 1px; height: 1px;" onclick="window.__clicked = true"></div>`);
  await page.click('div');
  expect(await page.evaluate('window.__clicked')).toBe(true);
});

it('should click the button after navigation ', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.click('button');
  await page.goto(server.PREFIX + '/input/button.html');
  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should click the button after a cross origin navigation ', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.click('button');
  await page.goto(server.CROSS_PROCESS_PREFIX + '/input/button.html');
  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should click with disabled javascript', async ({browser, server}) => {
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

it('should click when one of inline box children is outside of viewport', async ({page, server}) => {
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
  expect(await page.evaluate('CLICKED')).toBe(42);
});

it('should select the text by triple clicking', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  const text = 'This is the text that we are going to try to select. Let\'s see how it goes.';
  await page.fill('textarea', text);
  await page.click('textarea', { clickCount: 3 });
  expect(await page.evaluate(() => {
    const textarea = document.querySelector('textarea');
    return textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
  })).toBe(text);
});

it('should click offscreen buttons', async ({page, server}) => {
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

it('should waitFor visible when already visible', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should not wait with force', async ({page, server}) => {
  let error = null;
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', b => b.style.display = 'none');
  await page.click('button', { force: true }).catch(e => error = e);
  expect(error.message).toContain('Element is not visible');
  expect(await page.evaluate('result')).toBe('Was not clicked');
});

it('should waitFor display:none to be gone', async ({page, server}) => {
  let done = false;
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', b => b.style.display = 'none');
  const clicked = page.click('button', { timeout: 0 }).then(() => done = true);
  await giveItAChanceToClick(page);
  expect(await page.evaluate('result')).toBe('Was not clicked');
  expect(done).toBe(false);
  await page.$eval('button', b => b.style.display = 'block');
  await clicked;
  expect(done).toBe(true);
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should waitFor visibility:hidden to be gone', async ({page, server}) => {
  let done = false;
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', b => b.style.visibility = 'hidden');
  const clicked = page.click('button', { timeout: 0 }).then(() => done = true);
  await giveItAChanceToClick(page);
  expect(await page.evaluate('result')).toBe('Was not clicked');
  expect(done).toBe(false);
  await page.$eval('button', b => b.style.visibility = 'visible');
  await clicked;
  expect(done).toBe(true);
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should waitFor visible when parent is hidden', async ({page, server}) => {
  let done = false;
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', b => b.parentElement.style.display = 'none');
  const clicked = page.click('button', { timeout: 0 }).then(() => done = true);
  await giveItAChanceToClick(page);
  expect(done).toBe(false);
  await page.$eval('button', b => b.parentElement.style.display = 'block');
  await clicked;
  expect(done).toBe(true);
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should click wrapped links', async ({page, server}) => {
  await page.goto(server.PREFIX + '/wrappedlink.html');
  await page.click('a');
  expect(await page.evaluate('__clicked')).toBe(true);
});

it('should click on checkbox input and toggle', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/checkbox.html');
  expect(await page.evaluate(() => window['result'].check)).toBe(null);
  await page.click('input#agree');
  expect(await page.evaluate(() => window['result'].check)).toBe(true);
  expect(await page.evaluate(() => window['result'].events)).toEqual([
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
  expect(await page.evaluate(() => window['result'].check)).toBe(false);
});

it('should click on checkbox label and toggle', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/checkbox.html');
  expect(await page.evaluate(() => window['result'].check)).toBe(null);
  await page.click('label[for="agree"]');
  expect(await page.evaluate(() => window['result'].check)).toBe(true);
  expect(await page.evaluate(() => window['result'].events)).toEqual([
    'click',
    'input',
    'change',
  ]);
  await page.click('label[for="agree"]');
  expect(await page.evaluate(() => window['result'].check)).toBe(false);
});

it('should not hang with touch-enabled viewports', async ({browser, playwright}) => {
  // @see https://github.com/GoogleChrome/puppeteer/issues/161
  const { viewport, hasTouch } = playwright.devices['iPhone 6'];
  const context = await browser.newContext({ viewport, hasTouch });
  const page = await context.newPage();
  await page.mouse.down();
  await page.mouse.move(100, 10);
  await page.mouse.up();
  await context.close();
});

it('should scroll and click the button', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/scrollable.html');
  await page.click('#button-5');
  expect(await page.evaluate(() => document.querySelector('#button-5').textContent)).toBe('clicked');
  await page.click('#button-80');
  expect(await page.evaluate(() => document.querySelector('#button-80').textContent)).toBe('clicked');
});

it('should double click the button', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.evaluate(() => {
    window['double'] = false;
    const button = document.querySelector('button');
    button.addEventListener('dblclick', event => {
      window['double'] = true;
    });
  });
  await page.dblclick('button');
  expect(await page.evaluate('double')).toBe(true);
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should click a partially obscured button', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.evaluate(() => {
    const button = document.querySelector('button');
    button.textContent = 'Some really long text that will go offscreen';
    button.style.position = 'absolute';
    button.style.left = '368px';
  });
  await page.click('button');
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
});

it('should click a rotated button', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/rotatedButton.html');
  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should fire contextmenu event on right click', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/scrollable.html');
  await page.click('#button-8', {button: 'right'});
  expect(await page.evaluate(() => document.querySelector('#button-8').textContent)).toBe('context menu');
});

it('should click links which cause navigation', async ({page, server}) => {
  // @see https://github.com/GoogleChrome/puppeteer/issues/206
  await page.setContent(`<a href="${server.EMPTY_PAGE}">empty.html</a>`);
  // This await should not hang.
  await page.click('a');
});

it('should click the button inside an iframe', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<div style="width:100px;height:100px">spacer</div>');
  await attachFrame(page, 'button-test', server.PREFIX + '/input/button.html');
  const frame = page.frames()[1];
  const button = await frame.$('button');
  await button.click();
  expect(await frame.evaluate(() => window['result'])).toBe('Clicked');
});

it('should click the button with fixed position inside an iframe', (test, { browserName }) => {
  test.fixme(browserName === 'chromium' || browserName === 'webkit');
}, async ({page, server}) => {
  // @see https://github.com/GoogleChrome/puppeteer/issues/4110
  // @see https://bugs.chromium.org/p/chromium/issues/detail?id=986390
  // @see https://chromium-review.googlesource.com/c/chromium/src/+/1742784
  await page.goto(server.EMPTY_PAGE);
  await page.setViewportSize({width: 500, height: 500});
  await page.setContent('<div style="width:100px;height:2000px">spacer</div>');
  await attachFrame(page, 'button-test', server.CROSS_PROCESS_PREFIX + '/input/button.html');
  const frame = page.frames()[1];
  await frame.$eval('button', button => button.style.setProperty('position', 'fixed'));
  await frame.click('button');
  expect(await frame.evaluate(() => window['result'])).toBe('Clicked');
});

it('should click the button with deviceScaleFactor set', async ({browser, server}) => {
  const context = await browser.newContext({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 5 });
  const page = await context.newPage();
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(5);
  await page.setContent('<div style="width:100px;height:100px">spacer</div>');
  await attachFrame(page, 'button-test', server.PREFIX + '/input/button.html');
  const frame = page.frames()[1];
  const button = await frame.$('button');
  await button.click();
  expect(await frame.evaluate(() => window['result'])).toBe('Clicked');
  await context.close();
});

it('should click the button with px border with offset', async ({page, server, isWebKit}) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', button => button.style.borderWidth = '8px');
  await page.click('button', { position: { x: 20, y: 10 } });
  expect(await page.evaluate('result')).toBe('Clicked');
  // Safari reports border-relative offsetX/offsetY.
  expect(await page.evaluate('offsetX')).toBe(isWebKit ? 20 + 8 : 20);
  expect(await page.evaluate('offsetY')).toBe(isWebKit ? 10 + 8 : 10);
});

it('should click the button with em border with offset', async ({page, server, isWebKit}) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', button => button.style.borderWidth = '2em');
  await page.$eval('button', button => button.style.fontSize = '12px');
  await page.click('button', { position: { x: 20, y: 10 } });
  expect(await page.evaluate('result')).toBe('Clicked');
  // Safari reports border-relative offsetX/offsetY.
  expect(await page.evaluate('offsetX')).toBe(isWebKit ? 12 * 2 + 20 : 20);
  expect(await page.evaluate('offsetY')).toBe(isWebKit ? 12 * 2 + 10 : 10);
});

it('should click a very large button with offset', async ({page, server, isWebKit}) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', button => button.style.borderWidth = '8px');
  await page.$eval('button', button => button.style.height = button.style.width = '2000px');
  await page.click('button', { position: { x: 1900, y: 1910 } });
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
  // Safari reports border-relative offsetX/offsetY.
  expect(await page.evaluate('offsetX')).toBe(isWebKit ? 1900 + 8 : 1900);
  expect(await page.evaluate('offsetY')).toBe(isWebKit ? 1910 + 8 : 1910);
});

it('should click a button in scrolling container with offset', async ({page, server, isWebKit}) => {
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
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
  // Safari reports border-relative offsetX/offsetY.
  expect(await page.evaluate('offsetX')).toBe(isWebKit ? 1900 + 8 : 1900);
  expect(await page.evaluate('offsetY')).toBe(isWebKit ? 1910 + 8 : 1910);
});

it('should click the button with offset with page scale', (test, { browserName }) => {
  test.skip(browserName === 'firefox');
}, async ({browser, server, isWebKit, isChromium, headful}) => {
  const context = await browser.newContext({ viewport: { width: 400, height: 400 }, isMobile: true });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', button => {
    button.style.borderWidth = '8px';
    document.body.style.margin = '0';
  });
  await page.click('button', { position: { x: 20, y: 10 } });
  expect(await page.evaluate('result')).toBe('Clicked');
  const round = x => Math.round(x + 0.01);
  let expected = { x: 28, y: 18 };  // 20;10 + 8px of border in each direction
  if (isWebKit) {
    // WebKit rounds up during css -> dip -> css conversion.
    expected = { x: 29, y: 19 };
  } else if (isChromium && !headful) {
    // Headless Chromium rounds down during css -> dip -> css conversion.
    expected = { x: 27, y: 18 };
  }
  expect(round(await page.evaluate('pageX'))).toBe(expected.x);
  expect(round(await page.evaluate('pageY'))).toBe(expected.y);
  await context.close();
});

it('should wait for stable position', async ({page, server}) => {
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
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
  expect(await page.evaluate('pageX')).toBe(300);
  expect(await page.evaluate('pageY')).toBe(10);
});

it('should wait for becoming hit target', async ({page, server}) => {
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
  await giveItAChanceToClick(page);
  expect(clicked).toBe(false);

  await page.$eval('.flyover', flyOver => flyOver.style.left = '200px');
  await clickPromise;
  expect(clicked).toBe(true);
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
});

it('should fail when obscured and not waiting for hit target', async ({page, server}) => {
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
  expect(await page.evaluate(() => window['result'])).toBe('Was not clicked');
});

it('should wait for button to be enabled', async ({page, server}) => {
  await page.setContent('<button onclick="javascript:window.__CLICKED=true;" disabled><span>Click target</span></button>');
  let done = false;
  const clickPromise = page.click('text=Click target').then(() => done = true);
  await giveItAChanceToClick(page);
  expect(await page.evaluate('window.__CLICKED')).toBe(undefined);
  expect(done).toBe(false);
  await page.evaluate(() => document.querySelector('button').removeAttribute('disabled'));
  await clickPromise;
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should wait for input to be enabled', async ({page, server}) => {
  await page.setContent('<input onclick="javascript:window.__CLICKED=true;" disabled>');
  let done = false;
  const clickPromise = page.click('input').then(() => done = true);
  await giveItAChanceToClick(page);
  expect(await page.evaluate('window.__CLICKED')).toBe(undefined);
  expect(done).toBe(false);
  await page.evaluate(() => document.querySelector('input').removeAttribute('disabled'));
  await clickPromise;
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should wait for select to be enabled', async ({page, server}) => {
  await page.setContent('<select onclick="javascript:window.__CLICKED=true;" disabled><option selected>Hello</option></select>');
  let done = false;
  const clickPromise = page.click('select').then(() => done = true);
  await giveItAChanceToClick(page);
  expect(await page.evaluate('window.__CLICKED')).toBe(undefined);
  expect(done).toBe(false);
  await page.evaluate(() => document.querySelector('select').removeAttribute('disabled'));
  await clickPromise;
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should click disabled div', async ({page, server}) => {
  await page.setContent('<div onclick="javascript:window.__CLICKED=true;" disabled>Click target</div>');
  await page.click('text=Click target');
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should climb dom for inner label with pointer-events:none', async ({page, server}) => {
  await page.setContent('<button onclick="javascript:window.__CLICKED=true;"><label style="pointer-events:none">Click target</label></button>');
  await page.click('text=Click target');
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should climb up to [role=button]', async ({page, server}) => {
  await page.setContent('<div role=button onclick="javascript:window.__CLICKED=true;"><div style="pointer-events:none"><span><div>Click target</div></span></div>');
  await page.click('text=Click target');
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should wait for BUTTON to be clickable when it has pointer-events:none', async ({page, server}) => {
  await page.setContent('<button onclick="javascript:window.__CLICKED=true;" style="pointer-events:none"><span>Click target</span></button>');
  let done = false;
  const clickPromise = page.click('text=Click target').then(() => done = true);
  await giveItAChanceToClick(page);
  expect(await page.evaluate('window.__CLICKED')).toBe(undefined);
  expect(done).toBe(false);
  await page.evaluate(() => document.querySelector('button').style.removeProperty('pointer-events'));
  await clickPromise;
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should wait for LABEL to be clickable when it has pointer-events:none', async ({page, server}) => {
  await page.setContent('<label onclick="javascript:window.__CLICKED=true;" style="pointer-events:none"><span>Click target</span></label>');
  const clickPromise = page.click('text=Click target');
  // Do a few roundtrips to the page.
  for (let i = 0; i < 5; ++i)
    expect(await page.evaluate('window.__CLICKED')).toBe(undefined);
  // remove `pointer-events: none` css from button.
  await page.evaluate(() => document.querySelector('label').style.removeProperty('pointer-events'));
  await clickPromise;
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should update modifiers correctly', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.click('button', { modifiers: ['Shift'] });
  expect(await page.evaluate('shiftKey')).toBe(true);
  await page.click('button', { modifiers: [] });
  expect(await page.evaluate('shiftKey')).toBe(false);

  await page.keyboard.down('Shift');
  await page.click('button', { modifiers: [] });
  expect(await page.evaluate('shiftKey')).toBe(false);
  await page.click('button');
  expect(await page.evaluate('shiftKey')).toBe(true);
  await page.keyboard.up('Shift');
  await page.click('button');
  expect(await page.evaluate('shiftKey')).toBe(false);
});

it('should click an offscreen element when scroll-behavior is smooth', async ({page}) => {
  await page.setContent(`
    <div style="border: 1px solid black; height: 500px; overflow: auto; width: 500px; scroll-behavior: smooth">
    <button style="margin-top: 2000px" onClick="window.clicked = true">hi</button>
    </div>
  `);
  await page.click('button');
  expect(await page.evaluate('window.clicked')).toBe(true);
});

it('should report nice error when element is detached and force-clicked', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/animating-button.html');
  await page.evaluate('addButton()');
  const handle = await page.$('button');
  await page.evaluate('stopButton(true)');
  const promise = handle.click({ force: true }).catch(e => e);
  const error = await promise;
  expect(await page.evaluate('window.clicked')).toBe(undefined);
  expect(error.message).toContain('Element is not attached to the DOM');
});

it('should fail when element detaches after animation', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/animating-button.html');
  await page.evaluate('addButton()');
  const handle = await page.$('button');
  const promise = handle.click().catch(e => e);
  await page.evaluate('stopButton(true)');
  const error = await promise;
  expect(await page.evaluate('window.clicked')).toBe(undefined);
  expect(error.message).toContain('Element is not attached to the DOM');
});

it('should retry when element detaches after animation', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/animating-button.html');
  await page.evaluate('addButton()');
  let clicked = false;
  const promise = page.click('button').then(() => clicked = true);
  expect(clicked).toBe(false);
  expect(await page.evaluate('window.clicked')).toBe(undefined);
  await page.evaluate('stopButton(true)');
  await page.evaluate('addButton()');
  expect(clicked).toBe(false);
  expect(await page.evaluate('window.clicked')).toBe(undefined);
  await page.evaluate('stopButton(true)');
  await page.evaluate('addButton()');
  expect(clicked).toBe(false);
  expect(await page.evaluate('window.clicked')).toBe(undefined);
  await page.evaluate('stopButton(false)');
  await promise;
  expect(clicked).toBe(true);
  expect(await page.evaluate('clicked')).toBe(true);
});

it('should retry when element is animating from outside the viewport', async ({page, server}) => {
  await page.setContent(`<style>
    @keyframes move {
      from { left: -300px; }
      to { left: 0; }
    }
    button {
      position: absolute;
      left: -300px;
      top: 0;
      bottom: 0;
      width: 200px;
    }
    button.animated {
      animation: 1s linear 1s move forwards;
    }
    </style>
    <div style="position: relative; width: 300px; height: 300px;">
      <button onclick="window.clicked=true"></button>
    </div>
  `);
  const handle = await page.$('button');
  const promise = handle.click();
  await handle.evaluate(button => button.className = 'animated');
  await promise;
  expect(await page.evaluate('clicked')).toBe(true);
});

it('should fail when element is animating from outside the viewport with force', async ({page, server}) => {
  await page.setContent(`<style>
    @keyframes move {
      from { left: -300px; }
      to { left: 0; }
    }
    button {
      position: absolute;
      left: -300px;
      top: 0;
      bottom: 0;
      width: 200px;
    }
    button.animated {
      animation: 1s linear 1s move forwards;
    }
    </style>
    <div style="position: relative; width: 300px; height: 300px;">
      <button onclick="window.clicked=true"></button>
    </div>
  `);
  const handle = await page.$('button');
  const promise = handle.click({ force: true }).catch(e => e);
  await handle.evaluate(button => button.className = 'animated');
  const error = await promise;
  expect(await page.evaluate('window.clicked')).toBe(undefined);
  expect(error.message).toContain('Element is outside of the viewport');
});

it('should dispatch microtasks in order', async ({page, server}) => {
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
        window['result'] = mutationCount;
      });
    </script>
  `);
  await page.click('button');
  expect(await page.evaluate(() => window['result'])).toBe(1);
});

it('should click the button when window.innerWidth is corrupted', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.evaluate(() => Object.defineProperty(window, 'innerWidth', {value: 0}));
  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
});
