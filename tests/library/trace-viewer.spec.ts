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

import type { TraceViewerFixtures } from '../config/traceViewerFixtures';
import { traceViewerFixtures } from '../config/traceViewerFixtures';
import fs from 'fs';
import path from 'path';
import { expect, playwrightTest } from '../config/browserTest';

const test = playwrightTest.extend<TraceViewerFixtures>(traceViewerFixtures);

test.skip(({ trace }) => trace === 'on');
test.slow();

let traceFile: string;

test.beforeAll(async function recordTrace({ browser, browserName, browserType, server }, workerInfo) {
  const context = await browser.newContext();
  await context.tracing.start({ name: 'test', screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  await page.goto('data:text/html,<html>Hello world</html>');
  await page.setContent('<button>Click</button>');
  await expect(page.locator('button')).toHaveText('Click');
  await page.evaluate(({ a }) => {
    console.log('Info');
    console.warn('Warning');
    console.error('Error');
    return new Promise(f => {
      // Generate exception.
      setTimeout(() => {
        // And then resolve.
        setTimeout(() => f('return ' + a), 0);
        throw new Error('Unhandled exception');
      }, 0);
    });
  }, { a: 'paramA', b: 4 });

  await page.evaluate(() => 1 + 1, null);

  async function doClick() {
    await page.getByText('Click').click();
  }
  await doClick();

  await Promise.all([
    page.waitForNavigation(),
    page.waitForResponse(server.PREFIX + '/frames/frame.html'),
    page.waitForTimeout(200).then(() => page.goto(server.PREFIX + '/frames/frame.html'))
  ]);
  await page.setViewportSize({ width: 500, height: 600 });

  // Go through instrumentation to exercise reentrant stack traces.
  (browserType as any)._onWillCloseContext = async () => {
    await page.hover('body');
    await page.close();
    traceFile = path.join(workerInfo.project.outputDir, String(workerInfo.workerIndex), browserName, 'trace.zip');
    await context.tracing.stop({ path: traceFile });
  };
  await context.close();
  (browserType as any)._onWillCloseContext = undefined;
});

test('should show empty trace viewer', async ({ showTraceViewer }, testInfo) => {
  const traceViewer = await showTraceViewer([testInfo.outputPath()]);
  await expect(traceViewer.page).toHaveTitle('Playwright Trace Viewer');
});

test('should open two trace viewers', async ({ showTraceViewer }, testInfo) => {
  const port = testInfo.workerIndex + 48321;
  const traceViewer1 = await showTraceViewer([testInfo.outputPath()], { host: 'localhost', port });
  await expect(traceViewer1.page).toHaveTitle('Playwright Trace Viewer');
  const traceViewer2 = await showTraceViewer([testInfo.outputPath()], { host: 'localhost', port });
  await expect(traceViewer2.page).toHaveTitle('Playwright Trace Viewer');
});

test('should open trace viewer on specific host', async ({ showTraceViewer }, testInfo) => {
  const traceViewer = await showTraceViewer([testInfo.outputPath()], { host: '127.0.0.1' });
  await expect(traceViewer.page).toHaveTitle('Playwright Trace Viewer');
  await expect(traceViewer.page).toHaveURL(/127.0.0.1/);
});

test('should open simple trace viewer', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await expect(traceViewer.actionTitles).toHaveText([
    /browserContext.newPage/,
    /page.gotodata:text\/html,<html>Hello world<\/html>/,
    /page.setContent/,
    /expect.toHaveTextlocator\('button'\)/,
    /page.evaluate/,
    /page.evaluate/,
    /locator.clickgetByText\('Click'\)/,
    /page.waitForNavigation/,
    /page.waitForResponse/,
    /page.waitForTimeout/,
    /page.gotohttp:\/\/localhost:\d+\/frames\/frame.html/,
    /page.setViewportSize/,
  ]);
});

test('should contain action info', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await traceViewer.selectAction('locator.click');
  const logLines = await traceViewer.callLines.allTextContents();
  expect(logLines.length).toBeGreaterThan(10);
  expect(logLines).toContain('attempting click action');
  expect(logLines).toContain('  click action done');
});

