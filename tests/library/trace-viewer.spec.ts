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
import { pathToFileURL } from 'url';
import { expect, playwrightTest } from '../config/browserTest';
import type { FrameLocator } from '@playwright/test';

const test = playwrightTest.extend<TraceViewerFixtures>(traceViewerFixtures);

test.skip(({ trace }) => trace === 'on');
test.skip(({ mode }) => mode.startsWith('service'));
test.slow();

let traceFile: string;

test.beforeAll(async function recordTrace({ browser, browserName, browserType, server }, workerInfo) {
  const context = await browser.newContext({
    baseURL: 'https://example.com',
  });
  await context.tracing.start({ name: 'test', screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  await page.goto(`data:text/html,<!DOCTYPE html><html>Hello world</html>`);
  await page.setContent('<!DOCTYPE html><button>Click</button>');
  await expect(page.locator('button')).toHaveText('Click');
  await expect(page.getByTestId('amazing-btn')).toBeHidden();
  await expect(page.getByTestId(/amazing-btn-regex/)).toBeHidden();
  await page.evaluate(({ a }) => {
    console.log('Info');
    console.warn('Warning');
    console.error('Error');
    return new Promise(f => {
      // Generate exception.
      window.builtinSetTimeout(() => {
        // And then resolve.
        window.builtinSetTimeout(() => f('return ' + a), 0);
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
  const csi = {
    runBeforeCloseBrowserContext: async () => {
      await page.hover('body');
      await page.close();
      traceFile = path.join(workerInfo.project.outputDir, String(workerInfo.workerIndex), browserName, 'trace.zip');
      await context.tracing.stop({ path: traceFile });
    }
  };
  (browserType as any)._instrumentation.addListener(csi);
  await context.close();
  (browserType as any)._instrumentation.removeListener(csi);
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
    /page.gotodata:text\/html,<!DOCTYPE html><html>Hello world<\/html>/,
    /page.setContent/,
    /expect.toHaveTextlocator\('button'\)/,
    /expect.toBeHiddengetByTestId\('amazing-btn'\)/,
    /expect.toBeHiddengetByTestId\(\/amazing-btn-regex\/\)/,
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

test('should complain about newer version of trace in old viewer', async ({ showTraceViewer, asset }, testInfo) => {
  const traceViewer = await showTraceViewer([asset('trace-from-the-future.zip')]);
  await expect(traceViewer.page.getByText('The trace was created by a newer version of Playwright and is not supported by this version of the viewer.')).toBeVisible();
});

test('should properly synchronize local and remote time', async ({ showTraceViewer, asset }, testInfo) => {
  const traceViewer = await showTraceViewer([asset('trace-remote-time-diff.zip')]);
  // The total duration should be sub 10s, rather than 16h.
  await expect.poll(async () =>
    parseInt(await traceViewer.page.locator('.timeline-time').last().innerText(), 10)
  ).toBeLessThan(10);
});

test('should contain action info', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await traceViewer.selectAction('locator.click');
  await traceViewer.page.getByText('Log', { exact: true }).click();
  await expect(traceViewer.logLines).toContainText([
    /\d+m?sattempting click action/,
    /\d+m?s  click action done/,
  ]);
});

test('should render network bars', async ({ page, runAndTrace, server }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
  });
  await expect(traceViewer.page.locator('.timeline-bar.network')).toHaveCount(1);
});

test('should render console', async ({ showTraceViewer, browserName }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await traceViewer.showConsoleTab();

  await expect(traceViewer.consoleLineMessages.nth(0)).toHaveText('Info');
  await expect(traceViewer.consoleLineMessages.nth(1)).toHaveText('Warning');
  await expect(traceViewer.consoleLineMessages.nth(2)).toHaveText('Error');
  await expect(traceViewer.consoleLineMessages.nth(3)).toHaveText('Unhandled exception');
  // Browsers can insert more messages between these two.
  await expect(traceViewer.consoleLineMessages.filter({ hasText: 'Cheers!' })).toBeVisible();

  const icons = traceViewer.consoleLines.locator('.codicon');
  await expect.soft(icons.nth(0)).toHaveClass('codicon codicon-browser status-none');
  await expect.soft(icons.nth(1)).toHaveClass('codicon codicon-browser status-warning');
  await expect.soft(icons.nth(2)).toHaveClass('codicon codicon-browser status-error');
  await expect.soft(icons.nth(3)).toHaveClass('codicon codicon-browser status-error');
  // Browsers can insert more messages between these two.
  await expect.soft(traceViewer.consoleLines.filter({ hasText: 'Cheers!' }).locator('.codicon')).toHaveClass('codicon codicon-browser status-none');
  await expect(traceViewer.consoleStacks.first()).toContainText('Error: Unhandled exception');

  await traceViewer.selectAction('page.evaluate');

  const listViews = traceViewer.page.locator('.console-tab').locator('.list-view-entry');
  await expect(listViews.nth(0)).toHaveClass('list-view-entry');
  await expect(listViews.nth(1)).toHaveClass('list-view-entry warning');
  await expect(listViews.nth(2)).toHaveClass('list-view-entry error');
  await expect(listViews.nth(3)).toHaveClass('list-view-entry error');
  // Browsers can insert more messages between these two.
  await expect(listViews.filter({ hasText: 'Cheers!' })).toHaveClass('list-view-entry');
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
  await expect(traceViewer.networkRequests).toContainText([/frame.htmlGET200text\/html/]);
  await expect(traceViewer.networkRequests).toContainText([/style.cssGET200text\/css/]);
  await expect(traceViewer.networkRequests).toContainText([/404GET404text\/plain/]);
  await expect(traceViewer.networkRequests).toContainText([/script.jsGET200application\/javascript/]);
  await expect(traceViewer.networkRequests.filter({ hasText: '404' })).toHaveCSS('background-color', 'rgb(242, 222, 222)');
});

test('should filter network requests by resource type', async ({ page, runAndTrace, server }) => {
  const traceViewer = await runAndTrace(async () => {
    server.setRoute('/api/endpoint', (_, res) => res.setHeader('Content-Type', 'application/json').end());
    await page.goto(`${server.PREFIX}/network-tab/network.html`);
  });
  await traceViewer.selectAction('http://localhost');
  await traceViewer.showNetworkTab();

  await traceViewer.page.getByText('JS', { exact: true }).click();
  await expect(traceViewer.networkRequests).toHaveCount(1);
  await expect(traceViewer.networkRequests.getByText('script.js')).toBeVisible();

  await traceViewer.page.getByText('CSS', { exact: true }).click();
  await expect(traceViewer.networkRequests).toHaveCount(1);
  await expect(traceViewer.networkRequests.getByText('style.css')).toBeVisible();

  await traceViewer.page.getByText('Image', { exact: true }).click();
  await expect(traceViewer.networkRequests).toHaveCount(1);
  await expect(traceViewer.networkRequests.getByText('image.png')).toBeVisible();

  await traceViewer.page.getByText('Fetch', { exact: true }).click();
  await expect(traceViewer.networkRequests).toHaveCount(1);
  await expect(traceViewer.networkRequests.getByText('endpoint')).toBeVisible();

  await traceViewer.page.getByText('HTML', { exact: true }).click();
  await expect(traceViewer.networkRequests).toHaveCount(1);
  await expect(traceViewer.networkRequests.getByText('network.html')).toBeVisible();

  await traceViewer.page.getByText('Font', { exact: true }).click();
  await expect(traceViewer.networkRequests).toHaveCount(1);
  await expect(traceViewer.networkRequests.getByText('font.woff2')).toBeVisible();
});

test('should show font preview', async ({ page, runAndTrace, server }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.goto(`${server.PREFIX}/network-tab/network.html`);
  });
  await traceViewer.selectAction('http://localhost');
  await traceViewer.showNetworkTab();

  await traceViewer.page.getByText('Font', { exact: true }).click();
  await expect(traceViewer.networkRequests).toHaveCount(1);
  await traceViewer.networkRequests.getByText('font.woff2').click();
  await traceViewer.page.getByTestId('network-request-details').getByTitle('Body').click();
  await expect(traceViewer.page.locator('.network-request-details-tab')).toContainText('ABCDEF');
});

test('should filter network requests by url', async ({ page, runAndTrace, server }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.goto(`${server.PREFIX}/network-tab/network.html`);
  });
  await traceViewer.selectAction('http://localhost');
  await traceViewer.showNetworkTab();

  await traceViewer.page.getByPlaceholder('Filter network').fill('script.');
  await expect(traceViewer.networkRequests).toHaveCount(1);
  await expect(traceViewer.networkRequests.getByText('script.js')).toBeVisible();

  await traceViewer.page.getByPlaceholder('Filter network').fill('png');
  await expect(traceViewer.networkRequests).toHaveCount(1);
  await expect(traceViewer.networkRequests.getByText('image.png')).toBeVisible();

  await traceViewer.page.getByPlaceholder('Filter network').fill('api/');
  await expect(traceViewer.networkRequests).toHaveCount(1);
  await expect(traceViewer.networkRequests.getByText('endpoint')).toBeVisible();

  await traceViewer.page.getByPlaceholder('Filter network').fill('End');
  await expect(traceViewer.networkRequests).toHaveCount(1);
  await expect(traceViewer.networkRequests.getByText('endpoint')).toBeVisible();

  await traceViewer.page.getByPlaceholder('Filter network').fill('FON');
  await expect(traceViewer.networkRequests).toHaveCount(1);
  await expect(traceViewer.networkRequests.getByText('font.woff2')).toBeVisible();
});

test('should have network request overrides', async ({ page, server, runAndTrace }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.route('**/style.css', route => route.abort());
    await page.goto(server.PREFIX + '/frames/frame.html');
  });
  await traceViewer.selectAction('http://localhost');
  await traceViewer.showNetworkTab();
  await expect(traceViewer.networkRequests).toContainText([/frame.htmlGET200text\/html/]);
  await expect(traceViewer.networkRequests).toContainText([/style.cssGETx-unknown.*aborted/]);
  await expect(traceViewer.networkRequests).not.toContainText([/continued/]);
});

test('should have network request overrides 2', async ({ page, server, runAndTrace }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.route('**/script.js', route => route.continue());
    await page.goto(server.PREFIX + '/frames/frame.html');
  });
  await traceViewer.selectAction('http://localhost');
  await traceViewer.showNetworkTab();
  await expect.soft(traceViewer.networkRequests).toContainText([/frame.htmlGET200text\/html.*/]);
  await expect.soft(traceViewer.networkRequests).toContainText([/script.jsGET200application\/javascript.*continued/]);
});

