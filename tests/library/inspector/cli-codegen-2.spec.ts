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
import * as url from 'url';
import fs from 'fs';

test.describe('cli codegen', () => {
  test.skip(({ mode }) => mode !== 'default');

  test('should contain open page', async ({ openRecorder }) => {
    const { recorder } = await openRecorder();

    await recorder.setContentAndWait(``);
    const sources = await recorder.waitForOutput('JavaScript', `page.goto`);

    expect(sources.get('JavaScript')!.text).toContain(`
  const page = await context.newPage();`);

    expect(sources.get('Java')!.text).toContain(`
      Page page = context.newPage();`);

    expect(sources.get('Python')!.text).toContain(`
    page = context.new_page()`);

    expect(sources.get('Python Async')!.text).toContain(`
    page = await context.new_page()`);

    expect(sources.get('C#')!.text).toContain(`
var page = await context.NewPageAsync();`);
  });

  test('should contain second page', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(``);
    await page.context().newPage();
    const sources = await recorder.waitForOutput('JavaScript', 'page1');

    expect(sources.get('JavaScript')!.text).toContain(`
  const page1 = await context.newPage();`);

    expect(sources.get('Java')!.text).toContain(`
      Page page1 = context.newPage();`);

    expect(sources.get('Python')!.text).toContain(`
    page1 = context.new_page()`);

    expect(sources.get('Python Async')!.text).toContain(`
    page1 = await context.new_page()`);

    expect(sources.get('C#')!.text).toContain(`
var page1 = await context.NewPageAsync();`);
  });

  test('should contain close page', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(``);
    await page.context().newPage();
    await recorder.page.close();
    const sources = await recorder.waitForOutput('JavaScript', 'page.close();');

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.close();`);

    expect(sources.get('Java')!.text).toContain(`
      page.close();`);

    expect(sources.get('Python')!.text).toContain(`
    page.close()`);

    expect(sources.get('Python Async')!.text).toContain(`
    await page.close()`);

    expect(sources.get('C#')!.text).toContain(`
await page.CloseAsync();`);
  });

  test('should not lead to an error if html gets clicked', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait('');
    await page.context().newPage();
    const errors: any[] = [];
    recorder.page.on('pageerror', e => errors.push(e));
    await recorder.page.evaluate(() => document.querySelector('body')!.remove());
    await page.dispatchEvent('html', 'mousemove', { detail: 1 });
    await recorder.page.close();
    await recorder.waitForOutput('JavaScript', 'page.close();');
    expect(errors.length).toBe(0);
  });

  test('should upload a single file', async ({ openRecorder, browserName, asset, isLinux }) => {
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`
    <form>
      <input type="file">
    </form>
  `);

    await page.focus('input[type=file]');
    await page.setInputFiles('input[type=file]', asset('file-to-upload.txt'));
    await page.click('input[type=file]');

    const sources = await recorder.waitForOutput('JavaScript', 'setInputFiles');

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('button', { name: 'Choose File' }).setInputFiles('file-to-upload.txt');`);

    expect(sources.get('Java')!.text).toContain(`
      page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Choose File")).setInputFiles(Paths.get("file-to-upload.txt"));`);

    expect(sources.get('Python')!.text).toContain(`
    page.get_by_role("button", name="Choose File").set_input_files(\"file-to-upload.txt\")`);

    expect(sources.get('Python Async')!.text).toContain(`
    await page.get_by_role("button", name="Choose File").set_input_files(\"file-to-upload.txt\")`);

    expect(sources.get('C#')!.text).toContain(`
await page.GetByRole(AriaRole.Button, new() { Name = "Choose File" }).SetInputFilesAsync(new[] { \"file-to-upload.txt\" });`);
  });

  test('should upload multiple files', async ({ openRecorder, browserName, asset, isLinux }) => {
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`
    <form>
      <input type="file" multiple>
    </form>
  `);

    await page.focus('input[type=file]');
    await page.setInputFiles('input[type=file]', [asset('file-to-upload.txt'), asset('file-to-upload-2.txt')]);
    await page.click('input[type=file]');

    const sources = await recorder.waitForOutput('JavaScript', 'setInputFiles');

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('button', { name: 'Choose File' }).setInputFiles(['file-to-upload.txt', 'file-to-upload-2.txt']);`);

    expect(sources.get('Java')!.text).toContain(`
      page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Choose File")).setInputFiles(new Path[] {Paths.get("file-to-upload.txt"), Paths.get("file-to-upload-2.txt")});`);

    expect(sources.get('Python')!.text).toContain(`
    page.get_by_role("button", name="Choose File").set_input_files([\"file-to-upload.txt\", \"file-to-upload-2.txt\"]`);

    expect(sources.get('Python Async')!.text).toContain(`
    await page.get_by_role("button", name="Choose File").set_input_files([\"file-to-upload.txt\", \"file-to-upload-2.txt\"]`);

    expect(sources.get('C#')!.text).toContain(`
await page.GetByRole(AriaRole.Button, new() { Name = "Choose File" }).SetInputFilesAsync(new[] { \"file-to-upload.txt\", \"file-to-upload-2.txt\" });`);
  });

  test('should clear files', async ({ openRecorder, browserName, asset, isLinux }) => {
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`
    <form>
      <input type="file" multiple>
    </form>
  `);
    await page.focus('input[type=file]');
    await page.setInputFiles('input[type=file]', asset('file-to-upload.txt'));
    await page.setInputFiles('input[type=file]', []);
    await page.click('input[type=file]');

    const sources = await recorder.waitForOutput('JavaScript', 'setInputFiles');

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.getByRole('button', { name: 'Choose File' }).setInputFiles([]);`);

    expect(sources.get('Java')!.text).toContain(`
      page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Choose File")).setInputFiles(new Path[0]);`);

    expect(sources.get('Python')!.text).toContain(`
    page.get_by_role("button", name="Choose File").set_input_files([])`);

    expect(sources.get('Python Async')!.text).toContain(`
    await page.get_by_role("button", name="Choose File").set_input_files([])`);

    expect(sources.get('C#')!.text).toContain(`
await page.GetByRole(AriaRole.Button, new() { Name = "Choose File" }).SetInputFilesAsync(new[] {  });`);
  });

  test('should download files', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();

    server.setRoute('/download', (req, res) => {
      const pathName = url.parse(req.url!).path;
      if (pathName === '/download') {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
        res.end(`Hello world`);
      } else {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('');
      }
    });
    await recorder.setContentAndWait(`
      <a href="${server.PREFIX}/download" download>Download</a>
    `, server.PREFIX);
    await recorder.hoverOverElement('a');
    await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const sources = await recorder.waitForOutput('JavaScript', 'await downloadPromise');

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download' }).click();
  const download = await downloadPromise;`);

    expect.soft(sources.get('Java')!.text).toContain(`
      Download download = page.waitForDownload(() -> {
        page.getByRole(AriaRole.LINK, new Page.GetByRoleOptions().setName("Download")).click();
      });`);

    expect.soft(sources.get('Python')!.text).toContain(`
    with page.expect_download() as download_info:
        page.get_by_role("link", name="Download").click()
    download = download_info.value`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    async with page.expect_download() as download_info:
        await page.get_by_role("link", name="Download").click()
    download = await download_info.value`);

    expect.soft(sources.get('C#')!.text).toContain(`
var download = await page.RunAndWaitForDownloadAsync(async () =>
{
    await page.GetByRole(AriaRole.Link, new() { Name = "Download" }).ClickAsync();
});`);
  });

  test('should handle dialogs', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`
    <button onclick="alert()">click me</button>
    `);
    await recorder.hoverOverElement('button');
    page.once('dialog', async dialog => {
      await dialog.dismiss();
    });
    await page.click('button');

    const sources = await recorder.waitForOutput('JavaScript', 'once');

    expect.soft(sources.get('JavaScript')!.text).toContain(`
  page.once('dialog', dialog => {
    console.log(\`Dialog message: \${dialog.message()}\`);
    dialog.dismiss().catch(() => {});
  });
  await page.getByRole('button', { name: 'click me' }).click();`);

    expect.soft(sources.get('Java')!.text).toContain(`
      page.onceDialog(dialog -> {
        System.out.println(String.format("Dialog message: %s", dialog.message()));
        dialog.dismiss();
      });
      page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("click me")).click();`);

    expect.soft(sources.get('Python')!.text).toContain(`
    page.once(\"dialog\", lambda dialog: dialog.dismiss())
    page.get_by_role("button", name="click me").click()`);

    expect.soft(sources.get('Python Async')!.text).toContain(`
    page.once(\"dialog\", lambda dialog: dialog.dismiss())
    await page.get_by_role("button", name="click me").click()`);

    expect.soft(sources.get('C#')!.text).toContain(`
void page_Dialog_EventHandler(object sender, IDialog dialog)
{
    Console.WriteLine($\"Dialog message: {dialog.Message}\");
    dialog.DismissAsync();
    page.Dialog -= page_Dialog_EventHandler;
}
page.Dialog += page_Dialog_EventHandler;
await page.GetByRole(AriaRole.Button, new() { Name = "click me" }).ClickAsync();`);

  });

  test('should handle history.postData', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`
    <script>
    let seqNum = 0;
    function pushState() {
      history.pushState({}, 'title', '${server.PREFIX}/#seqNum=' + (++seqNum));
    }
    </script>`, server.PREFIX);
    for (let i = 1; i < 3; ++i) {
      await page.evaluate('pushState()');
      await recorder.waitForOutput('JavaScript', `await page.goto('${server.PREFIX}/#seqNum=${i}');`);
    }
  });

  test('should record open in a new tab with url', async ({ openRecorder, browserName }) => {
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`<a href="about:blank?foo">link</a>`);

    const locator = await recorder.hoverOverElement('a');
    expect(locator).toBe(`getByRole('link', { name: 'link' })`);

    await page.click('a', { modifiers: ['ControlOrMeta'] });
    const sources = await recorder.waitForOutput('JavaScript', 'page1');

    if (browserName !== 'firefox') {
      expect(sources.get('JavaScript')!.text).toContain(`
  const page1 = await context.newPage();
  await page1.goto('about:blank?foo');`);
      expect(sources.get('Python Async')!.text).toContain(`
    page1 = await context.new_page()
    await page1.goto("about:blank?foo")`);
      expect(sources.get('C#')!.text).toContain(`
var page1 = await context.NewPageAsync();
await page1.GotoAsync("about:blank?foo");`);
    } else {
      expect(sources.get('JavaScript')!.text).toContain(`
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'link' }).click({
    modifiers: ['ControlOrMeta']
  });
  const page1 = await page1Promise;`);
    }
  });

  test('should not clash pages', async ({ openRecorder, browserName }) => {
    const { page, recorder } = await openRecorder();
    const [popup1] = await Promise.all([
      page.context().waitForEvent('page'),
      page.evaluate(`window.open('about:blank')`)
    ]);
    await recorder.setPageContentAndWait(popup1, '<input id=name>');

    const [popup2] = await Promise.all([
      page.context().waitForEvent('page'),
      page.evaluate(`window.open('about:blank')`)
    ]);
    await recorder.setPageContentAndWait(popup2, '<input id=name>');

    await popup1.type('input', 'TextA');
    await recorder.waitForOutput('JavaScript', 'TextA');

    await popup2.type('input', 'TextB');
    await recorder.waitForOutput('JavaScript', 'TextB');

    const sources = recorder.sources();
    expect(sources.get('JavaScript')!.text).toContain(`await page1.locator('#name').fill('TextA');`);
    expect(sources.get('JavaScript')!.text).toContain(`await page2.locator('#name').fill('TextB');`);

    expect(sources.get('Java')!.text).toContain(`page1.locator("#name").fill("TextA");`);
    expect(sources.get('Java')!.text).toContain(`page2.locator("#name").fill("TextB");`);

    expect(sources.get('Python')!.text).toContain(`page1.locator("#name").fill("TextA")`);
    expect(sources.get('Python')!.text).toContain(`page2.locator("#name").fill("TextB")`);

    expect(sources.get('Python Async')!.text).toContain(`await page1.locator("#name").fill("TextA")`);
    expect(sources.get('Python Async')!.text).toContain(`await page2.locator("#name").fill("TextB")`);

    expect(sources.get('C#')!.text).toContain(`await page1.Locator("#name").FillAsync("TextA");`);
    expect(sources.get('C#')!.text).toContain(`await page2.Locator("#name").FillAsync("TextB");`);
  });

  test('click should emit events in order', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`
      <button id=button>
      <script>
      button.addEventListener('mousedown', e => console.log(e.type));
      button.addEventListener('mouseup', e => console.log(e.type));
      button.addEventListener('click', e => console.log(e.type));
      </script>
    `);

    const messages: any[] = [];
    page.on('console', message => {
      if (message.type() !== 'error')
        messages.push(message.text());
    });
    await Promise.all([
      page.click('button'),
      recorder.waitForOutput('JavaScript', '.click(')
    ]);
    await expect.poll(() => messages).toEqual(['mousedown', 'mouseup', 'click']);
  });

  test('should reset hover model on action when element detaches', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<input id="checkbox" onclick="document.getElementById('checkbox').remove()">`);
    const [models] = await Promise.all([
      recorder.waitForActionPerformed(),
      page.click('input')
    ]);
    expect(models.hovered).toBe(null);
  });

  test('should update active model on action', async ({ openRecorder, browserName, headless }) => {
    test.fixme(browserName === 'webkit');

    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" name="accept" onchange="checkbox.name='updated'"></input>`);
    const [models] = await Promise.all([
      recorder.waitForActionPerformed(),
      page.click('input')
    ]);
    expect(models.active).toBe('#checkbox');
  });

  test('should check input with chaining id', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();
    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" name="accept" onchange="checkbox.name = 'updated'"></input>`);
    await Promise.all([
      recorder.waitForActionPerformed(),
      page.click('input[id=checkbox]')
    ]);
  });

  test('should record navigations after identical pushState', async ({ openRecorder, server }) => {
    const { page, recorder } = await openRecorder();
    server.setRoute('/page2.html', (req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('Hello world');
    });
    await recorder.setContentAndWait(`
    <script>
    function pushState() {
      history.pushState({}, 'title', '${server.PREFIX}');
    }
    </script>`, server.PREFIX);
    for (let i = 1; i < 3; ++i)
      await page.evaluate('pushState()');

    await page.goto(server.PREFIX + '/page2.html');
    await recorder.waitForOutput('JavaScript', `await page.goto('${server.PREFIX}/page2.html');`);
  });

  test('should save assets via SIGINT', async ({ runCLI, platform }, testInfo) => {
    test.skip(platform === 'win32', 'SIGINT not supported on Windows');

    const storageFileName = testInfo.outputPath('auth.json');
    const harFileName = testInfo.outputPath('har.har');
    const cli = runCLI([`--save-storage=${storageFileName}`, `--save-har=${harFileName}`]);
    await cli.waitFor(`import { test, expect } from '@playwright/test'`);
    // Since our interrupt is non-graceful, we need to wait for the process to settle.
    // This test should be fixed.
    await new Promise(resolve => setTimeout(resolve, 2000));
    await cli.process.kill('SIGINT');
    const { exitCode, signal } = await cli.process.exited;
    if (exitCode !== null) {
      expect(exitCode).toBe(130);
    } else {
      // If the runner is slow enough, the process will be forcibly terminated by the signal
      expect(signal).toBe('SIGINT');
    }
    expect(fs.existsSync(storageFileName)).toBeTruthy();
    expect(fs.existsSync(harFileName)).toBeTruthy();
  });

  test('should fill tricky characters', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder();

    await recorder.setContentAndWait(`<textarea spellcheck=false id="textarea" name="name" oninput="console.log(textarea.value)"></textarea>`);
    const locator = await recorder.focusElement('textarea');
    expect(locator).toBe(`locator('#textarea')`);

    const [message, sources] = await Promise.all([
      page.waitForEvent('console', msg => msg.type() !== 'error'),
      recorder.waitForOutput('JavaScript', 'fill'),
      page.fill('textarea', 'Hello\'\"\`\nWorld')
    ]);

    expect(sources.get('JavaScript')!.text).toContain(`
  await page.locator('#textarea').fill('Hello\\'"\`\\nWorld');`);

    expect(sources.get('Java')!.text).toContain(`
      page.locator("#textarea").fill("Hello'\\"\`\\nWorld");`);

    expect(sources.get('Python')!.text).toContain(`
    page.locator("#textarea").fill(\"Hello'\\"\`\\nWorld\")`);

    expect(sources.get('Python Async')!.text).toContain(`
    await page.locator("#textarea").fill(\"Hello'\\"\`\\nWorld\")`);

    expect(sources.get('C#')!.text).toContain(`
await page.Locator("#textarea").FillAsync(\"Hello'\\"\`\\nWorld\");`);

    expect(message.text()).toBe('Hello\'\"\`\nWorld');
  });

  test('should --test-id-attribute', async ({ openRecorder }) => {
    const { page, recorder } = await openRecorder({ testIdAttributeName: 'my-test-id' });

    await recorder.setContentAndWait(`<div my-test-id="foo">Hello</div>`);
    await page.click('[my-test-id=foo]');
    const sources = await recorder.waitForOutput('JavaScript', `page.getByTestId`);

    expect.soft(sources.get('JavaScript')!.text).toContain(`await page.getByTestId('foo').click()`);
    expect.soft(sources.get('Java')!.text).toContain(`page.getByTestId("foo").click()`);
    expect.soft(sources.get('Python')!.text).toContain(`page.get_by_test_id("foo").click()`);
    expect.soft(sources.get('Python Async')!.text).toContain(`await page.get_by_test_id("foo").click()`);
    expect.soft(sources.get('C#')!.text).toContain(`await page.GetByTestId("foo").ClickAsync();`);
  });
});