test('should render events', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  const events = await traceViewer.eventBars();
  expect(events).toContain('page_console');
});

test('should render console', async ({ showTraceViewer, browserName }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await traceViewer.selectAction('page.evaluate');
  await traceViewer.showConsoleTab();

  await expect(traceViewer.consoleLineMessages).toHaveText(['Info', 'Warning', 'Error', 'Unhandled exception']);
  await expect(traceViewer.consoleLines).toHaveClass(['console-line log', 'console-line warning', 'console-line error', 'console-line error']);
  await expect(traceViewer.consoleStacks.first()).toContainText('Error: Unhandled exception');
});

test('should open console errors on click', async ({ showTraceViewer, browserName }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  expect(await traceViewer.actionIconsText('page.evaluate')).toEqual(['2', '1']);
  expect(await traceViewer.page.isHidden('.console-tab')).toBeTruthy();
  await (await traceViewer.actionIcons('page.evaluate')).click();
  expect(await traceViewer.page.waitForSelector('.console-tab')).toBeTruthy();
});

test('should show params and return value', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await traceViewer.selectAction('page.evaluate');
  await expect(traceViewer.callLines).toHaveText([
    /page.evaluate/,
    /wall time:[0-9/:,APM ]+/,
    /duration:[\d]+ms/,
    /expression:"\({↵    a↵  }\) => {↵    console\.log\(\'Info\'\);↵    console\.warn\(\'Warning\'\);↵    console/,
    'isFunction:true',
    'arg:{"a":"paramA","b":4}',
    'value:"return paramA"'
  ]);

  await traceViewer.selectAction(`locator('button')`);
  await expect(traceViewer.callLines).toContainText([
    /expect.toHaveText/,
    /wall time:[0-9/:,APM ]+/,
    /duration:[\d]+ms/,
    /locator:locator\('button'\)/,
    /expression:"to.have.text"/,
    /timeout:10000/,
    /matches:true/,
    /received:"Click"/,
  ]);
});

test('should show null as a param', async ({ showTraceViewer, browserName }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await traceViewer.selectAction('page.evaluate', 1);
  await expect(traceViewer.callLines).toHaveText([
    /page.evaluate/,
    /wall time:[0-9/:,APM ]+/,
    /duration:[\d]+ms/,
    'expression:"() => 1 + 1"',
    'isFunction:true',
    'arg:null',
    'value:2'
  ]);
});

test('should have correct snapshot size', async ({ showTraceViewer }, testInfo) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await traceViewer.selectAction('page.setViewport');
  await traceViewer.selectSnapshot('Before');
  await expect(traceViewer.snapshotContainer).toHaveCSS('width', '1280px');
  await expect(traceViewer.snapshotContainer).toHaveCSS('height', '720px');
  await traceViewer.selectSnapshot('After');
  await expect(traceViewer.snapshotContainer).toHaveCSS('width', '500px');
  await expect(traceViewer.snapshotContainer).toHaveCSS('height', '600px');
});

test('should have correct stack trace', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer([traceFile]);

  await traceViewer.selectAction('locator.click');
  await traceViewer.showSourceTab();
  await expect(traceViewer.stackFrames).toContainText([
    /doClick\s+trace-viewer.spec.ts\s+:\d+/,
    /recordTrace\s+trace-viewer.spec.ts\s+:\d+/,
  ], { useInnerText: true });
});

test('should have network requests', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await traceViewer.selectAction('http://localhost');
  await traceViewer.showNetworkTab();
  await expect(traceViewer.networkRequests).toContainText(['200GETframe.htmltext/html']);
  await expect(traceViewer.networkRequests).toContainText(['200GETstyle.csstext/css']);
  await expect(traceViewer.networkRequests).toContainText(['200GETscript.jsapplication/javascript']);
});

