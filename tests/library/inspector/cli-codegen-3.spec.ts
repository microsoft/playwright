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

import type { TestServer } from 'tests/config/testserver';
import type { Recorder } from './inspectorTest';
import { test, expect } from './inspectorTest';
import type { Page } from '@playwright/test';

test.describe('cli codegen', () => {
  test.skip(({ mode }) => mode !== 'default');

  test('should click locator.first', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`
      <button onclick="console.log('click1')">Submit</button>
      <button onclick="console.log('click2')">Submit</button>
    `);

    const locator = await recorder.hoverOverElement('button');
    expect(locator).toBe(`getByRole('button', { name: 'Submit' }).first()`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick()
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('button', { name: 'Submit' }).first().click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.get_by_role("button", name="Submit").first.click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.get_by_role("button", name="Submit").first.click()`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Submit")).first().click();`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.GetByRole(AriaRole.Button, new() { Name = "Submit" }).First.ClickAsync();`);

    const clickAction = sources.get('JSON')!.actions.map(l => JSON.parse(l)).find(a => a.name === 'click');
    expect.soft(clickAction).toEqual({
      name: 'click',
      selector: 'internal:role=button[name="Submit"i] >> nth=0',
      button: 'left',
      clickCount: 1,
      locator: { body: 'button', kind: 'role', options: { exact: false, attrs: [], name: 'Submit' }, next: { body: '', kind: 'first', options: {} } },
      modifiers: 0,
      signals: [],
      framePath: [],
      pageAlias: 'page',
      pageGuid: expect.any(String),
    });

    expect(message.text()).toBe('click1');
  });

  test('should click locator.nth', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`
      <button onclick="console.log('click1')">Submit</button>
      <button onclick="console.log('click2')">Submit</button>
    `);

    const locator = await recorder.hoverOverElement('button >> nth=1');
    expect(locator).toBe(`getByRole('button', { name: 'Submit' }).nth(1)`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick()
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('button', { name: 'Submit' }).nth(1).click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.get_by_role("button", name="Submit").nth(1).click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.get_by_role("button", name="Submit").nth(1).click()`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Submit")).nth(1).click();`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.GetByRole(AriaRole.Button, new() { Name = "Submit" }).Nth(1).ClickAsync();`);

    expect(message.text()).toBe('click2');
  });

  test('should generate frame locators (1)', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();
    const { frameHello1 } = await createFrameHierarchy(page, recorder, server);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'Hello1'),
      frameHello1.click('text=Hello1'),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#frame1').contentFrame().getByText('Hello1').click();`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.locator("#frame1").contentFrame().getByText("Hello1").click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.locator("#frame1").content_frame.get_by_text("Hello1").click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.locator("#frame1").content_frame.get_by_text("Hello1").click()`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.Locator("#frame1").ContentFrame.GetByText("Hello1").ClickAsync();`);

    const clickAction = sources.get('JSON')!.actions.map(l => JSON.parse(l)).find(a => a.name === 'click');
    expect.soft(clickAction).toEqual({
      name: 'click',
      selector: 'internal:text="Hello1"i',
      button: 'left',
      clickCount: 1,
      locator: { body: 'Hello1', kind: 'text', options: { exact: false } },
      modifiers: 0,
      signals: [],
      framePath: ['#frame1'],
      pageAlias: 'page',
      pageGuid: expect.any(String),
    });
  });

  test('should generate frame locators (2)', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();
    const { frameHello2 } = await createFrameHierarchy(page, recorder, server);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'Hello2'),
      frameHello2.click('text=Hello2'),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#frame1').contentFrame().locator('iframe').contentFrame().getByText('Hello2').click();`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.locator("#frame1").contentFrame().locator("iframe").contentFrame().getByText("Hello2").click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.locator("#frame1").content_frame.locator("iframe").content_frame.get_by_text("Hello2").click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.locator("#frame1").content_frame.locator("iframe").content_frame.get_by_text("Hello2").click()`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.Locator("#frame1").ContentFrame.Locator("iframe").ContentFrame.GetByText("Hello2").ClickAsync();`);

    const clickAction = sources.get('JSON')!.actions.map(l => JSON.parse(l)).find(a => a.name === 'click');
    expect.soft(clickAction).toEqual({
      name: 'click',
      selector: 'internal:text="Hello2"i',
      button: 'left',
      clickCount: 1,
      locator: { body: 'Hello2', kind: 'text', options: { exact: false } },
      modifiers: 0,
      signals: [],
      framePath: ['#frame1', 'iframe'],
      pageAlias: 'page',
      pageGuid: expect.any(String),
    });
  });

  test('should generate frame locators (3)', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();
    const { frameAnonymous } = await createFrameHierarchy(page, recorder, server);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'HelloNameAnonymous'),
      frameAnonymous.click('text=HelloNameAnonymous'),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#frame1').contentFrame().locator('iframe').contentFrame().locator('iframe').nth(2).contentFrame().getByText('HelloNameAnonymous').click();`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.locator("#frame1").contentFrame().locator("iframe").contentFrame().locator("iframe").nth(2).contentFrame().getByText("HelloNameAnonymous").click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.locator("#frame1").content_frame.locator("iframe").content_frame.locator("iframe").nth(2).content_frame.get_by_text("HelloNameAnonymous").click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.locator("#frame1").content_frame.locator("iframe").content_frame.locator("iframe").nth(2).content_frame.get_by_text("HelloNameAnonymous").click()`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.Locator("#frame1").ContentFrame.Locator("iframe").ContentFrame.Locator("iframe").Nth(2).ContentFrame.GetByText("HelloNameAnonymous").ClickAsync();`);

    const clickAction = sources.get('JSON')!.actions.map(l => JSON.parse(l)).find(a => a.name === 'click');
    expect.soft(clickAction).toEqual({
      name: 'click',
      selector: 'internal:text="HelloNameAnonymous"i',
      button: 'left',
      clickCount: 1,
      locator: { body: 'HelloNameAnonymous', kind: 'text', options: { exact: false } },
      modifiers: 0,
      signals: [],
      framePath: ['#frame1', 'iframe', 'iframe >> nth=2'],
      pageAlias: 'page',
      pageGuid: expect.any(String),
    });
  });

  test('should generate frame locators (4)', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();
    /*
      iframe
        div Hello1
        iframe
          div Hello2
          iframe[name=one]
            div HelloNameOne
          iframe
            dev HelloAnonymous
    */
    await recorder.setContentAndWait(`
      <iframe id=frame1 srcdoc="<div>Hello1</div><iframe srcdoc='<div>Hello2</div><iframe name=one></iframe><iframe name=two></iframe><iframe></iframe>'>">
    `, server.EMPTY_PAGE, 6);
    const frameHello1 = page.mainFrame().childFrames()[0];
    const frameHello2 = frameHello1.childFrames()[0];
    const frameTwo = page.frame({ name: 'two' })!;
    await frameTwo.setContent(`<div>HelloNameTwo</div>`);
    const frameAnonymous = frameHello2.childFrames().find(f => !f.name())!;
    await frameAnonymous.setContent(`<div>HelloNameAnonymous</div>`);

    let [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'Hello1'),
      frameHello1.click('text=Hello1'),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#frame1').contentFrame().getByText('Hello1').click();`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.locator("#frame1").contentFrame().getByText("Hello1").click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.locator("#frame1").content_frame.get_by_text("Hello1").click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.locator("#frame1").content_frame.get_by_text("Hello1").click()`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.Locator("#frame1").ContentFrame.GetByText("Hello1").ClickAsync();`);


    [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'Hello2'),
      frameHello2.click('text=Hello2'),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#frame1').contentFrame().locator('iframe').contentFrame().getByText('Hello2').click();`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.locator("#frame1").contentFrame().locator("iframe").contentFrame().getByText("Hello2").click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.locator("#frame1").content_frame.locator("iframe").content_frame.get_by_text("Hello2").click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.locator("#frame1").content_frame.locator("iframe").content_frame.get_by_text("Hello2").click()`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.Locator("#frame1").ContentFrame.Locator("iframe").ContentFrame.GetByText("Hello2").ClickAsync();`);

    [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'HelloNameAnonymous'),
      frameAnonymous.click('text=HelloNameAnonymous'),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#frame1').contentFrame().locator('iframe').contentFrame().locator('iframe').nth(2).contentFrame().getByText('HelloNameAnonymous').click();`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.locator("#frame1").contentFrame().locator("iframe").contentFrame().locator("iframe").nth(2).contentFrame().getByText("HelloNameAnonymous").click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.locator("#frame1").content_frame.locator("iframe").content_frame.locator("iframe").nth(2).content_frame.get_by_text("HelloNameAnonymous").click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.locator("#frame1").content_frame.locator("iframe").content_frame.locator("iframe").nth(2).content_frame.get_by_text("HelloNameAnonymous").click()`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.Locator("#frame1").ContentFrame.Locator("iframe").ContentFrame.Locator("iframe").Nth(2).ContentFrame.GetByText("HelloNameAnonymous").ClickAsync();`);
  });

  test('should generate frame locators with special characters in name attribute', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`
      <iframe srcdoc="<button>Click me</button>">
    `, server.EMPTY_PAGE, 2);
    await page.$eval('iframe', (frame: HTMLIFrameElement) => {
      frame.name = 'foo<bar\'"`>';
    });
    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'Click me'),
      page.locator('iframe[name="foo<bar\'\\"`>"]').contentFrame().getByRole('button', { name: 'Click me' }).click(),
    ]);
    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.locator('iframe[name="foo<bar\\'\\\\\"\`>"]').contentFrame().getByRole('button', { name: 'Click me' }).click()`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.locator("iframe[name=\\"foo<bar'\\\\\\"\`>\\"]").contentFrame().getByRole(AriaRole.BUTTON, new FrameLocator.GetByRoleOptions().setName("Click me")).click()`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.locator("iframe[name=\\"foo<bar'\\\\\\"\`>\\"]").content_frame.get_by_role("button", name="Click me").click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.locator("iframe[name=\\"foo<bar'\\\\\\"\`>\\"]").content_frame.get_by_role("button", name="Click me").click()`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.Locator("iframe[name=\\"foo<bar'\\\\\\"\`>\\"]").ContentFrame.GetByRole(AriaRole.Button, new() { Name = "Click me" }).ClickAsync()`);
  });

  test('should generate frame locators with title attribute', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`
      <iframe title="hello world" srcdoc="<button>Click me</button>"></iframe>
    `, server.EMPTY_PAGE, 1);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'Click me'),
      page.locator('[title="hello world"]').contentFrame().getByRole('button', { name: 'Click me' }).click(),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(
        `await page.locator('iframe[title="hello world"]').contentFrame().getByRole('button', { name: 'Click me' }).click();`
    );

    expect.soft(sources.get('Java')!.text).toContain(
        `page.locator(\"iframe[title=\\\"hello world\\\"]\").contentFrame().getByRole(AriaRole.BUTTON, new FrameLocator.GetByRoleOptions().setName(\"Click me\")).click();`
    );

    expect.soft(sources.get('Python')!.text).toContain(
        `page.locator(\"iframe[title=\\\"hello world\\\"]\").content_frame.get_by_role(\"button\", name=\"Click me\").click()`
    );

    expect.soft(sources.get('Python Async')!.text).toContain(
        `await page.locator("iframe[title=\\\"hello world\\\"]").content_frame.get_by_role("button", name="Click me").click()`
    );

    expect.soft(sources.get('C#')!.text).toContain(
        `await page.Locator("iframe[title=\\\"hello world\\\"]").ContentFrame.GetByRole(AriaRole.Button, new() { Name = "Click me" }).ClickAsync();`
    );
  });

  test('should generate frame locators with name attribute', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`
      <iframe name="hello world" srcdoc="<button>Click me</button>"></iframe>
    `, server.EMPTY_PAGE, 1);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'Click me'),
      page.locator('[name="hello world"]').contentFrame().getByRole('button', { name: 'Click me' }).click(),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(
        `await page.locator('iframe[name="hello world"]').contentFrame().getByRole('button', { name: 'Click me' }).click();`
    );

    expect.soft(sources.get('Java')!.text).toContain(
        `page.locator(\"iframe[name=\\\"hello world\\\"]\").contentFrame().getByRole(AriaRole.BUTTON, new FrameLocator.GetByRoleOptions().setName(\"Click me\")).click();`
    );

    expect.soft(sources.get('Python')!.text).toContain(
        `page.locator(\"iframe[name=\\\"hello world\\\"]\").content_frame.get_by_role(\"button\", name=\"Click me\").click()`
    );

    expect.soft(sources.get('Python Async')!.text).toContain(
        `await page.locator("iframe[name=\\\"hello world\\\"]").content_frame.get_by_role("button", name="Click me").click()`
    );

    expect.soft(sources.get('C#')!.text).toContain(
        `await page.Locator("iframe[name=\\\"hello world\\\"]").ContentFrame.GetByRole(AriaRole.Button, new() { Name = "Click me" }).ClickAsync();`
    );
  });

  test('should generate frame locators with id attribute', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`
      <iframe id="hello-world" srcdoc="<button>Click me</button>"></iframe>
    `, server.EMPTY_PAGE, 1);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'Click me'),
      page.locator('[id="hello-world"]').contentFrame().getByRole('button', { name: 'Click me' }).click(),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(
        `await page.locator('#hello-world').contentFrame().getByRole('button', { name: 'Click me' }).click();`
    );

    expect.soft(sources.get('Java')!.text).toContain(
        `page.locator(\"#hello-world\").contentFrame().getByRole(AriaRole.BUTTON, new FrameLocator.GetByRoleOptions().setName(\"Click me\")).click();`
    );

    expect.soft(sources.get('Python')!.text).toContain(
        `page.locator(\"#hello-world\").content_frame.get_by_role(\"button\", name=\"Click me\").click()`
    );

    expect.soft(sources.get('Python Async')!.text).toContain(
        `await page.locator("#hello-world").content_frame.get_by_role("button", name="Click me").click()`
    );

    expect.soft(sources.get('C#')!.text).toContain(
        `await page.Locator("#hello-world").ContentFrame.GetByRole(AriaRole.Button, new() { Name = "Click me" }).ClickAsync();`
    );
  });

  test('should generate frame locators with testId', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`
    <iframe data-testid="my-testid" srcdoc="<button>Click me</button>"></iframe>
    `, server.EMPTY_PAGE, 1);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'my-testid'),
      page.locator('iframe[data-testid="my-testid"]').contentFrame().getByRole('button', { name: 'Click me' }).click(),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(
        `await page.locator('[data-testid="my-testid"]').contentFrame().getByRole('button', { name: 'Click me' }).click();`
    );

    expect.soft(sources.get('Java')!.text).toContain(
        `page.locator(\"[data-testid=\\\"my-testid\\\"]\").contentFrame().getByRole(AriaRole.BUTTON, new FrameLocator.GetByRoleOptions().setName(\"Click me\")).click();`
    );

    expect.soft(sources.get('Python')!.text).toContain(
        `page.locator(\"[data-testid=\\\"my-testid\\\"]\").content_frame.get_by_role(\"button\", name=\"Click me\").click()`
    );

    expect.soft(sources.get('Python Async')!.text).toContain(
        `await page.locator("[data-testid=\\\"my-testid\\\"]").content_frame.get_by_role("button", name="Click me").click()`
    );

    expect.soft(sources.get('C#')!.text).toContain(
        `await page.Locator("[data-testid=\\\"my-testid\\\"]").ContentFrame.GetByRole(AriaRole.Button, new() { Name = "Click me" }).ClickAsync();`
    );
  });

  test('should generate role locators undef frame locators', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`<iframe id=frame1 srcdoc="<button>Submit</button>">`, server.EMPTY_PAGE, 2);
    const frame = page.mainFrame().childFrames()[0];

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      frame.click('button'),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#frame1').contentFrame().getByRole('button', { name: 'Submit' }).click();`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.locator("#frame1").contentFrame().getByRole(AriaRole.BUTTON, new FrameLocator.GetByRoleOptions().setName("Submit")).click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.locator("#frame1").content_frame.get_by_role("button", name="Submit").click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.locator("#frame1").content_frame.get_by_role("button", name="Submit").click()`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.Locator("#frame1").ContentFrame.GetByRole(AriaRole.Button, new() { Name = "Submit" }).ClickAsync();`);
  });

  test('should generate getByTestId', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<div data-testid=testid onclick="console.log('click')">Submit</div>`);

    const locator = await recorder.hoverOverElement('div');
    expect(locator).toBe(`getByTestId('testid')`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.getByTestId('testid').click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.get_by_test_id("testid").click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.get_by_test_id("testid").click()`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.getByTestId("testid").click()`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.GetByTestId("testid").ClickAsync();`);

    expect(message.text()).toBe('click');
  });

  test('should generate getByPlaceholder', async ({ openRecorder }) => {
    const { recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input placeholder="Country"></input>`);

    const locator = await recorder.hoverOverElement('input');
    expect(locator).toBe(`getByRole('textbox', { name: 'Country' })`);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('textbox', { name: 'Country' }).click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.get_by_role("textbox", name="Country").click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.get_by_role("textbox", name="Country").click()`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.getByRole(AriaRole.TEXTBOX, new Page.GetByRoleOptions().setName("Country")).click()`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.GetByRole(AriaRole.Textbox, new() { Name = "Country" }).ClickAsync();`);
  });

  test('should generate getByAltText', async ({ openRecorder }) => {
    const { recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input alt="Country"></input>`);

    const locator = await recorder.hoverOverElement('input');
    expect(locator).toBe(`getByAltText('Country')`);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.getByAltText('Country').click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.get_by_alt_text("Country").click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.get_by_alt_text("Country").click()`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.getByAltText("Country").click()`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.GetByAltText("Country").ClickAsync();`);
  });

  test('should generate getByLabel', async ({ openRecorder }) => {
    const { recorder } = await openRecorder();

    await recorder.setContentAndWait(`<label for=target>Country</label><input id=target>`);

    const locator = await recorder.hoverOverElement('input');
    expect(locator).toBe(`getByRole('textbox', { name: 'Country' })`);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('textbox', { name: 'Country' }).click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.get_by_role("textbox", name="Country").click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.get_by_role("textbox", name="Country").click()`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.getByRole(AriaRole.TEXTBOX, new Page.GetByRoleOptions().setName("Country")).click()`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.GetByRole(AriaRole.Textbox, new() { Name = "Country" }).ClickAsync();`);
  });

  test('should generate getByLabel without regex', async ({ openRecorder }) => {
    const { recorder } = await openRecorder();

    await recorder.setContentAndWait(`<label for=target>Coun"try</label><input id=target>`);

    const locator = await recorder.hoverOverElement('input');
    expect(locator).toBe(`getByRole('textbox', { name: 'Coun"try' })`);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('textbox', { name: 'Coun\"try' }).click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.get_by_role("textbox", name="Coun\\"try").click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    await page.get_by_role("textbox", name="Coun\\"try").click()`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.getByRole(AriaRole.TEXTBOX, new Page.GetByRoleOptions().setName(\"Coun\\\"try\")).click();`);

    expect.soft(sources.get('C#')!.text).toContain(`
await page.GetByRole(AriaRole.Textbox, new() { Name = \"Coun\\\"try\" }).ClickAsync();`);
  });

  test('should consume pointer events', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`
      <button onclick="console.log('clicked')">Submit</button>
      <script>
        const button = document.querySelector('button');
        const log = [];
        for (const eventName of ['mousedown', 'mousemove', 'mouseup', 'pointerdown', 'pointermove', 'pointerup', 'click'])
          button.addEventListener(eventName, e => log.push(e.type));
      </script>
    `);

    await recorder.hoverOverElement('button');
    expect(await page.evaluate('log')).toEqual(['pointermove', 'mousemove']);

    const [message] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);
    expect(message.text()).toBe('clicked');
    expect(await page.evaluate('log')).toEqual([
      'pointermove', 'mousemove',
      'pointermove',
      'mousemove',
      'pointerdown', 'mousedown',
      'pointerup', 'mouseup',
      'click',
    ]);
  });

  test('should consume contextmenu events, despite a custom context menu', async ({ openRecorder, browserName, platform }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`
      <button>Right click me.</button>
      <div id="menu" style="display: none; position: absolute;">
        <button>Menu option 1</button>
        <button>Menu option 2</button>
      </div>
      <script>
        const button = document.querySelector('button');
        button.addEventListener('contextmenu', e => {
          e.preventDefault();
          console.log('right-clicked');

          // show custom context menu
          const menu = document.getElementById("menu");
          menu.style.display = "block";
          menu.style.left = \`\${e.pageX}px\`;
          menu.style.top = \`\${e.pageY}px\`;
        });
        const log = [];
        for (const eventName of ['mousedown', 'mousemove', 'mouseup', 'pointerdown', 'pointermove', 'pointerup', 'click', 'contextmenu']) {
          button.addEventListener(eventName, e => log.push('button: ' + e.type));
          menu.addEventListener(eventName, e => log.push('menu: ' + e.type));
        }
      </script>
    `);

    await recorder.hoverOverElement('button');
    expect(await page.evaluate('log')).toEqual(['button: pointermove', 'button: mousemove']);

    const [message] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', `button: 'right'`),
      recorder.trustedClick({ button: 'right' }),
    ]);
    expect(message.text()).toBe('right-clicked');
    if (browserName === 'chromium' && platform === 'win32') {
      expect(await page.evaluate('log')).toEqual([
        // hover
        'button: pointermove',
        'button: mousemove',
        // trusted right click
        'button: pointermove',
        'button: mousemove',
        'button: pointerdown',
        'button: mousedown',
        'button: pointerup',
        'button: mouseup',
        'button: contextmenu',
      ]);
    } else {
      expect(await page.evaluate('log')).toEqual([
        // hover
        'button: pointermove',
        'button: mousemove',
        // trusted right click
        // @Max what do you mean pointerup comes before pointerdown?
        'button: pointerup',
        'button: pointermove',
        'button: mousemove',
        'button: pointerdown',
        'button: mousedown',
        'button: contextmenu',
        'menu: pointerup',
        'menu: mouseup',
      ]);
    }
  });

  test('should assert value', async ({ openRecorder }) => {
    const { recorder } = await openRecorder();

    await recorder.setContentAndWait(`
      <input id=first value=foo>
      <input id=second disabled value=bar>
      <input id=third>
      <input id=fourth type=checkbox checked>
    `);

    await recorder.page.click('x-pw-tool-item.value');
    await recorder.hoverOverElement('#first');
    const [sources1] = await Promise.all([
      recorder.waitForOutput('JavaScript', '#first'),
      recorder.trustedClick(),
    ]);
    expect.soft(sources1.get('JavaScript')!.text).toContain(`await expect(page.locator('#first')).toHaveValue('foo')`);
    expect.soft(sources1.get('Python')!.text).toContain(`expect(page.locator("#first")).to_have_value("foo")`);
    expect.soft(sources1.get('Python Async')!.text).toContain(`await expect(page.locator("#first")).to_have_value("foo")`);
    expect.soft(sources1.get('Java')!.text).toContain(`assertThat(page.locator("#first")).hasValue("foo")`);
    expect.soft(sources1.get('C#')!.text).toContain(`await Expect(page.Locator("#first")).ToHaveValueAsync("foo")`);

    await recorder.page.click('x-pw-tool-item.value');
    await recorder.hoverOverElement('#third');
    const [sources3] = await Promise.all([
      recorder.waitForOutput('JavaScript', '#third'),
      recorder.trustedClick(),
    ]);
    expect.soft(sources3.get('JavaScript')!.text).toContain(`await expect(page.locator('#third')).toBeEmpty()`);
    expect.soft(sources3.get('Python')!.text).toContain(`expect(page.locator("#third")).to_be_empty()`);
    expect.soft(sources3.get('Python Async')!.text).toContain(`await expect(page.locator("#third")).to_be_empty()`);
    expect.soft(sources3.get('Java')!.text).toContain(`assertThat(page.locator("#third")).isEmpty()`);
    expect.soft(sources3.get('C#')!.text).toContain(`await Expect(page.Locator("#third")).ToBeEmptyAsync()`);

    await recorder.page.click('x-pw-tool-item.value');
    await recorder.hoverOverElement('#fourth');
    const [sources4] = await Promise.all([
      recorder.waitForOutput('JavaScript', '#fourth'),
      recorder.trustedClick(),
    ]);
    expect.soft(sources4.get('JavaScript')!.text).toContain(`await expect(page.locator('#fourth')).toBeChecked()`);
    expect.soft(sources4.get('Python')!.text).toContain(`expect(page.locator("#fourth")).to_be_checked()`);
    expect.soft(sources4.get('Python Async')!.text).toContain(`await expect(page.locator("#fourth")).to_be_checked()`);
    expect.soft(sources4.get('Java')!.text).toContain(`assertThat(page.locator("#fourth")).isChecked()`);
    expect.soft(sources4.get('C#')!.text).toContain(`await Expect(page.Locator("#fourth")).ToBeCheckedAsync()`);
  });

  test('should assert value on disabled input', async ({ openRecorder, browserName }) => {
    test.fixme(browserName === 'firefox', 'pointerup event is not dispatched on a disabled input');

    const { recorder } = await openRecorder();

    await recorder.setContentAndWait(`
      <input id=first value=foo>
      <input id=second disabled value=bar>
      <input id=third>
      <input id=fourth type=checkbox checked>
    `);

    await recorder.page.click('x-pw-tool-item.value');
    await recorder.hoverOverElement('#second');
    const [sources2] = await Promise.all([
      recorder.waitForOutput('JavaScript', '#second'),
      recorder.trustedClick(),
    ]);
    expect.soft(sources2.get('JavaScript')!.text).toContain(`await expect(page.locator('#second')).toHaveValue('bar')`);
    expect.soft(sources2.get('Python')!.text).toContain(`expect(page.locator("#second")).to_have_value("bar")`);
    expect.soft(sources2.get('Python Async')!.text).toContain(`await expect(page.locator("#second")).to_have_value("bar")`);
    expect.soft(sources2.get('Java')!.text).toContain(`assertThat(page.locator("#second")).hasValue("bar")`);
    expect.soft(sources2.get('C#')!.text).toContain(`await Expect(page.Locator("#second")).ToHaveValueAsync("bar")`);
  });

  test('should assert value on disabled select', async ({ openRecorder, browserName }) => {
    const { recorder } = await openRecorder();

    await recorder.setContentAndWait(`
      <select id=first><option value=foo1>Foo1</option><option value=bar1>Bar1</option></select>
      <select id=second disabled><option value=foo2>Foo2</option><option value=bar2 selected>Bar2</option></select>
    `);

    await recorder.page.click('x-pw-tool-item.value');
    await recorder.hoverOverElement('#second');
    const [sources2] = await Promise.all([
      recorder.waitForOutput('JavaScript', '#second'),
      recorder.trustedClick(),
    ]);
    expect.soft(sources2.get('JavaScript')!.text).toContain(`await expect(page.locator('#second')).toHaveValue('bar2')`);
    expect.soft(sources2.get('Python')!.text).toContain(`expect(page.locator("#second")).to_have_value("bar2")`);
    expect.soft(sources2.get('Python Async')!.text).toContain(`await expect(page.locator("#second")).to_have_value("bar2")`);
    expect.soft(sources2.get('Java')!.text).toContain(`assertThat(page.locator("#second")).hasValue("bar2")`);
    expect.soft(sources2.get('C#')!.text).toContain(`await Expect(page.Locator("#second")).ToHaveValueAsync("bar2")`);
  });

  test('should assert visibility', async ({ openRecorder }) => {
    const { recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input>`);

    await recorder.page.click('x-pw-tool-item.visibility');
    await recorder.hoverOverElement('input');
    const [sources1] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'textbox'),
      recorder.trustedClick(),
    ]);
    expect.soft(sources1.get('JavaScript')!.text).toContain(`await expect(page.getByRole('textbox')).toBeVisible()`);
    expect.soft(sources1.get('Python')!.text).toContain(`expect(page.get_by_role("textbox")).to_be_visible()`);
    expect.soft(sources1.get('Python Async')!.text).toContain(`await expect(page.get_by_role("textbox")).to_be_visible()`);
    expect.soft(sources1.get('Java')!.text).toContain(`assertThat(page.getByRole(AriaRole.TEXTBOX)).isVisible()`);
    expect.soft(sources1.get('C#')!.text).toContain(`await Expect(page.GetByRole(AriaRole.Textbox)).ToBeVisibleAsync()`);
  });

  test('should keep toolbar visible even if webpage erases content in hydration', async ({ openRecorder }) => {
    const { recorder } = await openRecorder();

    const hydrate = () => {
      window.builtins.setTimeout(() => {
        document.documentElement.innerHTML = '<p>Post-Hydration Content</p>';
      }, 500);
    };
    await recorder.setContentAndWait(`
      <p>Pre-Hydration Content</p>
      <script>(${hydrate})()</script>
    `);

    await expect(recorder.page.getByText('Post-Hydration Content')).toBeVisible();
    await expect(recorder.page.locator('x-pw-glass')).toBeVisible();
  });

  test('should display inline svg icons on text assertion dialog inside iframe', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();
    await recorder.page.click('x-pw-tool-item.text');

    const { frameHello1 } = await createFrameHierarchy(page, recorder, server);
    await recorder.trustedMove(frameHello1.locator('div'));
    await recorder.trustedClick();

    const glassPane = frameHello1.locator('x-pw-glass');
    await expect(glassPane.locator('> x-pw-dialog .accept > x-div').evaluate(elem => getComputedStyle(elem).clipPath)).resolves.toBe('url("#icon-check")');
    await expect(glassPane.locator('> svg > defs > clipPath#icon-check')).toBeAttached();
  });
});

async function createFrameHierarchy(page: Page, recorder: Recorder, server: TestServer) {
  /*
    iframe
      div Hello1
      iframe
        div Hello2
        iframe[name=one]
          div HelloNameOne
        iframe
          dev HelloAnonymous
  */
  await recorder.setContentAndWait(`
    <iframe id=frame1 srcdoc="<div>Hello1</div><iframe srcdoc='<div>Hello2</div><iframe name=one></iframe><iframe name=two></iframe><iframe></iframe>'>">
  `, server.EMPTY_PAGE, 6);
  const frameHello1 = page.mainFrame().childFrames()[0];
  const frameHello2 = frameHello1.childFrames()[0];
  const frameTwo = page.frame({ name: 'two' })!;
  await frameTwo.setContent(`<div>HelloNameTwo</div>`);
  const frameAnonymous = frameHello2.childFrames().find(f => !f.name())!;
  await frameAnonymous.setContent(`<div>HelloNameAnonymous</div>`);
  return {
    frameHello1,
    frameHello2,
    frameTwo,
    frameAnonymous,
  };
}
