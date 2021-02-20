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

import { folio } from './cli.fixtures';
import * as http from 'http';

const { it, describe, expect } = folio;

describe('cli codegen', (suite, { browserName, headful, mode }) => {
  suite.skip(mode !== 'default');
  suite.fixme(browserName === 'firefox' && headful, 'Focus is off');
}, () => {
  it('should click', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<button onclick="console.log('click')">Submit</button>`);

    const selector = await recorder.hoverOverElement('button');
    expect(selector).toBe('text=Submit');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('<javascript>', 'click'),
      page.dispatchEvent('button', 'click', { detail: 1 })
    ]);

    expect(sources.get('<javascript>').text).toContain(`
  // Click text=Submit
  await page.click('text=Submit');`);

    expect(sources.get('<python>').text).toContain(`
    # Click text=Submit
    page.click("text=Submit")`);

    expect(sources.get('<async python>').text).toContain(`
    # Click text=Submit
    await page.click("text=Submit")`);

    expect(sources.get('<csharp>').text).toContain(`
// Click text=Submit
await page.ClickAsync("text=Submit");`);

    expect(message.text()).toBe('click');
  });

  it('should click after same-document navigation', async ({ page, recorder, httpServer }) => {
    httpServer.setHandler((req: http.IncomingMessage, res: http.ServerResponse) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('');
    });
    await recorder.setContentAndWait(`<button onclick="console.log('click')">Submit</button>`, httpServer.PREFIX + '/foo.html');
    await Promise.all([
      page.waitForNavigation(),
      page.evaluate(() => history.pushState({}, '', '/url.html')),
    ]);
    // This is the only way to give recorder a chance to install
    // the second unnecessary copy of the recorder script.
    await page.waitForTimeout(1000);

    const selector = await recorder.hoverOverElement('button');
    expect(selector).toBe('text=Submit');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('<javascript>', 'click'),
      page.dispatchEvent('button', 'click', { detail: 1 })
    ]);

    expect(sources.get('<javascript>').text).toContain(`
  // Click text=Submit
  await page.click('text=Submit');`);
    expect(message.text()).toBe('click');
  });

  it('should work with TrustedTypes', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`
      <head>
        <meta http-equiv="Content-Security-Policy" content="trusted-types unsafe escape; require-trusted-types-for 'script'">
    </head>
    <body>
      <button onclick="console.log('click')">Submit</button>
    </body>`);

    const selector = await recorder.hoverOverElement('button');
    expect(selector).toBe('text=Submit');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('<javascript>', 'click'),
      page.dispatchEvent('button', 'click', { detail: 1 })
    ]);

    expect(sources.get('<javascript>').text).toContain(`
  // Click text=Submit
  await page.click('text=Submit');`);

    expect(sources.get('<python>').text).toContain(`
    # Click text=Submit
    page.click("text=Submit")`);

    expect(sources.get('<async python>').text).toContain(`
    # Click text=Submit
    await page.click("text=Submit")`);

    expect(sources.get('<csharp>').text).toContain(`
// Click text=Submit
await page.ClickAsync("text=Submit");`);

    expect(message.text()).toBe('click');
  });

  it('should not target selector preview by text regexp', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<span>dummy</span>`);

    // Force highlight.
    await recorder.hoverOverElement('span');

    // Append text after highlight.
    await page.evaluate(() => {
      const div = document.createElement('div');
      div.setAttribute('onclick', "console.log('click')");
      div.textContent = ' Some long text here ';
      document.documentElement.appendChild(div);
    });

    const selector = await recorder.hoverOverElement('div');
    expect(selector).toBe('text=Some long text here');

    // Sanity check that selector does not match our highlight.
    const divContents = await page.$eval(selector, div => div.outerHTML);
    expect(divContents).toBe(`<div onclick="console.log('click')"> Some long text here </div>`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('<javascript>', 'click'),
      page.dispatchEvent('div', 'click', { detail: 1 })
    ]);
    expect(sources.get('<javascript>').text).toContain(`
  // Click text=Some long text here
  await page.click('text=Some long text here');`);
    expect(message.text()).toBe('click');
  });

  it('should fill', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<input id="input" name="name" oninput="console.log(input.value)"></input>`);
    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="name"]');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('<javascript>', 'fill'),
      page.fill('input', 'John')
    ]);

    expect(sources.get('<javascript>').text).toContain(`
  // Fill input[name="name"]
  await page.fill('input[name="name"]', 'John');`);

    expect(sources.get('<python>').text).toContain(`
    # Fill input[name="name"]
    page.fill(\"input[name=\\\"name\\\"]\", \"John\")`);

    expect(sources.get('<async python>').text).toContain(`
    # Fill input[name="name"]
    await page.fill(\"input[name=\\\"name\\\"]\", \"John\")`);

    expect(sources.get('<csharp>').text).toContain(`
// Fill input[name="name"]
await page.FillAsync(\"input[name=\\\"name\\\"]\", \"John\");`);

    expect(message.text()).toBe('John');
  });

  it('should fill textarea', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<textarea id="textarea" name="name" oninput="console.log(textarea.value)"></textarea>`);
    const selector = await recorder.focusElement('textarea');
    expect(selector).toBe('textarea[name="name"]');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('<javascript>', 'fill'),
      page.fill('textarea', 'John')
    ]);
    expect(sources.get('<javascript>').text).toContain(`
  // Fill textarea[name="name"]
  await page.fill('textarea[name="name"]', 'John');`);
    expect(message.text()).toBe('John');
  });

  it('should press', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<input name="name" onkeypress="console.log('press')"></input>`);

    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="name"]');

    const messages: any[] = [];
    page.on('console', message => messages.push(message));
    const [, sources] = await Promise.all([
      recorder.waitForActionPerformed(),
      recorder.waitForOutput('<javascript>', 'press'),
      page.press('input', 'Shift+Enter')
    ]);

    expect(sources.get('<javascript>').text).toContain(`
  // Press Enter with modifiers
  await page.press('input[name="name"]', 'Shift+Enter');`);

    expect(sources.get('<python>').text).toContain(`
    # Press Enter with modifiers
    page.press(\"input[name=\\\"name\\\"]\", \"Shift+Enter\")`);

    expect(sources.get('<async python>').text).toContain(`
    # Press Enter with modifiers
    await page.press(\"input[name=\\\"name\\\"]\", \"Shift+Enter\")`);

    expect(sources.get('<csharp>').text).toContain(`
// Press Enter with modifiers
await page.PressAsync(\"input[name=\\\"name\\\"]\", \"Shift+Enter\");`);

    expect(messages[0].text()).toBe('press');
  });

  it('should update selected element after pressing Tab', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`
      <input name="one"></input>
      <input name="two"></input>
    `);

    await page.click('input[name="one"]');
    await recorder.waitForOutput('<javascript>', 'click');
    await page.keyboard.type('foobar123');
    await recorder.waitForOutput('<javascript>', 'foobar123');

    await page.keyboard.press('Tab');
    await recorder.waitForOutput('<javascript>', 'Tab');
    await page.keyboard.type('barfoo321');
    await recorder.waitForOutput('<javascript>', 'barfoo321');

    const text = recorder.sources().get('<javascript>').text;
    expect(text).toContain(`
  // Fill input[name="one"]
  await page.fill('input[name="one"]', 'foobar123');`);

    expect(text).toContain(`
  // Press Tab
  await page.press('input[name="one"]', 'Tab');`);

    expect(text).toContain(`
  // Fill input[name="two"]
  await page.fill('input[name="two"]', 'barfoo321');`);
  });

  it('should record ArrowDown', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<input name="name" onkeydown="console.log('press:' + event.key)"></input>`);

    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="name"]');

    const messages: any[] = [];
    page.on('console', message => {
      messages.push(message);
    });
    const [, sources] = await Promise.all([
      recorder.waitForActionPerformed(),
      recorder.waitForOutput('<javascript>', 'press'),
      page.press('input', 'ArrowDown')
    ]);
    expect(sources.get('<javascript>').text).toContain(`
  // Press ArrowDown
  await page.press('input[name="name"]', 'ArrowDown');`);
    expect(messages[0].text()).toBe('press:ArrowDown');
  });

  it('should emit single keyup on ArrowDown', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<input name="name" onkeydown="console.log('down:' + event.key)" onkeyup="console.log('up:' + event.key)"></input>`);

    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="name"]');

    const messages: any[] = [];
    page.on('console', message => {
      messages.push(message);
    });
    const [, sources] = await Promise.all([
      recorder.waitForActionPerformed(),
      recorder.waitForOutput('<javascript>', 'press'),
      page.press('input', 'ArrowDown')
    ]);
    expect(sources.get('<javascript>').text).toContain(`
  // Press ArrowDown
  await page.press('input[name="name"]', 'ArrowDown');`);
    expect(messages.length).toBe(2);
    expect(messages[0].text()).toBe('down:ArrowDown');
    expect(messages[1].text()).toBe('up:ArrowDown');
  });

  it('should check', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" name="accept" onchange="console.log(checkbox.checked)"></input>`);

    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="accept"]');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('<javascript>', 'check'),
      page.click('input')
    ]);

    expect(sources.get('<javascript>').text).toContain(`
  // Check input[name="accept"]
  await page.check('input[name="accept"]');`);

    expect(sources.get('<python>').text).toContain(`
    # Check input[name="accept"]
    page.check(\"input[name=\\\"accept\\\"]\")`);

    expect(sources.get('<async python>').text).toContain(`
    # Check input[name="accept"]
    await page.check(\"input[name=\\\"accept\\\"]\")`);

    expect(sources.get('<csharp>').text).toContain(`
// Check input[name="accept"]
await page.CheckAsync(\"input[name=\\\"accept\\\"]\");`);

    expect(message.text()).toBe('true');
  });

  it('should check with keyboard', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" name="accept" onchange="console.log(checkbox.checked)"></input>`);

    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="accept"]');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('<javascript>', 'check'),
      page.keyboard.press('Space')
    ]);

    expect(sources.get('<javascript>').text).toContain(`
  // Check input[name="accept"]
  await page.check('input[name="accept"]');`);
    expect(message.text()).toBe('true');
  });

  it('should uncheck', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" checked name="accept" onchange="console.log(checkbox.checked)"></input>`);

    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="accept"]');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('<javascript>', 'uncheck'),
      page.click('input')
    ]);

    expect(sources.get('<javascript>').text).toContain(`
  // Uncheck input[name="accept"]
  await page.uncheck('input[name="accept"]');`);

    expect(sources.get('<python>').text).toContain(`
    # Uncheck input[name="accept"]
    page.uncheck(\"input[name=\\\"accept\\\"]\")`);

    expect(sources.get('<async python>').text).toContain(`
    # Uncheck input[name="accept"]
    await page.uncheck(\"input[name=\\\"accept\\\"]\")`);

    expect(sources.get('<csharp>').text).toContain(`
// Uncheck input[name="accept"]
await page.UncheckAsync(\"input[name=\\\"accept\\\"]\");`);

    expect(message.text()).toBe('false');
  });

  it('should select', async ({ page, recorder }) => {
    await recorder.setContentAndWait('<select id="age" onchange="console.log(age.selectedOptions[0].value)"><option value="1"><option value="2"></select>');

    const selector = await recorder.hoverOverElement('select');
    expect(selector).toBe('select');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('<javascript>', 'select'),
      page.selectOption('select', '2')
    ]);

    expect(sources.get('<javascript>').text).toContain(`
  // Select 2
  await page.selectOption('select', '2');`);

    expect(sources.get('<python>').text).toContain(`
    # Select 2
    page.select_option(\"select\", \"2\")`);

    expect(sources.get('<async python>').text).toContain(`
    # Select 2
    await page.select_option(\"select\", \"2\")`);

    expect(sources.get('<csharp>').text).toContain(`
// Select 2
await page.SelectOptionAsync(\"select\", \"2\");`);

    expect(message.text()).toBe('2');
  });

  it('should await popup', (test, { browserName, headful }) => {
    test.fixme(browserName === 'webkit' && headful, 'Middle click does not open a popup in our webkit embedder');
  }, async ({ page, recorder }) => {
    await recorder.setContentAndWait('<a target=_blank rel=noopener href="about:blank">link</a>');

    const selector = await recorder.hoverOverElement('a');
    expect(selector).toBe('text=link');

    const [popup, sources] = await Promise.all([
      page.context().waitForEvent('page'),
      recorder.waitForOutput('<javascript>', 'waitForEvent'),
      page.dispatchEvent('a', 'click', { detail: 1 })
    ]);

    expect(sources.get('<javascript>').text).toContain(`
  // Click text=link
  const [page1] = await Promise.all([
    page.waitForEvent('popup'),
    page.click('text=link')
  ]);`);

    expect(sources.get('<python>').text).toContain(`
    # Click text=link
    with page.expect_popup() as popup_info:
        page.click(\"text=link\")
    page1 = popup_info.value`);

    expect(sources.get('<async python>').text).toContain(`
    # Click text=link
    async with page.expect_popup() as popup_info:
        await page.click(\"text=link\")
    page1 = await popup_info.value`);

    expect(sources.get('<csharp>').text).toContain(`
var page1Task = page.WaitForEventAsync(PageEvent.Popup)
await Task.WhenAll(
    page1Task,
    page.ClickAsync(\"text=link\"));`);

    expect(popup.url()).toBe('about:blank');
  });

  it('should assert navigation', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<a onclick="window.location.href='about:blank#foo'">link</a>`);

    const selector = await recorder.hoverOverElement('a');
    expect(selector).toBe('text=link');
    const [, sources] = await Promise.all([
      page.waitForNavigation(),
      recorder.waitForOutput('<javascript>', 'assert'),
      page.dispatchEvent('a', 'click', { detail: 1 })
    ]);

    expect(sources.get('<javascript>').text).toContain(`
  // Click text=link
  await page.click('text=link');
  // assert.equal(page.url(), 'about:blank#foo');`);

    expect(sources.get('<python>').text).toContain(`
    # Click text=link
    page.click(\"text=link\")
    # assert page.url == \"about:blank#foo\"`);

    expect(sources.get('<async python>').text).toContain(`
    # Click text=link
    await page.click(\"text=link\")
    # assert page.url == \"about:blank#foo\"`);

    expect(sources.get('<csharp>').text).toContain(`
// Click text=link
await page.ClickAsync(\"text=link\");
// Assert.Equal(\"about:blank#foo\", page.Url);`);

    expect(page.url()).toContain('about:blank#foo');
  });


  it('should await navigation', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<a onclick="setTimeout(() => window.location.href='about:blank#foo', 1000)">link</a>`);

    const selector = await recorder.hoverOverElement('a');
    expect(selector).toBe('text=link');

    const [, sources] = await Promise.all([
      page.waitForNavigation(),
      recorder.waitForOutput('<javascript>', 'waitForNavigation'),
      page.dispatchEvent('a', 'click', { detail: 1 })
    ]);

    expect(sources.get('<javascript>').text).toContain(`
  // Click text=link
  await Promise.all([
    page.waitForNavigation(/*{ url: 'about:blank#foo' }*/),
    page.click('text=link')
  ]);`);

    expect(sources.get('<python>').text).toContain(`
    # Click text=link
    # with page.expect_navigation(url=\"about:blank#foo\"):
    with page.expect_navigation():
        page.click(\"text=link\")`);

    expect(sources.get('<async python>').text).toContain(`
    # Click text=link
    # async with page.expect_navigation(url=\"about:blank#foo\"):
    async with page.expect_navigation():
        await page.click(\"text=link\")`);

    expect(sources.get('<csharp>').text).toContain(`
// Click text=link
await Task.WhenAll(
    page.WaitForNavigationAsync(/*\"about:blank#foo\"*/),
    page.ClickAsync(\"text=link\"));`);

    expect(page.url()).toContain('about:blank#foo');
  });
});