test('should show snapshot URL', async ({ page, runAndTrace, server }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    await page.evaluate('2+2');
  });
  await traceViewer.snapshotFrame('page.evaluate');
  await expect(traceViewer.page.locator('.window-address-bar')).toHaveText(server.EMPTY_PAGE);
});

test('should popup snapshot', async ({ page, runAndTrace, server }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent('hello');
  });
  await traceViewer.snapshotFrame('page.setContent');
  const popupPromise = traceViewer.page.context().waitForEvent('page');
  await traceViewer.page.getByTitle('Open snapshot in a new tab').click();
  const popup = await popupPromise;
  await expect(popup.getByText('hello')).toBeVisible();
});

test('should capture iframe with sandbox attribute', async ({ page, server, runAndTrace }) => {
  await page.route('**/empty.html', route => {
    route.fulfill({
      body: '<iframe src="iframe.html" sandBOX="allow-scripts"></iframe>',
      contentType: 'text/html'
    }).catch(() => {});
  });
  await page.route('**/iframe.html', route => {
    route.fulfill({
      body: '<html><button>Hello iframe</button></html>',
      contentType: 'text/html'
    }).catch(() => {});
  });

  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    if (page.frames().length < 2)
      await page.waitForEvent('frameattached');
    await page.frames()[1].waitForSelector('button');
    // Force snapshot.
    await page.evaluate('2+2');
  });

  // Render snapshot, check expectations.
  const snapshotFrame = await traceViewer.snapshotFrame('page.evaluate', 0, true);
  const button = await snapshotFrame.childFrames()[0].waitForSelector('button');
  expect(await button.textContent()).toBe('Hello iframe');
});

test('should capture data-url svg iframe', async ({ page, server, runAndTrace }) => {
  await page.route('**/empty.html', route => {
    route.fulfill({
      body: `<iframe src="data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 0 24 24' width='24px' fill='%23000000'%3e%3cpath d='M0 0h24v24H0z' fill='none'/%3e%3cpath d='M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z'/%3e%3c/svg%3e"></iframe>`,
      contentType: 'text/html'
    }).catch(() => {});
  });

  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    if (page.frames().length < 2)
      await page.waitForEvent('frameattached');
    await page.frames()[1].waitForSelector('svg');
    // Force snapshot.
    await page.evaluate('2+2');
  });

  // Render snapshot, check expectations.
  const snapshotFrame = await traceViewer.snapshotFrame('page.evaluate', 0, true);
  await expect(snapshotFrame.childFrames()[0].locator('svg')).toBeVisible();
  const content = await snapshotFrame.childFrames()[0].content();
  expect(content).toContain(`d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"`);
});

test('should contain adopted style sheets', async ({ page, runAndTrace, browserName }) => {
  test.skip(browserName !== 'chromium', 'Constructed stylesheets are only in Chromium.');

  const traceViewer = await runAndTrace(async () => {
    await page.setContent('<button>Hello</button>');
    await page.evaluate(() => {
      const sheet = new CSSStyleSheet();
      sheet.addRule('button', 'color: red');
      (document as any).adoptedStyleSheets = [sheet];

      const sheet2 = new CSSStyleSheet();
      sheet2.addRule(':host', 'color: blue');

      for (const element of [document.createElement('div'), document.createElement('span')]) {
        const root = element.attachShadow({
          mode: 'open'
        });
        root.append('foo');
        (root as any).adoptedStyleSheets = [sheet2];
        document.body.appendChild(element);
      }
    });
  });

  const frame = await traceViewer.snapshotFrame('page.evaluate');
  await frame.waitForSelector('button');
  const buttonColor = await frame.$eval('button', button => {
    return window.getComputedStyle(button).color;
  });
  expect(buttonColor).toBe('rgb(255, 0, 0)');
  const divColor = await frame.$eval('div', div => {
    return window.getComputedStyle(div).color;
  });
  expect(divColor).toBe('rgb(0, 0, 255)');
  const spanColor = await frame.$eval('span', span => {
    return window.getComputedStyle(span).color;
  });
  expect(spanColor).toBe('rgb(0, 0, 255)');
});

