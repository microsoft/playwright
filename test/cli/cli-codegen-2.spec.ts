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
import * as url from 'url';

const { it, describe, expect } = folio;

describe('cli codegen', (suite, { mode, browserName, headful }) => {
  // suite.fixme(browserName === 'firefox' && headful, 'Focus is off');
  suite.skip(mode !== 'default');
}, () => {
  it('should contain open page', async ({ recorder }) => {
    await recorder.setContentAndWait(``);
    await recorder.waitForOutput(`const page = await context.newPage();`);
  });

  it('should contain second page', async ({ context, recorder }) => {
    await recorder.setContentAndWait(``);
    await context.newPage();
    await recorder.waitForOutput('page1');
    expect(recorder.output()).toContain('const page1 = await context.newPage();');
  });

  it('should contain close page', async ({ context, recorder }) => {
    await recorder.setContentAndWait(``);
    await context.newPage();
    await recorder.page.close();
    await recorder.waitForOutput('page.close();');
  });

  it('should not lead to an error if html gets clicked', async ({ context, recorder }) => {
    await recorder.setContentAndWait('');
    await context.newPage();
    const errors: any[] = [];
    recorder.page.on('pageerror', e => errors.push(e));
    await recorder.page.evaluate(() => document.querySelector('body').remove());
    const selector = await recorder.hoverOverElement('html');
    expect(selector).toBe('html');
    await recorder.page.close();
    await recorder.waitForOutput('page.close();');
    expect(errors.length).toBe(0);
  });

  it('should upload a single file', (test, { browserName }) => {
    test.fixme(browserName === 'firefox', 'Hangs');
  }, async ({ page, recorder }) => {
    await recorder.setContentAndWait(`
    <form>
      <input type="file">
    </form>
  `);

    await page.focus('input[type=file]');
    await page.setInputFiles('input[type=file]', 'test/assets/file-to-upload.txt');
    await page.click('input[type=file]');

    await recorder.waitForOutput(`
  // Upload file-to-upload.txt
  await page.setInputFiles('input[type="file"]', 'file-to-upload.txt');`);
  });

  it('should upload multiple files', (test, { browserName }) => {
    test.fixme(browserName === 'firefox', 'Hangs');
  }, async ({ page, recorder }) => {
    await recorder.setContentAndWait(`
    <form>
      <input type="file" multiple>
    </form>
  `);

    await page.focus('input[type=file]');
    await page.setInputFiles('input[type=file]', ['test/assets/file-to-upload.txt', 'test/assets/file-to-upload-2.txt']);
    await page.click('input[type=file]');

    await recorder.waitForOutput(`
  // Upload file-to-upload.txt, file-to-upload-2.txt
  await page.setInputFiles('input[type="file"]', ['file-to-upload.txt', 'file-to-upload-2.txt']);`);
  });

  it('should clear files', (test, { browserName }) => {
    test.fixme(browserName === 'firefox', 'Hangs');
  }, async ({ page, recorder }) => {
    await recorder.setContentAndWait(`
    <form>
      <input type="file" multiple>
    </form>
  `);
    await page.focus('input[type=file]');
    await page.setInputFiles('input[type=file]', 'test/assets/file-to-upload.txt');
    await page.setInputFiles('input[type=file]', []);
    await page.click('input[type=file]');

    await recorder.waitForOutput(`
  // Clear selected files
  await page.setInputFiles('input[type="file"]', []);`);
  });

  it('should download files', (test, {browserName, headful}) => {
    test.fixme(browserName === 'webkit' || browserName === 'firefox', 'Generated page.waitForNavigation next to page.waitForEvent(download)');
  }, async ({ page, recorder, httpServer }) => {
    httpServer.setHandler((req: http.IncomingMessage, res: http.ServerResponse) => {
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
      <a href="${httpServer.PREFIX}/download" download>Download</a>
    `, httpServer.PREFIX);
    await recorder.hoverOverElement('text=Download');
    await Promise.all([
      page.waitForEvent('download'),
      page.click('text=Download')
    ]);
    await recorder.waitForOutput(`
  // Click text=Download
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('text=Download')
  ]);`);
  });

  it('should handle dialogs', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`
    <button onclick="alert()">click me</button>
    `);
    await recorder.hoverOverElement('button');
    page.once('dialog', async dialog => {
      await dialog.dismiss();
    });
    await page.click('text=click me');
    await recorder.waitForOutput(`
  // Click text=click me
  page.once('dialog', dialog => {
    console.log(\`Dialog message: $\{dialog.message()}\`);
    dialog.dismiss().catch(() => {});
  });
  await page.click('text=click me')`);
  });

  it('should handle history.postData', async ({ page, recorder, httpServer }) => {
    httpServer.setHandler((req: http.IncomingMessage, res: http.ServerResponse) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('Hello world');
    });
    await recorder.setContentAndWait(`
    <script>
    let seqNum = 0;
    function pushState() {
      history.pushState({}, 'title', '${httpServer.PREFIX}/#seqNum=' + (++seqNum));
    }
    </script>`, httpServer.PREFIX);
    for (let i = 1; i < 3; ++i) {
      await page.evaluate('pushState()');
      await recorder.waitForOutput(`await page.goto('${httpServer.PREFIX}/#seqNum=${i}');`);
    }
  });

  it('should record open in a new tab with url', (test, { browserName }) => {
    test.fixme(browserName === 'webkit', 'Ctrl+click does not open in new tab on WebKit');
  }, async ({ page, recorder, browserName, platform }) => {
    await recorder.setContentAndWait(`<a href="about:blank?foo">link</a>`);

    const selector = await recorder.hoverOverElement('a');
    expect(selector).toBe('text=link');

    await page.click('a', { modifiers: [ platform === 'darwin' ? 'Meta' : 'Control'] });
    await recorder.waitForOutput('page1');
    if (browserName === 'chromium') {
      expect(recorder.output()).toContain(`
  // Open new page
  const page1 = await context.newPage();
  page1.goto('about:blank?foo');`);
    } else if (browserName === 'firefox') {
      expect(recorder.output()).toContain(`
  // Click text=link
  const [page1] = await Promise.all([
    page.waitForEvent('popup'),
    page.click('text=link', {
      modifiers: ['${platform === 'darwin' ? 'Meta' : 'Control'}']
    })
  ]);`);
    }
  });

  it('should not clash pages', (test, { browserName }) => {
    test.fixme(browserName === 'firefox', 'Times out on Firefox, maybe the focus issue');
  }, async ({ page, recorder }) => {
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
    await recorder.waitForOutput('TextA');

    await popup2.type('input', 'TextB');
    await recorder.waitForOutput('TextB');

    expect(recorder.output()).toContain(`await page1.fill('input', 'TextA');`);
    expect(recorder.output()).toContain(`await page2.fill('input', 'TextB');`);
  });

  it('click should emit events in order', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`
      <button id=button>
      <script>
      button.addEventListener('mousedown', e => console.log(e.type));
      button.addEventListener('mouseup', e => console.log(e.type));
      button.addEventListener('click', e => console.log(e.type));
      </script>
    `);

    const messages: any[] = [];
    page.on('console', message => messages.push(message.text()));
    await Promise.all([
      page.click('button'),
      recorder.waitForOutput('page.click')
    ]);
    expect(messages).toEqual(['mousedown', 'mouseup', 'click']);
  });

  it('should update hover model on action', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" name="accept" onchange="checkbox.name='updated'"></input>`);
    const [ models ] = await Promise.all([
      recorder.waitForActionPerformed(),
      page.click('input')
    ]);
    expect(models.hovered).toBe('input[name="updated"]');
  });

  it('should update active model on action', (test, { browserName, headful }) => {
    test.fixme(browserName === 'webkit' && !headful);
    test.fixme(browserName === 'firefox' && !headful);
  }, async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" name="accept" onchange="checkbox.name='updated'"></input>`);
    const [ models ] = await Promise.all([
      recorder.waitForActionPerformed(),
      page.click('input')
    ]);
    expect(models.active).toBe('input[name="updated"]');
  });

  it('should check input with chaning id', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" name="accept" onchange="checkbox.name = 'updated'"></input>`);
    await Promise.all([
      recorder.waitForActionPerformed(),
      page.click('input[id=checkbox]')
    ]);
  });

  it('should prefer frame name', async ({ page, recorder, server }) => {
    await recorder.setContentAndWait(`
      <iframe src='./frames/frame.html' name='one'></iframe>
      <iframe src='./frames/frame.html' name='two'></iframe>
      <iframe src='./frames/frame.html'></iframe>
    `, server.EMPTY_PAGE, 4);
    const frameOne = page.frame({ name: 'one' });
    const frameTwo = page.frame({ name: 'two' });
    const otherFrame = page.frames().find(f => f !== page.mainFrame() && !f.name());

    await Promise.all([
      recorder.waitForOutput('one'),
      frameOne.click('div'),
    ]);
    expect(recorder.output()).toContain(`
  // Click text=Hi, I'm frame
  await page.frame({
    name: 'one'
  }).click('text=Hi, I\\'m frame');`);

    await Promise.all([
      recorder.waitForOutput('two'),
      frameTwo.click('div'),
    ]);
    expect(recorder.output()).toContain(`
  // Click text=Hi, I'm frame
  await page.frame({
    name: 'two'
  }).click('text=Hi, I\\'m frame');`);

    await Promise.all([
      recorder.waitForOutput('url: \''),
      otherFrame.click('div'),
    ]);
    expect(recorder.output()).toContain(`
  // Click text=Hi, I'm frame
  await page.frame({
    url: '${otherFrame.url()}'
  }).click('text=Hi, I\\'m frame');`);
  });

  it('should record navigations after identical pushState', async ({ page, recorder, httpServer }) => {
    httpServer.setHandler((req: http.IncomingMessage, res: http.ServerResponse) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('Hello world');
    });
    await recorder.setContentAndWait(`
    <script>
    function pushState() {
      history.pushState({}, 'title', '${httpServer.PREFIX}');
    }
    </script>`, httpServer.PREFIX);
    for (let i = 1; i < 3; ++i)
      await page.evaluate('pushState()');

    await page.goto(httpServer.PREFIX + '/page2.html');
    await recorder.waitForOutput(`await page.goto('${httpServer.PREFIX}/page2.html');`);
  });
});