test('should show snapshot URL', async ({ page, runAndTrace, server }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    await page.evaluate('2+2');
  });
  await traceViewer.snapshotFrame('page.evaluate');
  await expect(traceViewer.page.locator('.browser-frame-address-bar')).toHaveText(server.EMPTY_PAGE);
});

test('should popup snapshot', async ({ page, runAndTrace, server }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent('hello äöü 🙂');
  });
  await traceViewer.snapshotFrame('page.setContent');
  const popupPromise = traceViewer.page.context().waitForEvent('page');
  await traceViewer.page.getByTitle('Open snapshot in a new tab').click();
  const popup = await popupPromise;
  await expect(popup.getByText('hello äöü 🙂')).toBeVisible();
});

test('should capture iframe with sandbox attribute', async ({ page, server, runAndTrace }) => {
  await page.route('**/empty.html', route => {
    void route.fulfill({
      body: '<iframe src="iframe.html" sandBOX="allow-scripts"></iframe>',
      contentType: 'text/html'
    }).catch(() => {});
  });
  await page.route('**/iframe.html', route => {
    void route.fulfill({
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
  const button = snapshotFrame.frameLocator('iframe').locator('button');
  expect(await button.textContent()).toBe('Hello iframe');
});

test('should capture data-url svg iframe', async ({ page, server, runAndTrace }) => {
  await page.route('**/empty.html', route => {
    void route.fulfill({
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
  await expect(snapshotFrame.frameLocator('iframe').locator('svg')).toBeVisible();
  const content = await snapshotFrame.frameLocator('iframe').locator(':root').innerHTML();
  expect(content).toContain(`d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"`);
});

test('should contain adopted style sheets', async ({ page, runAndTrace, browserName }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.setContent('<button>Hello</button>');
    await page.evaluate(() => {
      const sheet = new CSSStyleSheet();
      sheet.addRule('button', 'color: red');
      document.adoptedStyleSheets = [sheet];

      const sheet2 = new CSSStyleSheet();
      sheet2.addRule(':host', 'color: blue');

      for (const element of [document.createElement('div'), document.createElement('span')]) {
        const root = element.attachShadow({
          mode: 'open'
        });
        root.append('foo');
        root.adoptedStyleSheets = [sheet2];
        document.body.appendChild(element);
      }
    });
  });

  const frame = await traceViewer.snapshotFrame('page.evaluate');
  await expect(frame.locator('button')).toHaveCSS('color', 'rgb(255, 0, 0)');
  await expect(frame.locator('div')).toHaveCSS('color', 'rgb(0, 0, 255)');
  await expect(frame.locator('span')).toHaveCSS('color', 'rgb(0, 0, 255)');
});

test('should work with adopted style sheets and replace/replaceSync', async ({ page, runAndTrace, browserName }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.setContent('<button>Hello</button>');
    await page.evaluate(() => {
      const sheet = new CSSStyleSheet();
      sheet.addRule('button', 'color: red');
      document.adoptedStyleSheets = [sheet];
    });
    await page.evaluate(() => {
      const [sheet] = document.adoptedStyleSheets;
      sheet.replaceSync(`button { color: blue }`);
    });
    await page.evaluate(async () => {
      const [sheet] = document.adoptedStyleSheets;
      await sheet.replace(`button { color: #0F0 }`);
    });
  });

  {
    const frame = await traceViewer.snapshotFrame('page.evaluate', 0);
    await expect(frame.locator('button')).toHaveCSS('color', 'rgb(255, 0, 0)');
  }
  {
    const frame = await traceViewer.snapshotFrame('page.evaluate', 1);
    await expect(frame.locator('button')).toHaveCSS('color', 'rgb(0, 0, 255)');
  }
  {
    const frame = await traceViewer.snapshotFrame('page.evaluate', 2);
    await expect(frame.locator('button')).toHaveCSS('color', 'rgb(0, 255, 0)');
  }
});

test('should work with adopted style sheets and all: unset', async ({ page, runAndTrace, browserName }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31500' });
  test.fixme(browserName === 'chromium', 'https://issues.chromium.org/u/1/issues/41416124');

  const traceViewer = await runAndTrace(async () => {
    await page.setContent('<button>Hello</button>');
    await page.evaluate(() => {
      const stylesheet = new CSSStyleSheet();
      // 'all: unset' is the problem here.
      stylesheet.replaceSync('button { all: unset; border-radius: 24px; background-color: deepskyblue; color: black; padding: 5px }');
      document.adoptedStyleSheets = [stylesheet];
    });
    await page.getByRole('button').click();
  });
  {
    const frame = await traceViewer.snapshotFrame('page.evaluate', 0);
    await expect(frame.locator('button')).toHaveCSS('border-radius', '24px');
    await expect(frame.locator('button')).toHaveCSS('background-color', 'rgb(0, 191, 255)');
    await expect(frame.locator('button')).toHaveCSS('color', 'rgb(0, 0, 0)');
    await expect(frame.locator('button')).toHaveCSS('padding', '5px');
  }
});

test('should work with nesting CSS selectors', async ({ page, runAndTrace }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31607' });

  const traceViewer = await runAndTrace(async () => {
    await page.setContent(`
      <span class="foo" data-testid="green-element">Hi</span>
      <span class="foo bar" data-testid="red-element">Hello</span>
      <style>
        .foo {
          color: green;

          &.bar {
            color: red;
          }
        }
      </style>
      `);
    await page.evaluate(() => { });
  });
  {
    const frame = await traceViewer.snapshotFrame('page.evaluate', 0);
    await expect(frame.getByTestId('green-element')).toHaveCSS('color', /* green */'rgb(0, 128, 0)');
    await expect(frame.getByTestId('red-element')).toHaveCSS('color', /* red */'rgb(255, 0, 0)');
  }
});

test('should restore scroll positions', async ({ page, runAndTrace }) => {
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
  expect(await frame.locator('div').evaluate(div => div.scrollTop)).toBe(136);
});

test('should restore control values', async ({ page, runAndTrace, asset }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.setContent(`
      <input type=text value=old>
      <input type=checkbox checked>
      <input type=radio>
      <input type=file>
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
    await page.locator('input[type="file"]').setInputFiles(asset('file-to-upload.txt'));
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

  expect(await frame.locator('option >> nth=0').evaluate(o => o.hasAttribute('selected'))).toBe(false);
  expect(await frame.locator('option >> nth=1').evaluate(o => o.hasAttribute('selected'))).toBe(true);
  expect(await frame.locator('option >> nth=2').evaluate(o => o.hasAttribute('selected'))).toBe(false);
  await expect(frame.locator('select')).toHaveValues(['opt1', 'opt3']);

  await expect(frame.locator('input[type=file]')).toHaveValue('');
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
  // Should render shadow dom with post-processing script.
  await expect(frame.locator('span')).toHaveText('World');
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
  await frame.locator('div').waitFor();
  await expect(frame.locator('body')).toHaveCSS('padding-left', '42px');
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
  const size = await frame.locator('img').evaluate(e => (e as HTMLImageElement).naturalWidth);
  expect(size).toBe(10);
});

test('should handle file URIs', async ({ page, runAndTrace, browserName }) => {
  test.skip(browserName !== 'chromium');

  const traceViewer = await runAndTrace(async () => {
    await page.goto(pathToFileURL(path.join(__dirname, '..', 'assets', 'one-style.html')).href);
  });

  const frame = await traceViewer.snapshotFrame('goto');
  await expect(frame.locator('body')).toHaveCSS('background-color', 'rgb(255, 192, 203)');
});

test('should preserve currentSrc', async ({ browser, server, showTraceViewer }) => {
  const traceFile = test.info().outputPath('trace.zip');
  const page = await browser.newPage({ deviceScaleFactor: 3 });
  await page.context().tracing.start({ snapshots: true, screenshots: true, sources: true });
  await page.setViewportSize({ width: 300, height: 300 });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <picture>
      <source srcset="digits/1.png 1x, digits/2.png 2x, digits/3.png 3x">
      <img id=target1 src="digits/0.png">
    </picture>
    <img id=target2 srcset="digits/4.png 1x, digits/5.png 2x, digits/6.png 3x">
  `);
  await page.context().tracing.stop({ path: traceFile });
  await page.close();

  const traceViewer = await showTraceViewer([traceFile]);
  const frame = await traceViewer.snapshotFrame('page.setContent');
  await expect(frame.locator('#target1')).toHaveAttribute('src', server.PREFIX + '/digits/3.png');
  await expect(frame.locator('#target2')).toHaveAttribute('src', server.PREFIX + '/digits/6.png');
});

test('should register custom elements', async ({ page, server, runAndTrace }) => {
  const traceViewer = await runAndTrace(async () => {
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
      <div>t1</div>
      <div>t2</div>
      <div>t3</div>
      <div>t4</div>
      <div>t5</div>
      <div>t6</div>
      <div>multi</div>
      <div>multi</div>
    `);
    await page.click('text=t1');
    await page.innerText('text=t2');
    await (await page.$('text=t3')).click();
    await (await page.$('text=t4')).innerText();
    await page.locator('text=t5').innerText();
    await expect(page.locator('text=t6')).toHaveText(/t6/i);
    await expect(page.locator('text=multi')).toHaveText(['a', 'b'], { timeout: 1000 }).catch(() => {});
    await page.mouse.move(123, 234);
  });

  async function highlightedDivs(frameLocator: FrameLocator) {
    return frameLocator.locator('div').evaluateAll(divs => {
      // See snapshotRenderer.ts for the exact color.
      return divs.filter(div => getComputedStyle(div).backgroundColor === 'rgba(111, 168, 220, 0.498)').map(div => div.textContent);
    });
  }

  const framePageClick = await traceViewer.snapshotFrame('page.click');
  await expect.poll(() => highlightedDivs(framePageClick)).toEqual(['t1']);
  const box1 = await framePageClick.getByText('t1').boundingBox();
  const box2 = await framePageClick.locator('x-pw-pointer').boundingBox();
  const x1 = box1!.x + box1!.width / 2;
  const y1 = box1!.y + box1!.height / 2;
  const x2 = box2!.x + box2!.width / 2;
  const y2 = box2!.y + box2!.height / 2;
  expect(Math.abs(x1 - x2) < 2).toBeTruthy();
  expect(Math.abs(y1 - y2) < 2).toBeTruthy();

  const framePageInnerText = await traceViewer.snapshotFrame('page.innerText');
  await expect.poll(() => highlightedDivs(framePageInnerText)).toEqual(['t2']);

  const frameHandleClick = await traceViewer.snapshotFrame('elementHandle.click');
  await expect.poll(() => highlightedDivs(frameHandleClick)).toEqual(['t3']);

  const frameHandleInnerText = await traceViewer.snapshotFrame('elementHandle.innerText');
  await expect.poll(() => highlightedDivs(frameHandleInnerText)).toEqual(['t4']);

  const frameLocatorInnerText = await traceViewer.snapshotFrame('locator.innerText');
  await expect.poll(() => highlightedDivs(frameLocatorInnerText)).toEqual(['t5']);

  const frameExpect1 = await traceViewer.snapshotFrame('expect.toHaveText', 0);
  await expect.poll(() => highlightedDivs(frameExpect1)).toEqual(['t6']);

  const frameExpect2 = await traceViewer.snapshotFrame('expect.toHaveText', 1);
  await expect.poll(() => highlightedDivs(frameExpect2)).toEqual(['multi', 'multi']);
  await expect(frameExpect2.locator('x-pw-pointer')).not.toBeVisible();

  const frameMouseMove = await traceViewer.snapshotFrame('mouse.move');
  await expect(frameMouseMove.locator('x-pw-pointer')).toBeVisible();
});

test('should highlight target element in shadow dom', async ({ page, server, runAndTrace }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.PREFIX + '/shadow.html');
    await page.locator('button').click();
    await expect(page.locator('h1')).toHaveText('Hellow Shadow DOM v1');
  });

  const framePageClick = await traceViewer.snapshotFrame('locator.click');
  await expect(framePageClick.locator('button')).toHaveCSS('background-color', 'rgba(111, 168, 220, 0.498)');

  const frameExpect = await traceViewer.snapshotFrame('expect.toHaveText');
  await expect(frameExpect.locator('h1')).toHaveCSS('background-color', 'rgba(111, 168, 220, 0.498)');
});

test('should highlight expect failure', async ({ page, server, runAndTrace }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright-python/issues/2258' });
  const traceViewer = await runAndTrace(async () => {
    try {
      await page.goto(server.EMPTY_PAGE);
      await expect(page).toHaveTitle('foo', { timeout: 100 });
    } catch (e) {
    }
  });

  await expect(traceViewer.actionTitles.getByText('expect.toHaveTitle')).toHaveCSS('color', 'rgb(176, 16, 17)');
  await traceViewer.showErrorsTab();
  await expect(traceViewer.errorMessages.nth(0)).toHaveText('Expect failed');
});

test('should show action source', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await traceViewer.selectAction('locator.click');
  const page = traceViewer.page;

  await page.click('text=Source');
  await expect(page.locator('.source-line-running')).toContainText('await page.getByText(\'Click\').click()');
  await expect(page.getByTestId('stack-trace-list').locator('.list-view-entry.selected')).toHaveText(/doClick.*trace-viewer\.spec\.ts:[\d]+/);
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

test('should include metainfo', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await traceViewer.page.locator('text=Metadata').click();
  const callLine = traceViewer.metadataTab.locator('.call-line');
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
  await context.tracing.start({ snapshots: true, sources: true });
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
    await expect(response).toBeOK();
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
    `apiRequestContext.get/simple.json`,
    `page.gotohttp://localhost:${server.PORT}/input/button.html`,
    `apiRequestContext.head/simplezip.json`,
    `locator.clicklocator('button')`,
    `locator.clicklocator('button')`,
    `apiRequestContext.post/one-style.css`,
  ]);

  await traceViewer.page.locator('text=Metadata').click();
  const callLine = traceViewer.page.locator('.call-line');
  // Should get metadata from the context trace
  await expect(callLine.getByText('start time')).toHaveText(/start time:[\d/,: ]+/);
  // duration in the metadata section
  await expect(callLine.getByText('duration').first()).toHaveText(/duration:[\dms]+/);
  await expect(callLine.getByText('engine')).toHaveText(/engine:[\w]+/);
  await expect(callLine.getByText('platform')).toHaveText(/platform:[\w]+/);
  await expect(callLine.getByText('width')).toHaveText(/width:[\d]+/);
  await expect(callLine.getByText('height')).toHaveText(/height:[\d]+/);
  await expect(callLine.getByText('pages')).toHaveText(/pages:1/);
  await expect(callLine.getByText('actions')).toHaveText(/actions:6/);
  await expect(callLine.getByText('events')).toHaveText(/events:[\d]+/);
});

test('should open two trace files of the same test', async ({ context, page, request, server, showTraceViewer, asset }, testInfo) => {
  const traceViewer = await showTraceViewer([asset('test-trace1.zip'), asset('test-trace2.zip')]);
  // Same actions from different test runs should not be merged.
  await expect(traceViewer.actionTitles).toHaveText([
    'Before Hooks',
    'Before Hooks',
    'page.gotohttps://playwright.dev/',
    'page.gotohttps://playwright.dev/',
    'expect.toBe',
    'After Hooks',
    'expect.toBe',
    'After Hooks',
  ]);
});

test('should not crash with broken locator', async ({ page, runAndTrace, server }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/21832' });
  const traceViewer = await runAndTrace(async () => {
    try {
      await page.locator('[class*=github-btn] a]').click();
    } catch (e) {
    }
  });
  await expect(traceViewer.page).toHaveTitle('Playwright Trace Viewer');
  const header = traceViewer.page.getByText('Playwright', { exact: true });
  await expect(header).toBeVisible();
});

test('should serve overridden request', async ({ page, runAndTrace, server }) => {
  server.setRoute('/custom.css', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/css',
    });
    res.end(`body { background: red }`);
  });
  await page.route('**/one-style.css', route => {
    void route.continue({
      url: server.PREFIX + '/custom.css'
    });
  });
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.PREFIX + '/one-style.html');
  });
  // Render snapshot, check expectations.
  const snapshotFrame = await traceViewer.snapshotFrame('page.goto');
  await expect(snapshotFrame.locator('body')).toHaveCSS('background-color', 'rgb(255, 0, 0)');
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
  toImpl(page).attribution.playwright.options.sdkLanguage = 'python';
  const traceViewer = await runAndTrace(async () => {
    await page.setContent('<button>Submit</button>');
    await page.getByRole('button', { name: 'Submit' }).click();
  });
  await expect(traceViewer.actionTitles).toHaveText([
    /page.setContent/,
    /locator.clickget_by_role\("button", name="Submit"\)/,
  ]);
  toImpl(page).attribution.playwright.options.sdkLanguage = 'javascript';
});

