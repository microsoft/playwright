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
const {FFOX, HEADLESS} = testOptions;

describe('ElementHandle.boundingBox', function() {
  it.fail(FFOX && !HEADLESS)('should work', async({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    const elementHandle = await page.$('.box:nth-of-type(13)');
    const box = await elementHandle.boundingBox();
    expect(box).toEqual({ x: 100, y: 50, width: 50, height: 50 });
  });
  it('should handle nested frames', async({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/frames/nested-frames.html');
    const nestedFrame = page.frames().find(frame => frame.name() === 'dos');
    const elementHandle = await nestedFrame.$('div');
    const box = await elementHandle.boundingBox();
    expect(box).toEqual({ x: 24, y: 224, width: 268, height: 18 });
  });
  it('should return null for invisible elements', async({page, server}) => {
    await page.setContent('<div style="display:none">hi</div>');
    const element = await page.$('div');
    expect(await element.boundingBox()).toBe(null);
  });
  it('should force a layout', async({page, server}) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.setContent('<div style="width: 100px; height: 100px">hello</div>');
    const elementHandle = await page.$('div');
    await page.evaluate(element => element.style.height = '200px', elementHandle);
    const box = await elementHandle.boundingBox();
    expect(box).toEqual({ x: 8, y: 8, width: 100, height: 200 });
  });
  it('should work with SVG nodes', async({page, server}) => {
    await page.setContent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="500" height="500">
        <rect id="theRect" x="30" y="50" width="200" height="300"></rect>
      </svg>
    `);
    const element = await page.$('#therect');
    const pwBoundingBox = await element.boundingBox();
    const webBoundingBox = await page.evaluate(e => {
      const rect = e.getBoundingClientRect();
      return {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
    }, element);
    expect(pwBoundingBox).toEqual(webBoundingBox);
  });
  it.skip(FFOX)('should work with page scale', async({browser, server}) => {
    const context = await browser.newContext({ viewport: { width: 400, height: 400, isMobile: true} });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/input/button.html');
    const button = await page.$('button');
    await button.evaluate(button => {
      document.body.style.margin = '0';
      button.style.borderWidth = '0';
      button.style.width = '200px';
      button.style.height = '20px';
      button.style.marginLeft = '17px';
      button.style.marginTop = '23px';
    });
    const box = await button.boundingBox();
    expect(Math.round(box.x * 100)).toBe(17 * 100);
    expect(Math.round(box.y * 100)).toBe(23 * 100);
    expect(Math.round(box.width * 100)).toBe(200 * 100);
    expect(Math.round(box.height * 100)).toBe(20 * 100);
    await context.close();
  });
  it('should work when inline box child is outside of viewport', async({page, server}) => {
    await page.setContent(`
      <style>
      i {
        position: absolute;
        top: -1000px;
      }
      body {
        margin: 0;
        font-size: 12px;
      }
      </style>
      <span><i>woof</i><b>doggo</b></span>
    `);
    const handle = await page.$('span');
    const box = await handle.boundingBox();
    const webBoundingBox = await handle.evaluate(e => {
      const rect = e.getBoundingClientRect();
      return {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
    });
    const round = box => ({
      x: Math.round(box.x * 100),
      y: Math.round(box.y * 100),
      width: Math.round(box.width * 100),
      height: Math.round(box.height * 100),
    });
    expect(round(box)).toEqual(round(webBoundingBox));
  });
});

describe('ElementHandle.contentFrame', function() {
  it('should work', async({page,server}) => {
    await page.goto(server.EMPTY_PAGE);
    await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
    const elementHandle = await page.$('#frame1');
    const frame = await elementHandle.contentFrame();
    expect(frame).toBe(page.frames()[1]);
  });
  it('should work for cross-process iframes', async({page,server}) => {
    await page.goto(server.EMPTY_PAGE);
    await utils.attachFrame(page, 'frame1', server.CROSS_PROCESS_PREFIX + '/empty.html');
    const elementHandle = await page.$('#frame1');
    const frame = await elementHandle.contentFrame();
    expect(frame).toBe(page.frames()[1]);
  });
  it('should work for cross-frame evaluations', async({page,server}) => {
    await page.goto(server.EMPTY_PAGE);
    await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
    const frame = page.frames()[1];
    const elementHandle = await frame.evaluateHandle(() => window.top.document.querySelector('#frame1'));
    expect(await elementHandle.contentFrame()).toBe(frame);
  });
  it('should return null for non-iframes', async({page,server}) => {
    await page.goto(server.EMPTY_PAGE);
    await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
    const frame = page.frames()[1];
    const elementHandle = await frame.evaluateHandle(() => document.body);
    expect(await elementHandle.contentFrame()).toBe(null);
  });
  it('should return null for document.documentElement', async({page,server}) => {
    await page.goto(server.EMPTY_PAGE);
    await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
    const frame = page.frames()[1];
    const elementHandle = await frame.evaluateHandle(() => document.documentElement);
    expect(await elementHandle.contentFrame()).toBe(null);
  });
});

describe('ElementHandle.ownerFrame', function() {
  it('should work', async({page,server}) => {
    await page.goto(server.EMPTY_PAGE);
    await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
    const frame = page.frames()[1];
    const elementHandle = await frame.evaluateHandle(() => document.body);
    expect(await elementHandle.ownerFrame()).toBe(frame);
  });
  it('should work for cross-process iframes', async({page,server}) => {
    await page.goto(server.EMPTY_PAGE);
    await utils.attachFrame(page, 'frame1', server.CROSS_PROCESS_PREFIX + '/empty.html');
    const frame = page.frames()[1];
    const elementHandle = await frame.evaluateHandle(() => document.body);
    expect(await elementHandle.ownerFrame()).toBe(frame);
  });
  it('should work for document', async({page,server}) => {
    await page.goto(server.EMPTY_PAGE);
    await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
    const frame = page.frames()[1];
    const elementHandle = await frame.evaluateHandle(() => document);
    expect(await elementHandle.ownerFrame()).toBe(frame);
  });
  it('should work for iframe elements', async({page,server}) => {
    await page.goto(server.EMPTY_PAGE);
    await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
    const frame = page.mainFrame();
    const elementHandle = await frame.evaluateHandle(() => document.querySelector('#frame1'));
    expect(await elementHandle.ownerFrame()).toBe(frame);
  });
  it('should work for cross-frame evaluations', async({page,server}) => {
    await page.goto(server.EMPTY_PAGE);
    await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
    const frame = page.mainFrame();
    const elementHandle = await frame.evaluateHandle(() => document.querySelector('#frame1').contentWindow.document.body);
    expect(await elementHandle.ownerFrame()).toBe(frame.childFrames()[0]);
  });
  it('should work for detached elements', async({page,server}) => {
    await page.goto(server.EMPTY_PAGE);
    const divHandle = await page.evaluateHandle(() => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      return div;
    });
    expect(await divHandle.ownerFrame()).toBe(page.mainFrame());
    await page.evaluate(() => {
      const div = document.querySelector('div');
      document.body.removeChild(div);
    });
    expect(await divHandle.ownerFrame()).toBe(page.mainFrame());
  });
  it('should work for adopted elements', async({page,server}) => {
    await page.goto(server.EMPTY_PAGE);
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(url => window.__popup = window.open(url), server.EMPTY_PAGE),
    ]);
    const divHandle = await page.evaluateHandle(() => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      return div;
    });
    expect(await divHandle.ownerFrame()).toBe(page.mainFrame());
    await popup.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      const div = document.querySelector('div');
      window.__popup.document.body.appendChild(div);
    });
    expect(await divHandle.ownerFrame()).toBe(popup.mainFrame());
  });
});

describe('ElementHandle.click', function() {
  it('should work', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    const button = await page.$('button');
    await button.click();
    expect(await page.evaluate(() => result)).toBe('Clicked');
  });
  it('should work with Node removed', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.evaluate(() => delete window['Node']);
    const button = await page.$('button');
    await button.click();
    expect(await page.evaluate(() => result)).toBe('Clicked');
  });
  it('should work for Shadow DOM v1', async({page, server}) => {
    await page.goto(server.PREFIX + '/shadow.html');
    const buttonHandle = await page.evaluateHandle(() => button);
    await buttonHandle.click();
    expect(await page.evaluate(() => clicked)).toBe(true);
  });
  it('should work for TextNodes', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    const buttonTextNode = await page.evaluateHandle(() => document.querySelector('button').firstChild);
    await buttonTextNode.click();
    expect(await page.evaluate(() => result)).toBe('Clicked');
  });
  it('should throw for detached nodes', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    const button = await page.$('button');
    await page.evaluate(button => button.remove(), button);
    let error = null;
    await button.click().catch(err => error = err);
    expect(error.message).toContain('Element is not attached to the DOM');
  });
  it('should throw for hidden nodes with force', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    const button = await page.$('button');
    await page.evaluate(button => button.style.display = 'none', button);
    const error = await button.click({ force: true }).catch(err => err);
    expect(error.message).toContain('Element is not visible');
  });
  it('should throw for recursively hidden nodes with force', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    const button = await page.$('button');
    await page.evaluate(button => button.parentElement.style.display = 'none', button);
    const error = await button.click({ force: true }).catch(err => err);
    expect(error.message).toContain('Element is not visible');
  });
  it('should throw for <br> elements with force', async({page, server}) => {
    await page.setContent('hello<br>goodbye');
    const br = await page.$('br');
    const error = await br.click({ force: true }).catch(err => err);
    expect(error.message).toContain('Element is outside of the viewport');
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
    const button = await page.$('button');
    await button.dblclick();
    expect(await page.evaluate('double')).toBe(true);
    expect(await page.evaluate('result')).toBe('Clicked');
  });
});

describe('ElementHandle.hover', function() {
  it('should work', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/scrollable.html');
    const button = await page.$('#button-6');
    await button.hover();
    expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-6');
  });
  it('should work when Node is removed', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/scrollable.html');
    await page.evaluate(() => delete window['Node']);
    const button = await page.$('#button-6');
    await button.hover();
    expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-6');
  });
});

describe('ElementHandle.scrollIntoViewIfNeeded', function() {
  it('should work', async({page, server}) => {
    await page.goto(server.PREFIX + '/offscreenbuttons.html');
    for (let i = 0; i < 11; ++i) {
      const button = await page.$('#btn' + i);
      const before = await button.evaluate(button => {
        return button.getBoundingClientRect().right - window.innerWidth;
      });
      expect(before).toBe(10 * i);
      await button.scrollIntoViewIfNeeded();
      const after = await button.evaluate(button => {
        return button.getBoundingClientRect().right - window.innerWidth;
      });
      expect(after <= 0).toBe(true);
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  });
  it('should throw for detached element', async({page, server}) => {
    await page.setContent('<div>Hello</div>');
    const div = await page.$('div');
    await div.evaluate(div => div.remove());
    const error = await div.scrollIntoViewIfNeeded().catch(e => e);
    expect(error.message).toContain('Element is not attached to the DOM');
  });

  async function testWaiting(page, after) {
    const div = await page.$('div');
    let done = false;
    const promise = div.scrollIntoViewIfNeeded().then(() => done = true);
    await page.evaluate(() => new Promise(f => setTimeout(f, 1000)));
    expect(done).toBe(false);
    await div.evaluate(after);
    await promise;
    expect(done).toBe(true);
  }
  it('should wait for display:none to become visible', async({page, server}) => {
    await page.setContent('<div style="display:none">Hello</div>');
    await testWaiting(page, div => div.style.display = 'block');
  });
  it('should wait for display:contents to become visible', async({page, server}) => {
    await page.setContent('<div style="display:contents">Hello</div>');
    await testWaiting(page, div => div.style.display = 'block');
  });
  it('should wait for visibility:hidden to become visible', async({page, server}) => {
    await page.setContent('<div style="visibility:hidden">Hello</div>');
    await testWaiting(page, div => div.style.visibility = 'visible');
  });
  it('should wait for zero-sized element to become visible', async({page, server}) => {
    await page.setContent('<div style="height:0">Hello</div>');
    await testWaiting(page, div => div.style.height = '100px');
  });
  it('should wait for nested display:none to become visible', async({page, server}) => {
    await page.setContent('<span style="display:none"><div>Hello</div></span>');
    await testWaiting(page, div => div.parentElement.style.display = 'block');
  });

  it('should timeout waiting for visible', async({page, server}) => {
    await page.setContent('<div style="display:none">Hello</div>');
    const div = await page.$('div');
    const error = await div.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(e => e);
    expect(error.message).toContain('element is not visible');
  });
});

describe('ElementHandle.fill', function() {
  it('should fill input', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    const handle = await page.$('input');
    await handle.fill('some value');
    expect(await page.evaluate(() => result)).toBe('some value');
  });
  it('should fill input when Node is removed', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    await page.evaluate(() => delete window['Node']);
    const handle = await page.$('input');
    await handle.fill('some value');
    expect(await page.evaluate(() => result)).toBe('some value');
  });
});

describe('ElementHandle.selectText', function() {
  it('should select textarea', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    const textarea = await page.$('textarea');
    await textarea.evaluate(textarea => textarea.value = 'some value');
    await textarea.selectText();
    if (FFOX) {
      expect(await textarea.evaluate(el => el.selectionStart)).toBe(0);
      expect(await textarea.evaluate(el => el.selectionEnd)).toBe(10);
    } else {
      expect(await page.evaluate(() => window.getSelection().toString())).toBe('some value');
    }
  });
  it('should select input', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    const input = await page.$('input');
    await input.evaluate(input => input.value = 'some value');
    await input.selectText();
    if (FFOX) {
      expect(await input.evaluate(el => el.selectionStart)).toBe(0);
      expect(await input.evaluate(el => el.selectionEnd)).toBe(10);
    } else {
      expect(await page.evaluate(() => window.getSelection().toString())).toBe('some value');
    }
  });
  it('should select plain div', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    const div = await page.$('div.plain');
    await div.selectText();
    expect(await page.evaluate(() => window.getSelection().toString())).toBe('Plain div');
  });
  it('should timeout waiting for invisible element', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    const textarea = await page.$('textarea');
    await textarea.evaluate(e => e.style.display = 'none');
    const error = await textarea.selectText({ timeout: 3000 }).catch(e => e);
    expect(error.message).toContain('element is not visible');
  });
  it('should wait for visible', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    const textarea = await page.$('textarea');
    await textarea.evaluate(textarea => textarea.value = 'some value');
    await textarea.evaluate(e => e.style.display = 'none');
    let done = false;
    const promise = textarea.selectText({ timeout: 3000 }).then(() => done = true);
    await page.evaluate(() => new Promise(f => setTimeout(f, 1000)));
    expect(done).toBe(false);
    await textarea.evaluate(e => e.style.display = 'block');
    await promise;
  });
});


describe('ElementHandle convenience API', function() {
  it('should have a nice preview', async({page, server}) => {
    await page.goto(`${server.PREFIX}/dom.html`);
    const outer = await page.$('#outer');
    const inner = await page.$('#inner');
    const check = await page.$('#check');
    const text = await inner.evaluateHandle(e => e.firstChild);
    await page.evaluate(() => 1);  // Give them a chance to calculate the preview.
    expect(String(outer)).toBe('JSHandle@<div id="outer" name="value">…</div>');
    expect(String(inner)).toBe('JSHandle@<div id="inner">Text,↵more text</div>');
    expect(String(text)).toBe('JSHandle@#text=Text,↵more text');
    expect(String(check)).toBe('JSHandle@<input checked id="check" foo="bar"" type="checkbox"/>');
  });
  it('getAttribute should work', async({page, server}) => {
    await page.goto(`${server.PREFIX}/dom.html`);
    const handle = await page.$('#outer');
    expect(await handle.getAttribute('name')).toBe('value');
    expect(await handle.getAttribute('foo')).toBe(null);
    expect(await page.getAttribute('#outer', 'name')).toBe('value');
    expect(await page.getAttribute('#outer', 'foo')).toBe(null);
  });
  it('innerHTML should work', async({page, server}) => {
    await page.goto(`${server.PREFIX}/dom.html`);
    const handle = await page.$('#outer');
    expect(await handle.innerHTML()).toBe('<div id="inner">Text,\nmore text</div>');
    expect(await page.innerHTML('#outer')).toBe('<div id="inner">Text,\nmore text</div>');
  });
  it('innerText should work', async({page, server}) => {
    await page.goto(`${server.PREFIX}/dom.html`);
    const handle = await page.$('#inner');
    expect(await handle.innerText()).toBe('Text, more text');
    expect(await page.innerText('#inner')).toBe('Text, more text');
  });
  it('innerText should throw', async({page, server}) => {
    await page.setContent(`<svg>text</svg>`);
    const error1 = await page.innerText('svg').catch(e => e);
    expect(error1.message).toContain('Not an HTMLElement');
    const handle = await page.$('svg');
    const error2 = await handle.innerText().catch(e => e);
    expect(error2.message).toContain('Not an HTMLElement');
  });
  it('textContent should work', async({page, server}) => {
    await page.goto(`${server.PREFIX}/dom.html`);
    const handle = await page.$('#inner');
    expect(await handle.textContent()).toBe('Text,\nmore text');
    expect(await page.textContent('#inner')).toBe('Text,\nmore text');
  });
  it('textContent should be atomic', async({playwright, page}) => {
    const createDummySelector = () => ({
      create(root, target) {},
      query(root, selector) {
        const result = root.querySelector(selector);
        if (result)
          Promise.resolve().then(() => result.textContent = 'modified');
        return result;
      },
      queryAll(root, selector) {
        const result = Array.from(root.querySelectorAll(selector));
        for (const e of result)
          Promise.resolve().then(() => result.textContent = 'modified');
        return result;
      }
    });
    await utils.registerEngine(playwright, 'textContent', createDummySelector);
    await page.setContent(`<div>Hello</div>`);
    const tc = await page.textContent('textContent=div');
    expect(tc).toBe('Hello');
    expect(await page.evaluate(() => document.querySelector('div').textContent)).toBe('modified');
  });
  it('innerText should be atomic', async({playwright, page}) => {
    const createDummySelector = () => ({
      create(root, target) {},
      query(root, selector) {
        const result = root.querySelector(selector);
        if (result)
          Promise.resolve().then(() => result.textContent = 'modified');
        return result;
      },
      queryAll(root, selector) {
        const result = Array.from(root.querySelectorAll(selector));
        for (const e of result)
          Promise.resolve().then(() => result.textContent = 'modified');
        return result;
      }
    });
    await utils.registerEngine(playwright, 'innerText', createDummySelector);
    await page.setContent(`<div>Hello</div>`);
    const tc = await page.innerText('innerText=div');
    expect(tc).toBe('Hello');
    expect(await page.evaluate(() => document.querySelector('div').innerText)).toBe('modified');
  });
  it('innerHTML should be atomic', async({playwright, page}) => {
    const createDummySelector = () => ({
      create(root, target) {},
      query(root, selector) {
        const result = root.querySelector(selector);
        if (result)
          Promise.resolve().then(() => result.textContent = 'modified');
        return result;
      },
      queryAll(root, selector) {
        const result = Array.from(root.querySelectorAll(selector));
        for (const e of result)
          Promise.resolve().then(() => result.textContent = 'modified');
        return result;
      }
    });
    await utils.registerEngine(playwright, 'innerHTML', createDummySelector);
    await page.setContent(`<div>Hello<span>world</span></div>`);
    const tc = await page.innerHTML('innerHTML=div');
    expect(tc).toBe('Hello<span>world</span>');
    expect(await page.evaluate(() => document.querySelector('div').innerHTML)).toBe('modified');
  });
  it('getAttribute should be atomic', async({playwright, page}) => {
    const createDummySelector = () => ({
      create(root, target) {},
      query(root, selector) {
        const result = root.querySelector(selector);
        if (result)
          Promise.resolve().then(() => result.setAttribute('foo', 'modified'));
        return result;
      },
      queryAll(root, selector) {
        const result = Array.from(root.querySelectorAll(selector));
        for (const e of result)
          Promise.resolve().then(() => result.setAttribute('foo', 'modified'));
        return result;
      }
    });
    await utils.registerEngine(playwright, 'getAttribute', createDummySelector);
    await page.setContent(`<div foo=hello></div>`);
    const tc = await page.getAttribute('getAttribute=div', 'foo');
    expect(tc).toBe('hello');
    expect(await page.evaluate(() => document.querySelector('div').getAttribute('foo'))).toBe('modified');
  });
});

describe('ElementHandle.check', () => {
  it('should check the box', async({page}) => {
    await page.setContent(`<input id='checkbox' type='checkbox'></input>`);
    const input = await page.$('input');
    await input.check();
    expect(await page.evaluate(() => checkbox.checked)).toBe(true);
  });
  it('should uncheck the box', async({page}) => {
    await page.setContent(`<input id='checkbox' type='checkbox' checked></input>`);
    const input = await page.$('input');
    await input.uncheck();
    expect(await page.evaluate(() => checkbox.checked)).toBe(false);
  });
});

describe('ElementHandle.selectOption', function() {
  it('should select single option', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/select.html');
    const select = await page.$('select');
    await select.selectOption('blue');
    expect(await page.evaluate(() => result.onInput)).toEqual(['blue']);
    expect(await page.evaluate(() => result.onChange)).toEqual(['blue']);
  });
});

describe('ElementHandle.focus', function() {
  it('should focus a button', async({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    const button = await page.$('button');
    expect(await button.evaluate(button => document.activeElement === button)).toBe(false);
    await button.focus();
    expect(await button.evaluate(button => document.activeElement === button)).toBe(true);
  });
});

describe('ElementHandle.type', function() {
  it('should work', async ({page}) => {
    await page.setContent(`<input type='text' />`);
    await page.type('input', 'hello');
    expect(await page.$eval('input', input => input.value)).toBe('hello');
  });
  it('should not select existing value', async ({page}) => {
    await page.setContent(`<input type='text' value='hello' />`);
    await page.type('input', 'world');
    expect(await page.$eval('input', input => input.value)).toBe('worldhello');
  });
  it('should reset selection when not focused', async ({page}) => {
    await page.setContent(`<input type='text' value='hello' /><div tabIndex=2>text</div>`);
    await page.$eval('input', input => {
      input.selectionStart = 2;
      input.selectionEnd = 4;
      document.querySelector('div').focus();
    });
    await page.type('input', 'world');
    expect(await page.$eval('input', input => input.value)).toBe('worldhello');
  });
  it('should not modify selection when focused', async ({page}) => {
    await page.setContent(`<input type='text' value='hello' />`);
    await page.$eval('input', input => {
      input.focus();
      input.selectionStart = 2;
      input.selectionEnd = 4;
    });
    await page.type('input', 'world');
    expect(await page.$eval('input', input => input.value)).toBe('heworldo');
  });
  it('should work with number input', async ({page}) => {
    await page.setContent(`<input type='number' value=2 />`);
    await page.type('input', '13');
    expect(await page.$eval('input', input => input.value)).toBe('132');
  });
});

describe('ElementHandle.press', function() {
  it('should work', async ({page}) => {
    await page.setContent(`<input type='text' />`);
    await page.press('input', 'h');
    expect(await page.$eval('input', input => input.value)).toBe('h');
  });
  it('should not select existing value', async ({page}) => {
    await page.setContent(`<input type='text' value='hello' />`);
    await page.press('input', 'w');
    expect(await page.$eval('input', input => input.value)).toBe('whello');
  });
  it('should reset selection when not focused', async ({page}) => {
    await page.setContent(`<input type='text' value='hello' /><div tabIndex=2>text</div>`);
    await page.$eval('input', input => {
      input.selectionStart = 2;
      input.selectionEnd = 4;
      document.querySelector('div').focus();
    });
    await page.press('input', 'w');
    expect(await page.$eval('input', input => input.value)).toBe('whello');
  });
  it('should not modify selection when focused', async ({page}) => {
    await page.setContent(`<input type='text' value='hello' />`);
    await page.$eval('input', input => {
      input.focus();
      input.selectionStart = 2;
      input.selectionEnd = 4;
    });
    await page.press('input', 'w');
    expect(await page.$eval('input', input => input.value)).toBe('hewo');
  });
  it('should work with number input', async ({page}) => {
    await page.setContent(`<input type='number' value=2 />`);
    await page.press('input', '1');
    expect(await page.$eval('input', input => input.value)).toBe('12');
  });
});