test('should work with adopted style sheets and replace/replaceSync', async ({ page, runAndTrace, browserName }) => {
  test.skip(browserName !== 'chromium', 'Constructed stylesheets are only in Chromium.');

  const traceViewer = await runAndTrace(async () => {
    await page.setContent('<button>Hello</button>');
    await page.evaluate(() => {
      const sheet = new CSSStyleSheet();
      sheet.addRule('button', 'color: red');
      (document as any).adoptedStyleSheets = [sheet];
    });
    await page.evaluate(() => {
      const [sheet] = (document as any).adoptedStyleSheets;
      sheet.replaceSync(`button { color: blue }`);
    });
    await page.evaluate(() => {
      const [sheet] = (document as any).adoptedStyleSheets;
      sheet.replace(`button { color: #0F0 }`);
    });
  });

  {
    const frame = await traceViewer.snapshotFrame('page.evaluate', 0);
    await frame.waitForSelector('button');
    const buttonColor = await frame.$eval('button', button => {
      return window.getComputedStyle(button).color;
    });
    expect(buttonColor).toBe('rgb(255, 0, 0)');
  }
  {
    const frame = await traceViewer.snapshotFrame('page.evaluate', 1);
    await frame.waitForSelector('button');
    const buttonColor = await frame.$eval('button', button => {
      return window.getComputedStyle(button).color;
    });
    expect(buttonColor).toBe('rgb(0, 0, 255)');
  }
  {
    const frame = await traceViewer.snapshotFrame('page.evaluate', 2);
    await frame.waitForSelector('button');
    const buttonColor = await frame.$eval('button', button => {
      return window.getComputedStyle(button).color;
    });
    expect(buttonColor).toBe('rgb(0, 255, 0)');
  }
});

test('should restore scroll positions', async ({ page, runAndTrace, browserName }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.setContent(`
      <style>
        li { height: 20px; margin: 0; padding: 0; }
        div { height: 60px; overflow-x: hidden; overflow-y: scroll; background: green; padding: 0; margin: 0; }
      </style>
      <div>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
          <li>Item 4</li>
          <li>Item 5</li>
          <li>Item 6</li>
          <li>Item 7</li>
          <li>Item 8</li>
          <li>Item 9</li>
          <li>Item 10</li>
        </ul>
      </div>
    `);

    await (await page.$('text=Item 8')).scrollIntoViewIfNeeded();
  });

  // Render snapshot, check expectations.
  const frame = await traceViewer.snapshotFrame('scrollIntoViewIfNeeded');
  const div = await frame.waitForSelector('div');
  expect(await div.evaluate(div => div.scrollTop)).toBe(136);
});

test('should restore control values', async ({ page, runAndTrace }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.setContent(`
      <input type=text value=old>
      <input type=checkbox checked>
      <input type=radio>
      <textarea>old</textarea>
      <select multiple>
        <option value=opt1>Hi</option>
        <option value=opt2 selected>Bye</option>
        <option value=opt3>Hello</option>
      </select>
      <script>
        document.querySelector('[type=text]').value = 'hi';
        document.querySelector('[type=checkbox]').checked = false;
        document.querySelector('[type=radio]').checked = true;
        document.querySelector('textarea').value = 'hello';
        document.querySelector('[value=opt1]').selected = true;
        document.querySelector('[value=opt2]').selected = false;
        document.querySelector('[value=opt3]').selected = true;
      </script>
    `);
    await page.click('input');
  });

  // Render snapshot, check expectations.
  const frame = await traceViewer.snapshotFrame('page.click');

  const text = frame.locator('[type=text]');
  await expect(text).toHaveAttribute('value', 'old');
  await expect(text).toHaveValue('hi');

  const checkbox = frame.locator('[type=checkbox]');
  await expect(checkbox).not.toBeChecked();
  expect(await checkbox.evaluate(c => c.hasAttribute('checked'))).toBe(true);

  const radio = frame.locator('[type=radio]');
  await expect(radio).toBeChecked();
  expect(await radio.evaluate(c => c.hasAttribute('checked'))).toBe(false);

  const textarea = frame.locator('textarea');
  await expect(textarea).toHaveText('old');
  await expect(textarea).toHaveValue('hello');

  expect(await frame.$eval('option >> nth=0', o => o.hasAttribute('selected'))).toBe(false);
  expect(await frame.$eval('option >> nth=1', o => o.hasAttribute('selected'))).toBe(true);
  expect(await frame.$eval('option >> nth=2', o => o.hasAttribute('selected'))).toBe(false);
  expect(await frame.locator('select').evaluate(s => {
    const options = [...(s as HTMLSelectElement).selectedOptions];
    return options.map(option => option.value);
  })).toEqual(['opt1', 'opt3']);
});

