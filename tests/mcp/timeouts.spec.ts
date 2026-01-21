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

import { test, expect } from './fixtures';

test('action timeout (default)', async ({ server, startClient }) => {
  const { client } = await startClient({ noTimeoutForTest: true });
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <input readonly></input>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  expect(await client.callTool({
    name: 'browser_type',
    arguments: {
      element: 'textbox',
      ref: 'e2',
      text: 'Hi!',
      submit: true,
    },
  })).toHaveResponse({
    error: expect.stringContaining(`Timeout 5000ms exceeded.`),
    isError: true,
  });
});

test('action timeout (custom)', async ({ startClient, server }) => {
  const { client } = await startClient({ args: [`--timeout-action=1234`] });
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <input readonly></input>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  expect(await client.callTool({
    name: 'browser_type',
    arguments: {
      element: 'textbox',
      ref: 'e2',
      text: 'Hi!',
      submit: true,
    },
  })).toHaveResponse({
    error: expect.stringContaining(`Timeout 1234ms exceeded.`),
    isError: true,
  });
});

test('navigation timeout', async ({ startClient, server }) => {
  const { client } = await startClient({ args: [`--timeout-navigation=1234`] });
  server.setRoute('/slow', async () => {
    await new Promise(f => setTimeout(f, 1500));
    return new Response('OK');
  });
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <input readonly></input>
    </html>
  `, 'text/html');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX + '/slow',
    },
  })).toHaveResponse({
    error: expect.stringContaining(`Timeout 1234ms exceeded.`),
    isError: true,
  });
});
