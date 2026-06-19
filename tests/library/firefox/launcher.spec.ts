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
import { playwrightTest as it, expect } from '../../config/browserTest';
import { TestServer } from '../../config/testserver';
import { inheritAndCleanEnv } from '../../config/utils';
import { kFirefoxPoliciesEnvName, prepareFirefoxPolicies } from '../../../packages/playwright-core/src/server/firefox/firefoxPolicies';

it('should pass firefox user preferences', async ({ browserType, mode }) => {
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

it('should merge custom firefox policies with disabled app updates', async ({}, testInfo) => {
  const defaultUserDataDir = testInfo.outputPath('default-profile');
  await fs.promises.mkdir(defaultUserDataDir);
  await prepareFirefoxPolicies({}, defaultUserDataDir);
  expect(JSON.parse(await fs.promises.readFile(path.join(defaultUserDataDir, 'playwright-policies.json'), 'utf8'))).toEqual({
    policies: {
      DisableAppUpdate: true,
    },
  });

  const policiesPath = testInfo.outputPath('policies.json');
  await fs.promises.writeFile(policiesPath, JSON.stringify({
    policies: {
      Certificates: {
        Install: ['cert.pem'],
      },
    },
  }));

  const userDataDir = testInfo.outputPath('profile');
  await fs.promises.mkdir(userDataDir);
  await prepareFirefoxPolicies({
    env: [{ name: kFirefoxPoliciesEnvName, value: policiesPath }],
  }, userDataDir);

  const generatedPolicies = JSON.parse(await fs.promises.readFile(path.join(userDataDir, 'playwright-policies.json'), 'utf8'));
  expect(generatedPolicies).toEqual({
    policies: {
      Certificates: {
        Install: ['cert.pem'],
      },
      DisableAppUpdate: true,
    },
  });
});
