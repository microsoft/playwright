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
  for (const inFrame of [false, true]) {
    test(`CG-${inFrame ? '193' : '192'} should record drag and drop${inFrame ? ' in an iframe' : ''}`, { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/19892' } }, async ({ openRecorder }) => {
      const { page, recorder } = await openRecorder();
      await recorder.setContentAndWait(inFrame ? '<iframe style="height: 400px"></iframe>' : '');
      const frame = inFrame ? page.frames()[1] : page.mainFrame();
      await frame.setContent(`
        <div draggable="true" data-testid="source" tabindex="0" style="width: 100px; height: 50px; border: 2px solid" ondragstart="event.dataTransfer?.setData('text/plain', 'source')">Drag me</div>
        <div data-testid="target" style="margin-top: 100px; width: 200px; height: 100px; border: 3px solid" ondragover="event.preventDefault()"
             ondrop="event.preventDefault(); if (event.dataTransfer) this.appendChild(document.querySelector('[draggable]'))">Drop here</div>
        <button>Submit</button>
      `);
      const source = frame.getByTestId('source');
      const target = frame.getByTestId('target');

      // Ordinary recording must not guess that a mouse movement is a drag.
      await source.dragTo(target);
      await frame.getByRole('button').click();
      const before = await recorder.waitForOutput('JavaScript', '.click()');
      expect(before.get('JavaScript')!.text).not.toContain('.dragTo(');
      await frame.evaluate(() => document.body.prepend(document.querySelector('[draggable]')!));

      if (inFrame)
        await recorder.recorderPage.getByRole('button', { name: 'Record drag', exact: true }).click();
      else
        await page.locator('x-pw-tool-item.record-drag').click();
      await expect(page.locator('x-pw-tool-item.record-drag')).toHaveAttribute('aria-pressed', 'true');
      if (inFrame) {
        await source.focus();
        await page.keyboard.press('F9');
        await expect(page.locator('x-pw-tool-item.record-drag')).toHaveAttribute('aria-pressed', 'false');
        await page.keyboard.press('F9');
        await expect(page.locator('x-pw-tool-item.record-drag')).toHaveAttribute('aria-pressed', 'true');
      }
      await source.dispatchEvent('pointerdown');
      await target.dispatchEvent('pointerup');
      await source.dragTo(target, { sourcePosition: { x: 10, y: 12 }, targetPosition: { x: 20, y: 22 } });
      await expect(target.getByTestId('source')).toBeVisible();
      const sources = await recorder.waitForOutput('JavaScript', '.dragTo(');
      await expect(page.locator('x-pw-tool-item.record-drag')).toHaveAttribute('aria-pressed', 'false');
      const js = inFrame ? 'page.locator(\'iframe\').contentFrame()' : 'page';
      const python = inFrame ? 'page.locator("iframe").content_frame' : 'page';
      const java = inFrame ? 'page.locator("iframe").contentFrame()' : 'page';
      const csharp = inFrame ? 'page.Locator("iframe").ContentFrame' : 'page';
      expect.soft(sources.get('JavaScript')!.text.replace(/\s+/g, ' ')).toContain(`await ${js}.getByTestId('source').dragTo(${js}.getByTestId('target'), { sourcePosition: { x: 10, y: 12 }, targetPosition: { x: 20, y: 22 } });`);
      expect.soft(sources.get('Python')!.text).toContain(`${python}.get_by_test_id("source").drag_to(${python}.get_by_test_id("target"), source_position={"x":10,"y":12}, target_position={"x":20,"y":22})`);
      expect.soft(sources.get('Python Async')!.text).toContain(`await ${python}.get_by_test_id("source").drag_to(${python}.get_by_test_id("target"), source_position={"x":10,"y":12}, target_position={"x":20,"y":22})`);
      expect.soft(sources.get('Java')!.text).toContain(`${java}.getByTestId("source").dragTo(${java}.getByTestId("target"), new Locator.DragToOptions().setSourcePosition(10, 12).setTargetPosition(20, 22));`);
      expect.soft(sources.get('C#')!.text.replace(/\s+/g, ' ')).toContain(`await ${csharp}.GetByTestId("source").DragToAsync(${csharp}.GetByTestId("target"), new() { SourcePosition = new() { X = 10, Y = 12, }, TargetPosition = new() { X = 20, Y = 22, }, });`);
      expect(sources.get('JavaScript')!.text.match(/\.dragTo\(/g)).toHaveLength(1);
    });
  }

  test('CG-194 should arm and cancel mouse drags with a shortcut', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/19892' } }, async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`
      <div data-testid="surface" style="width: 300px; height: 200px; border: 4px solid"
           onpointerdown="this.setPointerCapture(event.pointerId)"
           onpointerup="this.dataset.released = 'true'">Drag surface</div>
      <div data-testid="target" style="margin-top: 20px; width: 100px; height: 100px">Target</div>
      <button>Submit</button>
    `);
    const toggle = page.locator('x-pw-tool-item.record-drag');
    const surface = page.getByTestId('surface');
    await surface.hover({ position: { x: 20, y: 30 } });
    await page.keyboard.press('F9');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.down();
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await page.mouse.up();
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    const before = await recorder.waitForOutput('JavaScript', '.click()');
    expect(before.get('JavaScript')!.text).not.toContain('.dragTo(');
    expect(before.get('JavaScript')!.text).not.toContain("getByTestId('surface').click");
    expect(before.get('JavaScript')!.text).not.toContain("press('Escape')");

    await recorder.recorderPage.keyboard.press('F9');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await surface.hover({ position: { x: 20, y: 30 } });
    await page.mouse.down();
    await surface.hover({ position: { x: 140, y: 90 } });
    await page.mouse.up();
    await expect(surface).toHaveAttribute('data-released', 'true');
    const sources = await recorder.waitForOutput('JavaScript', '.dragTo(');
    expect(sources.get('JavaScript')!.text.replace(/\s+/g, ' ')).toContain(`page.getByTestId('surface').dragTo(page.getByTestId('surface'), { sourcePosition: { x: 20, y: 30 }, targetPosition: { x: 140, y: 90 } });`);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(sources.get('JavaScript')!.text).not.toContain("press('F9')");

    // Pointer capture retargets pointerup to the source, so resolve the destination by hit testing.
    await page.keyboard.press('F9');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await surface.hover({ position: { x: 20, y: 30 } });
    await page.mouse.down();
    await page.getByTestId('target').hover({ position: { x: 40, y: 50 } });
    await page.mouse.up();
    const second = await recorder.waitForOutput('JavaScript', "dragTo(page.getByTestId('target')");
    expect(second.get('JavaScript')!.text.replace(/\s+/g, ' ')).toContain(`page.getByTestId('surface').dragTo(page.getByTestId('target'), { sourcePosition: { x: 20, y: 30 }, targetPosition: { x: 40, y: 50 } });`);
    expect(second.get('JavaScript')!.text).not.toContain("getByTestId('surface').click");
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('CG-001 should click', async ({ openRecorder }) => {
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

  test('CG-002 should double click', async ({ openRecorder }) => {
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

  test('CG-003 should click twice', async ({ openRecorder }) => {
    const { recorder } = await openRecorder();

    await recorder.setContentAndWait(`<button onclick="console.log('click')">Submit</button>`);

    const locator = await recorder.hoverOverElement('button');
    expect(locator).toBe(`getByRole('button', { name: 'Submit' })`);

    await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
      recorder.waitForActionPerformed(),
    ]);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', `click();\n  await`),
      recorder.trustedClick(),
      recorder.waitForActionPerformed(),
    ]);

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.getByRole('button', { name: 'Submit' }).click();`);
  });

  test('CG-004 should type after clicking twice', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input type="text" value="foo"/>`);
    const locator = await recorder.hoverOverElement('input');
    expect(locator).toBe(`getByRole('textbox')`);

    await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
      recorder.waitForActionPerformed(),
    ]);

    await Promise.all([
      recorder.waitForOutput('JavaScript', `click();\n  await`),
      recorder.trustedClick(),
      recorder.waitForActionPerformed(),
    ]);

    await page.keyboard.type('bar');
    const sources = await recorder.waitForOutput('JavaScript', 'bar');

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('textbox').click();
  await page.getByRole('textbox').click();
  await page.getByRole('textbox').fill('foobar');`);
  });

  test('CG-005 should ignore programmatic events', async ({ openRecorder }) => {
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

  test('CG-006 should click after same-document navigation', async ({ openRecorder, server }) => {
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

  test('CG-007 should make a positioned click on a canvas', async ({ openRecorder }) => {
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
await page.Locator("canvas").ClickAsync(new()
{
    Position = new()
    {
        X = 250,
        Y = 250,
    },
});`);
    expect(message.text()).toBe('click 250 250');
  });

  test('CG-008 should work with TrustedTypes', async ({ openRecorder }) => {
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

  test('CG-009 should not target selector preview by text regexp', async ({ openRecorder }) => {
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

  test('CG-010 should fill', async ({ openRecorder }) => {
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

  test('CG-011 should fill japanese text', async ({ openRecorder }) => {
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

  test('CG-012 should fill textarea', async ({ openRecorder }) => {
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

  test('CG-013 should fill textarea with new lines at the end', async ({ openRecorder }) => {
    test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23774' });
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`<textarea id="textarea"></textarea>`);
    const textarea = page.locator('textarea');
    await textarea.evaluate<void, void, HTMLTextAreaElement>(e => e.addEventListener('input', () => (window as any).lastInputValue = e.value));
    const waitForOutputPromise = recorder.waitForOutput('JavaScript', 'Hello\\n');
    await textarea.type('Hello\n');
    // Issue was that the input event was not fired for the last newline, so we check for that.
    await page.waitForFunction(() => (window as any).lastInputValue === 'Hello\n');
    const sources = await waitForOutputPromise;
    expect(sources.get('JavaScript')!.text).toContain(`await page.locator('#textarea').fill('Hello\\n');`);
    expect(sources.get('JavaScript')!.text).not.toContain(`Enter`);
  });

  test('CG-014 should fill [contentEditable]', async ({ openRecorder }) => {
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

  test('CG-015 should fill [contentEditable] with initial text', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`
      <section aria-label="First"><h1 contenteditable="" oninput="console.log(event.target.innerText)">Initial text</h1></section>
      <section aria-label="Second"><h1 contenteditable="">More text</h1></section>
    `);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'fill'),
      page.fill('section[aria-label=First] h1', 'John Doe')
    ]);
    // The selector should not be derived from the text that is being changed by the fill,
    // but can use the accessible name of the parent element.
    expect(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('region', { name: 'First' }).getByRole('heading').fill('John Doe');`);
    expect(message.text()).toBe('John Doe');
  });

  test('CG-016 should press', async ({ openRecorder }) => {
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

  test('CG-017 should update selected element after pressing Tab', async ({ openRecorder }) => {
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

  test('CG-018 should record ArrowDown', async ({ openRecorder }) => {
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

  test('CG-019 should emit single keyup on ArrowDown', async ({ openRecorder }) => {
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

  test('CG-020 should not record a click on Enter press', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<button onclick="console.log('clicked')">Submit</button>`);

    const locator = await recorder.focusElement('button');
    expect(locator).toBe(`getByRole('button', { name: 'Submit' })`);

    const [message] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', `press('Enter')`),
      page.keyboard.press('Enter'),
    ]);
    expect(message.text()).toBe('clicked');

    // Wait for the next action to be recorded, to make sure the keyboard-activated
    // click event that follows the Enter press did not produce a click action.
    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', `press('Tab')`),
      page.keyboard.press('Tab'),
    ]);
    expect(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('button', { name: 'Submit' }).press('Enter');`);
    expect(sources.get('JavaScript')!.text).not.toContain(`click()`);
  });

  test('CG-021 should check', async ({ openRecorder }) => {
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

  test('CG-022 should check a radio button', async ({ openRecorder }) => {
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

  test('CG-023 should check with keyboard', async ({ openRecorder }) => {
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

  test('CG-024 should check with keyboard after hover', async ({ openRecorder }) => {
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

  test('CG-025 should uncheck', async ({ openRecorder }) => {
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

  test('CG-026 should select', async ({ openRecorder }) => {
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

  test('CG-027 should select with size attribute', async ({ openRecorder }) => {
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

  test('CG-028 should await popup', async ({ openRecorder, server }) => {
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

  test('CG-029 should attribute navigation to click', async ({ openRecorder }) => {
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

  test('CG-030 should attribute navigation to press/fill', async ({ openRecorder }) => {
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

  test('CG-031 should ignore AltGraph', async ({ openRecorder, browserName }) => {
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

  test('CG-032 should middle click', async ({ openRecorder, server }) => {
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
await page.GetByText("Click me").ClickAsync(new()
{
    Button = MouseButton.Middle,
});`);
  });

  test('CG-033 should record slider', async ({ openRecorder, browserName, isLinux, headless }) => {
    test.fixme(browserName === 'chromium' && isLinux && headless, 'https://github.com/microsoft/playwright/issues/38568');

    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input type="range" min="0" max="10" value="5">`);

    const dragSlider = async () => {
      const { x, y, width, height } = await page.locator('input').boundingBox();
      await page.mouse.move(x + width / 2, y + height / 2);
      await page.mouse.down();
      // Dragging to the exact edge is not registered as slider change, so drag close to the end.
      await page.mouse.move(x + width - 3, y + height / 2);
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

  test('CG-034 should click button with nested div', async ({ openRecorder }) => {
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

  test('CG-035 should record omnibox navigations after performAction', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`<button>Submit</button>`);
    await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      page.locator('button').click(),
      recorder.waitForActionPerformed(),
    ]);
    await page.waitForTimeout(600);  // See "signalThreshold" is signal processor.
    await page.goto(server.PREFIX + `/empty.html`);
    await recorder.waitForOutput('JavaScript', `await page.goto('${server.PREFIX}/empty.html');`);
  });

  test('CG-036 should record omnibox navigations after recordAction', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`<textarea></textarea>`);
    await Promise.all([
      recorder.waitForOutput('JavaScript', 'fill'),
      page.locator('textarea').fill('Hello world'),
      recorder.waitForActionPerformed(),
    ]);
    await page.waitForTimeout(600);  // See "signalThreshold" is signal processor.
    await page.goto(server.PREFIX + `/empty.html`);
    await recorder.waitForOutput('JavaScript', `await page.goto('${server.PREFIX}/empty.html');`);
  });

  test('CG-037 should not throw csp directive violation errors', async ({ openRecorder, server }) => {
    server.setCSP('/empty.html', `default-src 'self'`);
    const { page } = await openRecorder();
    await page.goto(server.EMPTY_PAGE);
    const predicate = (msg: ConsoleMessage) => msg.type() === 'error' && /Content[\- ]Security[\- ]Policy/i.test(msg.text());
    await expect(page.waitForEvent('console', { predicate, timeout: 1000 })).rejects.toThrow();
  });

  test('CG-038 should clear when recording is disabled', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/33802' } }, async ({ openRecorder }) => {
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

    await recorder.recorderPage.getByRole('button', { name: /^(Start|Stop) Recording$/ }).click();
    await recorder.recorderPage.getByRole('button', { name: 'Clear' }).click();
    await recorder.recorderPage.getByRole('button', { name: /^(Start|Stop) Recording$/ }).click();

    await recorder.hoverOverElement('#bar');
    [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    expect(sources.get('JavaScript').text).toContain(`getByRole('button', { name: 'Bar' }).click()`);
    expect(sources.get('JavaScript').text).not.toContain(`getByRole('button', { name: 'Foo' })`);
  });
});
