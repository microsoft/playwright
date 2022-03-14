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

import fs from 'fs';
import path from 'path';
import type { Browser, Frame, Locator, Page } from 'playwright-core';
import { showTraceViewer } from '../../packages/playwright-core/lib/server/trace/viewer/traceViewer';
import { playwrightTest, expect } from '../config/browserTest';

class TraceViewerPage {
  actionTitles: Locator;
  callLines: Locator;
  consoleLines: Locator;
  consoleLineMessages: Locator;
  consoleStacks: Locator;
  stackFrames: Locator;
  networkRequests: Locator;
  snapshotContainer: Locator;

  constructor(public page: Page) {
    this.actionTitles = page.locator('.action-title');
    this.callLines = page.locator('.call-line');
    this.consoleLines = page.locator('.console-line');
    this.consoleLineMessages = page.locator('.console-line-message');
    this.consoleStacks = page.locator('.console-stack');
    this.stackFrames = page.locator('.stack-trace-frame');
    this.networkRequests = page.locator('.network-request-title');
    this.snapshotContainer = page.locator('.snapshot-container');
  }

  async actionIconsText(action: string) {
    const entry = await this.page.waitForSelector(`.action-entry:has-text("${action}")`);
    await entry.waitForSelector('.action-icon-value:visible');
    return await entry.$$eval('.action-icon-value:visible', ee => ee.map(e => e.textContent));
  }

  async actionIcons(action: string) {
    return await this.page.waitForSelector(`.action-entry:has-text("${action}") .action-icons`);
  }

  async selectAction(title: string, ordinal: number = 0) {
    await this.page.locator(`.action-title:has-text("${title}")`).nth(ordinal).click();
  }

  async selectSnapshot(name: string) {
    await this.page.click(`.snapshot-tab .tab-label:has-text("${name}")`);
  }

  async showConsoleTab() {
    await this.page.click('text="Console"');
  }

  async showSourceTab() {
    await this.page.click('text="Source"');
  }

  async showNetworkTab() {
    await this.page.click('text="Network"');
  }

  async eventBars() {
    await this.page.waitForSelector('.timeline-bar.event:visible');
    const list = await this.page.$$eval('.timeline-bar.event:visible', ee => ee.map(e => e.className));
    const set = new Set<string>();
    for (const item of list) {
      for (const className of item.split(' '))
        set.add(className);
    }
    const result = [...set];
    return result.sort();
  }

  async snapshotFrame(actionName: string, ordinal: number = 0, hasSubframe: boolean = false): Promise<Frame> {
    const existing = this.page.mainFrame().childFrames()[0];
    await Promise.all([
      existing ? existing.waitForNavigation() as any : Promise.resolve(),
      this.selectAction(actionName, ordinal),
    ]);
    while (this.page.frames().length < (hasSubframe ? 3 : 2))
      await this.page.waitForEvent('frameattached');
    return this.page.mainFrame().childFrames()[0];
  }
}

const test = playwrightTest.extend<{ showTraceViewer: (trace: string[]) => Promise<TraceViewerPage>, runAndTrace: (body: () => Promise<void>) => Promise<TraceViewerPage> }>({
  showTraceViewer: async ({ playwright, browserName, headless }, use) => {
    let browser: Browser;
    let contextImpl: any;
    await use(async (traces: string[]) => {
      contextImpl = await showTraceViewer(traces, browserName, headless);
      browser = await playwright.chromium.connectOverCDP({ endpointURL: contextImpl._browser.options.wsEndpoint });
      return new TraceViewerPage(browser.contexts()[0].pages()[0]);
    });
    await browser?.close();
    await contextImpl?._browser.close();
  },

  runAndTrace: async ({ context, showTraceViewer }, use, testInfo) => {
    await use(async (body: () => Promise<void>) => {
      const traceFile = testInfo.outputPath('trace.zip');
      await context.tracing.start({ snapshots: true, screenshots: true, sources: true });
      await body();
      await context.tracing.stop({ path: traceFile });
      return showTraceViewer([traceFile]);
    });
  }
});

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
    await page.click('"Click"');
  }
  await doClick();

  // Make sure resources arrive in a predictable order.
  const htmlDone = page.waitForEvent('requestfinished', request => request.url().includes('frame.html'));
  const styleDone = page.waitForEvent('requestfinished', request => request.url().includes('style.css'));
  await page.route(server.PREFIX + '/frames/style.css', async route => {
    await htmlDone;
    await route.continue();
  });
  await page.route(server.PREFIX + '/frames/script.js', async route => {
    await styleDone;
    await route.continue();
  });

  await Promise.all([
    page.waitForNavigation(),
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

test('should open simple trace viewer', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await expect(traceViewer.actionTitles).toHaveText([
    /browserContext.newPage/,
    /page.gotodata:text\/html,<html>Hello world<\/html>/,
    /page.setContent/,
    /expect.toHaveTextbutton/,
    /page.evaluate/,
    /page.evaluate/,
    /page.click"Click"/,
    /page.waitForEvent/,
    /page.waitForEvent/,
    /page.route/,
    /page.waitForNavigation/,
    /page.waitForTimeout/,
    /page.gotohttp:\/\/localhost:\d+\/frames\/frame.html/,
    /route.continue/,
    /route.continue/,
    /page.setViewportSize/,
  ]);
});

test('should contain action info', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await traceViewer.selectAction('page.click');
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
  test.fixme(browserName === 'firefox', 'Firefox generates stray console message for page error');
  const traceViewer = await showTraceViewer([traceFile]);
  await traceViewer.selectAction('page.evaluate');
  await traceViewer.showConsoleTab();

  await expect(traceViewer.consoleLineMessages).toHaveText(['Info', 'Warning', 'Error', 'Unhandled exception']);
  await expect(traceViewer.consoleLines).toHaveClass(['console-line log', 'console-line warning', 'console-line error', 'console-line error']);
  await expect(traceViewer.consoleStacks.first()).toContainText('Error: Unhandled exception');
});

