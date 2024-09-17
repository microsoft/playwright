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
import { jpegjs } from 'playwright-core/lib/utilsBundle';
import path from 'path';
import { browserTest, contextTest as test, expect } from '../config/browserTest';
import { parseTraceRaw } from '../config/utils';
import type { StackFrame } from '@protocol/channels';
import type { ActionTraceEvent } from '../../packages/trace/src/trace';
import { artifactsFolderName } from '../../packages/playwright/src/isomorphic/folders';

test.skip(({ trace }) => trace === 'on');

test('should collect trace with resources, but no js', async ({ context, page, server, asset }, testInfo) => {
  await context.tracing.start({ screenshots: true, snapshots: true });
  await page.goto(server.PREFIX + '/frames/frame.html');
  await page.setContent('<button>Click</button>');
  await page.click('"Click"');
  await page.mouse.move(20, 20);
  await page.mouse.dblclick(30, 30);
  await page.keyboard.insertText('abc');
  await page.goto(server.PREFIX + '/input/fileupload.html');
  await page.locator('input[type="file"]').setInputFiles(asset('file-to-upload.txt'));
  await page.waitForTimeout(2000);  // Give it some time to produce screenshots.
  await page.close();
  await context.tracing.stop({ path: testInfo.outputPath('trace.zip') });

  const { events, actions } = await parseTraceRaw(testInfo.outputPath('trace.zip'));
  expect(events[0].type).toBe('context-options');
  expect(actions).toEqual([
    'page.goto',
    'page.setContent',
    'page.click',
    'mouse.move',
    'mouse.dblclick',
    'keyboard.insertText',
    'page.goto',
    'locator.setInputFiles',
    'page.waitForTimeout',
    'page.close',
  ]);

  expect(events.some(e => e.type === 'frame-snapshot')).toBeTruthy();
  expect(events.some(e => e.type === 'screencast-frame')).toBeTruthy();
  const style = events.find(e => e.type === 'resource-snapshot' && e.snapshot.request.url.endsWith('style.css'));
  expect(style).toBeTruthy();
  expect(style.snapshot.response.content._sha1).toBeTruthy();
  const script = events.find(e => e.type === 'resource-snapshot' && e.snapshot.request.url.endsWith('script.js'));
  expect(script).toBeTruthy();
  expect(script.snapshot.response.content._sha1).toBe(undefined);
});

test('should use the correct apiName for event driven callbacks', async ({ context, page, server }, testInfo) => {
  await context.tracing.start();
  await page.route('**/empty.html', route => route.continue());
  // page.goto -> page.route should be included in the trace since its handled.
  await page.goto(server.PREFIX + '/empty.html');
  // page.route -> internalContinue should not be included in the trace since it was handled by Playwright internally.
  await page.goto(server.PREFIX + '/grid.html');

  // The default internal dialog handler should not provide an action.
  await page.evaluate(() => alert('yo'));
  await page.reload();
  // now we do it again with a dialog event listener attached which should produce an action.
  page.on('dialog', dialog => {
    void dialog.accept('answer!');
  });
  await page.evaluate(() => alert('yo'));

  await context.tracing.stop({ path: testInfo.outputPath('trace.zip') });
  const { events, actions } = await parseTraceRaw(testInfo.outputPath('trace.zip'));
  expect(events[0].type).toBe('context-options');
  expect(actions).toEqual([
    'page.route',
    'page.goto',
    'route.continue',
    'page.goto',
    'page.evaluate',
    'page.reload',
    'page.evaluate',
    'dialog.accept',
  ]);
});

test('should not collect snapshots by default', async ({ context, page, server }, testInfo) => {
  await context.tracing.start();
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<button>Click</button>');
  await page.click('"Click"');
  await page.close();
  await context.tracing.stop({ path: testInfo.outputPath('trace.zip') });

  const { events } = await parseTraceRaw(testInfo.outputPath('trace.zip'));
  expect(events.some(e => e.type === 'frame-snapshot')).toBeFalsy();
  expect(events.some(e => e.type === 'resource-snapshot')).toBeFalsy();
});

