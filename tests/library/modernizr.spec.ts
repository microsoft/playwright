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

import { browserTest as it, expect } from '../config/browserTest';
import fs from 'fs';
import os from 'os';

async function checkFeatures(name: string, context: any, server: any) {
  try {
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/modernizr.html');
    const actual = await page.evaluate('window.report');
    const expected = JSON.parse(fs.readFileSync(require.resolve(`../assets/modernizr/${name}.json`), 'utf-8'));
    return { actual, expected };
  } finally {
    await context.close();
  }
}

it('safari-14-1', async ({ browser, browserName, platform, server, headless, isMac }) => {
  it.skip(browserName !== 'webkit');
  it.skip(browserName === 'webkit' && parseInt(os.release(), 10) < 20, 'WebKit for macOS 10.15 is frozen.');
  const context = await browser.newContext({
    deviceScaleFactor: 2
  });
  const { actual, expected } = await checkFeatures('safari-14-1', context, server);

  if (platform === 'linux') {
    expected.subpixelfont = false;
    if (headless)
      expected.todataurljpeg = false;

    // GHA
    delete actual.variablefonts;
    delete expected.variablefonts;

    if (isDocker()) {
      delete actual.unicode;
      delete expected.unicode;
    }
  }

  if (platform === 'win32') {
    expected.datalistelem = false;
    expected.fileinputdirectory = false;
    expected.getusermedia = false;
    expected.peerconnection = false;
    expected.speechrecognition = false;
    expected.speechsynthesis = false;
    expected.todataurljpeg = false;
    expected.unicode = false;
    expected.webaudio = false;

    expected.input.list = false;
    expected.inputtypes.color = false;
    expected.inputtypes.date = false;
    expected.inputtypes['datetime-local'] = false;
    expected.inputtypes.time = false;
  }

  if (isMac && parseInt(os.release(), 10) > 20)
    expected.applicationcache = false;

  expect(actual).toEqual(expected);
});

it('mobile-safari-14-1', async ({ playwright, browser, browserName, platform, isMac, server, headless }) => {
  it.skip(browserName !== 'webkit');
  it.skip(browserName === 'webkit' && parseInt(os.release(), 10) < 20, 'WebKit for macOS 10.15 is frozen.');
  const iPhone = playwright.devices['iPhone 12'];
  const context = await browser.newContext(iPhone);
  const { actual, expected } = await checkFeatures('mobile-safari-14-1', context, server);

  {
    // All platforms.
    expected.capture = false;
    expected.cssscrollbar = true;
    expected.cssvhunit = true;
    expected.cssvmaxunit = true;
    expected.overflowscrolling = false;
  }

  if (platform === 'linux') {
    expected.subpixelfont = false;
    if (headless)
      expected.todataurljpeg = false;

    // GHA
    delete actual.variablefonts;
    delete expected.variablefonts;

    if (isDocker()) {
      delete actual.unicode;
      delete expected.unicode;
    }
  }

  if (platform === 'win32') {
    expected.datalistelem = false;
    expected.fileinputdirectory = false;
    expected.getusermedia = false;
    expected.peerconnection = false;
    expected.speechrecognition = false;
    expected.speechsynthesis = false;
    expected.todataurljpeg = false;
    expected.unicode = false;
    expected.webaudio = false;

    expected.input.list = false;
    expected.inputtypes.color = false;
    expected.inputtypes.month = false;
    expected.inputtypes.week = false;
    expected.inputtypes.date = false;
    expected.inputtypes.time = false;
    expected.inputtypes['datetime-local'] = false;
    expected.inputtypes.time = false;
  }

  if (isMac && parseInt(os.release(), 10) > 20)
    expected.applicationcache = false;

  expect(actual).toEqual(expected);
});

function isDocker() {
  try {
    fs.statSync('/.dockerenv');
    return true;
  } catch {
  }
  try {
    return fs.readFileSync('/proc/self/cgroup', 'utf8').includes('docker');
  } catch {
  }
  return false;
}