test('should work with meta CSP', async ({ page, runAndTrace, browserName }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.setContent(`
      <head>
        <meta http-equiv="Content-Security-Policy" content="script-src 'none'">
      </head>
      <body>
        <div>Hello</div>
      </body>
    `);
    await page.$eval('div', div => {
      const shadow = div.attachShadow({ mode: 'open' });
      const span = document.createElement('span');
      span.textContent = 'World';
      shadow.appendChild(span);
    });
  });

  // Render snapshot, check expectations.
  const frame = await traceViewer.snapshotFrame('$eval');
  await frame.waitForSelector('div');
  // Should render shadow dom with post-processing script.
  expect(await frame.textContent('span')).toBe('World');
});

test('should handle multiple headers', async ({ page, server, runAndTrace, browserName }) => {
  server.setRoute('/foo.css', (req, res) => {
    res.statusCode = 200;
    res.setHeader('vary', ['accepts-encoding', 'accepts-encoding']);
    res.end('body { padding: 42px }');
  });

  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent(`<head><link rel=stylesheet href="/foo.css"></head><body><div>Hello</div></body>`);
  });

  const frame = await traceViewer.snapshotFrame('setContent');
  await frame.waitForSelector('div');
  const padding = await frame.$eval('body', body => window.getComputedStyle(body).paddingLeft);
  expect(padding).toBe('42px');
});

test('should handle src=blob', async ({ page, server, runAndTrace, browserName }) => {
  test.skip(browserName === 'firefox');

  const traceViewer = await runAndTrace(async () => {
    await page.setViewportSize({ width: 300, height: 300 });
    await page.goto(server.EMPTY_PAGE);
    await page.evaluate(async () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAASCAQAAADIvofAAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAAmJLR0QA/4ePzL8AAAAHdElNRQfhBhAPKSstM+EuAAAAvUlEQVQY05WQIW4CYRgF599gEZgeoAKBWIfCNSmVvQMe3wv0ChhIViKwtTQEAYJwhgpISBA0JSxNIdlB7LIGTJ/8kpeZ7wW5TcT9o/QNBtvOrrWMrtg0sSGOFeELbHlCDsQ+ukeYiHNFJPHBDRKlQKVEbFkLUT3AiAxI6VGCXsWXAoQLBUl5E7HjUFwiyI4zf/wWoB3CFnxX5IeGdY8IGU/iwE9jcZrLy4pnEat+FL4hf/cbqREKo/Cf6W5zASVMeh234UtGAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDE3LTA2LTE2VDE1OjQxOjQzLTA3OjAwd1xNIQAAACV0RVh0ZGF0ZTptb2RpZnkAMjAxNy0wNi0xNlQxNTo0MTo0My0wNzowMAYB9Z0AAAAASUVORK5CYII=';
      const blob = await fetch(dataUrl).then(res => res.blob());
      const url = window.URL.createObjectURL(blob);
      const img = document.createElement('img');
      img.src = url;
      const loaded = new Promise(f => img.onload = f);
      document.body.appendChild(img);
      await loaded;
    });
  });

  const frame = await traceViewer.snapshotFrame('page.evaluate');
  const img = await frame.waitForSelector('img');
  const size = await img.evaluate(e => (e as HTMLImageElement).naturalWidth);
  expect(size).toBe(10);
});

