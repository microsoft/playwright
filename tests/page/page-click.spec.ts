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

import { test as it, expect, rafraf } from './pageTest';
import { attachFrame, detachFrame } from '../config/utils';
import type { Page } from '@playwright/test';

const giveItAChanceToClick = (page: Page) => rafraf(page, 5);

it('should click the button @smoke', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should click button inside frameset', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/frames/frameset.html');
  const frameElement = await page.$('frame');
  await frameElement.evaluate((frame: HTMLFrameElement) => frame.src = '/input/button.html');
  const frame = await frameElement.contentFrame();
  await frame.click('button');
  expect(await frame.evaluate('result')).toBe('Clicked');
});

it('should issue clicks in parallel in page and popup', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/counter.html');
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window.open('/counter.html')),
  ]);
  const clickPromises = [];
  for (let i = 0; i < 21; ++i) {
    if (i % 3 === 0)
      clickPromises.push(popup.locator('button').click());
    else
      clickPromises.push(page.locator('button').click());
  }
  await Promise.all(clickPromises);
  expect(await page.evaluate(() => window['count'])).toBe(14);
  expect(await popup.evaluate(() => window['count'])).toBe(7);
});

it('should click svg', async ({ page }) => {
  await page.setContent(`
    <svg height="100" width="100">
      <circle onclick="window.__CLICKED=42" cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
    </svg>
  `);
  await page.click('circle');
  expect(await page.evaluate('__CLICKED')).toBe(42);
});

it('should click the button if window.Node is removed', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.evaluate(() => delete window.Node);
  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
});

// @see https://github.com/GoogleChrome/puppeteer/issues/4281
it('should click on a span with an inline element inside', async ({ page }) => {
  await page.setContent(`
    <style>
    span::before {
      content: 'q';
    }
    </style>
    <span onclick='window.CLICKED=42'></span>
  `);
  await page.click('span');
  expect(await page.evaluate('CLICKED')).toBe(42);
});

it('should click the aligned 1x1 div', async ({ page }) => {
  await page.setContent(`<div style="width: 1px; height: 1px;" onclick="window.__clicked = true"></div>`);
  await page.click('div');
  expect(await page.evaluate('window.__clicked')).toBe(true);
});

it('should click the half-aligned 1x1 div', async ({ page }) => {
  await page.setContent(`<div style="margin-left: 20.5px; margin-top: 11.5px; width: 1px; height: 1px;" onclick="window.__clicked = true"></div>`);
  await page.click('div');
  expect(await page.evaluate('window.__clicked')).toBe(true);
});

it('should click the unaligned 1x1 div v1', async ({ page }) => {
  await page.setContent(`<div style="margin-left: 20.23px; margin-top: 11.65px; width: 1px; height: 1px;" onclick="window.__clicked = true"></div>`);
  await page.click('div');
  expect(await page.evaluate('window.__clicked')).toBe(true);
});

it('should click the unaligned 1x1 div v2', async ({ page }) => {
  await page.setContent(`<div style="margin-left: 20.68px; margin-top: 11.13px; width: 1px; height: 1px;" onclick="window.__clicked = true"></div>`);
  await page.click('div');
  expect(await page.evaluate('window.__clicked')).toBe(true);
});

it('should click the unaligned 1x1 div v3', async ({ page }) => {
  await page.setContent(`<div style="margin-left: 20.68px; margin-top: 11.52px; width: 1px; height: 1px;" onclick="window.__clicked = true"></div>`);
  await page.click('div');
  expect(await page.evaluate('window.__clicked')).toBe(true);
});

it('should click the unaligned 1x1 div v4', async ({ page }) => {
  await page.setContent(`<div style="margin-left: 20.15px; margin-top: 11.24px; width: 1px; height: 1px;" onclick="window.__clicked = true"></div>`);
  await page.click('div');
  expect(await page.evaluate('window.__clicked')).toBe(true);
});

