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

    const selector = await recorder.hoverOverElement('button');
    expect(selector).toBe('text=Submit >> nth=0');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      page.dispatchEvent('button', 'click', { detail: 1 })
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Click text=Submit >> nth=0
  await page.locator('text=Submit').first().click();`);

    expect(sources.get('Python').text).toContain(`
    # Click text=Submit >> nth=0
    page.locator("text=Submit").first.click()`);

    expect(sources.get('Python Async').text).toContain(`
    # Click text=Submit >> nth=0
    await page.locator("text=Submit").first.click()`);

    expect(sources.get('Java').text).toContain(`
      // Click text=Submit >> nth=0
      page.locator("text=Submit").first().click();`);

    expect(sources.get('C#').text).toContain(`
        // Click text=Submit >> nth=0
        await page.Locator("text=Submit").First.ClickAsync();`);

    expect(message.text()).toBe('click1');
  });

  test('should click locator.nth', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`
      <button onclick="console.log('click1')">Submit</button>
      <button onclick="console.log('click2')">Submit</button>
    `);

    const selector = await recorder.hoverOverElement('button >> nth=1');
    expect(selector).toBe('text=Submit >> nth=1');

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'click'),
      page.dispatchEvent('button', 'click', { detail: 1 })
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Click text=Submit >> nth=1
  await page.locator('text=Submit').nth(1).click();`);

    expect(sources.get('Python').text).toContain(`
    # Click text=Submit >> nth=1
    page.locator("text=Submit").nth(1).click()`);

    expect(sources.get('Python Async').text).toContain(`
    # Click text=Submit >> nth=1
    await page.locator("text=Submit").nth(1).click()`);

    expect(sources.get('Java').text).toContain(`
      // Click text=Submit >> nth=1
      page.locator("text=Submit").nth(1).click();`);

    expect(sources.get('C#').text).toContain(`
        // Click text=Submit >> nth=1
        await page.Locator("text=Submit").Nth(1).ClickAsync();`);

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
  // Click text=Hello1
  await page.frameLocator('#frame1').locator('text=Hello1').click();`);

    expect(sources.get('Java').text).toContain(`
      // Click text=Hello1
      page.frameLocator("#frame1").locator("text=Hello1").click();`);

    expect(sources.get('Python').text).toContain(`
    # Click text=Hello1
    page.frame_locator("#frame1").locator("text=Hello1").click()`);

    expect(sources.get('Python Async').text).toContain(`
    # Click text=Hello1
    await page.frame_locator("#frame1").locator("text=Hello1").click()`);

    expect(sources.get('C#').text).toContain(`
        // Click text=Hello1
        await page.FrameLocator("#frame1").Locator("text=Hello1").ClickAsync();`);


    [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'Hello2'),
      frameHello2.click('text=Hello2'),
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Click text=Hello2
  await page.frameLocator('#frame1').frameLocator('iframe').locator('text=Hello2').click();`);

    expect(sources.get('Java').text).toContain(`
      // Click text=Hello2
      page.frameLocator("#frame1").frameLocator("iframe").locator("text=Hello2").click();`);

    expect(sources.get('Python').text).toContain(`
    # Click text=Hello2
    page.frame_locator("#frame1").frame_locator("iframe").locator("text=Hello2").click()`);

    expect(sources.get('Python Async').text).toContain(`
    # Click text=Hello2
    await page.frame_locator("#frame1").frame_locator("iframe").locator("text=Hello2").click()`);

    expect(sources.get('C#').text).toContain(`
        // Click text=Hello2
        await page.FrameLocator("#frame1").FrameLocator("iframe").Locator("text=Hello2").ClickAsync();`);


    [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'one'),
      frameOne.click('text=HelloNameOne'),
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Click text=HelloNameOne
  await page.frame({
    name: 'one'
  }).locator('text=HelloNameOne').click();`);

    expect(sources.get('Java').text).toContain(`
      // Click text=HelloNameOne
      page.frame("one").locator("text=HelloNameOne").click();`);

    expect(sources.get('Python').text).toContain(`
    # Click text=HelloNameOne
    page.frame(name=\"one\").locator(\"text=HelloNameOne\").click()`);

    expect(sources.get('Python Async').text).toContain(`
    # Click text=HelloNameOne
    await page.frame(name=\"one\").locator(\"text=HelloNameOne\").click()`);

    expect(sources.get('C#').text).toContain(`
        // Click text=HelloNameOne
        await page.Frame(\"one\").Locator(\"text=HelloNameOne\").ClickAsync();`);


    [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'url:'),
      frameAnonymous.click('text=HelloNameAnonymous'),
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Click text=HelloNameAnonymous
  await page.frame({
    url: 'about:blank'
  }).locator('text=HelloNameAnonymous').click();`);

    expect(sources.get('Java').text).toContain(`
      // Click text=HelloNameAnonymous
      page.frameByUrl("about:blank").locator("text=HelloNameAnonymous").click();`);

    expect(sources.get('Python').text).toContain(`
    # Click text=HelloNameAnonymous
    page.frame(url=\"about:blank\").locator(\"text=HelloNameAnonymous\").click()`);

    expect(sources.get('Python Async').text).toContain(`
    # Click text=HelloNameAnonymous
    await page.frame(url=\"about:blank\").locator(\"text=HelloNameAnonymous\").click()`);

    expect(sources.get('C#').text).toContain(`
        // Click text=HelloNameAnonymous
        await page.FrameByUrl(\"about:blank\").Locator(\"text=HelloNameAnonymous\").ClickAsync();`);
  });
});