test('should register custom elements', async ({ page, server, runAndTrace }) => {
  const traceViewer = await runAndTrace(async () => {
    page.on('console', console.log);
    await page.goto(server.EMPTY_PAGE);
    await page.evaluate(() => {
      customElements.define('my-element', class extends HTMLElement {
        constructor() {
          super();
          const shadow = this.attachShadow({ mode: 'open' });
          const span = document.createElement('span');
          span.textContent = 'hello';
          shadow.appendChild(span);
          shadow.appendChild(document.createElement('slot'));
        }
      });
    });
    await page.setContent(`
      <style>
        :not(:defined) {
          visibility: hidden;
        }
      </style>
      <MY-element>world</MY-element>
    `);
  });

  const frame = await traceViewer.snapshotFrame('page.setContent');
  await expect(frame.getByText('worldhello')).toBeVisible();
});

test('should highlight target elements', async ({ page, runAndTrace, browserName }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.setContent(`
      <div>hello</div>
      <div>world</div>
    `);
    await page.click('text=hello');
    await page.innerText('text=hello');
    const handle = await page.$('text=hello');
    await handle.click();
    await handle.innerText();
    await page.locator('text=hello').innerText();
    await expect(page.locator('text=hello')).toHaveText(/hello/i);
    await expect(page.locator('div')).toHaveText(['a', 'b'], { timeout: 1000 }).catch(() => {});
  });

  const framePageClick = await traceViewer.snapshotFrame('page.click');
  await expect(framePageClick.locator('[__playwright_target__]')).toHaveText(['hello']);

  const framePageInnerText = await traceViewer.snapshotFrame('page.innerText');
  await expect(framePageInnerText.locator('[__playwright_target__]')).toHaveText(['hello']);

  const frameHandleClick = await traceViewer.snapshotFrame('elementHandle.click');
  await expect(frameHandleClick.locator('[__playwright_target__]')).toHaveText(['hello']);

  const frameHandleInnerText = await traceViewer.snapshotFrame('elementHandle.innerText');
  await expect(frameHandleInnerText.locator('[__playwright_target__]')).toHaveText(['hello']);

  const frameLocatorInnerText = await traceViewer.snapshotFrame('locator.innerText');
  await expect(frameLocatorInnerText.locator('[__playwright_target__]')).toHaveText(['hello']);

  const frameExpect1 = await traceViewer.snapshotFrame('expect.toHaveText', 0);
  await expect(frameExpect1.locator('[__playwright_target__]')).toHaveText(['hello']);

  const frameExpect2 = await traceViewer.snapshotFrame('expect.toHaveText', 1);
  await expect(frameExpect2.locator('[__playwright_target__]')).toHaveText(['hello', 'world']);
});

test('should show action source', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await traceViewer.selectAction('locator.click');
  const page = traceViewer.page;

  await page.click('text=Source');
  await expect(page.locator('.source-line-running')).toContainText('await page.getByText(\'Click\').click()');
  await expect(page.getByTestId('stack-trace').locator('.list-view-entry.selected')).toHaveText(/doClick.*trace-viewer\.spec\.ts:[\d]+/);
});

