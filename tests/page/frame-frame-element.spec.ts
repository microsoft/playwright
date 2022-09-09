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

it('should work @smoke', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const frame1 = await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  await attachFrame(page, 'frame2', server.EMPTY_PAGE);
  const frame3 = await attachFrame(page, 'frame3', server.EMPTY_PAGE);
  const frame1handle1 = await page.$('#frame1');
  const frame1handle2 = await frame1.frameElement();
  const frame3handle1 = await page.$('#frame3');
  const frame3handle2 = await frame3.frameElement();
  expect(await frame1handle1.evaluate((a, b) => a === b, frame1handle2)).toBe(true);
  expect(await frame3handle1.evaluate((a, b) => a === b, frame3handle2)).toBe(true);
  expect(await frame1handle1.evaluate((a, b) => a === b, frame3handle1)).toBe(false);
});

it('should work with contentFrame', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const frame = await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  const handle = await frame.frameElement();
  const contentFrame = await handle.contentFrame();
  expect(contentFrame).toBe(frame);
});

it('should work with frameset', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/frames/frameset.html');
  const frameElement1 = await page.$('frame');
  const frame = await frameElement1.contentFrame();
  const frameElement2 = await frame.frameElement();
  expect(await frameElement1.evaluate((a, b) => a === b, frameElement2)).toBe(true);
});

it('should throw when detached', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const frame1 = await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  await page.$eval('#frame1', e => e.remove());
  const error = await frame1.frameElement().catch(e => e);
  expect(error.message).toContain('Frame has been detached.');
});

it('should work inside closed shadow root', async ({ page, server, browserName }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <div id=framecontainer>
    </div>
    <script>
      const iframe = document.createElement('iframe');
      iframe.setAttribute('name', 'myframe');
      iframe.setAttribute('srcdoc', 'find me');
      const div = document.getElementById('framecontainer');
      const host = div.attachShadow({ mode: 'closed' });
      host.appendChild(iframe);
    </script>
  `);

  const frame = page.frame({ name: 'myframe' });
  const element = await frame.frameElement();
  expect(await element.getAttribute('name')).toBe('myframe');
});
