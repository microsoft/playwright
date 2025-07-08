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
import type { ConsoleMessage } from 'playwright';

test.describe('cli codegen', () => {
  test('should click', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<button onclick="console.log('click')">Submit</button>`);

    const locator = await recorder.hoverOverElement('button');
    expect(locator).toBe(`getByRole('button', { name: 'Submit' })`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('button', { name: 'Submit' }).click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.get_by_role("button", name="Submit").click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.get_by_role("button", name="Submit").click()`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Submit")).click()`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.GetByRole(AriaRole.Button, new() { Name = "Submit" }).ClickAsync();`);

    expect(message.text()).toBe('click');
  });

  test('should double click', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<button onclick="console.log('click ' + event.detail)" ondblclick="console.log('dblclick ' + event.detail)">Submit</button>`);

    const locator = await recorder.hoverOverElement('button');
    expect(locator).toBe(`getByRole('button', { name: 'Submit' })`);

    const messages: string[] = [];
    page.on('console', message => {
      if (message.text().includes('click'))
        messages.push(message.text());
    });
    const [, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error' && msg.text() === 'dblclick 2'),
      recorder.waitForOutput('JavaScript', 'dblclick'),
      recorder.trustedDblclick(),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('button', { name: 'Submit' }).dblclick();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.get_by_role("button", name="Submit").dblclick()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.get_by_role("button", name="Submit").dblclick()`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Submit")).dblclick()`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.GetByRole(AriaRole.Button, new() { Name = "Submit" }).DblClickAsync();`);

    expect(messages).toEqual([
      'click 1',
      'click 2',
      'dblclick 2',
    ]);
  });

  test('should click twice', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<button onclick="console.log('click')">Submit</button>`);

    const locator = await recorder.hoverOverElement('button');
    expect(locator).toBe(`getByRole('button', { name: 'Submit' })`);

    await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    // Do not trigger double click.
    await page.waitForTimeout(200);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', `click();\n  await`),
      recorder.trustedClick(),
    ]);

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.getByRole('button', { name: 'Submit' }).click();`);
  });

  test('should type after clicking twice', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input type="text" value="foo"/>`);
    const locator = await recorder.hoverOverElement('input');
    expect(locator).toBe(`getByRole('textbox')`);

    await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    // Do not trigger double click.
    await page.waitForTimeout(200);

    await Promise.all([
      recorder.waitForOutput('JavaScript', `click();\n  await`),
      recorder.trustedClick(),
    ]);

    await page.keyboard.type('bar');
    const sources = await recorder.waitForOutput('JavaScript', 'bar');

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('textbox').click();
  await page.getByRole('textbox').click();
  await page.getByRole('textbox').fill('foobar');`);
  });

  test('should ignore programmatic events', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<button onclick="console.log('click')">Submit</button>`);

    const locator = await recorder.hoverOverElement('button');
    expect(locator).toBe(`getByRole('button', { name: 'Submit' })`);

    await page.dispatchEvent('button', 'click', { detail: 1 });

    await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick()
    ]);

    const clicks = recorder.sources().get('Playwright Test')!.actions!.filter(l => l.includes('Submit'));
    expect(clicks.length).toBe(1);
  });

  test('should click after same-document navigation', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();

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

    const locator = await recorder.hoverOverElement('button');
    expect(locator).toBe(`getByRole('button', { name: 'Submit' })`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('button', { name: 'Submit' }).click();`);
    expect(message.text()).toBe('click');
  });

  test('should make a positioned click on a canvas', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`
      <canvas width="500" height="500" style="margin: 42px"/>
      <script>
      document.querySelector("canvas").addEventListener("click", event => {
        const rect = event.target.getBoundingClientRect();
        console.log("click", event.clientX - rect.left, event.clientY - rect.top);
      })
      </script>
    `);

    const locator = await recorder.hoverOverElement('canvas', {
      position: { x: 250, y: 250 },
    });
    expect(locator).toBe(`locator('canvas')`);
    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.locator('canvas').click({
    position: {
      x: 250,
      y: 250
    }
  });`);

    expect(sources.get('Python')!.text).toContain(`
    page.locator("canvas").click(position={"x":250,"y":250})`);

    expect(sources.get('Python Async')!.text).toContain(`
    await page.locator("canvas").click(position={"x":250,"y":250})`);

    expect(sources.get('Java')!.text).toContain(`
      page.locator("canvas").click(new Locator.ClickOptions()
        .setPosition(250, 250));`);

    expect(sources.get('C#')!.text).toContain(`
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

  test('should work with TrustedTypes', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`
      <head>
        <meta http-equiv="Content-Security-Policy" content="trusted-types unsafe escape; require-trusted-types-for 'script'">
    </head>
    <body>
      <button onclick="console.log('click')">Submit</button>
    </body>`);

    const locator = await recorder.hoverOverElement('button');
    expect(locator).toBe(`getByRole('button', { name: 'Submit' })`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('button', { name: 'Submit' }).click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.get_by_role("button", name="Submit").click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.get_by_role("button", name="Submit").click()`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Submit")).click()`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.GetByRole(AriaRole.Button, new() { Name = "Submit" }).ClickAsync();`);

    expect(message.text()).toBe('click');
  });

  test('should not target selector preview by text regexp', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<span>dummy</span>`);

    // Force highlight.
    await recorder.hoverOverElement('span');
    // Append text after highlight.
    await page.evaluate(() => {
      const div = document.createElement('div');
      div.setAttribute('onclick', "console.log('click')");
      div.textContent = ' Some long text here ';
      document.body.appendChild(div);
    });

    const locator = await recorder.hoverOverElement('div');
    expect(locator).toBe(`getByText('Some long text here')`);

    const divContents = await page.$eval('div', div => div.outerHTML);
    expect(divContents).toBe(`<div onclick="console.log('click')"> Some long text here </div>`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedMove('div').then(() => recorder.trustedClick()),
    ]);
    expect(sources.get('JavaScript')!.text).toContain(`
  await page.getByText('Some long text here').click();`);
    expect(message.text()).toBe('click');
  });

  test('should fill', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input id="input" name="name" oninput="console.log(input.value)"></input>`);
    const locator = await recorder.focusElement('input');
    expect(locator).toBe(`locator('#input')`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'fill'),
      page.fill('input', 'John')
    ]);

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#input').fill('John');`);
    expect(sources.get('Java')!.text).toContain(`
      page.locator("#input").fill("John");`);

    expect(sources.get('Python')!.text).toContain(`
    page.locator("#input").fill(\"John\")`);

    expect(sources.get('Python Async')!.text).toContain(`
    await page.locator("#input").fill(\"John\")`);

    expect(sources.get('C#')!.text).toContain(`
await page.Locator("#input").FillAsync(\"John\");`);

    expect(message.text()).toBe('John');
  });

  test('should fill japanese text', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    // In Japanese, "てすと" or "テスト" means "test".
    await recorder.setContentAndWait(`<input id="input" name="name" oninput="input.value === 'てすと' && console.log(input.value)"></input>`);
    const locator = await recorder.focusElement('input');
    expect(locator).toBe(`locator('#input')`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'fill'),
      (async () => {
        await recorder.page.dispatchEvent('input', 'keydown', { key: 'Process' });
        await recorder.page.keyboard.insertText('てすと');
        await recorder.page.dispatchEvent('input', 'keyup', { key: 'Process' });
      })()
    ]);
    expect(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#input').fill('てすと');`);
    expect(sources.get('Java')!.text).toContain(`
      page.locator("#input").fill("てすと");`);

    expect(sources.get('Python')!.text).toContain(`
    page.locator("#input").fill(\"てすと\")`);

    expect(sources.get('Python Async')!.text).toContain(`
    await page.locator("#input").fill(\"てすと\")`);

    expect(sources.get('C#')!.text).toContain(`
await page.Locator("#input").FillAsync(\"てすと\");`);

    expect(message.text()).toBe('てすと');
  });

  test('should fill textarea', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<textarea id="textarea" name="name" oninput="console.log(textarea.value)"></textarea>`);
    const locator = await recorder.focusElement('textarea');
    expect(locator).toBe(`locator('#textarea')`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'fill'),
      page.fill('textarea', 'John')
    ]);
    expect(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#textarea').fill('John');`);
    expect(message.text()).toBe('John');
  });

  test('should fill textarea with new lines at the end', async ({ openRecorder }) => {
    test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23774' });
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`<textarea id="textarea"></textarea>`);
    const textarea = page.locator('textarea');
    await textarea.evaluate<void, HTMLTextAreaElement>(e => e.addEventListener('input', () => (window as any).lastInputValue = e.value));
    const waitForOutputPromise = recorder.waitForOutput('JavaScript', 'Hello\\n');
    await textarea.type('Hello\n');
    // Issue was that the input event was not fired for the last newline, so we check for that.
    await page.waitForFunction(() => (window as any).lastInputValue === 'Hello\n');
    const sources = await waitForOutputPromise;
    expect(sources.get('JavaScript')!.text).toContain(`await page.locator('#textarea').fill('Hello\\n');`);
    expect(sources.get('JavaScript')!.text).not.toContain(`Enter`);
  });

  test('should fill [contentEditable]', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<div id="content" contenteditable="" oninput="console.log(content.innerText)"/>`);
    const locator = await recorder.focusElement('div');
    expect(locator).toBe(`locator('#content')`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'fill'),
      page.fill('div', 'John Doe')
    ]);
    expect(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#content').fill('John Doe');`);
    expect(message.text()).toBe('John Doe');
  });

  test('should press', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input name="name" onkeypress="console.log('press')"></input>`);

    const locator = await recorder.focusElement('input');
    expect(locator).toBe(`getByRole('textbox')`);

    const messages: any[] = [];
    page.on('console', message => messages.push(message));
    const [, sources] = await Promise.all([
      recorder.waitForActionPerformed(),
      recorder.waitForOutput('JavaScript', 'press'),
      page.press('input', 'Shift+Enter')
    ]);

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('textbox').press('Shift+Enter');`);

    expect(sources.get('Java')!.text).toContain(`
      page.getByRole(AriaRole.TEXTBOX).press("Shift+Enter");`);

    expect(sources.get('Python')!.text).toContain(`
    page.get_by_role("textbox").press("Shift+Enter")`);

    expect(sources.get('Python Async')!.text).toContain(`
    await page.get_by_role("textbox").press("Shift+Enter")`);

    expect(sources.get('C#')!.text).toContain(`
await page.GetByRole(AriaRole.Textbox).PressAsync("Shift+Enter");`);

    expect(messages.map(m => m.text())).toContain('press');
  });

  test('should update selected element after pressing Tab', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`
      <input name="one"></input>
      <input name="two"></input>
    `);

    const input1 = page.locator('input[name="one"]');
    const input2 = page.locator('input[name="two"]');

    {
      await input1.click();
      await recorder.waitForOutput('JavaScript', 'click');
      await expect(input1).toBeFocused();
    }

    {
      await page.keyboard.type('foobar123');
      await recorder.waitForOutput('JavaScript', 'foobar123');
      await expect(input1).toHaveValue('foobar123');
    }

    {
      await page.keyboard.press('Tab');
      await recorder.waitForOutput('JavaScript', 'Tab');
      await expect(input2).toBeFocused();
    }

    {
      await page.keyboard.type('barfoo321');
      await recorder.waitForOutput('JavaScript', 'barfoo321');
      await expect(input2).toHaveValue('barfoo321');
    }

    const text = recorder.sources().get('JavaScript')!.text;
    expect(text).toContain(`
  await page.locator('input[name="one"]').fill('foobar123');`);

    expect(text).toContain(`
  await page.locator('input[name="one"]').press('Tab');`);

    expect(text).toContain(`
  await page.locator('input[name="two"]').fill('barfoo321');`);
  });

  test('should record ArrowDown', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input name="name" onkeydown="console.log('press:' + event.key)"></input>`);

    const locator = await recorder.focusElement('input');
    expect(locator).toBe(`getByRole('textbox')`);

    const messages: any[] = [];
    page.on('console', message => {
      messages.push(message);
    });
    const [, sources] = await Promise.all([
      recorder.waitForActionPerformed(),
      recorder.waitForOutput('JavaScript', 'press'),
      page.press('input', 'ArrowDown')
    ]);
    expect(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('textbox').press('ArrowDown');`);
    expect(messages.map(m => m.text())).toContain('press:ArrowDown');
  });

  test('should emit single keyup on ArrowDown', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input name="name" onkeydown="console.log('down:' + event.key)" onkeyup="console.log('up:' + event.key)"></input>`);

    const locator = await recorder.focusElement('input');
    expect(locator).toBe(`getByRole('textbox')`);

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
    expect(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('textbox').press('ArrowDown');`);
    expect(messages.length).toBe(2);
    expect(messages[0].text()).toBe('down:ArrowDown');
    expect(messages[1].text()).toBe('up:ArrowDown');
  });

  test('should check', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" name="accept" onchange="console.log(checkbox.checked)"></input>`);

    const locator = await recorder.focusElement('input');
    expect(locator).toBe(`locator('#checkbox')`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'check'),
      page.click('input')
    ]);

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#checkbox').check();`);

    expect(sources.get('Java')!.text).toContain(`
      page.locator("#checkbox").check();`);

    expect(sources.get('Python')!.text).toContain(`
    page.locator("#checkbox").check()`);

    expect(sources.get('Python Async')!.text).toContain(`
    await page.locator("#checkbox").check()`);

    expect(sources.get('C#')!.text).toContain(`
await page.Locator("#checkbox").CheckAsync();`);

    expect(message.text()).toBe('true');
  });

  test('should check a radio button', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input id="checkbox" type="radio" name="accept" onchange="console.log(checkbox.checked)"></input>`);

    const locator = await recorder.focusElement('input');
    expect(locator).toBe(`locator('#checkbox')`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'check'),
      page.click('input')
    ]);

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#checkbox').check();`);
    expect(message.text()).toBe('true');
  });

  test('should check with keyboard', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" name="accept" onchange="console.log(checkbox.checked)"></input>`);

    const locator = await recorder.focusElement('input');
    expect(locator).toBe(`locator('#checkbox')`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'check'),
      page.keyboard.press('Space')
    ]);

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#checkbox').check();`);
    expect(message.text()).toBe('true');
  });

  test('should check with keyboard after hover', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" name="accept" onchange="console.log(checkbox.checked)"></input>`);

    await recorder.hoverOverElement('input');
    await page.focus('input');

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'check'),
      page.keyboard.press('Space')
    ]);

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#checkbox').check();`);

    const sources2 = await recorder.waitForOutput('JavaScript', 'check');
    expect(sources2.get('JavaScript')!.text).not.toContain(`
  await page.locator('#checkbox').check();
  await page.locator('#checkbox').check();`);
  });

  test('should uncheck', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" checked name="accept" onchange="console.log(checkbox.checked)"></input>`);

    const locator = await recorder.focusElement('input');
    expect(locator).toBe(`locator('#checkbox')`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'uncheck'),
      page.click('input')
    ]);

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#checkbox').uncheck();`);

    expect(sources.get('Java')!.text).toContain(`
      page.locator("#checkbox").uncheck();`);

    expect(sources.get('Python')!.text).toContain(`
    page.locator("#checkbox").uncheck()`);

    expect(sources.get('Python Async')!.text).toContain(`
    await page.locator("#checkbox").uncheck()`);

    expect(sources.get('C#')!.text).toContain(`
await page.Locator("#checkbox").UncheckAsync();`);

    expect(message.text()).toBe('false');
  });

  test('should select', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait('<select id="age" onchange="console.log(age.selectedOptions[0].value)"><option value="1"><option value="2"></select>');

    const locator = await recorder.hoverOverElement('select');
    expect(locator).toBe(`locator('#age')`);
    await page.locator('select').click();

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'select'),
      page.selectOption('select', '2')
    ]);

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#age').selectOption('2');`);

    expect(sources.get('Java')!.text).toContain(`
      page.locator("#age").selectOption("2");`);

    expect(sources.get('Python')!.text).toContain(`
    page.locator("#age").select_option("2")`);

    expect(sources.get('Python Async')!.text).toContain(`
    await page.locator("#age").select_option("2")`);

    expect(sources.get('C#')!.text).toContain(`
await page.Locator("#age").SelectOptionAsync(new[] { "2" });`);

    expect(message.text()).toBe('2');
  });

  test('should select with size attribute', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`
      <style>
        body {
          margin: 0;
        }
      </style>
      <select id="age" size="2" onchange="console.log(age.selectedOptions[0].value)">
        <option value="1">v1</option>
        <option value="2">v2</option>
      </select>
    `);

    const locator = await recorder.hoverOverElement('select');
    expect(locator).toBe(`locator('#age')`);
    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'select'),
      page.mouse.click(10, 25)
    ]);

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#age').selectOption('2');`);

    expect(sources.get('Java')!.text).toContain(`
      page.locator("#age").selectOption("2");`);

    expect(sources.get('Python')!.text).toContain(`
    page.locator(\"#age\").select_option(\"2\")`);

    expect(sources.get('Python Async')!.text).toContain(`
    await page.locator(\"#age\").select_option(\"2\")`);

    expect(sources.get('C#')!.text).toContain(`
await page.Locator(\"#age\").SelectOptionAsync(new[] { \"2\" });`);

    expect(message.text()).toBe('2');
  });

  test('should await popup', async ({ openRecorder, server }) => {
    test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/36461' });

    const { page, recorder } = await openRecorder();
    server.setRoute('/popup', (req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<button>Click me</button>`);
    });
    await recorder.setContentAndWait(`<a target=_blank rel=noopener href="${server.PREFIX}/popup">link</a>`);

    const locator = await recorder.hoverOverElement('a');
    expect(locator).toBe(`getByRole('link', { name: 'link' })`);

    const [popup] = await Promise.all([
      page.context().waitForEvent('page'),
      recorder.trustedClick(),
    ]);

    recorder.page = popup;
    await recorder.hoverOverElement('button');
    await recorder.trustedClick();

    const sources = await recorder.waitForOutput('JavaScript', 'page1.');

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'link' }).click();
  const page1 = await page1Promise;
  await page1.getByRole('button', { name: 'Click me' }).click();`);

    expect.soft(sources.get('Java')!.text).toContain(`
      Page page1 = page.waitForPopup(() -> {
        page.getByRole(AriaRole.LINK, new Page.GetByRoleOptions().setName("link")).click();
      });`);

    expect.soft(sources.get('Python')!.text).toContain(`
    with page.expect_popup() as page1_info:
        page.get_by_role("link", name="link").click()
    page1 = page1_info.value`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    async with page.expect_popup() as page1_info:
        await page.get_by_role("link", name="link").click()
    page1 = await page1_info.value`);

    expect.soft(sources.get('C#')!.text).toContain(`
var page1 = await page.RunAndWaitForPopupAsync(async () =>
{
    await page.GetByRole(AriaRole.Link, new() { Name = "link" }).ClickAsync();
});
await page1.GetByRole(AriaRole.Button, new() { Name = \"Click me\" }).ClickAsync();`);

    expect.soft(sources.get('C# NUnit')!.text).toContain(`
        var page1 = await Page.RunAndWaitForPopupAsync(async () =>
        {
            await Page.GetByRole(AriaRole.Link, new() { Name = "link" }).ClickAsync();
        });
        await page1.GetByRole(AriaRole.Button, new() { Name = \"Click me\" }).ClickAsync();`);
  });

  test('should attribute navigation to click', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<a onclick="window.location.href='about:blank#foo'">link</a>`);

    const locator = await recorder.hoverOverElement('a');
    expect(locator).toBe(`getByText('link')`);
    const [, sources] = await Promise.all([
      page.waitForNavigation(),
      recorder.waitForOutput('JavaScript', '.click()'),
      recorder.trustedClick(),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.goto('about:blank');
  await page.getByText('link').click();

  // ---------------------
  await context.close();`);

    expect.soft(sources.get('Playwright Test')!.text).toContain(`
  await page.goto('about:blank');
  await page.getByText('link').click();
});`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.navigate(\"about:blank\");
      page.getByText(\"link\").click();
    }`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.goto("about:blank")
    page.get_by_text("link").click()

    # ---------------------
    context.close()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.goto("about:blank")
    await page.get_by_text("link").click()

    # ---------------------
    await context.close()`);

    expect.soft(sources.get('Pytest')!.text).toContain(`
    page.goto("about:blank")
    page.get_by_text("link").click()`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.GotoAsync("about:blank");
await page.GetByText("link").ClickAsync();`);

    expect(page.url()).toContain('about:blank#foo');
  });

  test('should attribute navigation to press/fill', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input /><script>document.querySelector('input').addEventListener('input', () => window.location.href = 'about:blank#foo');</script>`);

    const locator = await recorder.hoverOverElement('input');
    expect(locator).toBe(`getByRole('textbox')`);
    await recorder.trustedClick();
    await expect.poll(() => page.locator('input').evaluate(e => e === document.activeElement)).toBeTruthy();
    const [, sources] = await Promise.all([
      page.waitForNavigation(),
      recorder.waitForOutput('JavaScript', '.fill'),
      recorder.trustedPress('h'),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.goto('about:blank');
  await page.getByRole('textbox').click();
  await page.getByRole('textbox').fill('h');

  // ---------------------
  await context.close();`);

    expect.soft(sources.get('Playwright Test')!.text).toContain(`
  await page.goto('about:blank');
  await page.getByRole('textbox').click();
  await page.getByRole('textbox').fill('h');
});`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.navigate(\"about:blank\");
      page.getByRole(AriaRole.TEXTBOX).click();
      page.getByRole(AriaRole.TEXTBOX).fill(\"h\");
    }`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.goto("about:blank")
    page.get_by_role("textbox").click()
    page.get_by_role("textbox").fill("h")

    # ---------------------
    context.close()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.goto("about:blank")
    await page.get_by_role("textbox").click()
    await page.get_by_role("textbox").fill("h")

    # ---------------------
    await context.close()`);

    expect.soft(sources.get('Pytest')!.text).toContain(`
    page.goto("about:blank")
    page.get_by_role("textbox").click()
    page.get_by_role("textbox").fill("h")`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.GotoAsync("about:blank");
await page.GetByRole(AriaRole.Textbox).ClickAsync();
await page.GetByRole(AriaRole.Textbox).FillAsync("h");`);

    expect(page.url()).toContain('about:blank#foo');
  });

  test('should ignore AltGraph', async ({ openRecorder, browserName }) => {
    test.skip(browserName === 'firefox', 'The TextInputProcessor in Firefox does not work with AltGraph.');
    const { recorder } = await openRecorder();
    await recorder.setContentAndWait(`<input></input>`);

    await recorder.page.type('input', 'playwright');
    await recorder.page.keyboard.press('AltGraph');
    await recorder.page.keyboard.insertText('@');
    await recorder.page.keyboard.type('example.com');
    await recorder.waitForOutput('JavaScript', 'example.com');
    expect(recorder.sources().get('JavaScript')!.text).not.toContain(`await page.getByRole('textbox').press('AltGraph');`);
    expect(recorder.sources().get('JavaScript')!.text).toContain(`await page.getByRole('textbox').fill('playwright@example.com');`);
  });

  test('should middle click', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<a href${JSON.stringify(server.EMPTY_PAGE)}>Click me</a>`);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      page.click('a', { button: 'middle' }),
    ]);

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.getByText('Click me').click({
    button: 'middle'
  });`);

    expect(sources.get('Python')!.text).toContain(`
    page.get_by_text("Click me").click(button="middle")`);

    expect(sources.get('Python Async')!.text).toContain(`
    await page.get_by_text("Click me").click(button="middle")`);

    expect(sources.get('Java')!.text).toContain(`
      page.getByText("Click me").click(new Locator.ClickOptions()
        .setButton(MouseButton.MIDDLE));`);

    expect(sources.get('C#')!.text).toContain(`
await page.GetByText("Click me").ClickAsync(new LocatorClickOptions
{
    Button = MouseButton.Middle,
});`);
  });

  test('should record slider', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input type="range" min="0" max="10" value="5">`);

    const dragSlider = async () => {
      const { x, y, width, height } = await page.locator('input').boundingBox();
      await page.mouse.move(x + width / 2, y + height / 2);
      await page.mouse.down();
      await page.mouse.move(x + width, y + height / 2);
      await page.mouse.up();
    };

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'fill'),
      dragSlider(),
    ]);

    await expect(page.locator('input')).toHaveValue('10');

    expect(sources.get('JavaScript')!.text).not.toContain(`
  await page.getByRole('slider').click();`);

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('slider').fill('10');`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.get_by_role("slider").fill("10")`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.get_by_role("slider").fill("10")`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.getByRole(AriaRole.SLIDER).fill("10")`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.GetByRole(AriaRole.Slider).FillAsync("10");`);
  });

  test('should click button with nested div', async ({ openRecorder }) => {
    test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/29067' });

    const { recorder } = await openRecorder();

    await recorder.setContentAndWait(`<button><div role="none">Submit</div></button>`);

    // we hover the nested div, but it must record the button
    const locator = await recorder.hoverOverElement('div');
    expect(locator).toBe(`getByRole('button', { name: 'Submit' })`);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'Submit'),
      recorder.trustedClick(),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('button', { name: 'Submit' }).click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.get_by_role("button", name="Submit").click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.get_by_role("button", name="Submit").click()`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Submit")).click()`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.GetByRole(AriaRole.Button, new() { Name = "Submit" }).ClickAsync();`);
  });

  test('should record omnibox navigations after performAction', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`<button>Submit</button>`);
    await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      page.locator('button').click(),
    ]);
    await page.waitForTimeout(500);
    await page.goto(server.PREFIX + `/empty.html`);
    await recorder.waitForOutput('JavaScript', `await page.goto('${server.PREFIX}/empty.html');`);
  });

  test('should record omnibox navigations after recordAction', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`<textarea></textarea>`);
    await Promise.all([
      recorder.waitForOutput('JavaScript', 'fill'),
      page.locator('textarea').fill('Hello world'),
    ]);
    await page.waitForTimeout(500);
    await page.goto(server.PREFIX + `/empty.html`);
    await recorder.waitForOutput('JavaScript', `await page.goto('${server.PREFIX}/empty.html');`);
  });

  test('should not throw csp directive violation errors', async ({ openRecorder, server }) => {
    const { page } = await openRecorder();
    await page.goto(server.PREFIX + '/csp.html');
    const predicate = (msg: ConsoleMessage) => msg.type() === 'error' && /Content[\- ]Security[\- ]Policy/i.test(msg.text());
    await expect(page.waitForEvent('console', { predicate, timeout: 1000 })).rejects.toThrow();
  });

  test('should clear when recording is disabled', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/33802' } }, async ({ openRecorder }) => {
    const { recorder } = await openRecorder();

    await recorder.setContentAndWait(`
      <button id="foo" onclick="console.log('click')">Foo</button>
      <button id="bar" onclick="console.log('click')">Bar</button>
    `);

    await recorder.hoverOverElement('#foo');
    let [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    expect(sources.get('JavaScript').text).toContain(`getByRole('button', { name: 'Foo' }).click()`);

    await recorder.recorderPage.getByRole('button', { name: 'Record' }).click();
    await recorder.recorderPage.getByRole('button', { name: 'Clear' }).click();
    await recorder.recorderPage.getByRole('button', { name: 'Record' }).click();

    await recorder.hoverOverElement('#bar');
    [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    expect(sources.get('JavaScript').text).toContain(`getByRole('button', { name: 'Bar' }).click()`);
    expect(sources.get('JavaScript').text).not.toContain(`getByRole('button', { name: 'Foo' })`);
  });
});
