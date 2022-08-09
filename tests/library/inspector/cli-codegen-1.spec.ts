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

import { test, expect } from './inspectorTest';

test.describe('cli codegen', () => {
  test.skip(({ mode }) => mode !== 'default');
  test.fixme(({ browserName, headless }) => browserName === 'firefox' && !headless, 'Focus is off');

  test('should click', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<button onclick="console.log('click')">Submit</button>`);

    const selector = await recorder.hoverOverElement('button');
    expect(selector).toBe('text=Submit');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      page.dispatchEvent('button', 'click', { detail: 1 })
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Click text=Submit
  await page.locator('text=Submit').click();`);

    expect(sources.get('Python').text).toContain(`
    # Click text=Submit
    page.locator("text=Submit").click()`);

    expect(sources.get('Python Async').text).toContain(`
    # Click text=Submit
    await page.locator("text=Submit").click()`);

    expect(sources.get('Java').text).toContain(`
      // Click text=Submit
      page.locator("text=Submit").click();`);

    expect(sources.get('C#').text).toContain(`
        // Click text=Submit
        await page.Locator("text=Submit").ClickAsync();`);

    expect(message.text()).toBe('click');
  });

  test('should click after same-document navigation', async ({ page, openRecorder, server }) => {
    const recorder = await openRecorder();

    server.setRoute('/foo.html', (req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('');
    });
    await recorder.setContentAndWait(`<button onclick="console.log('click')">Submit</button>`, server.PREFIX + '/foo.html');
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
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      page.dispatchEvent('button', 'click', { detail: 1 })
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Click text=Submit
  await page.locator('text=Submit').click();`);
    expect(message.text()).toBe('click');
  });

  test('should make a positioned click on a canvas', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`
      <canvas width="500" height="500" style="margin: 42px"/>
      <script>
      document.querySelector("canvas").addEventListener("click", event => {
        const rect = event.target.getBoundingClientRect();
        console.log("click", event.clientX - rect.left, event.clientY - rect.top);
      })
      </script>
    `);

    const selector = await recorder.waitForHighlight(() => recorder.page.hover('canvas', {
      position: { x: 250, y: 250 },
    }));
    expect(selector).toBe('canvas');
    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.page.click('canvas', {
        position: { x: 250, y: 250 },
      })
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Click canvas
  await page.locator('canvas').click({
    position: {
      x: 250,
      y: 250
    }
  });`);

    expect(sources.get('Python').text).toContain(`
    # Click canvas
    page.locator("canvas").click(position={"x":250,"y":250})`);

    expect(sources.get('Python Async').text).toContain(`
    # Click canvas
    await page.locator("canvas").click(position={"x":250,"y":250})`);

    expect(sources.get('Java').text).toContain(`
      // Click canvas
      page.locator("canvas").click(new Locator.ClickOptions()
        .setPosition(250, 250));`);

    expect(sources.get('C#').text).toContain(`
        // Click canvas
        await page.Locator("canvas").ClickAsync(new LocatorClickOptions
        {
            Position = new Position
            {
                X = 250,
                Y = 250,
            },
        });`);
    expect(message.text()).toBe('click 250 250');
  });

  test('should work with TrustedTypes', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

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
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      page.dispatchEvent('button', 'click', { detail: 1 })
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Click text=Submit
  await page.locator('text=Submit').click();`);

    expect(sources.get('Python').text).toContain(`
    # Click text=Submit
    page.locator("text=Submit").click()`);

    expect(sources.get('Python Async').text).toContain(`
    # Click text=Submit
    await page.locator("text=Submit").click()`);

    expect(sources.get('Java').text).toContain(`
      // Click text=Submit
      page.locator("text=Submit").click();`);

    expect(sources.get('C#').text).toContain(`
        // Click text=Submit
        await page.Locator("text=Submit").ClickAsync();`);

    expect(message.text()).toBe('click');
  });

  test('should not target selector preview by text regexp', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

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
    expect(divContents.replace(/\s__playwright_target__="[^"]+"/, '')).toBe(`<div onclick="console.log('click')"> Some long text here </div>`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      page.dispatchEvent('div', 'click', { detail: 1 })
    ]);
    expect(sources.get('JavaScript').text).toContain(`
  // Click text=Some long text here
  await page.locator('text=Some long text here').click();`);
    expect(message.text()).toBe('click');
  });

  test('should fill', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<input id="input" name="name" oninput="console.log(input.value)"></input>`);
    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="name"]');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'fill'),
      page.fill('input', 'John')
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Fill input[name="name"]
  await page.locator('input[name="name"]').fill('John');`);
    expect(sources.get('Java').text).toContain(`
      // Fill input[name="name"]
      page.locator("input[name=\\\"name\\\"]").fill("John");`);

    expect(sources.get('Python').text).toContain(`
    # Fill input[name="name"]
    page.locator(\"input[name=\\\"name\\\"]\").fill(\"John\")`);

    expect(sources.get('Python Async').text).toContain(`
    # Fill input[name="name"]
    await page.locator(\"input[name=\\\"name\\\"]\").fill(\"John\")`);

    expect(sources.get('C#').text).toContain(`
        // Fill input[name="name"]
        await page.Locator(\"input[name=\\\"name\\\"]\").FillAsync(\"John\");`);

    expect(message.text()).toBe('John');
  });

  test('should fill textarea', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<textarea id="textarea" name="name" oninput="console.log(textarea.value)"></textarea>`);
    const selector = await recorder.focusElement('textarea');
    expect(selector).toBe('textarea[name="name"]');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'fill'),
      page.fill('textarea', 'John')
    ]);
    expect(sources.get('JavaScript').text).toContain(`
  // Fill textarea[name="name"]
  await page.locator('textarea[name="name"]').fill('John');`);
    expect(message.text()).toBe('John');
  });

  test('should press', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<input name="name" onkeypress="console.log('press')"></input>`);

    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="name"]');

    const messages: any[] = [];
    page.on('console', message => messages.push(message));
    const [, sources] = await Promise.all([
      recorder.waitForActionPerformed(),
      recorder.waitForOutput('JavaScript', 'press'),
      page.press('input', 'Shift+Enter')
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Press Enter with modifiers
  await page.locator('input[name="name"]').press('Shift+Enter');`);

    expect(sources.get('Java').text).toContain(`
      // Press Enter with modifiers
      page.locator("input[name=\\\"name\\\"]").press("Shift+Enter");`);

    expect(sources.get('Python').text).toContain(`
    # Press Enter with modifiers
    page.locator(\"input[name=\\\"name\\\"]\").press(\"Shift+Enter\")`);

    expect(sources.get('Python Async').text).toContain(`
    # Press Enter with modifiers
    await page.locator(\"input[name=\\\"name\\\"]\").press(\"Shift+Enter\")`);

    expect(sources.get('C#').text).toContain(`
        // Press Enter with modifiers
        await page.Locator(\"input[name=\\\"name\\\"]\").PressAsync(\"Shift+Enter\");`);

    expect(messages[0].text()).toBe('press');
  });

  test('should update selected element after pressing Tab', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`
      <input name="one"></input>
      <input name="two"></input>
    `);

    await page.click('input[name="one"]');
    await recorder.waitForOutput('JavaScript', 'click');
    await page.keyboard.type('foobar123');
    await recorder.waitForOutput('JavaScript', 'foobar123');

    await page.keyboard.press('Tab');
    await recorder.waitForOutput('JavaScript', 'Tab');
    await page.keyboard.type('barfoo321');
    await recorder.waitForOutput('JavaScript', 'barfoo321');

    const text = recorder.sources().get('JavaScript').text;
    expect(text).toContain(`
  // Fill input[name="one"]
  await page.locator('input[name="one"]').fill('foobar123');`);

    expect(text).toContain(`
  // Press Tab
  await page.locator('input[name="one"]').press('Tab');`);

    expect(text).toContain(`
  // Fill input[name="two"]
  await page.locator('input[name="two"]').fill('barfoo321');`);
  });

  test('should record ArrowDown', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<input name="name" onkeydown="console.log('press:' + event.key)"></input>`);

    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="name"]');

    const messages: any[] = [];
    page.on('console', message => {
      messages.push(message);
    });
    const [, sources] = await Promise.all([
      recorder.waitForActionPerformed(),
      recorder.waitForOutput('JavaScript', 'press'),
      page.press('input', 'ArrowDown')
    ]);
    expect(sources.get('JavaScript').text).toContain(`
  // Press ArrowDown
  await page.locator('input[name="name"]').press('ArrowDown');`);
    expect(messages[0].text()).toBe('press:ArrowDown');
  });

  test('should emit single keyup on ArrowDown', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<input name="name" onkeydown="console.log('down:' + event.key)" onkeyup="console.log('up:' + event.key)"></input>`);

    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="name"]');

    const messages: any[] = [];
    page.on('console', message => {
      if (message.type() !== 'error')
        messages.push(message);
    });
    const [, sources] = await Promise.all([
      recorder.waitForActionPerformed(),
      recorder.waitForOutput('JavaScript', 'press'),
      page.press('input', 'ArrowDown')
    ]);
    expect(sources.get('JavaScript').text).toContain(`
  // Press ArrowDown
  await page.locator('input[name="name"]').press('ArrowDown');`);
    expect(messages.length).toBe(2);
    expect(messages[0].text()).toBe('down:ArrowDown');
    expect(messages[1].text()).toBe('up:ArrowDown');
  });

  test('should check', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" name="accept" onchange="console.log(checkbox.checked)"></input>`);

    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="accept"]');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'check'),
      page.click('input')
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Check input[name="accept"]
  await page.locator('input[name="accept"]').check();`);

    expect(sources.get('Java').text).toContain(`
      // Check input[name="accept"]
      page.locator("input[name=\\\"accept\\\"]").check();`);

    expect(sources.get('Python').text).toContain(`
    # Check input[name="accept"]
    page.locator(\"input[name=\\\"accept\\\"]\").check()`);

    expect(sources.get('Python Async').text).toContain(`
    # Check input[name="accept"]
    await page.locator(\"input[name=\\\"accept\\\"]\").check()`);

    expect(sources.get('C#').text).toContain(`
        // Check input[name="accept"]
        await page.Locator(\"input[name=\\\"accept\\\"]\").CheckAsync();`);

    expect(message.text()).toBe('true');
  });

  test('should check a radio button', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<input id="checkbox" type="radio" name="accept" onchange="console.log(checkbox.checked)"></input>`);

    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="accept"]');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'check'),
      page.click('input')
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Check input[name="accept"]
  await page.locator('input[name="accept"]').check();`);
    expect(message.text()).toBe('true');
  });

  test('should check with keyboard', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" name="accept" onchange="console.log(checkbox.checked)"></input>`);

    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="accept"]');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'check'),
      page.keyboard.press('Space')
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Check input[name="accept"]
  await page.locator('input[name="accept"]').check();`);
    expect(message.text()).toBe('true');
  });

  test('should uncheck', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" checked name="accept" onchange="console.log(checkbox.checked)"></input>`);

    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="accept"]');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'uncheck'),
      page.click('input')
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Uncheck input[name="accept"]
  await page.locator('input[name="accept"]').uncheck();`);

    expect(sources.get('Java').text).toContain(`
      // Uncheck input[name="accept"]
      page.locator("input[name=\\\"accept\\\"]").uncheck();`);

    expect(sources.get('Python').text).toContain(`
    # Uncheck input[name="accept"]
    page.locator(\"input[name=\\\"accept\\\"]\").uncheck()`);

    expect(sources.get('Python Async').text).toContain(`
    # Uncheck input[name="accept"]
    await page.locator(\"input[name=\\\"accept\\\"]\").uncheck()`);

    expect(sources.get('C#').text).toContain(`
        // Uncheck input[name="accept"]
        await page.Locator(\"input[name=\\\"accept\\\"]\").UncheckAsync();`);

    expect(message.text()).toBe('false');
  });

  test('should select', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait('<select id="age" onchange="console.log(age.selectedOptions[0].value)"><option value="1"><option value="2"></select>');

    const selector = await recorder.hoverOverElement('select');
    expect(selector).toBe('select');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'select'),
      page.selectOption('select', '2')
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Select 2
  await page.locator('select').selectOption('2');`);

    expect(sources.get('Java').text).toContain(`
      // Select 2
      page.locator("select").selectOption("2");`);

    expect(sources.get('Python').text).toContain(`
    # Select 2
    page.locator(\"select\").select_option(\"2\")`);

    expect(sources.get('Python Async').text).toContain(`
    # Select 2
    await page.locator(\"select\").select_option(\"2\")`);

    expect(sources.get('C#').text).toContain(`
        // Select 2
        await page.Locator(\"select\").SelectOptionAsync(new[] { \"2\" });`);

    expect(message.text()).toBe('2');
  });

  test('should await popup', async ({ page, openRecorder, browserName, headless }) => {
    test.fixme(browserName === 'webkit' && !headless, 'Middle click does not open a popup in our webkit embedder');

    const recorder = await openRecorder();
    await recorder.setContentAndWait('<a target=_blank rel=noopener href="about:blank">link</a>');

    const selector = await recorder.hoverOverElement('a');
    expect(selector).toBe('text=link');

    const [popup, sources] = await Promise.all([
      page.context().waitForEvent('page'),
      recorder.waitForOutput('JavaScript', 'waitForEvent'),
      page.dispatchEvent('a', 'click', { detail: 1 })
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Click text=link
  const [page1] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('text=link').click()
  ]);`);

    expect(sources.get('Java').text).toContain(`
      // Click text=link
      Page page1 = page.waitForPopup(() -> {
        page.locator("text=link").click();
      });`);

    expect(sources.get('Python').text).toContain(`
    # Click text=link
    with page.expect_popup() as popup_info:
        page.locator(\"text=link\").click()
    page1 = popup_info.value`);

    expect(sources.get('Python Async').text).toContain(`
    # Click text=link
    async with page.expect_popup() as popup_info:
        await page.locator(\"text=link\").click()
    page1 = await popup_info.value`);

    expect(sources.get('C#').text).toContain(`
        var page1 = await page.RunAndWaitForPopupAsync(async () =>
        {
            await page.Locator(\"text=link\").ClickAsync();
        });`);

    expect(popup.url()).toBe('about:blank');
  });

  test('should assert navigation', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<a onclick="window.location.href='about:blank#foo'">link</a>`);

    const selector = await recorder.hoverOverElement('a');
    expect(selector).toBe('text=link');
    const [, sources] = await Promise.all([
      page.waitForNavigation(),
      recorder.waitForOutput('JavaScript', 'waitForURL'),
      page.dispatchEvent('a', 'click', { detail: 1 })
    ]);

    expect.soft(sources.get('JavaScript').text).toContain(`
  // Click text=link
  await page.locator('text=link').click();
  await page.waitForURL('about:blank#foo');`);

    expect.soft(sources.get('Playwright Test').text).toContain(`
  // Click text=link
  await page.locator('text=link').click();
  await expect(page).toHaveURL('about:blank#foo');`);

    expect.soft(sources.get('Java').text).toContain(`
      // Click text=link
      page.locator("text=link").click();
      assertThat(page).hasURL("about:blank#foo");`);

    expect.soft(sources.get('Python').text).toContain(`
    # Click text=link
    page.locator("text=link").click()
    page.wait_for_url("about:blank#foo")`);

    expect.soft(sources.get('Python Async').text).toContain(`
    # Click text=link
    await page.locator("text=link").click()
    await page.wait_for_url("about:blank#foo")`);

    expect.soft(sources.get('Pytest').text).toContain(`
    # Click text=link
    page.locator("text=link").click()
    expect(page).to_have_url("about:blank#foo")`);

    expect.soft(sources.get('C#').text).toContain(`
        // Click text=link
        await page.Locator("text=link").ClickAsync();
        await page.WaitForURLAsync("about:blank#foo");`);

    expect(page.url()).toContain('about:blank#foo');
  });


  test('should await navigation', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<a onclick="setTimeout(() => window.location.href='about:blank#foo', 1000)">link</a>`);

    const selector = await recorder.hoverOverElement('a');
    expect(selector).toBe('text=link');

    const [, sources] = await Promise.all([
      page.waitForNavigation(),
      recorder.waitForOutput('JavaScript', 'waitForURL'),
      page.dispatchEvent('a', 'click', { detail: 1 })
    ]);

    expect.soft(sources.get('JavaScript').text).toContain(`
  // Click text=link
  await page.locator('text=link').click();
  await page.waitForURL('about:blank#foo');`);

    expect.soft(sources.get('Java').text).toContain(`
      // Click text=link
      page.locator("text=link").click();
      assertThat(page).hasURL("about:blank#foo");`);

    expect.soft(sources.get('Python').text).toContain(`
    # Click text=link
    page.locator(\"text=link\").click()
    page.wait_for_url("about:blank#foo")`);

    expect.soft(sources.get('Python Async').text).toContain(`
    # Click text=link
    await page.locator(\"text=link\").click()
    await page.wait_for_url("about:blank#foo")`);

    expect.soft(sources.get('C#').text).toContain(`
        // Click text=link
        await page.Locator(\"text=link\").ClickAsync();
        await page.WaitForURLAsync(\"about:blank#foo\");`);

    expect(page.url()).toContain('about:blank#foo');
  });

  test('should ignore AltGraph', async ({ openRecorder, browserName }) => {
    test.skip(browserName === 'firefox', 'The TextInputProcessor in Firefox does not work with AltGraph.');
    const recorder = await openRecorder();
    await recorder.setContentAndWait(`<input></input>`);

    await recorder.page.type('input', 'playwright');
    await recorder.page.keyboard.press('AltGraph');
    await recorder.page.keyboard.insertText('@');
    await recorder.page.keyboard.type('example.com');
    await recorder.waitForOutput('JavaScript', 'example.com');
    expect(recorder.sources().get('JavaScript').text).not.toContain(`await page.locator('input').press('AltGraph');`);
    expect(recorder.sources().get('JavaScript').text).toContain(`await page.locator('input').fill('playwright@example.com');`);
  });

  test('should middle click', async ({ page, openRecorder, server }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<a href${JSON.stringify(server.EMPTY_PAGE)}>Click me</a>`);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      page.click('a', { button: 'middle' }),
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  await page.locator('text=Click me').click({
    button: 'middle'
  });`);

    expect(sources.get('Python').text).toContain(`
    page.locator("text=Click me").click(button="middle")`);

    expect(sources.get('Python Async').text).toContain(`
    await page.locator("text=Click me").click(button="middle")`);

    expect(sources.get('Java').text).toContain(`
      page.locator("text=Click me").click(new Locator.ClickOptions()
        .setButton(MouseButton.MIDDLE));`);

    expect(sources.get('C#').text).toContain(`
        await page.Locator("text=Click me").ClickAsync(new LocatorClickOptions
        {
            Button = MouseButton.Middle,
        });`);
  });
});
