/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test as it, expect } from './pageTest';
import { attachFrame, detachFrame } from '../config/utils';

it('should have different execution contexts', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  expect(page.frames().length).toBe(2);
  await page.frames()[0].evaluate(() => window['FOO'] = 'foo');
  await page.frames()[1].evaluate(() => window['FOO'] = 'bar');
  expect(await page.frames()[0].evaluate(() => window['FOO'])).toBe('foo');
  expect(await page.frames()[1].evaluate(() => window['FOO'])).toBe('bar');
});

it('should have correct execution contexts @smoke', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/frames/one-frame.html');
  expect(page.frames().length).toBe(2);
  expect(await page.frames()[0].evaluate(() => document.body.textContent.trim())).toBe('');
  expect(await page.frames()[1].evaluate(() => document.body.textContent.trim())).toBe(`Hi, I'm frame`);
});

function expectContexts(pageImpl, count, browserName) {
  if (browserName === 'chromium')
    expect(pageImpl.delegate._mainFrameSession._contextIdToContext.size).toBe(count);
  else
    expect(pageImpl.delegate._contextIdToContext.size).toBe(count);
}

it('should dispose context on navigation', async ({ page, server, toImpl, browserName, isElectron }) => {
  it.skip(isElectron);

  await page.goto(server.PREFIX + '/frames/one-frame.html');
  expect(page.frames().length).toBe(2);
  expectContexts(toImpl(page), 4, browserName);
  await page.goto(server.EMPTY_PAGE);
  expectContexts(toImpl(page), 2, browserName);
});

it('should dispose context on cross-origin navigation', async ({ page, server, toImpl, browserName, isElectron }) => {
  it.skip(isElectron);

  await page.goto(server.PREFIX + '/frames/one-frame.html');
  expect(page.frames().length).toBe(2);
  expectContexts(toImpl(page), 4, browserName);
  await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
  expectContexts(toImpl(page), 2, browserName);
});

it('should execute after cross-site navigation', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const mainFrame = page.mainFrame();
  expect(await mainFrame.evaluate(() => window.location.href)).toContain(server.EMPTY_PAGE);
  await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
  expect(await mainFrame.evaluate(() => window.location.href)).toContain(server.CROSS_PROCESS_PREFIX);
});

it('should not allow cross-frame js handles', async ({ page, server }) => {
  // TODO: this should actually be possible because frames script each other,
  // but protocol implementations do not support this. For now, assume current
  // behavior.
  await page.goto(server.PREFIX + '/frames/one-frame.html');
  const handle = await page.evaluateHandle(() => {
    const iframe = document.querySelector('iframe');
    const foo = { bar: 'baz' };
    iframe.contentWindow['__foo'] = foo;
    return foo;
  });
  const childFrame = page.mainFrame().childFrames()[0];
  const childResult = await childFrame.evaluate(() => window['__foo']);
  expect(childResult).toEqual({ bar: 'baz' });
  const error = await childFrame.evaluate(foo => foo.bar, handle).catch(e => e);
  expect(error.message).toContain('JSHandles can be evaluated only in the context they were created!');
});

it('should allow cross-frame element handles', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/frames/one-frame.html');
  const bodyHandle = await page.mainFrame().childFrames()[0].$('body');
  const result = await page.evaluate(body => body.innerHTML, bodyHandle);
  expect(result.trim()).toBe('<div>Hi, I\'m frame</div>');
});

it('should not allow cross-frame element handles when frames do not script each other', async ({ page, server, isAndroid }) => {
  it.skip(isAndroid, 'No cross-process on Android');

  await page.goto(server.EMPTY_PAGE);
  const frame = await attachFrame(page, 'frame1', server.CROSS_PROCESS_PREFIX + '/empty.html');
  const bodyHandle = await frame.$('body');
  const error = await page.evaluate(body => body.innerHTML, bodyHandle).catch(e => e);
  expect(error.message).toContain('Unable to adopt element handle from a different document');
});

it('should throw for detached frames', async ({ page, server }) => {
  const frame1 = await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  await detachFrame(page, 'frame1');
  let error = null;
  await frame1.evaluate(() => 7 * 8).catch(e => error = e);
  expect(error.message).toContain('frame.evaluate: Frame was detached');
});

it('should be isolated between frames', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  expect(page.frames().length).toBe(2);
  const [frame1, frame2] = page.frames();
  expect(frame1 !== frame2).toBeTruthy();

  await Promise.all([
    frame1.evaluate(() => window['a'] = 1),
    frame2.evaluate(() => window['a'] = 2)
  ]);
  const [a1, a2] = await Promise.all([
    frame1.evaluate(() => window['a']),
    frame2.evaluate(() => window['a'])
  ]);
  expect(a1).toBe(1);
  expect(a2).toBe(2);
});

it('should work in iframes that failed initial navigation', async ({ page, browserName }) => {
  it.fixme(browserName !== 'webkit');

  // - Firefox does not report domcontentloaded for the iframe.
  // - Chromium and Firefox report empty url.
  // - Chromium does not report main/utility worlds for the iframe.
  await page.setContent(`
    <meta http-equiv="Content-Security-Policy" content="script-src 'none';">
    <iframe src='javascript:""'></iframe>
  `, { waitUntil: 'domcontentloaded' });
  // Note: Chromium/Firefox never report 'load' event for the iframe.
  await page.evaluate(() => {
    const iframe = document.querySelector('iframe');
    const div = iframe.contentDocument.createElement('div');
    iframe.contentDocument.body.appendChild(div);
  });
  expect(page.frames()[1].url()).toBe('about:blank');
  // Main world should work.
  expect(await page.frames()[1].evaluate(() => window.location.href)).toBe('about:blank');
  // Utility world should work.
  expect(await page.frames()[1].$('div')).toBeTruthy();
});

it('should work in iframes that interrupted initial javascript url navigation', async ({ page, server, browserName }) => {
  it.fixme(browserName === 'chromium');

  // Chromium does not report isolated world for the iframe.
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.src = 'javascript:""';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write('<div>hello</div>');
    iframe.contentDocument.close();
  });
  // Main world should work.
  expect(await page.frames()[1].evaluate(() => window.top.location.href)).toBe(server.EMPTY_PAGE);
  // Utility world should work.
  expect(await page.frames()[1].$('div')).toBeTruthy();
});

it('evaluateHandle should work', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const mainFrame = page.mainFrame();
  const windowHandle = await mainFrame.evaluateHandle(() => window);
  expect(windowHandle).toBeTruthy();
});