test('should pick locator', async ({ page, runAndTrace, server }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent('<button>Submit</button>');
  });
  const snapshot = await traceViewer.snapshotFrame('page.setContent');
  await traceViewer.page.getByTitle('Pick locator').click();
  await snapshot.locator('button').click();
  await expect(traceViewer.page.locator('.cm-wrapper')).toContainText(`getByRole('button', { name: 'Submit' })`);
});

test('should update highlight when typing', async ({ page, runAndTrace, server }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent('<button>Submit</button>');
  });
  const snapshot = await traceViewer.snapshotFrame('page.setContent');
  await traceViewer.page.getByText('Locator').click();
  await traceViewer.page.locator('.CodeMirror').click();
  await traceViewer.page.keyboard.type('button');
  await expect(snapshot.locator('x-pw-glass')).toBeVisible();
});

test('should open trace-1.31', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer([path.join(__dirname, '../assets/trace-1.31.zip')]);
  const snapshot = await traceViewer.snapshotFrame('locator.click');
  await expect(snapshot.locator('[__playwright_target__]')).toHaveText(['Submit']);
});

test('should open trace-1.37', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer([path.join(__dirname, '../assets/trace-1.37.zip')]);
  const snapshot = await traceViewer.snapshotFrame('page.goto');
  await expect(snapshot.locator('div')).toHaveCSS('background-color', 'rgb(255, 0, 0)');

  await traceViewer.showConsoleTab();
  await expect(traceViewer.consoleLineMessages).toHaveText(['hello {foo: bar}']);

  await traceViewer.showNetworkTab();
  await expect(traceViewer.networkRequests).toContainText([
    /index.htmlGET200text\/html/,
    /style.cssGET200x-unknown/
  ]);
});