test('should follow redirects', async ({ page, runAndTrace, server, asset }) => {
  server.setRoute('/empty.html', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<div><img id=img src="image.png"></img></div>`);
  });
  server.setRoute('/image.png', (req, res) => {
    res.writeHead(301, { location: '/image-301.png' });
    res.end();
  });
  server.setRoute('/image-301.png', (req, res) => {
    res.writeHead(302, { location: '/image-302.png' });
    res.end();
  });
  server.setRoute('/image-302.png', (req, res) => {
    res.writeHead(200, { 'content-type': 'image/png' });
    res.end(fs.readFileSync(asset('digits/0.png')));
  });

  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    expect(await page.evaluate(() => (window as any).img.naturalWidth)).toBe(10);
  });
  const snapshotFrame = await traceViewer.snapshotFrame('page.evaluate');
  await expect(snapshotFrame.locator('img')).toHaveJSProperty('naturalWidth', 10);
});

test('should include metainfo', async ({ showTraceViewer, browserName }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await traceViewer.page.locator('text=Metadata').click();
  const callLine = traceViewer.page.locator('.call-line');
  await expect(callLine.getByText('start time')).toHaveText(/start time:[\d/,: ]+/);
  await expect(callLine.getByText('duration')).toHaveText(/duration:[\dms]+/);
  await expect(callLine.getByText('engine')).toHaveText(/engine:[\w]+/);
  await expect(callLine.getByText('platform')).toHaveText(/platform:[\w]+/);
  await expect(callLine.getByText('width')).toHaveText(/width:[\d]+/);
  await expect(callLine.getByText('height')).toHaveText(/height:[\d]+/);
  await expect(callLine.getByText('pages')).toHaveText(/pages:1/);
  await expect(callLine.getByText('actions')).toHaveText(/actions:[\d]+/);
  await expect(callLine.getByText('events')).toHaveText(/events:[\d]+/);
});

test('should open two trace files', async ({ context, page, request, server, showTraceViewer }, testInfo) => {
  await (request as any)._tracing.start({ snapshots: true });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  {
    const response = await request.get(server.PREFIX + '/simple.json');
    await expect(response).toBeOK();
  }
  await page.goto(server.PREFIX + '/input/button.html');
  {
    const response = await request.head(server.PREFIX + '/simplezip.json');
    await expect(response).toBeOK();
  }
  await page.locator('button').click();
  await page.locator('button').click();
  {
    const response = await request.post(server.PREFIX + '/one-style.css');
    expect(response).toBeOK();
  }
  const apiTrace = testInfo.outputPath('api.zip');
  const contextTrace = testInfo.outputPath('context.zip');
  await (request as any)._tracing.stop({ path: apiTrace });
  await context.tracing.stop({ path: contextTrace });


  const traceViewer = await showTraceViewer([contextTrace, apiTrace]);
  await traceViewer.selectAction('apiRequestContext.head');
  await traceViewer.selectAction('apiRequestContext.get');
  await traceViewer.selectAction('apiRequestContext.post');
  await expect(traceViewer.actionTitles).toHaveText([
    `apiRequestContext.get`,
    `page.gotohttp://localhost:${server.PORT}/input/button.html`,
    `apiRequestContext.head`,
    `locator.clicklocator('button')`,
    `locator.clicklocator('button')`,
    `apiRequestContext.post`,
  ]);

  await traceViewer.page.locator('text=Metadata').click();
  const callLine = traceViewer.page.locator('.call-line');
  // Should get metadata from the context trace
  await expect(callLine.getByText('start time')).toHaveText(/start time:[\d/,: ]+/);
  // duration in the metatadata section
  await expect(callLine.getByText('duration').first()).toHaveText(/duration:[\dms]+/);
  await expect(callLine.getByText('engine')).toHaveText(/engine:[\w]+/);
  await expect(callLine.getByText('platform')).toHaveText(/platform:[\w]+/);
  await expect(callLine.getByText('width')).toHaveText(/width:[\d]+/);
  await expect(callLine.getByText('height')).toHaveText(/height:[\d]+/);
  await expect(callLine.getByText('pages')).toHaveText(/pages:1/);
  await expect(callLine.getByText('actions')).toHaveText(/actions:6/);
  await expect(callLine.getByText('events')).toHaveText(/events:[\d]+/);
});

test('should include requestUrl in route.fulfill', async ({ page, runAndTrace, browserName }) => {
  await page.route('**/*', route => {
    route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/html'
      },
      body: 'Hello there!'
    });
  });
  const traceViewer = await runAndTrace(async () => {
    await page.goto('http://test.com');
  });

  // Render snapshot, check expectations.
  await traceViewer.selectAction('route.fulfill');
  await traceViewer.page.locator('.tabbed-pane-tab-label', { hasText: 'Call' }).click();
  const callLine = traceViewer.page.locator('.call-line');
  await expect(callLine.getByText('status')).toContainText('200');
  await expect(callLine.getByText('requestUrl')).toContainText('http://test.com');
});

