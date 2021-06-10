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

test.describe('cli codegen', () => {
  test.skip(({ mode }) => mode !== 'default');

  test('should contain open page', async ({ openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(``);
    const sources = await recorder.waitForOutput('JavaScript', `page.goto`);

    expect(sources.get('JavaScript').text).toContain(`
  // Open new page
  const page = await context.newPage();`);

    expect(sources.get('Java').text).toContain(`
      // Open new page
      Page page = context.newPage();`);

    expect(sources.get('Python').text).toContain(`
    # Open new page
    page = context.new_page()`);

    expect(sources.get('Python Async').text).toContain(`
    # Open new page
    page = await context.new_page()`);

    expect(sources.get('C#').text).toContain(`
        // Open new page
        var page = await context.NewPageAsync();`);
  });

  test('should contain second page', async ({ openRecorder, page }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(``);
    await page.context().newPage();
    const sources = await recorder.waitForOutput('JavaScript', 'page1');

    expect(sources.get('JavaScript').text).toContain(`
  // Open new page
  const page1 = await context.newPage();`);

    expect(sources.get('Java').text).toContain(`
      // Open new page
      Page page1 = context.newPage();`);

    expect(sources.get('Python').text).toContain(`
    # Open new page
    page1 = context.new_page()`);

    expect(sources.get('Python Async').text).toContain(`
    # Open new page
    page1 = await context.new_page()`);

    expect(sources.get('C#').text).toContain(`
        // Open new page
        var page1 = await context.NewPageAsync();`);
  });

  test('should contain close page', async ({ openRecorder, page }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(``);
    await page.context().newPage();
    await recorder.page.close();
    const sources = await recorder.waitForOutput('JavaScript', 'page.close();');

    expect(sources.get('JavaScript').text).toContain(`
  await page.close();`);

    expect(sources.get('Java').text).toContain(`
      page.close();`);

    expect(sources.get('Python').text).toContain(`
    page.close()`);

    expect(sources.get('Python Async').text).toContain(`
    await page.close()`);

    expect(sources.get('C#').text).toContain(`
        await page.CloseAsync();`);
  });

  test('should not lead to an error if html gets clicked', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait('');
    await page.context().newPage();
    const errors: any[] = [];
    recorder.page.on('pageerror', e => errors.push(e));
    await recorder.page.evaluate(() => document.querySelector('body').remove());
    const selector = await recorder.hoverOverElement('html');
    expect(selector).toBe('html');
    await recorder.page.close();
    await recorder.waitForOutput('JavaScript', 'page.close();');
    expect(errors.length).toBe(0);
  });

  test('should upload a single file', async ({ page, openRecorder, browserName, asset }) => {
    test.fixme(browserName === 'firefox', 'Hangs');

    const recorder = await openRecorder();
    await recorder.setContentAndWait(`
    <form>
      <input type="file">
    </form>
  `);

    await page.focus('input[type=file]');
    await page.setInputFiles('input[type=file]', asset('file-to-upload.txt'));
    await page.click('input[type=file]');

    const sources = await recorder.waitForOutput('JavaScript', 'setInputFiles');

    expect(sources.get('JavaScript').text).toContain(`
  // Upload file-to-upload.txt
  await page.setInputFiles('input[type="file"]', 'file-to-upload.txt');`);

    expect(sources.get('Java').text).toContain(`
      // Upload file-to-upload.txt
      page.setInputFiles("input[type=\\\"file\\\"]", Paths.get("file-to-upload.txt"));`);

    expect(sources.get('Python').text).toContain(`
    # Upload file-to-upload.txt
    page.set_input_files(\"input[type=\\\"file\\\"]\", \"file-to-upload.txt\")`);

    expect(sources.get('Python Async').text).toContain(`
    # Upload file-to-upload.txt
    await page.set_input_files(\"input[type=\\\"file\\\"]\", \"file-to-upload.txt\")`);

    expect(sources.get('C#').text).toContain(`
        // Upload file-to-upload.txt
        await page.SetInputFilesAsync(\"input[type=\\\"file\\\"]\", new[] { \"file-to-upload.txt\" });`);
  });

  test('should upload multiple files', async ({ page, openRecorder, browserName, asset }) => {
    test.fixme(browserName === 'firefox', 'Hangs');

    const recorder = await openRecorder();
    await recorder.setContentAndWait(`
    <form>
      <input type="file" multiple>
    </form>
  `);

    await page.focus('input[type=file]');
    await page.setInputFiles('input[type=file]', [asset('file-to-upload.txt'), asset('file-to-upload-2.txt')]);
    await page.click('input[type=file]');

    const sources = await recorder.waitForOutput('JavaScript', 'setInputFiles');

    expect(sources.get('JavaScript').text).toContain(`
  // Upload file-to-upload.txt, file-to-upload-2.txt
  await page.setInputFiles('input[type=\"file\"]', ['file-to-upload.txt', 'file-to-upload-2.txt']);`);

    expect(sources.get('Java').text).toContain(`
      // Upload file-to-upload.txt, file-to-upload-2.txt
      page.setInputFiles("input[type=\\\"file\\\"]", new Path[] {Paths.get("file-to-upload.txt"), Paths.get("file-to-upload-2.txt")});`);

    expect(sources.get('Python').text).toContain(`
    # Upload file-to-upload.txt, file-to-upload-2.txt
    page.set_input_files(\"input[type=\\\"file\\\"]\", [\"file-to-upload.txt\", \"file-to-upload-2.txt\"]`);

    expect(sources.get('Python Async').text).toContain(`
    # Upload file-to-upload.txt, file-to-upload-2.txt
    await page.set_input_files(\"input[type=\\\"file\\\"]\", [\"file-to-upload.txt\", \"file-to-upload-2.txt\"]`);

    expect(sources.get('C#').text).toContain(`
        // Upload file-to-upload.txt, file-to-upload-2.txt
        await page.SetInputFilesAsync(\"input[type=\\\"file\\\"]\", new[] { \"file-to-upload.txt\", \"file-to-upload-2.txt\" });`);
  });

  test('should clear files', async ({ page, openRecorder, browserName, asset }) => {
    test.fixme(browserName === 'firefox', 'Hangs');

    const recorder = await openRecorder();
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

    expect(sources.get('JavaScript').text).toContain(`
  // Clear selected files
  await page.setInputFiles('input[type=\"file\"]', []);`);

    expect(sources.get('Java').text).toContain(`
      // Clear selected files
      page.setInputFiles("input[type=\\\"file\\\"]", new Path[0]);`);

    expect(sources.get('Python').text).toContain(`
    # Clear selected files
    page.set_input_files(\"input[type=\\\"file\\\"]\", []`);

    expect(sources.get('Python Async').text).toContain(`
    # Clear selected files
    await page.set_input_files(\"input[type=\\\"file\\\"]\", []`);

    expect(sources.get('C#').text).toContain(`
        // Clear selected files
        await page.SetInputFilesAsync(\"input[type=\\\"file\\\"]\", new[] {  });`);

  });

  test('should download files', async ({ page, openRecorder, server }) => {
    const recorder = await openRecorder();

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
    await recorder.hoverOverElement('text=Download');
    await Promise.all([
      page.waitForEvent('download'),
      page.click('text=Download')
    ]);
    const sources = await recorder.waitForOutput('JavaScript', 'waitForEvent');

    expect(sources.get('JavaScript').text).toContain(`
  const context = await browser.newContext({
    acceptDownloads: true
  });`);
    expect(sources.get('JavaScript').text).toContain(`
  // Click text=Download
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('text=Download')
  ]);`);

    expect(sources.get('Java').text).toContain(`
      BrowserContext context = browser.newContext(new Browser.NewContextOptions()
        .setAcceptDownloads(true));`);
    expect(sources.get('Java').text).toContain(`
      // Click text=Download
      Download download = page.waitForDownload(() -> {
        page.click("text=Download");
      });`);

    expect(sources.get('Python').text).toContain(`
    context = browser.new_context(accept_downloads=True)`);
    expect(sources.get('Python').text).toContain(`
    # Click text=Download
    with page.expect_download() as download_info:
        page.click(\"text=Download\")
    download = download_info.value`);

    expect(sources.get('Python Async').text).toContain(`
    context = await browser.new_context(accept_downloads=True)`);
    expect(sources.get('Python Async').text).toContain(`
    # Click text=Download
    async with page.expect_download() as download_info:
        await page.click(\"text=Download\")
    download = await download_info.value`);

    expect(sources.get('C#').text).toContain(`
        var context = await browser.NewContextAsync(new BrowserNewContextOptions
        {
            AcceptDownloads = true,
        });`);
    expect(sources.get('C#').text).toContain(`
        // Click text=Download
        var download1 = await page.RunAndWaitForDownloadAsync(async () =>
        {
            await page.ClickAsync(\"text=Download\");
        });`);
  });

  test('should handle dialogs', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`
    <button onclick="alert()">click me</button>
    `);
    await recorder.hoverOverElement('button');
    page.once('dialog', async dialog => {
      await dialog.dismiss();
    });
    await page.click('text=click me');

    const sources = await recorder.waitForOutput('JavaScript', 'once');

    expect(sources.get('JavaScript').text).toContain(`
  // Click text=click me
  page.once('dialog', dialog => {
    console.log(\`Dialog message: \${dialog.message()}\`);
    dialog.dismiss().catch(() => {});
  });
  await page.click('text=click me');`);

    expect(sources.get('Java').text).toContain(`
      // Click text=click me
      page.onceDialog(dialog -> {
        System.out.println(String.format("Dialog message: %s", dialog.message()));
        dialog.dismiss();
      });
      page.click("text=click me");`);

    expect(sources.get('Python').text).toContain(`
    # Click text=click me
    page.once(\"dialog\", lambda dialog: dialog.dismiss())
    page.click(\"text=click me\")`);

    expect(sources.get('Python Async').text).toContain(`
    # Click text=click me
    page.once(\"dialog\", lambda dialog: dialog.dismiss())
    await page.click(\"text=click me\")`);

    expect(sources.get('C#').text).toContain(`
        // Click text=click me
        void page_Dialog1_EventHandler(object sender, IDialog dialog)
        {
            Console.WriteLine($\"Dialog message: {dialog.Message}\");
            dialog.DismissAsync();
            page.Dialog -= page_Dialog1_EventHandler;
        }
        page.Dialog += page_Dialog1_EventHandler;
        await page.ClickAsync(\"text=click me\");`);

  });

  test('should handle history.postData', async ({ page, openRecorder, server }) => {
    const recorder = await openRecorder();

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

  test('should record open in a new tab with url', async ({ page, openRecorder, browserName, platform }) => {
    test.fixme(browserName === 'webkit', 'Ctrl+click does not open in new tab on WebKit');

    const recorder = await openRecorder();
    await recorder.setContentAndWait(`<a href="about:blank?foo">link</a>`);

    const selector = await recorder.hoverOverElement('a');
    expect(selector).toBe('text=link');

    await page.click('a', { modifiers: [ platform === 'darwin' ? 'Meta' : 'Control'] });
    const sources = await recorder.waitForOutput('JavaScript', 'page1');

    if (browserName === 'chromium') {
      expect(sources.get('JavaScript').text).toContain(`
  // Open new page
  const page1 = await context.newPage();
  await page1.goto('about:blank?foo');`);
      expect(sources.get('Python Async').text).toContain(`
    # Open new page
    page1 = await context.new_page()
    await page1.goto("about:blank?foo")`);
      expect(sources.get('C#').text).toContain(`
        // Open new page
        var page1 = await context.NewPageAsync();
        await page1.GotoAsync("about:blank?foo");`);
    } else if (browserName === 'firefox') {
      expect(sources.get('JavaScript').text).toContain(`
  // Click text=link
  const [page1] = await Promise.all([
    page.waitForEvent('popup'),
    page.click('text=link', {
      modifiers: ['${platform === 'darwin' ? 'Meta' : 'Control'}']
    })
  ]);`);
    }
  });

  test('should not clash pages', async ({ page, openRecorder, browserName }) => {
    test.fixme(browserName === 'firefox', 'Times out on Firefox, maybe the focus issue');

    const recorder = await openRecorder();
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
    expect(sources.get('JavaScript').text).toContain(`await page1.fill('input', 'TextA');`);
    expect(sources.get('JavaScript').text).toContain(`await page2.fill('input', 'TextB');`);

    expect(sources.get('Java').text).toContain(`page1.fill("input", "TextA");`);
    expect(sources.get('Java').text).toContain(`page2.fill("input", "TextB");`);

    expect(sources.get('Python').text).toContain(`page1.fill(\"input\", \"TextA\")`);
    expect(sources.get('Python').text).toContain(`page2.fill(\"input\", \"TextB\")`);

    expect(sources.get('Python Async').text).toContain(`await page1.fill(\"input\", \"TextA\")`);
    expect(sources.get('Python Async').text).toContain(`await page2.fill(\"input\", \"TextB\")`);

    expect(sources.get('C#').text).toContain(`await page1.FillAsync(\"input\", \"TextA\");`);
    expect(sources.get('C#').text).toContain(`await page2.FillAsync(\"input\", \"TextB\");`);
  });

  test('click should emit events in order', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

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
      recorder.waitForOutput('JavaScript', 'page.click')
    ]);
    expect(messages).toEqual(['mousedown', 'mouseup', 'click']);
  });

  test('should update hover model on action', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();

    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" name="accept" onchange="checkbox.name='updated'"></input>`);
    const [ models ] = await Promise.all([
      recorder.waitForActionPerformed(),
      page.click('input')
    ]);
    expect(models.hovered).toBe('input[name="updated"]');
  });

  test('should update active model on action', async ({ page, openRecorder, browserName, headless }) => {
    test.fixme(browserName === 'webkit' && headless);
    test.fixme(browserName === 'firefox' && headless);

    const recorder = await openRecorder();
    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" name="accept" onchange="checkbox.name='updated'"></input>`);
    const [ models ] = await Promise.all([
      recorder.waitForActionPerformed(),
      page.click('input')
    ]);
    expect(models.active).toBe('input[name="updated"]');
  });

  test('should check input with chaning id', async ({ page, openRecorder }) => {
    const recorder = await openRecorder();
    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" name="accept" onchange="checkbox.name = 'updated'"></input>`);
    await Promise.all([
      recorder.waitForActionPerformed(),
      page.click('input[id=checkbox]')
    ]);
  });

  test('should prefer frame name', async ({ page, openRecorder, server }) => {
    const recorder = await openRecorder();
    await recorder.setContentAndWait(`
      <iframe src='./frames/frame.html' name='one'></iframe>
      <iframe src='./frames/frame.html' name='two'></iframe>
      <iframe src='./frames/frame.html'></iframe>
    `, server.EMPTY_PAGE, 4);
    const frameOne = page.frame({ name: 'one' });
    const frameTwo = page.frame({ name: 'two' });
    const otherFrame = page.frames().find(f => f !== page.mainFrame() && !f.name());

    let [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'one'),
      frameOne.click('div'),
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Click text=Hi, I'm frame
  await page.frame({
    name: 'one'
  }).click('text=Hi, I\\'m frame');`);

    expect(sources.get('Java').text).toContain(`
      // Click text=Hi, I'm frame
      page.frame("one").click("text=Hi, I'm frame");`);

    expect(sources.get('Python').text).toContain(`
    # Click text=Hi, I'm frame
    page.frame(name=\"one\").click(\"text=Hi, I'm frame\")`);

    expect(sources.get('Python Async').text).toContain(`
    # Click text=Hi, I'm frame
    await page.frame(name=\"one\").click(\"text=Hi, I'm frame\")`);

    expect(sources.get('C#').text).toContain(`
        // Click text=Hi, I'm frame
        await page.Frame(\"one\").ClickAsync(\"text=Hi, I'm frame\");`);

    [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'two'),
      frameTwo.click('div'),
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Click text=Hi, I'm frame
  await page.frame({
    name: 'two'
  }).click('text=Hi, I\\'m frame');`);

    expect(sources.get('Java').text).toContain(`
      // Click text=Hi, I'm frame
      page.frame("two").click("text=Hi, I'm frame");`);

    expect(sources.get('Python').text).toContain(`
    # Click text=Hi, I'm frame
    page.frame(name=\"two\").click(\"text=Hi, I'm frame\")`);

    expect(sources.get('Python Async').text).toContain(`
    # Click text=Hi, I'm frame
    await page.frame(name=\"two\").click(\"text=Hi, I'm frame\")`);

    expect(sources.get('C#').text).toContain(`
        // Click text=Hi, I'm frame
        await page.Frame(\"two\").ClickAsync(\"text=Hi, I'm frame\");`);

    [sources] = await Promise.all([
      recorder.waitForOutput('JavaScript', 'url: \''),
      otherFrame.click('div'),
    ]);

    expect(sources.get('JavaScript').text).toContain(`
  // Click text=Hi, I'm frame
  await page.frame({
    url: 'http://localhost:${server.PORT}/frames/frame.html'
  }).click('text=Hi, I\\'m frame');`);

    expect(sources.get('Java').text).toContain(`
      // Click text=Hi, I'm frame
      page.frameByUrl("http://localhost:${server.PORT}/frames/frame.html").click("text=Hi, I'm frame");`);

    expect(sources.get('Python').text).toContain(`
    # Click text=Hi, I'm frame
    page.frame(url=\"http://localhost:${server.PORT}/frames/frame.html\").click(\"text=Hi, I'm frame\")`);

    expect(sources.get('Python Async').text).toContain(`
    # Click text=Hi, I'm frame
    await page.frame(url=\"http://localhost:${server.PORT}/frames/frame.html\").click(\"text=Hi, I'm frame\")`);

    expect(sources.get('C#').text).toContain(`
        // Click text=Hi, I'm frame
        await page.FrameByUrl(\"http://localhost:${server.PORT}/frames/frame.html\").ClickAsync(\"text=Hi, I'm frame\");`);
  });

  test('should record navigations after identical pushState', async ({ page, openRecorder, server }) => {
    const recorder = await openRecorder();
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

  test('should record slow navigation signal after mouse move', async ({ page, openRecorder, server }) => {
    const recorder = await openRecorder();
    await recorder.setContentAndWait(`
    <script>
      async function onClick() {
        await new Promise(f => setTimeout(f, 100));
        await window.letTheMouseMove();
        window.location = ${JSON.stringify(server.EMPTY_PAGE)};
      }
    </script>
    <button onclick="onClick()">Click me</button>
    `);
    await page.exposeBinding('letTheMouseMove', async () => {
      await page.mouse.move(200, 200);
    });

    const [, sources] = await Promise.all([
      // This will click, finish the click, then mouse move, then navigate.
      page.click('button'),
      recorder.waitForOutput('JavaScript', 'waitForNavigation'),
    ]);

    expect(sources.get('JavaScript').text).toContain(`page.waitForNavigation(/*{ url: '${server.EMPTY_PAGE}' }*/)`);
  });
});