test('should prefer later resource request with the same method', async ({ page, server, runAndTrace }) => {
  const html = `
    <body>
      <script>
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'style.css';
        document.head.appendChild(link);

        if (!window.location.href.includes('reloaded'))
          window.location.href = window.location.href + '?reloaded';
        else
          link.onload = () => fetch('style.css', { method: 'HEAD' });
      </script>
      <div>Hello</div>
    </body>
  `;

  let reloadStartedCallback = () => {};
  const reloadStartedPromise = new Promise<void>(f => reloadStartedCallback = f);
  server.setRoute('/style.css', async (req, res) => {
    if (req.method === 'HEAD') {
      res.statusCode = 200;
      res.end('');
      return;
    }

    // Make sure reload happens before style arrives.
    await reloadStartedPromise;
    res.end('body { background-color: rgb(123, 123, 123) }');
  });
  server.setRoute('/index.html', (req, res) => res.end(html));
  server.setRoute('/index.html?reloaded', (req, res) => {
    reloadStartedCallback();
    res.end(html);
  });

  const traceViewer = await runAndTrace(async () => {
    const headRequest = page.waitForRequest(req => req.url() === server.PREFIX + '/style.css' && req.method() === 'HEAD');
    await page.goto(server.PREFIX + '/index.html');
    await headRequest;
    await page.locator('div').click();
  });
  const frame1 = await traceViewer.snapshotFrame('page.goto');
  await expect(frame1.locator('body')).toHaveCSS('background-color', 'rgb(123, 123, 123)');
  const frame2 = await traceViewer.snapshotFrame('locator.click');
  await expect(frame2.locator('body')).toHaveCSS('background-color', 'rgb(123, 123, 123)');
});

