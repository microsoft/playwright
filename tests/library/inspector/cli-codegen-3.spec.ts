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

  test('should click locator.first', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

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

    expect.soft(sources.get('JavaScript').text).toContain(`
  await page.getByRole('button', { name: 'Submit' }).first().click();`);

    expect.soft(sources.get('Python').text).toContain(`
    page.get_by_role("button", name="Submit").first.click()`);

    expect.soft(sources.get('Python Async').text).toContain(`
    await page.get_by_role("button", name="Submit").first.click()`);

    expect.soft(sources.get('Java').text).toContain(`
      page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Submit")).first().click();`);

    expect.soft(sources.get('C#').text).toContain(`
        await page.GetByRole(AriaRole.Button, new() { Name = "Submit" }).First.ClickAsync();`);

    expect(message.text()).toBe('click1');
  });

  test('should click locator.nth', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

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

    expect.soft(sources.get('JavaScript').text).toContain(`
  await page.getByRole('button', { name: 'Submit' }).nth(1).click();`);

    expect.soft(sources.get('Python').text).toContain(`
    page.get_by_role("button", name="Submit").nth(1).click()`);

    expect.soft(sources.get('Python Async').text).toContain(`
    await page.get_by_role("button", name="Submit").nth(1).click()`);

    expect.soft(sources.get('Java').text).toContain(`
      page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Submit")).nth(1).click();`);

    expect.soft(sources.get('C#').text).toContain(`
        await page.GetByRole(AriaRole.Button, new() { Name = "Submit" }).Nth(1).ClickAsync();`);

    expect(message.text()).toBe('click2');
  });

  test('should generate frame locators', async ({ page, openRecorder, server }) => {
    const recorder = await openRecorder();
    /*
      iframe
        div Hello1
        iframe
          div Hello2
          iframe[name=one]
            div HelloNameOne
          iframe[name=two]
            dev HelloNameTwo
          iframe
            dev HelloAnonymous
    */
    await recorder.setContentAndWait(`
      <iframe id=frame1 srcdoc="<div>Hello1</div><iframe srcdoc='<div>Hello2</div><iframe name=one></iframe><iframe name=two></iframe><iframe></iframe>'>">
    `, server.EMPTY_PAGE, 6);
    const frameHello1 = page.mainFrame().childFrames()[0];
    const frameHello2 = frameHello1.childFrames()[0];
    const frameOne = page.frame({ name: 'one' });
    await frameOne.setContent(`<div>HelloNameOne</div>`);
    const frameTwo = page.frame({ name: 'two' });
    await frameTwo.setContent(`<div>HelloNameTwo</div>`);
    const frameAnonymous = frameHello2.childFrames().find(f => !f.name());
    await frameAnonymous.setContent(`<div>HelloNameAnonymous</div>`);

    let [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'Hello1'),
      frameHello1.click('text=Hello1'),
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  await page.frameLocator('#frame1').getByText('Hello1').click();`);

    expect(sources.get('Java').text).toContain(`
      page.frameLocator("#frame1").getByText("Hello1").click();`);

    expect(sources.get('Python').text).toContain(`
    page.frame_locator("#frame1").get_by_text("Hello1").click()`);

    expect(sources.get('Python Async').text).toContain(`
    await page.frame_locator("#frame1").get_by_text("Hello1").click()`);

    expect(sources.get('C#').text).toContain(`
        await page.FrameLocator("#frame1").GetByText("Hello1").ClickAsync();`);


    [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'Hello2'),
      frameHello2.click('text=Hello2'),
    ]);

    expect.soft(sources.get('JavaScript').text).toContain(`
  await page.frameLocator('#frame1').frameLocator('iframe').getByText('Hello2').click();`);

    expect.soft(sources.get('Java').text).toContain(`
      page.frameLocator("#frame1").frameLocator("iframe").getByText("Hello2").click();`);

    expect.soft(sources.get('Python').text).toContain(`
    page.frame_locator("#frame1").frame_locator("iframe").get_by_text("Hello2").click()`);

    expect.soft(sources.get('Python Async').text).toContain(`
    await page.frame_locator("#frame1").frame_locator("iframe").get_by_text("Hello2").click()`);

    expect.soft(sources.get('C#').text).toContain(`
        await page.FrameLocator("#frame1").FrameLocator("iframe").GetByText("Hello2").ClickAsync();`);


    [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'one'),
      frameOne.click('text=HelloNameOne'),
    ]);

    expect.soft(sources.get('JavaScript').text).toContain(`
  await page.frame({
    name: 'one'
  }).getByText('HelloNameOne').click();`);

    expect.soft(sources.get('Java').text).toContain(`
      page.frame("one").getByText("HelloNameOne").click();`);

    expect.soft(sources.get('Python').text).toContain(`
    page.frame(name=\"one\").get_by_text(\"HelloNameOne\").click()`);

    expect.soft(sources.get('Python Async').text).toContain(`
    await page.frame(name=\"one\").get_by_text(\"HelloNameOne\").click()`);

    expect.soft(sources.get('C#').text).toContain(`
        await page.Frame(\"one\").GetByText(\"HelloNameOne\").ClickAsync();`);


    [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'url:'),
      frameAnonymous.click('text=HelloNameAnonymous'),
    ]);

    expect.soft(sources.get('JavaScript').text).toContain(`
  await page.frame({
    url: 'about:blank'
  }).getByText('HelloNameAnonymous').click();`);

    expect.soft(sources.get('Java').text).toContain(`
      page.frameByUrl("about:blank").getByText("HelloNameAnonymous").click();`);

    expect.soft(sources.get('Python').text).toContain(`
    page.frame(url=\"about:blank\").get_by_text(\"HelloNameAnonymous\").click()`);

    expect.soft(sources.get('Python Async').text).toContain(`
    await page.frame(url=\"about:blank\").get_by_text(\"HelloNameAnonymous\").click()`);

    expect.soft(sources.get('C#').text).toContain(`
        await page.FrameByUrl(\"about:blank\").GetByText(\"HelloNameAnonymous\").ClickAsync();`);
  });

  test('should generate frame locators with title attribute', async ({ page, openRecorder, server }) => {
    const recorder = await openRecorder();
    await recorder.setContentAndWait(`
      <iframe title="hello world" srcdoc="<button>Click me</button>"></iframe>
    `, server.EMPTY_PAGE, 1);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'Click me'),
      page.frameLocator('[title="hello world"]').getByRole('button', { name: 'Click me' }).click(),
    ]);

    expect(sources.get('JavaScript').text).toContain(
        `await page.frameLocator('iframe[title="hello world"]').getByRole('button', { name: 'Click me' }).click();`
    );

    expect(sources.get('Java').text).toContain(
        `page.frameLocator(\"iframe[title=\\\"hello world\\\"]\").getByRole(AriaRole.BUTTON, new FrameLocator.GetByRoleOptions().setName(\"Click me\")).click();`
    );

    expect(sources.get('Python').text).toContain(
        `page.frame_locator(\"iframe[title=\\\"hello world\\\"]\").get_by_role(\"button\", name=\"Click me\").click()`
    );

    expect(sources.get('Python Async').text).toContain(
        `await page.frame_locator("iframe[title=\\\"hello world\\\"]").get_by_role("button", name="Click me").click()`
    );

    expect(sources.get('C#').text).toContain(
        `await page.FrameLocator("iframe[title=\\\"hello world\\\"]").GetByRole(AriaRole.Button, new() { Name = "Click me" }).ClickAsync();`
    );
  });

  test('should generate frame locators with name attribute', async ({ page, openRecorder, server }) => {
    const recorder = await openRecorder();
    await recorder.setContentAndWait(`
      <iframe name="hello world" srcdoc="<button>Click me</button>"></iframe>
    `, server.EMPTY_PAGE, 1);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'Click me'),
      page.frameLocator('[name="hello world"]').getByRole('button', { name: 'Click me' }).click(),
    ]);

    expect(sources.get('JavaScript').text).toContain(
        `await page.frameLocator('iframe[name="hello world"]').getByRole('button', { name: 'Click me' }).click();`
    );

    expect(sources.get('Java').text).toContain(
        `page.frameLocator(\"iframe[name=\\\"hello world\\\"]\").getByRole(AriaRole.BUTTON, new FrameLocator.GetByRoleOptions().setName(\"Click me\")).click();`
    );

    expect(sources.get('Python').text).toContain(
        `page.frame_locator(\"iframe[name=\\\"hello world\\\"]\").get_by_role(\"button\", name=\"Click me\").click()`
    );

    expect(sources.get('Python Async').text).toContain(
        `await page.frame_locator("iframe[name=\\\"hello world\\\"]").get_by_role("button", name="Click me").click()`
    );

    expect(sources.get('C#').text).toContain(
        `await page.FrameLocator("iframe[name=\\\"hello world\\\"]").GetByRole(AriaRole.Button, new() { Name = "Click me" }).ClickAsync();`
    );
  });

  test('should generate frame locators with id attribute', async ({ page, openRecorder, server }) => {
    const recorder = await openRecorder();
    await recorder.setContentAndWait(`
      <iframe id="hello-world" srcdoc="<button>Click me</button>"></iframe>
    `, server.EMPTY_PAGE, 1);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'Click me'),
      page.frameLocator('[id="hello-world"]').getByRole('button', { name: 'Click me' }).click(),
    ]);

    expect(sources.get('JavaScript').text).toContain(
        `await page.frameLocator('#hello-world').getByRole('button', { name: 'Click me' }).click();`
    );

    expect(sources.get('Java').text).toContain(
        `page.frameLocator(\"#hello-world\").getByRole(AriaRole.BUTTON, new FrameLocator.GetByRoleOptions().setName(\"Click me\")).click();`
    );

    expect(sources.get('Python').text).toContain(
        `page.frame_locator(\"#hello-world\").get_by_role(\"button\", name=\"Click me\").click()`
    );

    expect(sources.get('Python Async').text).toContain(
        `await page.frame_locator("#hello-world").get_by_role("button", name="Click me").click()`
    );

    expect(sources.get('C#').text).toContain(
        `await page.FrameLocator("#hello-world").GetByRole(AriaRole.Button, new() { Name = "Click me" }).ClickAsync();`
    );
  });

  test('should generate frame locators with testId', async ({ page, openRecorder, server }) => {
    const recorder = await openRecorder();
    await recorder.setContentAndWait(`
    <iframe data-testid="my-testid" srcdoc="<button>Click me</button>"></iframe>
    `, server.EMPTY_PAGE, 1);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'my-testid'),
      page.frameLocator('iframe[data-testid="my-testid"]').getByRole('button', { name: 'Click me' }).click(),
    ]);

    expect(sources.get('JavaScript').text).toContain(
        `await page.frameLocator('[data-testid="my-testid"]').getByRole('button', { name: 'Click me' }).click();`
    );

    expect(sources.get('Java').text).toContain(
        `page.frameLocator(\"[data-testid=\\\"my-testid\\\"]\").getByRole(AriaRole.BUTTON, new FrameLocator.GetByRoleOptions().setName(\"Click me\")).click();`
    );

    expect(sources.get('Python').text).toContain(
        `page.frame_locator(\"[data-testid=\\\"my-testid\\\"]\").get_by_role(\"button\", name=\"Click me\").click()`
    );

    expect(sources.get('Python Async').text).toContain(
        `await page.frame_locator("[data-testid=\\\"my-testid\\\"]").get_by_role("button", name="Click me").click()`
    );

    expect(sources.get('C#').text).toContain(
        `await page.FrameLocator("[data-testid=\\\"my-testid\\\"]").GetByRole(AriaRole.Button, new() { Name = "Click me" }).ClickAsync();`
    );
  });

  test('should generate role locators undef frame locators', async ({ page, openRecorder, server }) => {
    const recorder = await openRecorder();
    await recorder.setContentAndWait(`<iframe id=frame1 srcdoc="<button>Submit</button>">`, server.EMPTY_PAGE, 2);
    const frame = page.mainFrame().childFrames()[0];

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      frame.click('button'),
    ]);

    expect.soft(sources.get('JavaScript').text).toContain(`
  await page.frameLocator('#frame1').getByRole('button', { name: 'Submit' }).click();`);

    expect.soft(sources.get('Java').text).toContain(`
      page.frameLocator("#frame1").getByRole(AriaRole.BUTTON, new FrameLocator.GetByRoleOptions().setName("Submit")).click();`);

    expect.soft(sources.get('Python').text).toContain(`
    page.frame_locator("#frame1").get_by_role("button", name="Submit").click()`);

    expect.soft(sources.get('Python Async').text).toContain(`
    await page.frame_locator("#frame1").get_by_role("button", name="Submit").click()`);

    expect.soft(sources.get('C#').text).toContain(`
        await page.FrameLocator("#frame1").GetByRole(AriaRole.Button, new() { Name = "Submit" }).ClickAsync();`);
  });

  test('should generate getByTestId', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<div data-testid=testid onclick="console.log('click')">Submit</div>`);

    const locator = await recorder.hoverOverElement('div');
    expect(locator).toBe(`getByTestId('testid')`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    expect.soft(sources.get('JavaScript').text).toContain(`
  await page.getByTestId('testid').click();`);

    expect.soft(sources.get('Python').text).toContain(`
    page.get_by_test_id("testid").click()`);

    expect.soft(sources.get('Python Async').text).toContain(`
    await page.get_by_test_id("testid").click()`);

    expect.soft(sources.get('Java').text).toContain(`
      page.getByTestId("testid").click()`);

    expect.soft(sources.get('C#').text).toContain(`
        await page.GetByTestId("testid").ClickAsync();`);

    expect(message.text()).toBe('click');
  });

  test('should generate getByPlaceholder', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<input placeholder="Country"></input>`);

    const locator = await recorder.hoverOverElement('input');
    expect(locator).toBe(`getByPlaceholder('Country')`);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    expect.soft(sources.get('JavaScript').text).toContain(`
  await page.getByPlaceholder('Country').click();`);

    expect.soft(sources.get('Python').text).toContain(`
    page.get_by_placeholder("Country").click()`);

    expect.soft(sources.get('Python Async').text).toContain(`
    await page.get_by_placeholder("Country").click()`);

    expect.soft(sources.get('Java').text).toContain(`
      page.getByPlaceholder("Country").click()`);

    expect.soft(sources.get('C#').text).toContain(`
        await page.GetByPlaceholder("Country").ClickAsync();`);
  });

  test('should generate getByAltText', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<input alt="Country"></input>`);

    const locator = await recorder.hoverOverElement('input');
    expect(locator).toBe(`getByAltText('Country')`);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    expect.soft(sources.get('JavaScript').text).toContain(`
  await page.getByAltText('Country').click();`);

    expect.soft(sources.get('Python').text).toContain(`
    page.get_by_alt_text("Country").click()`);

    expect.soft(sources.get('Python Async').text).toContain(`
    await page.get_by_alt_text("Country").click()`);

    expect.soft(sources.get('Java').text).toContain(`
      page.getByAltText("Country").click()`);

    expect.soft(sources.get('C#').text).toContain(`
        await page.GetByAltText("Country").ClickAsync();`);
  });

  test('should generate getByLabel', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<label for=target>Country</label><input id=target>`);

    const locator = await recorder.hoverOverElement('input');
    expect(locator).toBe(`getByLabel('Country')`);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    expect.soft(sources.get('JavaScript').text).toContain(`
  await page.getByLabel('Country').click();`);

    expect.soft(sources.get('Python').text).toContain(`
    page.get_by_label("Country").click()`);

    expect.soft(sources.get('Python Async').text).toContain(`
    await page.get_by_label("Country").click()`);

    expect.soft(sources.get('Java').text).toContain(`
      page.getByLabel("Country").click()`);

    expect.soft(sources.get('C#').text).toContain(`
        await page.GetByLabel("Country").ClickAsync();`);
  });

  test('should generate getByLabel without regex', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<label for=target>Coun"try</label><input id=target>`);

    const locator = await recorder.hoverOverElement('input');
    expect(locator).toBe(`getByLabel('Coun"try')`);

    const [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'click'),
      recorder.trustedClick(),
    ]);

    expect.soft(sources.get('JavaScript').text).toContain(`
  await page.getByLabel('Coun\"try').click();`);

    expect.soft(sources.get('Python').text).toContain(`
    page.get_by_label("Coun\\"try").click()`);

    expect.soft(sources.get('Python Async').text).toContain(`
    await page.get_by_label("Coun\\"try").click()`);

    expect.soft(sources.get('Java').text).toContain(`
      page.getByLabel("Coun\\"try").click()`);

    expect.soft(sources.get('C#').text).toContain(`
        await page.GetByLabel("Coun\\"try").ClickAsync();`);
  });
});
