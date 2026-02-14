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

import { test, expect, parseResponse } from './fixtures';

test('ini config sets viewport', async ({ startClient, server }) => {
  server.setContent('/', `
    <title>Test</title>
    <script>document.title = window.innerWidth + 'x' + window.innerHeight</script>
  `, 'text/html');

  const { client } = await startClient({
    config: `
      browser.contextOptions.viewport = 640x480
    `,
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    page: expect.stringContaining('640x480'),
  });
});

test('ini config sets timeouts and console level', async ({ startClient }) => {
  const { client } = await startClient({
    config: `
      capabilities = config
      console.level = error
      timeouts.action = 12345
      timeouts.navigation = 54321
    `,
    noTimeoutForTest: true,
  });

  const result = await client.callTool({ name: 'browser_get_config' });
  const config = JSON.parse(parseResponse(result).result);
  expect(config.console.level).toBe('error');
  expect(config.timeouts.action).toBe(12345);
  expect(config.timeouts.navigation).toBe(54321);
});

test('ini config sets browser launch options', async ({ startClient }) => {
  const { client } = await startClient({
    config: `
      capabilities = config
      browser.launchOptions.headless = true
      browser.isolated = true
    `,
  });

  const result = await client.callTool({ name: 'browser_get_config' });
  const config = JSON.parse(parseResponse(result).result);
  expect(config.browser.launchOptions.headless).toBe(true);
  expect(config.browser.isolated).toBe(true);
});

test('ini config sets context options', async ({ startClient }) => {
  const { client } = await startClient({
    config: `
      capabilities = config
      browser.contextOptions.userAgent = TestAgent/1.0
      browser.contextOptions.locale = fr-FR
      browser.contextOptions.timezoneId = Europe/Paris
    `,
  });

  const result = await client.callTool({ name: 'browser_get_config' });
  const config = JSON.parse(parseResponse(result).result);
  expect(config.browser.contextOptions.userAgent).toBe('TestAgent/1.0');
  expect(config.browser.contextOptions.locale).toBe('fr-FR');
  expect(config.browser.contextOptions.timezoneId).toBe('Europe/Paris');
});

test('ini config sets server and network options', async ({ startClient }) => {
  const { client } = await startClient({
    config: `
      capabilities = config
      server.host = localhost
      network.allowedOrigins = https://example.com
    `,
  });

  const result = await client.callTool({ name: 'browser_get_config' });
  const config = JSON.parse(parseResponse(result).result);
  expect(config.server.host).toBe('localhost');
  expect(config.network.allowedOrigins).toEqual(['https://example.com']);
});

test('ini config boolean values', async ({ startClient }) => {
  const { client } = await startClient({
    config: `
      capabilities = config
      saveTrace = true
      browser.contextOptions.bypassCSP = true
      browser.contextOptions.javaScriptEnabled = false
    `,
  });

  const result = await client.callTool({ name: 'browser_get_config' });
  const config = JSON.parse(parseResponse(result).result);
  expect(config.saveTrace).toBe(true);
  expect(config.browser.contextOptions.bypassCSP).toBe(true);
  expect(config.browser.contextOptions.javaScriptEnabled).toBe(false);
});