test('should ignore 304 responses', async ({ page, server, runAndTrace }) => {
  const html = `
    <head>
      <link rel=stylesheet href="style.css" />
    </head>
    <body>
      <div>Hello</div>
    </body>
  `;

  server.setRoute('/style.css', async (req, res) => {
    if (req.headers['if-modified-since']) {
      res.statusCode = 304; // not modified
      res.end();
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, no-cache');
    res.setHeader('Last-Modified', (new Date()).toISOString());
    res.end('body { background-color: rgb(123, 123, 123) }');
  });
  server.setRoute('/index.html', (req, res) => res.end(html));

  const traceViewer = await runAndTrace(async () => {
    const request1 = page.waitForEvent('requestfinished', req => req.url() === server.PREFIX + '/style.css');
    await page.goto(server.PREFIX + '/index.html');
    await request1;
    await page.waitForTimeout(1000);
    const request2 = page.waitForEvent('requestfinished', req => req.url() === server.PREFIX + '/style.css');
    await page.goto(server.PREFIX + '/index.html');
    await request2;
    await page.waitForTimeout(1000);
    await page.locator('div').click();
  });
  const frame = await traceViewer.snapshotFrame('locator.click');
  await expect(frame.locator('body')).toHaveCSS('background-color', 'rgb(123, 123, 123)');
});

test('should pick locator in iframe', async ({ page, runAndTrace, server }) => {
  /*
    iframe[id=frame1]
      div Hello1
      iframe
        div Hello2
        iframe[name=one]
          div HelloNameOne
        iframe[name=two]
          dev HelloNameTwo
  */
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent(`<iframe id=frame1 srcdoc="<div>Hello1</div><iframe srcdoc='<div>Hello2</div><iframe name=one></iframe><iframe name=two></iframe><iframe></iframe>'>">`);
    const frameOne = page.frame({ name: 'one' });
    await frameOne.setContent(`<div>HelloNameOne</div>`);
    const frameTwo = page.frame({ name: 'two' });
    await frameTwo.setContent(`<div>HelloNameTwo</div>`);
    await page.evaluate('2+2');
  });
  await traceViewer.page.getByTitle('Pick locator').click();
  const cmWrapper = traceViewer.page.locator('.cm-wrapper');

  const snapshot = await traceViewer.snapshotFrame('page.evaluate');

  await snapshot.frameLocator('#frame1').getByText('Hello1').click();
  await expect.soft(cmWrapper).toContainText(`locator('#frame1').contentFrame().getByText('Hello1')`);

  await snapshot.frameLocator('#frame1').frameLocator('iframe').getByText('Hello2').click();
  await expect.soft(cmWrapper).toContainText(`locator('#frame1').contentFrame().locator('iframe').contentFrame().getByText('Hello2')`, { timeout: 0 });

  await snapshot.frameLocator('#frame1').frameLocator('iframe').frameLocator('[name=one]').getByText('HelloNameOne').click();
  await expect.soft(cmWrapper).toContainText(`locator('#frame1').contentFrame().locator('iframe').contentFrame().locator('iframe[name="one"]').contentFrame().getByText('HelloNameOne')`, { timeout: 0 });

  await snapshot.frameLocator('#frame1').frameLocator('iframe').frameLocator('[name=two]').getByText('HelloNameTwo').click();
  await expect.soft(cmWrapper).toContainText(`locator('#frame1').contentFrame().locator('iframe').contentFrame().locator('iframe[name="two"]').contentFrame().getByText('HelloNameTwo')`, { timeout: 0 });
});

