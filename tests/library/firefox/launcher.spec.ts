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
import { playwrightTest as it, expect } from '../../config/browserTest';
import { TestServer } from '../../config/testserver';
import { inheritAndCleanEnv } from '../../config/utils';

it('FF-001 should pass firefox user preferences', async ({ browserType, mode }) => {
  const browser = await browserType.launch({
    firefoxUserPrefs: {
      'network.proxy.type': 1,
      'network.proxy.ssl': '127.0.0.1',
      'network.proxy.ssl_port': 3333,
    }
  });
  const page = await browser.newPage();
  const error = await page.goto('https://example.com').catch(e => e);
  expect(error.message).toContain('NS_ERROR_PROXY_CONNECTION_REFUSED');
  await browser.close();
});

it('FF-002 should pass firefox user preferences in persistent', async ({ mode, launchPersistent }) => {
  const { page } = await launchPersistent({
    firefoxUserPrefs: {
      'network.proxy.type': 1,
      'network.proxy.ssl': '127.0.0.1',
      'network.proxy.ssl_port': 3333,
    }
  });
  const error = await page.goto('https://example.com').catch(e => e);
  expect(error.message).toContain('NS_ERROR_PROXY_CONNECTION_REFUSED');
});

it('FF-003 should support custom firefox policies', async ({ browserType, mode, asset, loopback }, testInfo) => {
  const policies = {
    'policies': {
      'Certificates': {
        'Install': [asset('client-certificates/server/server_cert.pem')],
      },
    },
  };
  const policiesPath = testInfo.outputPath('policies.json');
  await fs.promises.writeFile(policiesPath, JSON.stringify(policies));

  const port = 13122;
  const server = new TestServer(asset(''), port, loopback, {
    key: await fs.promises.readFile(asset('client-certificates/client/localhost/localhost.key')),
    cert: await fs.promises.readFile(asset('client-certificates/client/localhost/localhost.pem')),
  });
  await server.waitUntilReady();

  const browser = await browserType.launch({
    env: inheritAndCleanEnv({ 'PLAYWRIGHT_FIREFOX_POLICIES_JSON': policiesPath }),
  });

  const page = await browser.newPage();
  await page.goto(server.PREFIX + '/frames/frame.html');
  await expect(page.locator('body')).toHaveText(`Hi, I'm frame`);
  await browser.close();
  await server.stop();
});

it('FF-004 should resize viewport with fractional device scale factor', async ({ browserType }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43028' });
  // A fractional device scale factor makes the viewport size fractional in CSS pixels,
  // e.g. 400.27x799.9 instead of 400x800. Web content still sees rounded values.
  const browser = await browserType.launch({ firefoxUserPrefs: { 'layout.css.devPixelsPerPx': '1.1' } });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 400, height: 800 });
  expect(await page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([400, 800]);
  await browser.close();
});
