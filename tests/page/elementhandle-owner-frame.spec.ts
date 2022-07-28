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
import { attachFrame } from '../config/utils';

it('should work', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  const frame = page.frames()[1];
  const elementHandle = await frame.evaluateHandle(() => document.body);
  expect(await elementHandle.ownerFrame()).toBe(frame);
});

it('should work for cross-process iframes', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.CROSS_PROCESS_PREFIX + '/empty.html');
  const frame = page.frames()[1];
  const elementHandle = await frame.evaluateHandle(() => document.body);
  expect(await elementHandle.ownerFrame()).toBe(frame);
});

it('should work for document', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  const frame = page.frames()[1];
  const elementHandle = await frame.evaluateHandle(() => document);
  expect(await elementHandle.ownerFrame()).toBe(frame);
});

it('should work for iframe elements', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  const frame = page.mainFrame();
  const elementHandle = await frame.evaluateHandle(() => document.querySelector('#frame1'));
  expect(await elementHandle.ownerFrame()).toBe(frame);
});

it('should work for cross-frame evaluations', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  const frame = page.mainFrame();
  const elementHandle = await frame.evaluateHandle(() => document.querySelector('iframe').contentWindow.document.body);
  expect(await elementHandle.ownerFrame()).toBe(frame.childFrames()[0]);
});

it('should work for detached elements', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const divHandle = await page.evaluateHandle(() => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    return div;
  });
  expect(await divHandle.ownerFrame()).toBe(page.mainFrame());
  await page.evaluate(() => {
    const div = document.querySelector('div');
    document.body.removeChild(div);
  });
  expect(await divHandle.ownerFrame()).toBe(page.mainFrame());
});

it('should work for adopted elements', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => window['__popup'] = window.open(url), server.EMPTY_PAGE),
  ]);
  const divHandle = await page.evaluateHandle(() => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    return div;
  });
  expect(await divHandle.ownerFrame()).toBe(page.mainFrame());
  await popup.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    const div = document.querySelector('div');
    window['__popup'].document.body.appendChild(div);
  });
  expect(await divHandle.ownerFrame()).toBe(popup.mainFrame());
});