test('should not include buffers in the trace', async ({ context, page, server }, testInfo) => {
  await context.tracing.start({ snapshots: true });
  await page.goto(server.PREFIX + '/empty.html');
  await page.screenshot();
  await context.tracing.stop({ path: testInfo.outputPath('trace.zip') });
  const { actionObjects } = await parseTraceRaw(testInfo.outputPath('trace.zip'));
  const screenshotEvent = actionObjects.find(a => a.apiName === 'page.screenshot');
  expect(screenshotEvent.beforeSnapshot).toBeTruthy();
  expect(screenshotEvent.afterSnapshot).toBeTruthy();
  expect(screenshotEvent.result).toEqual({
    'binary': '<Buffer>',
  });
});

test('should exclude internal pages', async ({ browserName, context, page, server }, testInfo) => {
  await page.goto(server.EMPTY_PAGE);

  await context.tracing.start();
  await context.storageState();
  await page.close();
  await context.tracing.stop({ path: testInfo.outputPath('trace.zip') });

  const trace = await parseTraceRaw(testInfo.outputPath('trace.zip'));
  const pageIds = new Set();
  trace.events.forEach(e => {
    const pageId = e.pageId;
    if (pageId)
      pageIds.add(pageId);
  });
  expect(pageIds.size).toBe(1);
});

test('should include context API requests', async ({ browserName, context, page, server }, testInfo) => {
  await context.tracing.start({ snapshots: true });
  await page.request.post(server.PREFIX + '/simple.json', { data: { foo: 'bar' } });
  await context.tracing.stop({ path: testInfo.outputPath('trace.zip') });
  const { events } = await parseTraceRaw(testInfo.outputPath('trace.zip'));
  const postEvent = events.find(e => e.apiName === 'apiRequestContext.post');
  expect(postEvent).toBeTruthy();
  const harEntry = events.find(e => e.type === 'resource-snapshot');
  expect(harEntry).toBeTruthy();
  expect(harEntry.snapshot.request.url).toBe(server.PREFIX + '/simple.json');
  expect(harEntry.snapshot.response.status).toBe(200);
});

test('should collect two traces', async ({ context, page, server }, testInfo) => {
  await context.tracing.start({ screenshots: true, snapshots: true });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<button>Click</button>');
  await page.click('"Click"');
  await context.tracing.stop({ path: testInfo.outputPath('trace1.zip') });

  await context.tracing.start({ screenshots: true, snapshots: true });
  await page.dblclick('"Click"');
  await page.close();
  await context.tracing.stop({ path: testInfo.outputPath('trace2.zip') });

  {
    const { events, actions } = await parseTraceRaw(testInfo.outputPath('trace1.zip'));
    expect(events[0].type).toBe('context-options');
    expect(actions).toEqual([
      'page.goto',
      'page.setContent',
      'page.click',
    ]);
  }

  {
    const { events, actions } = await parseTraceRaw(testInfo.outputPath('trace2.zip'));
    expect(events[0].type).toBe('context-options');
    expect(actions).toEqual([
      'page.dblclick',
      'page.close',
    ]);
  }
});

test('should respect tracesDir and name', async ({ browserType, server, mode }, testInfo) => {
  test.skip(mode.startsWith('service'), 'Service ignores tracesDir');

  const tracesDir = testInfo.outputPath('traces');
  const browser = await browserType.launch({ tracesDir });
  const context = await browser.newContext();
  const page = await context.newPage();

  await context.tracing.start({ name: 'name1', snapshots: true });
  await page.goto(server.PREFIX + '/one-style.html');
  await context.tracing.stopChunk({ path: testInfo.outputPath('trace1.zip') });
  expect(fs.existsSync(path.join(tracesDir, 'name1.trace'))).toBe(true);
  expect(fs.existsSync(path.join(tracesDir, 'name1.network'))).toBe(true);

  await context.tracing.startChunk({ name: 'name2' });
  await page.goto(server.PREFIX + '/har.html');
  await context.tracing.stop({ path: testInfo.outputPath('trace2.zip') });
  expect(fs.existsSync(path.join(tracesDir, 'name2.trace'))).toBe(true);
  expect(fs.existsSync(path.join(tracesDir, 'name2.network'))).toBe(true);

  await browser.close();

  function resourceNames(resources: Map<string, Buffer>) {
    return [...resources.keys()].map(file => {
      return file.replace(/^resources\/.*\.(html|css)$/, 'resources/XXX.$1');
    }).sort();
  }

  {
    const { resources, actions } = await parseTraceRaw(testInfo.outputPath('trace1.zip'));
    expect(actions).toEqual(['page.goto']);
    expect(resourceNames(resources)).toEqual([
      'resources/XXX.css',
      'resources/XXX.html',
      'trace.network',
      'trace.stacks',
      'trace.trace',
    ]);
  }

  {
    const { resources, actions } = await parseTraceRaw(testInfo.outputPath('trace2.zip'));
    expect(actions).toEqual(['page.goto']);
    expect(resourceNames(resources)).toEqual([
      'resources/XXX.css',
      'resources/XXX.html',
      'resources/XXX.html',
      'trace.network',
      'trace.stacks',
      'trace.trace',
    ]);
  }
});