test('should highlight locator in iframe while typing', async ({ page, runAndTrace, server, platform }) => {
  /*
    iframe[id=frame1]
      div Hello1
      iframe
        div Hello2
        iframe[name=one]
          div HelloNameOne
        iframe[name=two]
          dev HelloNameTwo
  */
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent(`<iframe id=frame1 srcdoc="<div>Hello1</div><iframe srcdoc='<div>Hello2</div><iframe name=one></iframe><iframe name=two></iframe><iframe></iframe>'>">`);
    const frameOne = page.frame({ name: 'one' });
    await frameOne.setContent(`<div>HelloNameOne</div>`);
    const frameTwo = page.frame({ name: 'two' });
    await frameTwo.setContent(`<div>HelloNameTwo</div>`);
    await page.evaluate('2+2');
  });

  const snapshot = await traceViewer.snapshotFrame('page.evaluate');
  await traceViewer.page.getByText('Locator').click();
  await traceViewer.page.locator('.CodeMirror').click();

  const locators = [{
    text: `locator('#frame1').contentFrame().getByText('Hello1')`,
    element: snapshot.frameLocator('#frame1').locator('div', { hasText: 'Hello1' }),
    highlight: snapshot.frameLocator('#frame1').locator('x-pw-highlight'),
  }, {
    text: `locator('#frame1').contentFrame().locator('iframe').contentFrame().getByText('Hello2')`,
    element: snapshot.frameLocator('#frame1').frameLocator('iframe').locator('div', { hasText: 'Hello2' }),
    highlight: snapshot.frameLocator('#frame1').frameLocator('iframe').locator('x-pw-highlight'),
  }, {
    text: `locator('#frame1').contentFrame().locator('iframe').contentFrame().locator('iframe[name="one"]').contentFrame().getByText('HelloNameOne')`,
    element: snapshot.frameLocator('#frame1').frameLocator('iframe').frameLocator('iframe[name="one"]').locator('div', { hasText: 'HelloNameOne' }),
    highlight: snapshot.frameLocator('#frame1').frameLocator('iframe').frameLocator('iframe[name="one"]').locator('x-pw-highlight'),
  }];

  for (const locator of locators) {
    if (platform === 'darwin')
      await traceViewer.page.keyboard.press('Meta+a');
    else
      await traceViewer.page.keyboard.press('Control+a');
    await traceViewer.page.keyboard.press('Backspace');
    await traceViewer.page.keyboard.type(locator.text);
    const elementBox = await locator.element.boundingBox();
    const highlightBox = await locator.highlight.boundingBox();
    expect(Math.abs(elementBox.width - highlightBox.width)).toBeLessThan(5);
    expect(Math.abs(elementBox.height - highlightBox.height)).toBeLessThan(5);
    expect(Math.abs(elementBox.x - highlightBox.x)).toBeLessThan(5);
    expect(Math.abs(elementBox.y - highlightBox.y)).toBeLessThan(5);
  }
});

