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

it('should pass firefox user preferences', async ({ browserType, mode }) => {
  it.skip(mode.startsWith('service'));
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

it('should pass firefox user preferences in persistent', async ({ mode, launchPersistent }) => {
  it.skip(mode.startsWith('service'));
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

it('should support custom firefox policies', async ({ browserType, mode, asset, loopback }, testInfo) => {
  it.skip(mode.startsWith('service'));

  const policies = {
    'policies': {
      'Certificates': {
        'Install': [asset('client-certificates/server/server_cert.pem')],
      },
    },
  };
  const policiesPath = testInfo.outputPath('policies.json');
  await fs.promises.writeFile(policiesPath, JSON.stringify(policies));

  const port = 48112;
  const server = new TestServer(asset(''), port, loopback, {
    key: await fs.promises.readFile(asset('client-certificates/client/localhost/localhost.key')),
    cert: await fs.promises.readFile(asset('client-certificates/client/localhost/localhost.pem')),
  });
  await server.waitUntilReady();

  const browser = await browserType.launch({
    env: { ...process.env, 'PLAYWRIGHT_FIREFOX_POLICIES_JSON': policiesPath },
  });

  const page = await browser.newPage();
  await page.goto(server.PREFIX + '/frames/frame.html');
  await expect(page.locator('body')).toHaveText(`Hi, I'm frame`);
  await browser.close();
  await server.stop();
});
