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

describe('cli codegen', (test, { browserName, headful }) => {
  test.fixme(browserName === 'firefox' && headful, 'Focus is off');
}, () => {
  it('should click', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<button onclick="console.log('click')">Submit</button>`);

    const selector = await recorder.hoverOverElement('button');
    expect(selector).toBe('text="Submit"');

    const [message] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('click'),
      page.dispatchEvent('button', 'click', { detail: 1 })
    ]);
    expect(recorder.output()).toContain(`
  // Click text="Submit"
  await page.click('text="Submit"');`);
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
    expect(selector).toBe('text="Submit"');

    const [message] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('click'),
      page.dispatchEvent('button', 'click', { detail: 1 })
    ]);
    expect(recorder.output()).toContain(`
  // Click text="Submit"
  await page.click('text="Submit"');`);
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
    expect(selector).toBe('text=/.*Some long text here.*/');

    // Sanity check that selector does not match our highlight.
    const divContents = await page.$eval(selector, div => div.outerHTML);
    expect(divContents).toBe(`<div onclick="console.log('click')"> Some long text here </div>`);

    const [message] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('click'),
      page.dispatchEvent('div', 'click', { detail: 1 })
    ]);
    expect(recorder.output()).toContain(`
  // Click text=/.*Some long text here.*/
  await page.click('text=/.*Some long text here.*/');`);
    expect(message.text()).toBe('click');
  });

  it('should fill', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<input id="input" name="name" oninput="console.log(input.value)"></input>`);
    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="name"]');

    const [message] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('fill'),
      page.fill('input', 'John')
    ]);
    expect(recorder.output()).toContain(`
  // Fill input[name="name"]
  await page.fill('input[name="name"]', 'John');`);
    expect(message.text()).toBe('John');
  });

  it('should fill textarea', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<textarea id="textarea" name="name" oninput="console.log(textarea.value)"></textarea>`);
    const selector = await recorder.focusElement('textarea');
    expect(selector).toBe('textarea[name="name"]');

    const [message] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('fill'),
      page.fill('textarea', 'John')
    ]);
    expect(recorder.output()).toContain(`
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
    await Promise.all([
      recorder.waitForActionPerformed(),
      recorder.waitForOutput('press'),
      page.press('input', 'Shift+Enter')
    ]);
    expect(recorder.output()).toContain(`
  // Press Enter with modifiers
  await page.press('input[name="name"]', 'Shift+Enter');`);
    expect(messages[0].text()).toBe('press');
  });

  it('should update selected element after pressing Tab', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`
      <input name="one"></input>
      <input name="two"></input>
    `);

    await page.click('input[name="one"]');
    await recorder.waitForOutput('click');
    await page.keyboard.type('foobar123');
    await recorder.waitForOutput('foobar123');

    await page.keyboard.press('Tab');
    await recorder.waitForOutput('Tab');
    await page.keyboard.type('barfoo321');
    await recorder.waitForOutput('barfoo321');

    expect(recorder.output()).toContain(`
  // Fill input[name="one"]
  await page.fill('input[name="one"]', 'foobar123');`);

    expect(recorder.output()).toContain(`
  // Press Tab
  await page.press('input[name="one"]', 'Tab');`);

    expect(recorder.output()).toContain(`
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
    await Promise.all([
      recorder.waitForActionPerformed(),
      recorder.waitForOutput('press'),
      page.press('input', 'ArrowDown')
    ]);
    expect(recorder.output()).toContain(`
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
    await Promise.all([
      recorder.waitForActionPerformed(),
      recorder.waitForOutput('press'),
      page.press('input', 'ArrowDown')
    ]);
    expect(recorder.output()).toContain(`
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

    const [message] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('check'),
      page.click('input')
    ]);
    await recorder.waitForOutput('check');
    expect(recorder.output()).toContain(`
  // Check input[name="accept"]
  await page.check('input[name="accept"]');`);
    expect(message.text()).toBe('true');
  });

  it('should check with keyboard', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" name="accept" onchange="console.log(checkbox.checked)"></input>`);

    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="accept"]');

    const [message] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('check'),
      page.keyboard.press('Space')
    ]);
    await recorder.waitForOutput('check');
    expect(recorder.output()).toContain(`
  // Check input[name="accept"]
  await page.check('input[name="accept"]');`);
    expect(message.text()).toBe('true');
  });

  it('should uncheck', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<input id="checkbox" type="checkbox" checked name="accept" onchange="console.log(checkbox.checked)"></input>`);

    const selector = await recorder.focusElement('input');
    expect(selector).toBe('input[name="accept"]');

    const [message] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('uncheck'),
      page.click('input')
    ]);
    expect(recorder.output()).toContain(`
  // Uncheck input[name="accept"]
  await page.uncheck('input[name="accept"]');`);
    expect(message.text()).toBe('false');
  });

  it('should select', async ({ page, recorder }) => {
    await recorder.setContentAndWait('<select id="age" onchange="console.log(age.selectedOptions[0].value)"><option value="1"><option value="2"></select>');

    const selector = await recorder.hoverOverElement('select');
    expect(selector).toBe('select[id="age"]');

    const [message] = await Promise.all([
      page.waitForEvent('console'),
      recorder.waitForOutput('select'),
      page.selectOption('select', '2')
    ]);
    expect(recorder.output()).toContain(`
  // Select 2
  await page.selectOption('select[id="age"]', '2');`);
    expect(message.text()).toBe('2');
  });

  it('should await popup', (test, { browserName, headful }) => {
    test.fixme(browserName === 'webkit' && headful, 'Middle click does not open a popup in our webkit embedder');
  }, async ({ page, recorder }) => {
    await recorder.setContentAndWait('<a target=_blank rel=noopener href="about:blank">link</a>');

    const selector = await recorder.hoverOverElement('a');
    expect(selector).toBe('text="link"');

    const [popup] = await Promise.all([
      page.context().waitForEvent('page'),
      recorder.waitForOutput('waitForEvent'),
      page.dispatchEvent('a', 'click', { detail: 1 })
    ]);
    expect(recorder.output()).toContain(`
  // Click text="link"
  const [page1] = await Promise.all([
    page.waitForEvent('popup'),
    page.click('text="link"')
  ]);`);
    expect(popup.url()).toBe('about:blank');
  });

  it('should assert navigation', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<a onclick="window.location.href='about:blank#foo'">link</a>`);

    const selector = await recorder.hoverOverElement('a');
    expect(selector).toBe('text="link"');

    await Promise.all([
      page.waitForNavigation(),
      recorder.waitForOutput('assert'),
      page.dispatchEvent('a', 'click', { detail: 1 })
    ]);
    expect(recorder.output()).toContain(`
  // Click text="link"
  await page.click('text="link"');
  // assert.equal(page.url(), 'about:blank#foo');`);
    expect(page.url()).toContain('about:blank#foo');
  });


  it('should await navigation', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`<a onclick="setTimeout(() => window.location.href='about:blank#foo', 1000)">link</a>`);

    const selector = await recorder.hoverOverElement('a');
    expect(selector).toBe('text="link"');

    await Promise.all([
      page.waitForNavigation(),
      recorder.waitForOutput('waitForNavigation'),
      page.dispatchEvent('a', 'click', { detail: 1 })
    ]);
    expect(recorder.output()).toContain(`
  // Click text="link"
  await Promise.all([
    page.waitForNavigation(/*{ url: 'about:blank#foo' }*/),
    page.click('text="link"')
  ]);`);
    expect(page.url()).toContain('about:blank#foo');
  });

  it('should contain open page', async ({ recorder }) => {
    await recorder.setContentAndWait(``);
    expect(recorder.output()).toContain(`const page = await context.newPage();`);
  });

  it('should contain second page', async ({ contextWrapper, recorder }) => {
    await recorder.setContentAndWait(``);
    await contextWrapper.context.newPage();
    await recorder.waitForOutput('page1');
    expect(recorder.output()).toContain('const page1 = await context.newPage();');
  });

  it('should contain close page', async ({ contextWrapper, recorder }) => {
    await recorder.setContentAndWait(``);
    await contextWrapper.context.newPage();
    await recorder.page.close();
    await recorder.waitForOutput('page.close();');
  });

  it('should not lead to an error if /html gets clicked', async ({ contextWrapper, recorder }) => {
    await recorder.setContentAndWait('');
    await contextWrapper.context.newPage();
    const errors: any[] = [];
    recorder.page.on('pageerror', e => errors.push(e));
    await recorder.page.evaluate(() => document.querySelector('body').remove());
    const selector = await recorder.hoverOverElement('html');
    expect(selector).toBe('/html');
    await recorder.page.close();
    await recorder.waitForOutput('page.close();');
    expect(errors.length).toBe(0);
  });

  it('should upload a single file', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`
    <form>
      <input type="file">
    </form>
  `);

    await page.focus('input[type=file]');
    await page.setInputFiles('input[type=file]', 'test/assets/file-to-upload.txt');
    await page.click('input[type=file]');

    await recorder.waitForOutput('setInputFiles');
    expect(recorder.output()).toContain(`
  // Upload file-to-upload.txt
  await page.setInputFiles('input[type="file"]', 'file-to-upload.txt');`);
  });

  it('should upload multiple files', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`
    <form>
      <input type="file" multiple>
    </form>
  `);

    await page.focus('input[type=file]');
    await page.setInputFiles('input[type=file]', ['test/assets/file-to-upload.txt', 'test/assets/file-to-upload-2.txt']);
    await page.click('input[type=file]');

    await recorder.waitForOutput('setInputFiles');
    expect(recorder.output()).toContain(`
  // Upload file-to-upload.txt, file-to-upload-2.txt
  await page.setInputFiles('input[type="file"]', ['file-to-upload.txt', 'file-to-upload-2.txt']);`);
  });

  it('should clear files', async ({ page, recorder }) => {
    await recorder.setContentAndWait(`
    <form>
      <input type="file" multiple>
    </form>
  `);
    await page.focus('input[type=file]');
    await page.setInputFiles('input[type=file]', 'test/assets/file-to-upload.txt');
    await page.setInputFiles('input[type=file]', []);
    await page.click('input[type=file]');

    await recorder.waitForOutput('setInputFiles');
    expect(recorder.output()).toContain(`
  // Clear selected files
  await page.setInputFiles('input[type="file"]', []);`);
  });

  it('should download files', async ({ page, recorder, httpServer }) => {
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
    await recorder.waitForOutput('page.click');
    expect(recorder.output()).toContain(`
  // Click text="Download"
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('text="Download"')
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
    await page.click('text="click me"');
    await recorder.waitForOutput('page.once');
    expect(recorder.output()).toContain(`
  // Click text="click me"
  page.once('dialog', dialog => {
    console.log(\`Dialog message: $\{dialog.message()}\`);
    dialog.dismiss().catch(() => {});
  });
  await page.click('text="click me"')`);
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
      await recorder.waitForOutput(`seqNum=${i}`);
      expect(recorder.output()).toContain(`await page.goto('${httpServer.PREFIX}/#seqNum=${i}');`);
    }
  });

  it('should record open in a new tab with url', (test, { browserName }) => {
    test.fixme(browserName === 'webkit', 'Ctrl+click does not open in new tab on WebKit');
  }, async ({ page, recorder, browserName, platform }) => {
    await recorder.setContentAndWait(`<a href="about:blank?foo">link</a>`);

    const selector = await recorder.hoverOverElement('a');
    expect(selector).toBe('text="link"');

    await page.click('a', { modifiers: [ platform === 'darwin' ? 'Meta' : 'Control'] });
    await recorder.waitForOutput('page1');
    if (browserName === 'chromium') {
      expect(recorder.output()).toContain(`
  // Open new page
  const page1 = await context.newPage();
  page1.goto('about:blank?foo');`);
    } else if (browserName === 'firefox') {
      expect(recorder.output()).toContain(`
  // Click text="link"
  const [page1] = await Promise.all([
    page.waitForEvent('popup'),
    page.click('text="link"', {
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

    expect(recorder.output()).toContain(`await page1.fill('input[id="name"]', 'TextA');`);
    expect(recorder.output()).toContain(`await page2.fill('input[id="name"]', 'TextB');`);
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
});