test('should preserve noscript when javascript is disabled', async ({ browser, server, showTraceViewer }) => {
  const traceFile = test.info().outputPath('trace.zip');
  const page = await browser.newPage({ javaScriptEnabled: false });
  await page.context().tracing.start({ snapshots: true, screenshots: true, sources: true });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <body>
      <noscript>javascript is disabled!</noscript>
    </body>
  `);
  await page.context().tracing.stop({ path: traceFile });
  await page.close();

  const traceViewer = await showTraceViewer([traceFile]);
  const frame = await traceViewer.snapshotFrame('page.setContent');
  await expect(frame.getByText('javascript is disabled!')).toBeVisible();
});

test('should remove noscript by default', async ({ browser, server, showTraceViewer, browserType }) => {
  const traceFile = test.info().outputPath('trace.zip');
  const page = await browser.newPage({ javaScriptEnabled: undefined });
  await page.context().tracing.start({ snapshots: true, screenshots: true, sources: true });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
      <noscript>Enable JavaScript to run this app.</noscript>
      <div>Always visible</div>
    `);
  await page.context().tracing.stop({ path: traceFile });
  await page.close();

  const traceViewer = await showTraceViewer([traceFile]);
  const frame = await traceViewer.snapshotFrame('page.setContent');
  await expect(frame.getByText('Always visible')).toBeVisible();
  await expect(frame.getByText('Enable JavaScript to run this app.')).toBeHidden();
});