it('should click the button after navigation ', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.click('button');
  await page.goto(server.PREFIX + '/input/button.html');
  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should click the button after a cross origin navigation ', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.click('button');
  await page.goto(server.CROSS_PROCESS_PREFIX + '/input/button.html');
  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should click when one of inline box children is outside of viewport', async ({ page }) => {
  await page.setContent(`
    <style>
    i {
      position: absolute;
      top: -1000px;
    }
    </style>
    <span onclick='window.CLICKED = 42;'><i>woof</i><b>doggo</b></span>
  `);
  await page.click('span');
  expect(await page.evaluate('CLICKED')).toBe(42);
});

it('should select the text by triple clicking', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  const text = 'This is the text that we are going to try to select. Let\'s see how it goes.';
  await page.fill('textarea', text);
  await page.click('textarea', { clickCount: 3 });
  expect(await page.evaluate(() => {
    const textarea = document.querySelector('textarea');
    return textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
  })).toBe(text);
});

it('should click offscreen buttons', async ({ page, server, browserName, headless }) => {
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

it('should waitFor visible when already visible', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should not wait with force', async ({ page, server }) => {
  let error = null;
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', b => b.style.display = 'none');
  await page.click('button', { force: true }).catch(e => error = e);
  expect(error.message).toContain('Element is not visible');
  expect(await page.evaluate('result')).toBe('Was not clicked');
});

it('should waitFor display:none to be gone', async ({ page, server }) => {
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

it('should waitFor visibility:hidden to be gone', async ({ page, server }) => {
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

it('should waitFor visible when parent is hidden', async ({ page, server }) => {
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

it('should click wrapped links', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/wrappedlink.html');
  await page.click('a');
  expect(await page.evaluate('__clicked')).toBe(true);
});

it('should click on checkbox input and toggle', async ({ page, server }) => {
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

it('should click on checkbox label and toggle', async ({ page, server }) => {
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

it('should scroll and click the button', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/scrollable.html');
  await page.click('#button-5');
  expect(await page.evaluate(() => document.querySelector('#button-5').textContent)).toBe('clicked');
  await page.click('#button-80');
  expect(await page.evaluate(() => document.querySelector('#button-80').textContent)).toBe('clicked');
});

it('should scroll and click the button with smooth scroll behavior', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/12370' });
  await page.goto(server.PREFIX + '/input/scrollable.html');
  await page.addStyleTag({ content: 'html { scroll-behavior: smooth; }' });
  for (let i = 0; i < 10; i++) {
    await page.click('#button-80');
    expect(await page.evaluate(() => document.querySelector('#button-80').textContent)).toBe('clicked');
    await page.click('#button-20');
    expect(await page.evaluate(() => document.querySelector('#button-20').textContent)).toBe('clicked');
  }
});

it('should double click the button', async ({ page, server }) => {
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

it('should click a partially obscured button', async ({ page, server }) => {
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

it('should click a rotated button', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/rotatedButton.html');
  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should fire contextmenu event on right click', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/scrollable.html');
  await page.click('#button-8', { button: 'right' });
  expect(await page.evaluate(() => document.querySelector('#button-8').textContent)).toBe('context menu');
});

it('should click links which cause navigation', async ({ page, server }) => {
  // @see https://github.com/GoogleChrome/puppeteer/issues/206
  await page.setContent(`<a href="${server.EMPTY_PAGE}">empty.html</a>`);
  // This await should not hang.
  await page.click('a');
});

it('should click the button inside an iframe', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<div style="width:100px;height:100px">spacer</div>');
  await attachFrame(page, 'button-test', server.PREFIX + '/input/button.html');
  const frame = page.frames()[1];
  const button = await frame.$('button');
  await button.click();
  expect(await frame.evaluate(() => window['result'])).toBe('Clicked');
});

it('should click the button with fixed position inside an iframe', async ({ page, server, browserName }) => {
  it.fixme(browserName === 'chromium');

  // @see https://github.com/GoogleChrome/puppeteer/issues/4110
  // @see https://bugs.chromium.org/p/chromium/issues/detail?id=986390
  // @see https://chromium-review.googlesource.com/c/chromium/src/+/1742784
  await page.goto(server.EMPTY_PAGE);
  await page.setViewportSize({ width: 500, height: 500 });
  await page.setContent('<div style="width:100px;height:2000px">spacer</div>');
  await attachFrame(page, 'button-test', server.CROSS_PROCESS_PREFIX + '/input/button.html');
  const frame = page.frames()[1];
  await frame.$eval('button', button => button.style.setProperty('position', 'fixed'));
  await frame.click('button');
  expect(await frame.evaluate(() => window['result'])).toBe('Clicked');
});

it('should click the button behind sticky header', async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 240 });
  await page.setContent(`
    <style>
    * {
      padding: 0;
      margin: 0;
    }
    li {
      height: 80px;
      border: 1px solid black;
    }
    ol {
      padding-top: 160px;
    }
    div.fixed {
      position: fixed;
      z-index: 1001;
      width: 100%;
      background: red;
      height: 160px;
    }
    </style>

    <div class=fixed></div>

    <ol>
    <li>hi1</li><li>hi2</li><li>hi3</li><li>hi4</li><li>hi5</li><li>hi6</li><li>hi7</li><li>hi8</li>
    <li id=target onclick="window.__clicked = true">hi9</li>
    <li>hi10</li><li>hi11</li><li>hi12</li><li>hi13</li><li id=li14>hi14</li>
    </ol>
  `);
  await page.$eval('#li14', e => e.scrollIntoView());
  await page.click('#target');
  expect(await page.evaluate(() => window['__clicked'])).toBe(true);
});

it('should click the button behind position:absolute header', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/36339' },
}, async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 240 });
  await page.setContent(`
    <style>
    * {
      padding: 0;
      margin: 0;
    }
    li {
      height: 80px;
      border: 1px solid black;
    }
    ol {
      height: 100vh;
      overflow: scroll;
      padding-top: 160px;
    }
    body {
      position: relative;
    }
    div.fixed {
      position: absolute;
      top: 0;
      z-index: 1001;
      width: 100%;
      background: red;
      height: 160px;
    }
    </style>

    <ol>
    <li>hi1</li><li>hi2</li><li>hi3</li><li>hi4</li><li>hi5</li><li>hi6</li><li>hi7</li><li>hi8</li>
    <li id=target onclick="window.__clicked = true">hi9</li>
    <li>hi10</li><li>hi11</li><li>hi12</li><li>hi13</li><li id=li14>hi14</li>
    </ol>

    <div class=fixed>Overlay</div>
  `);
  await page.$eval('ol', e => {
    const target = document.querySelector('#target') as HTMLElement;
    e.scrollTo({ top: target.offsetTop, behavior: 'instant' });
  });
  await page.click('#target');
  expect(await page.evaluate(() => window['__clicked'])).toBe(true);
});

it('should click the button with px border with offset', async ({ page, server, browserName }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', button => button.style.borderWidth = '8px');
  await page.click('button', { position: { x: 20, y: 10 } });
  expect(await page.evaluate('result')).toBe('Clicked');
  // Safari reports border-relative offsetX/offsetY.
  expect(await page.evaluate('offsetX')).toBe(browserName === 'webkit' ? 20 + 8 : 20);
  expect(await page.evaluate('offsetY')).toBe(browserName === 'webkit' ? 10 + 8 : 10);
});

it('should click the button with em border with offset', async ({ page, server, browserName }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', button => button.style.borderWidth = '2em');
  await page.$eval('button', button => button.style.fontSize = '12px');
  await page.click('button', { position: { x: 20, y: 10 } });
  expect(await page.evaluate('result')).toBe('Clicked');
  // Safari reports border-relative offsetX/offsetY.
  expect(await page.evaluate('offsetX')).toBe(browserName === 'webkit' ? 12 * 2 + 20 : 20);
  expect(await page.evaluate('offsetY')).toBe(browserName === 'webkit' ? 12 * 2 + 10 : 10);
});

it('should click a very large button with offset', async ({ page, server, browserName, isAndroid }) => {
  it.fixme(isAndroid, 'Failed to scroll to a particular point');
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', button => button.style.borderWidth = '8px');
  await page.$eval('button', button => button.style.height = button.style.width = '2000px');
  await page.click('button', { position: { x: 1900, y: 1910 } });
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
  // Safari reports border-relative offsetX/offsetY.
  expect(await page.evaluate('offsetX')).toBe(browserName === 'webkit' ? 1900 + 8 : 1900);
  expect(await page.evaluate('offsetY')).toBe(browserName === 'webkit' ? 1910 + 8 : 1910);
});

it('should click a button in scrolling container with offset', async ({ page, server, browserName, isAndroid }) => {
  it.fixme(isAndroid, 'Failed to scroll to a particular point');
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
  expect(await page.evaluate('offsetX')).toBe(browserName === 'webkit' ? 1900 + 8 : 1900);
  expect(await page.evaluate('offsetY')).toBe(browserName === 'webkit' ? 1910 + 8 : 1910);
});

it('should wait for stable position', async ({ page, server }) => {
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
  // rafraf for Firefox to kick in the animation.
  await rafraf(page);
  await page.click('button');
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
  expect(await page.evaluate('pageX')).toBe(300);
  expect(await page.evaluate('pageY')).toBe(10);
});

it('should wait for becoming hit target', async ({ page, server }) => {
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

it('should wait for becoming hit target with trial run', async ({ page, server }) => {
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
  const clickPromise = page.click('button', { trial: true }).then(() => clicked = true);
  expect(clicked).toBe(false);

  await page.$eval('.flyover', flyOver => flyOver.style.left = '0');
  await giveItAChanceToClick(page);
  expect(clicked).toBe(false);

  await page.$eval('.flyover', flyOver => flyOver.style.left = '200px');
  await clickPromise;
  expect(clicked).toBe(true);

  // Should not actually click.
  expect(await page.evaluate(() => window['result'])).toBe('Was not clicked');
});

it('trial run should work with short timeout', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', button => button.disabled = true);
  const error = await page.click('button', { trial: true, timeout: 2000 }).catch(e => e);
  expect(error.message).toContain('click action (trial run)');
  expect(await page.evaluate(() => window['result'])).toBe('Was not clicked');
});

it('trial run should not click', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.click('button', { trial: true });
  expect(await page.evaluate(() => window['result'])).toBe('Was not clicked');
});

it('trial run should not double click', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.evaluate(() => {
    window['double'] = false;
    const button = document.querySelector('button');
    button.addEventListener('dblclick', event => {
      window['double'] = true;
    });
  });
  await page.dblclick('button', { trial: true });
  expect(await page.evaluate('double')).toBe(false);
  expect(await page.evaluate('result')).toBe('Was not clicked');
});

it('should fail when obscured and not waiting for hit target', async ({ page, server }) => {
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

it('should wait for button to be enabled', async ({ page }) => {
  await page.setContent('<button onclick="window.__CLICKED=true;" disabled><span>Click target</span></button>');
  let done = false;
  const clickPromise = page.click('text=Click target').then(() => done = true);
  await giveItAChanceToClick(page);
  expect(await page.evaluate('window.__CLICKED')).toBe(undefined);
  expect(done).toBe(false);
  await page.evaluate(() => document.querySelector('button').removeAttribute('disabled'));
  await clickPromise;
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should wait for input to be enabled', async ({ page }) => {
  await page.setContent('<input onclick="window.__CLICKED=true;" disabled>');
  let done = false;
  const clickPromise = page.click('input').then(() => done = true);
  await giveItAChanceToClick(page);
  expect(await page.evaluate('window.__CLICKED')).toBe(undefined);
  expect(done).toBe(false);
  await page.evaluate(() => document.querySelector('input').removeAttribute('disabled'));
  await clickPromise;
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should wait for select to be enabled', async ({ page }) => {
  await page.setContent(`
    <select disabled><option selected>Hello</option></select>
    <script>
      document.querySelector('select').addEventListener('mousedown', event => {
        window.__CLICKED=true;
        event.preventDefault();
      });
    </script>
  `);
  let done = false;
  const clickPromise = page.click('select').then(() => done = true);
  await giveItAChanceToClick(page);
  expect(await page.evaluate('window.__CLICKED')).toBe(undefined);
  expect(done).toBe(false);
  await page.evaluate(() => document.querySelector('select').removeAttribute('disabled'));
  await clickPromise;
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should click disabled div', async ({ page }) => {
  await page.setContent('<div onclick="window.__CLICKED=true" disabled>Click target</div>');
  await page.click('text=Click target');
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should wait for BUTTON to be clickable when it has pointer-events:none', async ({ page }) => {
  await page.setContent('<button onclick="window.__CLICKED=true" style="pointer-events:none"><span>Click target</span></button>');
  let done = false;
  const clickPromise = page.click('text=Click target').then(() => done = true);
  await giveItAChanceToClick(page);
  expect(await page.evaluate('window.__CLICKED')).toBe(undefined);
  expect(done).toBe(false);
  await page.evaluate(() => document.querySelector('button').style.removeProperty('pointer-events'));
  await clickPromise;
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should wait for LABEL to be clickable when it has pointer-events:none', async ({ page }) => {
  await page.setContent('<label onclick="window.__CLICKED=true" style="pointer-events:none"><span>Click target</span></label>');
  const clickPromise = page.click('text=Click target');
  // Do a few roundtrips to the page.
  for (let i = 0; i < 5; ++i)
    expect(await page.evaluate('window.__CLICKED')).toBe(undefined);
  // remove `pointer-events: none` css from button.
  await page.evaluate(() => document.querySelector('label').style.removeProperty('pointer-events'));
  await clickPromise;
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should update modifiers correctly', async ({ page, server }) => {
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

it('should click an offscreen element when scroll-behavior is smooth', async ({ page }) => {
  await page.setContent(`
    <div style="border: 1px solid black; height: 500px; overflow: auto; width: 500px; scroll-behavior: smooth">
    <button style="margin-top: 2000px" onClick="window.clicked = true">hi</button>
    </div>
  `);
  await page.click('button');
  expect(await page.evaluate('window.clicked')).toBe(true);
});

it('should report nice error when element is detached and force-clicked', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/animating-button.html');
  await page.evaluate('addButton()');
  const handle = await page.$('button');
  await page.evaluate('stopButton(true)');
  const promise = handle.click({ force: true }).catch(e => e);
  const error = await promise;
  expect(await page.evaluate('window.clicked')).toBe(undefined);
  expect(error.message).toContain('Element is not attached to the DOM');
});

it('should fail when element detaches after animation', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/animating-button.html');
  await page.evaluate('addButton()');
  const handle = await page.$('button');
  const promise = handle.click().catch(e => e);
  await page.evaluate('stopButton(true)');
  const error = await promise;
  expect(await page.evaluate('window.clicked')).toBe(undefined);
  expect(error.message).toContain('Element is not attached to the DOM');
});

it('should retry when element detaches after animation', async ({ page, server }) => {
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

it('should retry when element is animating from outside the viewport', async ({ page }) => {
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

it('should fail when element is animating from outside the viewport with force', async ({ page }) => {
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

it('should dispatch microtasks in order', async ({ page }) => {
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

it('should click the button when window.innerWidth is corrupted', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.evaluate(() => Object.defineProperty(window, 'innerWidth', { value: 0 }));
  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should click zero-sized input by label', async ({ page }) => {
  await page.setContent(`
    <label>
      Click me
      <input onclick="window.__clicked=true" style="width:0;height:0;padding:0;margin:0;border:0;">
    </label>
  `);
  await page.click('text=Click me');
  expect(await page.evaluate('window.__clicked')).toBe(true);
});

it('should not throw protocol error when navigating during the click', async ({ page, server, mode }) => {
  it.skip(mode !== 'default');

  await page.goto(server.PREFIX + '/input/button.html');
  let firstTime = true;
  const __testHookBeforeStable = async () => {
    if (!firstTime)
      return;
    firstTime = false;
    await page.goto(server.PREFIX + '/input/button.html');
  };
  await page.click('button', { __testHookBeforeStable } as any);
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should retry when navigating during the click', async ({ page, server, mode, isAndroid }) => {
  it.skip(mode !== 'default');
  it.fixme(isAndroid);

  await page.goto(server.PREFIX + '/input/button.html');
  let firstTime = true;
  const __testHookBeforeStable = async () => {
    if (!firstTime)
      return;
    firstTime = false;
    await page.goto(server.EMPTY_PAGE);
  };
  const error = await page.click('button', { __testHookBeforeStable, timeout: 2000 } as any).catch(e => e);
  expect(error.message).toContain('element was detached from the DOM, retrying');
});

it('should not hang when frame is detached', async ({ page, server, mode }) => {
  it.skip(mode !== 'default');

  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  const frame = page.frames()[1];
  await frame.goto(server.PREFIX + '/input/button.html');

  // Start moving the button.
  await frame.$eval('button', button => {
    button.style.transition = 'margin 5s linear 0s';
    button.style.marginLeft = '200px';
  });

  let resolveDetachPromise;
  const detachPromise = new Promise(resolve => resolveDetachPromise = resolve);
  let firstTime = true;
  const __testHookBeforeStable = () => {
    // Detach the frame after "waiting for stable" has started.
    if (!firstTime)
      return;
    firstTime = false;
    setTimeout(async () => {
      await detachFrame(page, 'frame1');
      resolveDetachPromise();
    }, 1000);
  };
  const promise = frame.click('button', { __testHookBeforeStable } as any).catch(e => e);

  await detachPromise;
  const error = await promise;
  expect(error).toBeTruthy();
  expect(error.message).toMatch(/frame got detached|Frame was detached/);
});

it('should climb dom for inner label with pointer-events:none', async ({ page }) => {
  await page.setContent('<button onclick="window.__CLICKED=true;"><label style="pointer-events:none">Click target</label></button>');
  await page.click('text=Click target');
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should climb up to [role=button]', async ({ page }) => {
  await page.setContent('<div role=button onclick="window.__CLICKED=true;"><div style="pointer-events:none"><span><div>Click target</div></span></div>');
  await page.click('text=Click target');
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should climb up to a anchor', async ({ page }) => {
  // For Firefox its not allowed to return anything: https://bugzilla.mozilla.org/show_bug.cgi?id=1392046
  // Note the intermediate div - it is necessary, otherwise <a><non-clickable/></a> is not recognized as a clickable link.
  await page.setContent(`<a href="#" onclick="window.__CLICKED=true" id="outer"><div id="intermediate"><div id="inner" style="pointer-events: none">Inner</div></div></a>`);
  await page.click('#inner');
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should climb up to a [role=link]', async ({ page }) => {
  await page.setContent(`<div role=link onclick="window.__CLICKED=true" id="outer"><div id="inner" style="pointer-events: none">Inner</div></div>`);
  await page.click('#inner');
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('should click in an iframe with border', async ({ page }) => {
  await page.setContent(`
    <style>
      body, html, iframe { margin: 0; padding: 0; border: none; box-sizing: border-box; }
      iframe { border: 4px solid black; background: gray; margin-left: 33px; margin-top: 24px; width: 400px; height: 400px; }
    </style>
    <iframe srcdoc="
      <style>
        body, html { margin: 0; padding: 0; }
        div { margin-left: 10px; margin-top: 20px; width: 2px; height: 2px; }
      </style>
      <div>Target</div>
      <script>
        document.querySelector('div').addEventListener('click', () => window.top._clicked = true);
      </script>
    "></iframe>
  `);
  const locator = page.frameLocator('iframe').locator('div');
  await locator.click();
  expect(await page.evaluate('window._clicked')).toBe(true);
});

it('should click in an iframe with border 2', async ({ page }) => {
  await page.setContent(`
    <style>
      body, html, iframe { margin: 0; padding: 0; border: none; }
      iframe { border: 4px solid black; background: gray; margin-left: 33px; margin-top: 24px; width: 400px; height: 400px; }
    </style>
    <iframe srcdoc="
      <style>
        body, html { margin: 0; padding: 0; }
        div { margin-left: 10px; margin-top: 20px; width: 2px; height: 2px; }
      </style>
      <div>Target</div>
      <script>
        document.querySelector('div').addEventListener('click', () => window.top._clicked = true);
      </script>
    "></iframe>
  `);
  const locator = page.frameLocator('iframe').locator('div');
  await locator.click();
  expect(await page.evaluate('window._clicked')).toBe(true);
});

it('should click in a transformed iframe', async ({ page }) => {
  await page.setContent(`
    <style>
      body, html, iframe { margin: 0; padding: 0; border: none; }
      iframe {
        border: 4px solid black;
        background: gray;
        margin-left: 33px;
        margin-top: 24px;
        width: 400px;
        height: 400px;
        transform: translate(100px, 100px) scale(1.2) rotate3d(1, 1, 1, 25deg);
      }
    </style>
    <iframe srcdoc="
      <style>
        body, html { margin: 0; padding: 0; }
        div { margin-left: 10px; margin-top: 20px; width: 2px; height: 2px; }
      </style>
      <div>Target</div>
      <script>
        document.querySelector('div').addEventListener('click', () => window.top._clicked = true);
      </script>
    "></iframe>
  `);
  const locator = page.frameLocator('iframe').locator('div');
  await locator.click();
  expect(await page.evaluate('window._clicked')).toBe(true);
});

it('should click a button that is overlaid by a permission popup', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23280' });
  await page.setViewportSize({ width: 500, height: 500 });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <style>body, html { padding: 0; margin: 0; }</style>
    <script type='text/javascript'>
      window.addEventListener('DOMContentLoaded', () => {
        // Viewport filled with buttons.
        for (let i = 0; i < 100; ++i) {
          const button = document.createElement('button');
          button.textContent = i;
          button.style.setProperty('width', '50px');
          button.style.setProperty('height', '50px');
          document.body.append(button);
        }
      }, false);
    </script>
  `);
  // Issue a geolocation request. This should show a browser popup.
  // NOTE: this is a bit racy since we can't wait for the geolocation
  // popup to be shown.
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition(position => { });
  });
  // If popup blocks the click, then some of the `page.click` calls below will hang.
  for (let i = 0; i < 100; ++i)
    await page.click(`text=${i}`);
});

it('should click in a transformed iframe with force', async ({ page }) => {
  await page.setContent(`
    <style>
      body, html, iframe { margin: 0; padding: 0; border: none; }
      iframe { background: gray; margin-left: 33px; margin-top: 24px; width: 400px; height: 400px; transform: translate(-40px, -40px) scale(0.8); }
    </style>
    <iframe srcdoc="
      <style>
        body, html { margin: 0; padding: 0; }
        div { margin-left: 10px; margin-top: 20px; width: 2px; height: 2px; }
      </style>
      <div>Target</div>
      <script>
        document.querySelector('div').addEventListener('click', () => window.top._clicked = true);
      </script>
    "></iframe>
  `);
  const locator = page.frameLocator('iframe').locator('div');
  await locator.click({ force: true });
  expect(await page.evaluate('window._clicked')).toBe(true);
});

it('should click in a nested transformed iframe', async ({ page }) => {
  await page.setContent(`
    <style>
      body, html, iframe { margin: 0; padding: 0; box-sizing: border-box; }
      iframe { border: 1px solid black; background: gray; margin-left: 33px; margin-top: 24px; width: 400px; height: 400px; transform: scale(0.8); }
    </style>
    <iframe srcdoc="
      <style>
        body, html, iframe { margin: 0; padding: 0; box-sizing: border-box; }
        iframe { border: 3px solid black; background: gray; margin-left: 18px; margin-top: 14px; width: 200px; height: 200px; transform: scale(0.7); }
      </style>
      <iframe srcdoc='
        <style>
          div { margin-left: 10px; margin-top: 20px; width: 2px; height: 2px; }
        </style>
        <div>Target</div>
      '></iframe>
    "></iframe>
  `);
  const locator = page.frameLocator('iframe').frameLocator('iframe').locator('div');
  await locator.evaluate(div => {
    div.addEventListener('click', () => window.top['_clicked'] = true);
  });
  await locator.click();
  expect(await page.evaluate('window._clicked')).toBe(true);
});

it('ensure events are dispatched in the individual tasks', async ({ page, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/19685' });
  await page.setContent(`
    <div id="outer" style="background: #d4d4d4; width: 60px; height: 60px;">
      <div id="inner" style="background: #adadad; width: 46px; height: 46px;"></div>
    </div>
  `);

  await page.evaluate(() => {
    function onClick(name) {
      console.log(`click ${name}`);

      window.builtins.setTimeout(function() {
        console.log(`timeout ${name}`);
      }, 0);

      void Promise.resolve().then(function() {
        console.log(`promise ${name}`);
      });
    }

    document.getElementById('inner').addEventListener('click', () => onClick('inner'));
    document.getElementById('outer').addEventListener('click', () => onClick('outer'));
  });

  // Capture console messages
  const messages: Array<string> = [];
  page.on('console', msg => messages.push(msg.text()));

  // Click on the inner div element
  await page.locator('#inner').click();

  await expect.poll(() => messages).toEqual([
    'click inner',
    'promise inner',
    'click outer',
    'promise outer',
    'timeout inner',
    'timeout outer',
  ]);
});

it('should click if opened select covers the button', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23618' });
  await page.setContent(`
    <div>
      <select>
        <option>very long text #1</option>
        <option>very long text #2</option>
        <option>very long text #3</option>
        <option>very long text #4</option>
        <option>very long text #5</option>
        <option>very long text #6</option>
      </select>
    </div>
    <div>
      <button onclick="window.__CLICKED=42">clickme</button>
    </div>
  `);
  await page.click('select');
  await page.click('button');
  expect(await page.evaluate('window.__CLICKED')).toBe(42);
});

it('should fire contextmenu event on right click in correct order', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/26515' });
  it.fixme(browserName === 'chromium', 'mouseup is fired');
  it.fixme(browserName === 'firefox', 'mouseup is fired');
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <button id="target">Click me</button>
  `);
  await page.evaluate(() => {
    const logEvent = e => console.log(e.type);
    document.addEventListener('mousedown', logEvent);
    document.addEventListener('mouseup', logEvent);
    document.addEventListener('contextmenu', logEvent);
  });
  const entries = [];
  page.on('console', message => entries.push(message.text()));
  await page.getByRole('button', { name: 'Click me' }).click({ button: 'right' });
  await expect.poll(() => entries).toEqual([
    'mousedown',
    'contextmenu',
  ]);
});

it('should set PointerEvent.pressure on pointerdown', async ({ page, isLinux, headless }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/35844' });
  it.fixme(isLinux && !headless, 'Stray mouse events on Linux headed mess up the tests.');
  await page.setContent(`
    <button id="target">Click me</button>
    <script>
      window['pressures'] = [];
      document.addEventListener('pointerdown', e => window['pressures'].push(['pointerdown', e.pressure]));
      document.addEventListener('pointerup', e => window['pressures'].push(['pointerup', e.pressure]));
    </script>
  `);
  await page.click('button');
  expect(await page.evaluate(() => window['pressures'])).toEqual([
    ['pointerdown', 0.5],
    ['pointerup', 0],
  ]);
});

it('should set PointerEvent.pressure on pointermove', async ({ page, isLinux, headless, isWindows, browserName, isAndroid }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/35844' });
  it.fixme(isLinux && !headless, 'Stray mouse events on Linux headed mess up the tests.');
  it.fixme(isWindows && !headless && browserName === 'webkit', 'WebKit win also send stray mouse events.');
  it.fixme(isAndroid, 'Android coordinates seem to have rounding issues.');
  await page.setContent(`
    <body style="margin: 0; padding: 0;">
      <div id="target" style="width: 500px; height: 500px; background-color: red;"></div>
      <script>
        window['pressures'] = [];
        document.addEventListener('pointermove', e => window['pressures'].push([e.pressure, e.clientX, e.clientY]));
      </script>
    </body>
  `);
  await page.click('div#target');
  await page.mouse.move(10, 10);
  await page.mouse.down();
  await page.mouse.move(250, 250);
  await page.mouse.up();
  await page.mouse.move(50, 50);
  expect(await page.evaluate(() => window['pressures'])).toEqual([
    [0, 250, 250],
    [0, 10, 10],
    [0.5, 250, 250],
    [0, 50, 50],
  ]);
});
