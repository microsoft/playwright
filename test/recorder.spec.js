/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const {WIN, LINUX, MAC, HEADLESS, CHANNEL, USES_HOOKS} = utils = require('./utils');
const {FIREFOX, CHROMIUM, WEBKIT} = require('playwright-runner');
const {browserEnv} = require('./environments/browser');
const {serverEnv} = require('./environments/server');
const {it} = browserEnv.mixin(serverEnv).extend({
  async beforeEach({browser}) {
    const context = await browser.newContext();
    const output = new WritableBuffer();
    const debugController = context._initDebugModeForTest({ recorderOutput: output });
    const page = await context.newPage();
    const setContent = async content => {
      await page.setContent(content);
      await debugController.ensureInstalledInFrameForTest(page.mainFrame());
    };
    return {context, output, page, setContent};
  },

  async afterEach({context}) {
    await context.close();
  }
});

class WritableBuffer {
  constructor() {
    this.lines = [];
  }

  write(chunk) {
    if (chunk === '\u001B[F\u001B[2K') {
      this.lines.pop();
      return;
    }
    this.lines.push(...chunk.split('\n'));
    if (this._callback && chunk.includes(this._text))
      this._callback();
  }

  waitFor(text) {
    if (this.lines.join('\n').includes(text))
      return Promise.resolve();
    this._text = text;
    return new Promise(f => this._callback = f);
  }

  data() {
    return this.lines.join('\n');
  }

  text() {
    const pattern = [
      '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
      '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
    ].join('|');
    return this.data().replace(new RegExp(pattern, 'g'), '');
  }
}

describe.skip(USES_HOOKS)('Recorder', function() {

  it('should click', async function({page, output, setContent, server}) {
    await page.goto(server.EMPTY_PAGE);
    await setContent(`<button onclick="console.log('click')">Submit</button>`);
    const [message] = await Promise.all([
      page.waitForEvent('console'),
      output.waitFor('click'),
      page.dispatchEvent('button', 'click', { detail: 1 })
    ]);
    expect(output.text()).toContain(`
  // Click text="Submit"
  await page.click('text="Submit"');`);
    expect(message.text()).toBe('click');
  });

  it('should click after document.open', async function({page, output, setContent, server}) {
    await page.goto(server.EMPTY_PAGE);
    await setContent(``);
    await page.evaluate(() => {
      document.open();
      document.write(`<button onclick="console.log('click')">Submit</button>`);
      document.close();
      // Give it time to refresh. See Recorder for details.
      return new Promise(f => setTimeout(f, 1000));
    });
    const [message] = await Promise.all([
      page.waitForEvent('console'),
      output.waitFor('click'),
      page.dispatchEvent('button', 'click', { detail: 1 })
    ]);
    expect(output.text()).toContain(`
  // Click text="Submit"
  await page.click('text="Submit"');`);
    expect(message.text()).toBe('click');
  });

  it('should fill', async function({page, output, setContent, server}) {
    await page.goto(server.EMPTY_PAGE);
    await setContent(`<input id="input" name="name" oninput="console.log(input.value)"></input>`);
    const [message] = await Promise.all([
      page.waitForEvent('console'),
      output.waitFor('fill'),
      page.fill('input', 'John')
    ]);
    expect(output.text()).toContain(`
  // Fill input[name=name]
  await page.fill('input[name=name]', 'John');`);
    expect(message.text()).toBe('John');
  });

  it('should press', async function({page, output, setContent, server}) {
    await page.goto(server.EMPTY_PAGE);
    await setContent(`<input name="name" onkeypress="console.log('press')"></input>`);
    const [message] = await Promise.all([
      page.waitForEvent('console'),
      output.waitFor('press'),
      page.press('input', 'Shift+Enter')
    ]);
    expect(output.text()).toContain(`
  // Press Enter with modifiers
  await page.press('input[name=name]', 'Shift+Enter');`);
    expect(message.text()).toBe('press');
  });

  it('should check', async function({page, output, setContent, server}) {
    await page.goto(server.EMPTY_PAGE);
    await setContent(`<input id="checkbox" type="checkbox" name="accept" onchange="console.log(checkbox.checked)"></input>`);
    const [message] = await Promise.all([
      page.waitForEvent('console'),
      output.waitFor('check'),
      page.dispatchEvent('input', 'click', { detail: 1 })
    ]);
    await output.waitFor('check');
    expect(output.text()).toContain(`
  // Check input[name=accept]
  await page.check('input[name=accept]');`);
    expect(message.text()).toBe('true');
  });

  it('should uncheck', async function({page, output, setContent, server}) {
    await page.goto(server.EMPTY_PAGE);
    await setContent(`<input id="checkbox" type="checkbox" checked name="accept" onchange="console.log(checkbox.checked)"></input>`);
    const [message] = await Promise.all([
      page.waitForEvent('console'),
      output.waitFor('uncheck'),
      page.dispatchEvent('input', 'click', { detail: 1 })
    ]);
    expect(output.text()).toContain(`
  // Uncheck input[name=accept]
  await page.uncheck('input[name=accept]');`);
    expect(message.text()).toBe('false');
  });

  it('should select', async function({page, output, setContent, server}) {
    await page.goto(server.EMPTY_PAGE);
    await setContent('<select id="age" onchange="console.log(age.selectedOptions[0].value)"><option value="1"><option value="2"></select>');
    const [message] = await Promise.all([
      page.waitForEvent('console'),
      output.waitFor('select'),
      page.selectOption('select', '2')
    ]);
    expect(output.text()).toContain(`
  // Select select[id=age]
  await page.selectOption('select[id=age]', '2');`);
    expect(message.text()).toBe('2');
  });

  it('should await popup', async function({context, page, output, setContent, server}) {
    await page.goto(server.EMPTY_PAGE);
    await setContent('<a target=_blank rel=noopener href="/popup/popup.html">link</a>');
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      output.waitFor('waitForEvent'),
      page.dispatchEvent('a', 'click', { detail: 1 })
    ]);
    expect(output.text()).toContain(`
  // Click text="link"
  const [popup1] = await Promise.all([
    page.waitForEvent('popup'),
    await page.click('text="link"');
  ]);`);
    expect(popup.url()).toBe(`${server.PREFIX}/popup/popup.html`);
  });

  it('should await navigation', async function({page, output, setContent, server}) {
    await page.goto(server.EMPTY_PAGE);
    await setContent(`<a onclick="setTimeout(() => window.location.href='${server.PREFIX}/popup/popup.html', 1000)">link</a>`);
    await Promise.all([
      page.waitForNavigation(),
      output.waitFor('waitForNavigation'),
      page.dispatchEvent('a', 'click', { detail: 1 })
    ]);
    expect(output.text()).toContain(`
  // Click text="link"
  await Promise.all([
    page.waitForNavigation({ url: '${server.PREFIX}/popup/popup.html' }),
    page.click('text="link"')
  ]);`);
    expect(page.url()).toContain('/popup/popup.html');
  });
});