test('should remove noscript when javaScriptEnabled is set to true', async ({ browser, server, showTraceViewer, browserType }) => {
  const traceFile = test.info().outputPath('trace.zip');
  const page = await browser.newPage({ javaScriptEnabled: true });
  await page.context().tracing.start({ snapshots: true, screenshots: true, sources: true });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <noscript>Enable JavaScript to run this app.</noscript>
    <div>Always visible</div>
  `);
  await page.context().tracing.stop({ path: traceFile });
  await page.close();

  const traceViewer = await showTraceViewer([traceFile]);
  const frame = await traceViewer.snapshotFrame('page.setContent');
  await expect(frame.getByText('Always visible')).toBeVisible();
  await expect(frame.getByText('Enable JavaScript to run this app.')).toBeHidden();
});

test('should open snapshot in new browser context', async ({ browser, page, runAndTrace, server }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent('hello');
  });
  await traceViewer.snapshotFrame('page.setContent');
  const popupPromise = traceViewer.page.context().waitForEvent('page');
  await traceViewer.page.getByTitle('Open snapshot in a new tab').click();
  const popup = await popupPromise;

  // doesn't share sw.bundle.js
  const newPage = await browser.newPage();
  await newPage.goto(popup.url());
  await expect(newPage.getByText('hello')).toBeVisible();
  await newPage.close();
});

test('should show similar actions from library-only trace', async ({ showTraceViewer, asset }) => {
  const traceViewer = await showTraceViewer([asset('trace-library-1.46.zip')]);
  await expect(traceViewer.actionTitles).toHaveText([
    /page.setContent/,
    /locator.getAttributelocator\('div'\)/,
    /locator.isVisiblelocator\('div'\)/,
    /locator.getAttributelocator\('div'\)/,
    /locator.isVisiblelocator\('div'\)/,
  ]);
});

function parseMillis(s: string): number {
  const matchMs = s.match(/(\d+)ms/);
  if (matchMs)
    return +matchMs[1];
  const matchSeconds = s.match(/([\d.]+)s/);
  if (!matchSeconds)
    throw new Error('Failed to parse to millis: ' + s);
  return (+matchSeconds[1]) * 1000;
}

test('should show correct request start time', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31133' },
}, async ({ page, runAndTrace, server }) => {
  server.setRoute('/api', (req, res) => {
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('done');
    }, 1100);
  });
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.EMPTY_PAGE);
    await page.evaluate(() => {
      return fetch('/api').then(r => r.text());
    });
  });
  await traceViewer.selectAction('page.evaluate');
  await traceViewer.showNetworkTab();
  await expect(traceViewer.networkRequests).toContainText([/apiGET200text/]);
  const line = traceViewer.networkRequests.getByText(/apiGET200text/);
  const start = await line.locator('.grid-view-column-start').textContent();
  const duration =  await line.locator('.grid-view-column-duration').textContent();
  expect(parseMillis(duration)).toBeGreaterThan(1000);
  expect(parseMillis(start)).toBeLessThan(1000);
});

test('should not record route actions', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30970' },
}, async ({ page, runAndTrace, server }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.route('**/*', async route => {
      await route.fulfill({ contentType: 'text/html', body: 'Yo, page!' });
    });
    await page.goto(server.EMPTY_PAGE);
  });

  await expect(traceViewer.actionTitles).toHaveText([
    /page.route/,
    /page.goto.*empty.html/,
  ]);
});

test('should show baseURL in metadata pane', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31847' },
}, async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer([traceFile]);
  await traceViewer.selectAction('page.evaluate');
  await traceViewer.showMetadataTab();
  await expect(traceViewer.metadataTab).toContainText('baseURL:https://example.com');
});

test('should serve css without content-type', async ({ page, runAndTrace, server }) => {
  server.setRoute('/one-style.css', (req, res) => {
    res.writeHead(200);
    res.end(`body { background: red }`);
  });
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.PREFIX + '/one-style.html');
  });
  const snapshotFrame = await traceViewer.snapshotFrame('page.goto');
  await expect(snapshotFrame.locator('body')).toHaveCSS('background-color', 'rgb(255, 0, 0)', { timeout: 0 });
});

test('should allow showing screenshots instead of snapshots', async ({ runAndTrace, page, server }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.PREFIX + '/one-style.html');
    await page.waitForTimeout(1000); // ensure we could take a screenshot
  });

  const screenshot = traceViewer.page.getByAltText(`Screenshot of page.goto > Action`);
  const snapshot = (await traceViewer.snapshotFrame('page.goto')).owner();
  await expect(snapshot).toBeVisible();
  await expect(screenshot).not.toBeVisible();

  await traceViewer.page.getByTitle('Settings').click();
  await traceViewer.page.getByText('Show screenshot instead of snapshot').setChecked(true);

  await expect(snapshot).not.toBeVisible();
  await expect(screenshot).toBeVisible();
});

test('should handle case where neither snapshots nor screenshots exist', async ({ runAndTrace, page, server }) => {
  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.PREFIX + '/one-style.html');
  }, { snapshots: false, screenshots: false });

  await traceViewer.page.getByTitle('Settings').click();
  await traceViewer.page.getByText('Show screenshot instead of snapshot').setChecked(true);

  const screenshot = traceViewer.page.getByAltText(`Screenshot of page.goto > Action`);
  await expect(screenshot).not.toBeVisible();
});

test('should show only one pointer with multilevel iframes', async ({ page, runAndTrace, server, browserName }) => {
  test.fixme(browserName !== 'chromium', 'Elements in iframe are not marked');

  server.setRoute('/level-0.html', (req, res) => {
    res.writeHead(200);
    res.end(`<iframe src="/level-1.html" style="position: absolute; left: 100px"></iframe>`);
  });
  server.setRoute('/level-1.html', (req, res) => {
    res.writeHead(200);
    res.end(`<iframe src="/level-2.html"></iframe>`);
  });
  server.setRoute('/level-2.html', (req, res) => {
    res.writeHead(200);
    res.end(`<button>Click me</button>`);
  });

  const traceViewer = await runAndTrace(async () => {
    await page.goto(server.PREFIX + '/level-0.html');
    await page.frameLocator('iframe').frameLocator('iframe').locator('button').click({ position: { x: 5, y: 5 } });
  });
  const snapshotFrame = await traceViewer.snapshotFrame('locator.click');
  await expect.soft(snapshotFrame.locator('x-pw-pointer')).not.toBeAttached();
  await expect.soft(snapshotFrame.frameLocator('iframe').locator('x-pw-pointer')).not.toBeAttached();
  await expect.soft(snapshotFrame.frameLocator('iframe').frameLocator('iframe').locator('x-pw-pointer')).toBeVisible();
});
