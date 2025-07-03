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

import type { BrowserContext } from 'playwright-core';
import type { TestServer } from '../config/testserver';
import { hostPlatform } from '../../packages/playwright-core/src/server/utils/hostPlatform';
import { browserTest as it, expect } from '../config/browserTest';
import fs from 'fs';
import os from 'os';

async function checkFeatures(name: string, context: BrowserContext, server: TestServer): Promise<any> {
  try {
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/modernizr/index.html');
    const actual = await page.evaluate('window.report');
    const expected = JSON.parse(fs.readFileSync(require.resolve(`../assets/modernizr/${name}.json`), 'utf-8'));
    return { actual, expected };
  } finally {
    await context.close();
  }
}

it('Safari Desktop', async ({ browser, browserName, platform, httpsServer, headless }) => {
  it.skip(browserName !== 'webkit');
  it.skip(browserName === 'webkit' && platform === 'darwin' && os.arch() === 'x64', 'Modernizr uses WebGL which is not available on Intel macOS - https://bugs.webkit.org/show_bug.cgi?id=278277');
  it.skip(browserName === 'webkit' && hostPlatform.startsWith('ubuntu20.04'), 'Ubuntu 20.04 is frozen');
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: true,
  });
  const { actual, expected } = await checkFeatures('safari-18', context, httpsServer);

  expected.pushmanager = false;
  expected.devicemotion2 = false;
  expected.devicemotion = false;
  expected.deviceorientation = false;
  expected.deviceorientation3 = false;

  delete expected.webglextensions;
  delete actual.webglextensions;
  expected.audio = !!expected.audio;
  actual.audio = !!actual.audio;
  expected.video = !!expected.video;
  actual.video = !!actual.video;

  if (platform === 'linux') {
    expected.speechrecognition = false;
    expected.mediastream = false;
    if (headless)
      expected.todataurlwebp = true;

    // GHA
    delete actual.variablefonts;
    delete expected.variablefonts;
  }

  if (platform === 'win32') {
    expected.getusermedia = false;
    expected.peerconnection = false;
    expected.speechrecognition = false;
    expected.speechsynthesis = false;
    expected.todataurlwebp = true;
    expected.webaudio = false;
    expected.gamepads = false;

    delete expected.datalistelem;

    expected.mediastream = false;
    expected.mediasource = false;
    expected.datachannel = false;

    expected.inputtypes.color = false;
    expected.inputtypes.date = false;
    expected.inputtypes['datetime-local'] = false;
    expected.inputtypes.time = false;
  }

  expect(actual).toEqual(expected);
});

it('Mobile Safari', async ({ playwright, browser, browserName, platform, httpsServer, headless }) => {
  it.skip(browserName !== 'webkit');
  it.skip(browserName === 'webkit' && platform === 'darwin' && os.arch() === 'x64', 'Modernizr uses WebGL which is not available on Intel macOS - https://bugs.webkit.org/show_bug.cgi?id=278277');
  it.skip(browserName === 'webkit' && hostPlatform.startsWith('ubuntu20.04'), 'Ubuntu 20.04 is frozen');
  const iPhone = playwright.devices['iPhone 12'];
  const context = await browser.newContext({
    ...iPhone,
    ignoreHTTPSErrors: true,
  });
  const { actual, expected } = await checkFeatures('mobile-safari-18', context, httpsServer);

  {
    // All platforms.
    expected.capture = false;
    expected.cssscrollbar = true;
    expected.cssvhunit = true;
    expected.cssvmaxunit = true;
    expected.overflowscrolling = false;
    expected.mediasource = true;
    expected.scrolltooptions = false;

    delete expected.webglextensions;
    delete actual.webglextensions;
    expected.audio = !!expected.audio;
    actual.audio = !!actual.audio;
    expected.video = !!expected.video;
    actual.video = !!actual.video;
  }

  if (platform === 'linux') {
    expected.speechrecognition = false;
    expected.mediastream = false;
    if (headless)
      expected.todataurlwebp = true;

    // GHA
    delete actual.variablefonts;
    delete expected.variablefonts;
  }

  if (platform === 'win32') {
    expected.getusermedia = false;
    expected.peerconnection = false;
    expected.speechrecognition = false;
    expected.speechsynthesis = false;
    expected.todataurlwebp = true;
    expected.webaudio = false;
    expected.gamepads = false;

    delete expected.datalistelem;

    expected.mediastream = false;
    expected.mediasource = false;
    expected.datachannel = false;

    expected.inputtypes.color = false;
    expected.inputtypes.date = false;
    expected.inputtypes['datetime-local'] = false;
    expected.inputtypes.time = false;
  }

  expect(actual).toEqual(expected);
});