test('should open console errors on click', async ({ showTraceViewer, browserName }) => {
  test.fixme(browserName === 'firefox', 'Firefox generates stray console message for page error');
  const traceViewer = await showTraceViewer([traceFile]);
  expect(await traceViewer.actionIconsText('page.evaluate')).toEqual(['2', '1']);
  expect(await traceViewer.page.isHidden('.console-tab')).toBeTruthy();
  await (await traceViewer.actionIcons('page.evaluate')).click();
  expect(await traceViewer.page.waitForSelector('.console-tab')).toBeTruthy();
});

test('should show params and return value', async ({ showTraceViewer, browserName }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await traceViewer.selectAction('page.evaluate');
  await expect(traceViewer.callLines).toHaveText([
    /page.evaluate/,
    /wall time: [0-9/:,APM ]+/,
    /duration: [\d]+ms/,
    /expression: "\({↵    a↵  }\) => {↵    console\.log\(\'Info\'\);↵    console\.warn\(\'Warning\'\);↵    console/,
    'isFunction: true',
    'arg: {"a":"paramA","b":4}',
    'value: "return paramA"'
  ]);
});

test('should show null as a param', async ({ showTraceViewer, browserName }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await traceViewer.selectAction('page.evaluate', 1);
  await expect(traceViewer.callLines).toHaveText([
    /page.evaluate/,
    /wall time: [0-9/:,APM ]+/,
    /duration: [\d]+ms/,
    'expression: "() => 1 + 1"',
    'isFunction: true',
    'arg: null',
    'value: 2'
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

  await traceViewer.selectAction('page.click');
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
  await expect(traceViewer.networkRequests).toHaveText([
    '200GETframe.htmltext/html',
    '200GETstyle.csstext/css',
    '200GETscript.jsapplication/javascript',
  ]);
});

test('should show snapshot URL', async ({ page, runAndTrace, server }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    await page.evaluate('2+2');
  });
  await traceViewer.snapshotFrame('page.evaluate');
  await expect(traceViewer.page.locator('.snapshot-url')).toHaveText(server.EMPTY_PAGE);
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
  await traceViewer.selectAction('page.click');
  const page = traceViewer.page;

  await page.click('text=Source');
  await expect(page.locator('.source-line')).toContainText([
    /async.*function.*doClick/,
    /page\.click/
  ]);
  await expect(page.locator('.source-line-running')).toContainText('page.click');
  await expect(page.locator('.stack-trace-frame.selected')).toHaveText(/doClick.*trace-viewer\.spec\.ts:[\d]+/);
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
  await expect(callLine.locator('text=start time')).toHaveText(/start time: [\d/,: ]+/);
  await expect(callLine.locator('text=duration')).toHaveText(/duration: [\dms]+/);
  await expect(callLine.locator('text=engine')).toHaveText(/engine: [\w]+/);
  await expect(callLine.locator('text=platform')).toHaveText(/platform: [\w]+/);
  await expect(callLine.locator('text=width')).toHaveText(/width: [\d]+/);
  await expect(callLine.locator('text=height')).toHaveText(/height: [\d]+/);
  await expect(callLine.locator('text=pages')).toHaveText(/pages: 1/);
  await expect(callLine.locator('text=actions')).toHaveText(/actions: [\d]+/);
  await expect(callLine.locator('text=events')).toHaveText(/events: [\d]+/);
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
  await page.click('button');
  await page.click('button');
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
    `page.clickbutton`,
    `page.clickbutton`,
    `apiRequestContext.post`,
  ]);

  await traceViewer.page.locator('text=Metadata').click();
  const callLine = traceViewer.page.locator('.call-line');
  // Should get metadata from the context trace
  await expect(callLine.locator('text=start time')).toHaveText(/start time: [\d/,: ]+/);
  // duration in the metatadata section
  await expect(callLine.locator('text=duration').first()).toHaveText(/duration: [\dms]+/);
  await expect(callLine.locator('text=engine')).toHaveText(/engine: [\w]+/);
  await expect(callLine.locator('text=platform')).toHaveText(/platform: [\w]+/);
  await expect(callLine.locator('text=width')).toHaveText(/width: [\d]+/);
  await expect(callLine.locator('text=height')).toHaveText(/height: [\d]+/);
  await expect(callLine.locator('text=pages')).toHaveText(/pages: 1/);
  await expect(callLine.locator('text=actions')).toHaveText(/actions: 6/);
  await expect(callLine.locator('text=events')).toHaveText(/events: [\d]+/);
});