test('should not include trace resources from the previous chunks', async ({ context, page, server, browserName, mode }, testInfo) => {
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  await context.tracing.startChunk();
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <style>
      @keyframes move {
        from { marign-left: 0; }
        to   { margin-left: 1000px; }
      }
      button {
        animation: 20s linear move;
        animation-iteration-count: infinite;
      }
    </style>
    <button>Click</button>
  `);
  await page.click('"Click"', { force: true });
  // Give it enough time for both screenshots to get into the trace.
  await new Promise(f => setTimeout(f, 3000));
  await context.tracing.stopChunk({ path: testInfo.outputPath('trace1.zip') });

  await context.tracing.startChunk();
  await context.tracing.stopChunk({ path: testInfo.outputPath('trace2.zip') });

  let jpegs: string[] = [];
  {
    const { resources } = await parseTraceRaw(testInfo.outputPath('trace1.zip'));
    const names = Array.from(resources.keys());
    expect(names.filter(n => n.endsWith('.html')).length).toBe(1);
    jpegs = names.filter(n => n.endsWith('.jpeg'));
    expect(jpegs.length).toBeGreaterThan(0);
    // 1 source file for the test.
    expect(names.filter(n => n.endsWith('.txt')).length).toBe(1);
  }

  {
    const { resources } = await parseTraceRaw(testInfo.outputPath('trace2.zip'));
    const names = Array.from(resources.keys());
    // 1 network resource should be preserved.
    expect(names.filter(n => n.endsWith('.html')).length).toBe(1);
    // screenshots from the previous chunk should not be preserved.
    expect(names.filter(n => jpegs.includes(n)).length).toBe(0);
    // 0 source files for the second test.
    expect(names.filter(n => n.endsWith('.txt')).length).toBe(0);
  }
});

test('should overwrite existing file', async ({ context, page, server }, testInfo) => {
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<button>Click</button>');
  await page.click('"Click"');
  const path = testInfo.outputPath('trace1.zip');
  await context.tracing.stop({ path });
  {
    const { resources } = await parseTraceRaw(path);
    const names = Array.from(resources.keys());
    expect(names.filter(n => n.endsWith('.html')).length).toBe(1);
  }

  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  await context.tracing.stop({ path });

  {
    const { resources } = await parseTraceRaw(path);
    const names = Array.from(resources.keys());
    expect(names.filter(n => n.endsWith('.html')).length).toBe(0);
  }
});

test('should collect sources', async ({ context, page, server }, testInfo) => {
  await context.tracing.start({ sources: true });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<button>Click</button>');
  await page.click('"Click"');
  await context.tracing.stop({ path: testInfo.outputPath('trace1.zip') });

  const { resources } = await parseTraceRaw(testInfo.outputPath('trace1.zip'));
  const sourceNames = Array.from(resources.keys()).filter(k => k.endsWith('.txt'));
  expect(sourceNames.length).toBe(1);
  const sourceFile = resources.get(sourceNames[0]);
  const thisFile = await fs.promises.readFile(__filename);
  expect(sourceFile).toEqual(thisFile);
});

test('should record network failures', async ({ context, page, server }, testInfo) => {
  await context.tracing.start({ snapshots: true });
  await page.route('**/*', route => route.abort('connectionaborted'));
  await page.goto(server.EMPTY_PAGE).catch(e => {});
  await context.tracing.stop({ path: testInfo.outputPath('trace1.zip') });

  const { events } = await parseTraceRaw(testInfo.outputPath('trace1.zip'));
  const requestEvent = events.find(e => e.type === 'resource-snapshot' && !!e.snapshot.response._failureText);
  expect(requestEvent).toBeTruthy();
});

test('should not crash when browser closes mid-trace', async ({ browserType, server }, testInfo) => {
  const browser = await browserType.launch();
  const page = await browser.newPage();
  await page.context().tracing.start({ snapshots: true, screenshots: true });
  await page.goto(server.EMPTY_PAGE);
  await browser.close();
  await new Promise(f => setTimeout(f, 1000));  // Give it some time to throw errors
});

test('should survive browser.close with auto-created traces dir', async ({ browserType }, testInfo) => {
  const oldTracesDir = (browserType as any)._defaultLaunchOptions.tracesDir;
  (browserType as any)._defaultLaunchOptions.tracesDir = undefined;
  const browser = await browserType.launch();
  const page = await browser.newPage();
  await page.context().tracing.start();

  const done = { value: false };
  async function go() {
    while (!done.value) {
      // Produce a lot of operations to make sure tracing operations are enqueued.
      for (let i = 0; i < 100; i++)
        page.evaluate('1 + 1').catch(() => {});
      await new Promise(f => setTimeout(f, 250));
    }
  }

  void go();
  await new Promise(f => setTimeout(f, 1000));

  // Close the browser and give it some time to fail.
  await Promise.all([
    browser.close(),
    new Promise(f => setTimeout(f, 500)),
  ]);

  done.value = true;
  (browserType as any)._defaultLaunchOptions.tracesDir = oldTracesDir;
});

test('should not stall on dialogs', async ({ page, context, server }) => {
  await context.tracing.start({ screenshots: true, snapshots: true });
  await page.goto(server.EMPTY_PAGE);

  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  await page.evaluate(() => {
    confirm('are you sure');
  });
  await context.tracing.stop();
});


for (const params of [
  {
    id: 'fit',
    width: 500,
    height: 500,
  },
  {
    id: 'crop',
    width: 400, // Less than 450 to test firefox
    height: 800,
  },
  {
    id: 'scale',
    width: 1024,
    height: 768,
  }
]) {
  browserTest(`should produce screencast frames ${params.id}`, async ({ video, contextFactory, browserName, platform, headless }, testInfo) => {
    browserTest.skip(browserName === 'chromium' && video === 'on', 'Same screencast resolution conflicts');
    browserTest.fixme(browserName === 'chromium' && (!headless || !!process.env.PLAYWRIGHT_CHROMIUM_USE_HEADLESS_NEW), 'Chromium screencast on headed has a min width issue');
    browserTest.fixme(params.id === 'fit' && browserName === 'chromium' && platform === 'darwin', 'High DPI maxes image at 600x600');
    browserTest.fixme(params.id === 'fit' && browserName === 'webkit' && platform === 'linux', 'Image size is flaky');
    browserTest.fixme(browserName === 'firefox' && !headless, 'Image size is different');

    const scale = Math.min(800 / params.width, 600 / params.height, 1);
    const previewWidth = params.width * scale;
    const previewHeight = params.height * scale;

    const context = await contextFactory({ viewport: { width: params.width, height: params.height } });
    await context.tracing.start({ screenshots: true, snapshots: true });
    const page = await context.newPage();
    // Make sure we have a chance to paint.
    for (let i = 0; i < 10; ++i) {
      await page.setContent('<body style="box-sizing: border-box; width: 100%; height: 100%; margin:0; background: red; border: 50px solid blue"></body>');
      await page.evaluate(() => new Promise(window.builtinRequestAnimationFrame));
    }
    await context.tracing.stop({ path: testInfo.outputPath('trace.zip') });

    const { events, resources } = await parseTraceRaw(testInfo.outputPath('trace.zip'));
    const frames = events.filter(e => e.type === 'screencast-frame');

    // Check all frame sizes.
    for (const frame of frames) {
      expect(frame.width).toBe(params.width);
      expect(frame.height).toBe(params.height);
      const buffer = resources.get('resources/' + frame.sha1);
      const image = jpegjs.decode(buffer);
      expect(image.width).toBe(previewWidth);
      expect(image.height).toBe(previewHeight);
    }

    const frame = frames[frames.length - 1]; // pick last frame.
    const buffer = resources.get('resources/' + frame.sha1);
    const image = jpegjs.decode(buffer);
    expect(image.data.byteLength).toBe(previewWidth * previewHeight * 4);
    expectRed(image.data, previewWidth * previewHeight * 4 / 2 + previewWidth * 4 / 2); // center is red
    expectBlue(image.data, previewWidth * 5 * 4 + previewWidth * 4 / 2); // top
    expectBlue(image.data, previewWidth * (previewHeight - 5) * 4 + previewWidth * 4 / 2); // bottom
    expectBlue(image.data, previewWidth * previewHeight * 4 / 2 + 5 * 4); // left
    expectBlue(image.data, previewWidth * previewHeight * 4 / 2 + (previewWidth - 5) * 4); // right
  });
}

test('should include interrupted actions', async ({ context, page, server }, testInfo) => {
  await context.tracing.start({ screenshots: true, snapshots: true });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<button>Click</button>');
  page.click('"ClickNoButton"').catch(() =>  {});
  await context.tracing.stop({ path: testInfo.outputPath('trace.zip') });
  await context.close();

  const { events } = await parseTraceRaw(testInfo.outputPath('trace.zip'));
  const clickEvent = events.find(e => e.apiName === 'page.click');
  expect(clickEvent).toBeTruthy();
});

test('should throw when starting with different options', async ({ context }) => {
  await context.tracing.start({ screenshots: true, snapshots: true });
  const error = await context.tracing.start({ screenshots: false, snapshots: false }).catch(e => e);
  expect(error.message).toContain('Tracing has been already started');
});

test('should throw when stopping without start', async ({ context }, testInfo) => {
  const error = await context.tracing.stop({ path: testInfo.outputPath('trace.zip') }).catch(e => e);
  expect(error.message).toContain('Must start tracing before stopping');
});

test('should not throw when stopping without start but not exporting', async ({ context }, testInfo) => {
  await context.tracing.stop();
});

test('should work with multiple chunks', async ({ context, page, server }, testInfo) => {
  await context.tracing.start({ screenshots: true, snapshots: true });
  await page.goto(server.PREFIX + '/frames/frame.html');

  await context.tracing.startChunk();
  await page.setContent('<button>Click</button>');
  await page.click('"Click"');
  page.click('"ClickNoButton"', { timeout: 0 }).catch(() =>  {});
  await page.evaluate(() => {});
  await context.tracing.stopChunk({ path: testInfo.outputPath('trace.zip') });

  await context.tracing.startChunk();
  await page.hover('"Click"');
  await context.tracing.stopChunk({ path: testInfo.outputPath('trace2.zip') });

  await context.tracing.startChunk();
  await page.click('"Click"');
  await context.tracing.stopChunk();  // Should stop without a path.

  const trace1 = await parseTraceRaw(testInfo.outputPath('trace.zip'));
  expect(trace1.events[0].type).toBe('context-options');
  expect(trace1.actions).toEqual([
    'page.setContent',
    'page.click',
    'page.click',
    'page.evaluate',
  ]);
  expect(trace1.events.some(e => e.type === 'frame-snapshot')).toBeTruthy();
  expect(trace1.events.some(e => e.type === 'resource-snapshot' && e.snapshot.request.url.endsWith('style.css'))).toBeTruthy();

  const trace2 = await parseTraceRaw(testInfo.outputPath('trace2.zip'));
  expect(trace2.events[0].type).toBe('context-options');
  expect(trace2.actions).toEqual([
    'page.hover',
  ]);
  expect(trace2.events.some(e => e.type === 'frame-snapshot')).toBeTruthy();
  expect(trace2.events.some(e => e.type === 'resource-snapshot' && e.snapshot.request.url.endsWith('style.css'))).toBeTruthy();
});

test('should export trace concurrently to second navigation', async ({ context, page, server }, testInfo) => {
  for (let timeout = 0; timeout < 200; timeout += 20) {
    await context.tracing.start({ screenshots: true, snapshots: true });
    await page.goto(server.PREFIX + '/grid.html');

    // Navigate to the same page to produce the same trace resources
    // that might be concurrently exported.
    const promise = page.goto(server.PREFIX + '/grid.html');
    await page.waitForTimeout(timeout);
    await Promise.all([
      promise,
      context.tracing.stop({ path: testInfo.outputPath('trace.zip') }),
    ]);
  }
});

test('should not hang for clicks that open dialogs', async ({ context, page }) => {
  await context.tracing.start({ screenshots: true, snapshots: true });
  const dialogPromise = page.waitForEvent('dialog');
  await page.setContent(`<div onclick='window.alert(123)'>Click me</div>`);
  await page.click('div', { timeout: 2000 }).catch(() => {});
  const dialog = await dialogPromise;
  await dialog.dismiss();
  await context.tracing.stop();
});

test('should ignore iframes in head', async ({ context, page, server }, testInfo) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.evaluate(() => {
    document.head.appendChild(document.createElement('iframe'));
    // Add iframe in a shadow tree.
    const div = document.createElement('div');
    document.head.appendChild(div);
    const shadow = div.attachShadow({ mode: 'open' });
    shadow.appendChild(document.createElement('iframe'));
  });

  await context.tracing.start({ screenshots: true, snapshots: true });
  await page.click('button');
  await context.tracing.stopChunk({ path: testInfo.outputPath('trace.zip') });

  const trace = await parseTraceRaw(testInfo.outputPath('trace.zip'));
  expect(trace.actions).toEqual([
    'page.click',
  ]);
  expect(trace.events.find(e => e.type === 'frame-snapshot')).toBeTruthy();
  expect(trace.events.find(e => e.type === 'frame-snapshot' && JSON.stringify(e.snapshot.html).includes('IFRAME'))).toBeFalsy();
});

test('should hide internal stack frames', async ({ context, page }, testInfo) => {
  await context.tracing.start({ screenshots: true, snapshots: true });
  let evalPromise;
  page.on('dialog', dialog => {
    evalPromise = page.evaluate('2+2');
    void dialog.dismiss();
  });
  await page.setContent(`<div onclick='window.alert(123)'>Click me</div>`);
  await page.click('div');
  await evalPromise;
  const tracePath = testInfo.outputPath('trace.zip');
  await context.tracing.stop({ path: tracePath });

  const trace = await parseTraceRaw(tracePath);
  const actions = trace.actionObjects.filter(a => !a.apiName.startsWith('tracing.'));
  expect(actions).toHaveLength(4);
  for (const action of actions)
    expect(relativeStack(action, trace.stacks)).toEqual(['tracing.spec.ts']);
});

test('should hide internal stack frames in expect', async ({ context, page }, testInfo) => {
  await context.tracing.start({ screenshots: true, snapshots: true });
  let expectPromise;
  page.on('dialog', dialog => {
    expectPromise = expect(page).toHaveTitle('Hello');
    void dialog.dismiss();
  });
  await page.setContent(`<title>Hello</title><div onclick='window.alert(123)'>Click me</div>`);
  await page.click('div');
  await expect(page.locator('div')).toBeVisible();
  await expectPromise;
  const tracePath = testInfo.outputPath('trace.zip');
  await context.tracing.stop({ path: tracePath });

  const trace = await parseTraceRaw(tracePath);
  const actions = trace.actionObjects.filter(a => !a.apiName.startsWith('tracing.'));
  expect(actions).toHaveLength(5);
  for (const action of actions)
    expect(relativeStack(action, trace.stacks)).toEqual(['tracing.spec.ts']);
});

test('should record global request trace', async ({ request, context, server }, testInfo) => {
  await (request as any)._tracing.start({ snapshots: true });
  const url = server.PREFIX + '/simple.json';
  await request.get(url);
  const tracePath = testInfo.outputPath('trace.zip');
  await (request as any)._tracing.stop({ path: tracePath });

  const trace = await parseTraceRaw(tracePath);
  const actions = trace.events.filter(e => e.type === 'resource-snapshot');
  expect(actions).toHaveLength(1);
  expect(actions[0].snapshot.request).toEqual(expect.objectContaining({
    method: 'GET',
    url
  }));
  expect(actions[0].snapshot.response).toEqual(expect.objectContaining({
    status: 200,
    statusText: 'OK',
    headers: expect.arrayContaining([
      expect.objectContaining({
        'name': 'Content-Length',
        'value': '15'
      })
    ])
  }));
});

test('should store global request traces separately', async ({ request, server, playwright, browserName, mode }, testInfo) => {
  const request2 = await playwright.request.newContext();
  await Promise.all([
    (request as any)._tracing.start({ snapshots: true }),
    (request2 as any)._tracing.start({ snapshots: true })
  ]);
  const url = server.PREFIX + '/simple.json';
  await Promise.all([
    request.get(url),
    request2.post(url)
  ]);
  const tracePath = testInfo.outputPath('trace.zip');
  const trace2Path = testInfo.outputPath('trace2.zip');
  await Promise.all([
    (request as any)._tracing.stop({ path: tracePath }),
    (request2 as any)._tracing.stop({ path: trace2Path })
  ]);
  {
    const trace = await parseTraceRaw(tracePath);
    const actions = trace.events.filter(e => e.type === 'resource-snapshot');
    expect(actions).toHaveLength(1);
    expect(actions[0].snapshot.request).toEqual(expect.objectContaining({
      method: 'GET',
      url
    }));
  }
  {
    const trace = await parseTraceRaw(trace2Path);
    const actions = trace.events.filter(e => e.type === 'resource-snapshot');
    expect(actions).toHaveLength(1);
    expect(actions[0].snapshot.request).toEqual(expect.objectContaining({
      method: 'POST',
      url
    }));
  }
});

test('should store postData for global request', async ({ request, server }, testInfo) => {
  testInfo.annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/15031' });
  await (request as any)._tracing.start({ snapshots: true });
  const url = server.PREFIX + '/simple.json';
  await request.post(url, {
    data: 'test'
  });
  const tracePath = testInfo.outputPath('trace.zip');
  await (request as any)._tracing.stop({ path: tracePath });

  const trace = await parseTraceRaw(tracePath);
  const actions = trace.events.filter(e => e.type === 'resource-snapshot');
  expect(actions).toHaveLength(1);
  const req = actions[0].snapshot.request;
  expect(req.postData?._sha1).toBeTruthy();
  expect(req).toEqual(expect.objectContaining({
    method: 'POST',
    url
  }));
});

test('should not flush console events', async ({ context, page, mode }, testInfo) => {
  test.skip(mode.startsWith('service'), 'Uses artifactsFolderName');
  const testId = test.info().testId;
  await context.tracing.start({ name: testId });
  const promise = new Promise<void>(f => {
    let counter = 0;
    page.on('console', () => {
      if (++counter === 100)
        f();
    });
  });

  await page.evaluate(() => {
    window.builtinSetTimeout(() => {
      for (let i = 0; i < 100; ++i)
        console.log('hello ' + i);
    }, 10);
    return 31415926;
  });

  await promise;

  const dir = path.join(testInfo.project.outputDir, artifactsFolderName(testInfo.workerIndex), 'traces');

  let content: string;
  await expect(async () => {
    const traceName = fs.readdirSync(dir).find(name => name.endsWith(testId + '.trace'));
    content = await fs.promises.readFile(path.join(dir, traceName), 'utf8');
    expect(content).toContain('page.evaluate');
    expect(content).toContain('31415926');
  }).toPass();
  expect(content).not.toContain('hello 0');

  await page.evaluate(() => 42);

  await expect(async () => {
    const traceName = fs.readdirSync(dir).find(name => name.endsWith(testId + '.trace'));
    const content = await fs.promises.readFile(path.join(dir, traceName), 'utf8');
    expect(content).toContain('hello 0');
    expect(content).toContain('hello 99');
  }).toPass();
});

test('should flush console events on tracing stop', async ({ context, page }, testInfo) => {
  await context.tracing.start();
  const promise = new Promise<void>(f => {
    let counter = 0;
    page.on('console', () => {
      if (++counter === 100)
        f();
    });
  });
  await page.evaluate(() => {
    window.builtinSetTimeout(() => {
      for (let i = 0; i < 100; ++i)
        console.log('hello ' + i);
    });
  });
  await promise;
  const tracePath = testInfo.outputPath('trace.zip');
  await context.tracing.stop({ path: tracePath });
  const trace = await parseTraceRaw(tracePath);
  const events = trace.events.filter(e => e.type === 'console');
  expect(events).toHaveLength(100);
});

test('should not emit after w/o before', async ({ browserType, mode }, testInfo) => {
  test.skip(mode.startsWith('service'), 'Service ignores tracesDir');

  const tracesDir = testInfo.outputPath('traces');
  const browser = await browserType.launch({ tracesDir });
  const context = await browser.newContext();
  const page = await context.newPage();

  await context.tracing.start({ name: 'name1', snapshots: true });
  const evaluatePromise = page.evaluate(() => {
    console.log('started');
    return new Promise(f => (window as any).callback = f);
  }).catch(() => {});
  await page.waitForEvent('console');
  await context.tracing.stopChunk({ path: testInfo.outputPath('trace1.zip') });
  expect(fs.existsSync(path.join(tracesDir, 'name1.trace'))).toBe(true);

  await context.tracing.startChunk({ name: 'name2' });
  await page.evaluateHandle(() => (window as any).callback());
  await evaluatePromise;
  await context.tracing.stop({ path: testInfo.outputPath('trace2.zip') });
  expect(fs.existsSync(path.join(tracesDir, 'name2.trace'))).toBe(true);

  await browser.close();
  let minCallId = 100000;
  const sanitize = (e: any) => {
    if (e.type === 'after' || e.type === 'before') {
      minCallId = Math.min(minCallId, +e.callId.split('@')[1]);
      return {
        type: e.type,
        callId: +e.callId.split('@')[1] - minCallId,
        apiName: e.apiName,
      };
    }
  };

  let call1: number;
  {
    const { events } = await parseTraceRaw(testInfo.outputPath('trace1.zip'));
    const sanitized = events.map(sanitize).filter(Boolean);
    expect(sanitized).toEqual([
      {
        type: 'before',
        callId: expect.any(Number),
        apiName: 'page.evaluate'
      },
      {
        type: 'before',
        callId: expect.any(Number),
        apiName: 'page.waitForEvent'
      },
      {
        type: 'after',
        callId: expect.any(Number),
        apiName: undefined,
      },
    ]);
    call1 = sanitized[0].callId;
    expect(sanitized[1].callId).toBe(sanitized[2].callId);
  }

  let call2before: number;
  let call2after: number;
  {
    const { events } = await parseTraceRaw(testInfo.outputPath('trace2.zip'));
    const sanitized = events.map(sanitize).filter(Boolean);
    expect(sanitized).toEqual([
      {
        type: 'before',
        callId: expect.any(Number),
        apiName: 'page.evaluateHandle'
      },
      {
        type: 'after',
        callId: expect.any(Number),
        apiName: undefined
      }
    ]);
    call2before = sanitized[0].callId;
    call2after = sanitized[1].callId;
  }
  expect(call2before).toBeGreaterThan(call1);
  expect(call2after).toBe(call2before);
});

function expectRed(pixels: Buffer, offset: number) {
  const r = pixels.readUInt8(offset);
  const g = pixels.readUInt8(offset + 1);
  const b = pixels.readUInt8(offset + 2);
  const a = pixels.readUInt8(offset + 3);
  expect(r).toBeGreaterThan(200);
  expect(g).toBeLessThan(70);
  expect(b).toBeLessThan(70);
  expect(a).toBe(255);
}

function expectBlue(pixels: Buffer, offset: number) {
  const r = pixels.readUInt8(offset);
  const g = pixels.readUInt8(offset + 1);
  const b = pixels.readUInt8(offset + 2);
  const a = pixels.readUInt8(offset + 3);
  expect(r).toBeLessThan(70);
  expect(g).toBeLessThan(70);
  expect(b).toBeGreaterThan(200);
  expect(a).toBe(255);
}

function relativeStack(action: ActionTraceEvent, stacks: Map<string, StackFrame[]>): string[] {
  const stack = stacks.get(action.callId) || [];
  return stack.map(f => f.file.replace(__dirname + path.sep, ''));
}