test('should include requestUrl in route.continue', async ({ page, runAndTrace, server }) => {
  await page.route('**/*', route => {
    route.continue({ url: server.EMPTY_PAGE });
  });
  const traceViewer = await runAndTrace(async () => {
    await page.goto('http://test.com');
  });

  // Render snapshot, check expectations.
  await traceViewer.selectAction('route.continue');
  await traceViewer.page.locator('.tabbed-pane-tab-label', { hasText: 'Call' }).click();
  const callLine = traceViewer.page.locator('.call-line');
  await expect(callLine.getByText('requestUrl')).toContainText('http://test.com');
  await expect(callLine.getByText(/^url:.*/)).toContainText(server.EMPTY_PAGE);
});

test('should include requestUrl in route.abort', async ({ page, runAndTrace, server }) => {
  await page.route('**/*', route => {
    route.abort();
  });
  const traceViewer = await runAndTrace(async () => {
    await page.goto('http://test.com').catch(() => {});
  });

  // Render snapshot, check expectations.
  await traceViewer.selectAction('route.abort');
  await traceViewer.page.locator('.tabbed-pane-tab-label', { hasText: 'Call' }).click();
  const callLine = traceViewer.page.locator('.call-line');
  await expect(callLine.getByText('requestUrl')).toContainText('http://test.com');
});

test('should serve overridden request', async ({ page, runAndTrace, server }) => {
  server.setRoute('/custom.css', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/css',
    });
    res.end(`body { background: red }`);
  });
  await page.route('**/one-style.css', route => {
    route.continue({
      url: server.PREFIX + '/custom.css'
    });
  });
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.PREFIX + '/one-style.html');
  });
  // Render snapshot, check expectations.
  const snapshotFrame = await traceViewer.snapshotFrame('page.goto');
  const color = await snapshotFrame.locator('body').evaluate(body => getComputedStyle(body).backgroundColor);
  expect(color).toBe('rgb(255, 0, 0)');
});

test('should display waitForLoadState even if did not wait for it', async ({ runAndTrace, server, page }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    await page.waitForLoadState('load');
    await page.waitForLoadState('load');
  });
  await expect(traceViewer.actionTitles).toHaveText([
    /page.goto/,
    /page.waitForLoadState/,
    /page.waitForLoadState/,
  ]);
});

test('should display language-specific locators', async ({ runAndTrace, server, page, toImpl }) => {
  toImpl(page.context())._browser.options.sdkLanguage = 'python';
  const traceViewer = await runAndTrace(async () => {
    await page.setContent('<button>Submit</button>');
    await page.getByRole('button', { name: 'Submit' }).click();
  });
  await expect(traceViewer.actionTitles).toHaveText([
    /page.setContent/,
    /locator.clickget_by_role\("button", name="Submit"\)/,
  ]);
});

test('should pick locator', async ({ page, runAndTrace, server }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent('<button>Submit</button>');
  });
  const snapshot = await traceViewer.snapshotFrame('page.setContent');
  await traceViewer.page.getByTitle('Pick locator').click();
  await snapshot.click('button');
  await expect(traceViewer.page.locator('.cm-wrapper')).toContainText(`getByRole('button', { name: 'Submit' })`);
});

test('should update highlight when typing', async ({ page, runAndTrace, server }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent('<button>Submit</button>');
  });
  const snapshot = await traceViewer.snapshotFrame('page.setContent');
  await traceViewer.page.getByTitle('Pick locator').click();
  await traceViewer.page.locator('.CodeMirror').click();
  await traceViewer.page.keyboard.type('button');
  await expect(snapshot.locator('x-pw-glass')).toBeVisible();
});
