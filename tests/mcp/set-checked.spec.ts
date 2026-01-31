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

test('browser_set_checked (checkbox)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Checkbox Test</title>
    <label>
      <input type="checkbox" id="terms" />
      Accept terms
    </label>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Check the checkbox
  expect(await client.callTool({
    name: 'browser_set_checked',
    arguments: {
      element: 'Accept terms checkbox',
      ref: 'e2',
      checked: true,
    },
  })).toHaveResponse({
    code: expect.stringContaining('.setChecked(true)'),
    snapshot: expect.stringContaining('[checked]'),
  });

  // Uncheck the checkbox
  expect(await client.callTool({
    name: 'browser_set_checked',
    arguments: {
      element: 'Accept terms checkbox',
      ref: 'e2',
      checked: false,
    },
  })).toHaveResponse({
    code: expect.stringContaining('.setChecked(false)'),
  });
});

test('browser_set_checked (radio button)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Radio Test</title>
    <input type="radio" name="color" id="red" />
    <label for="red">Red</label>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Select the Red radio button
  expect(await client.callTool({
    name: 'browser_set_checked',
    arguments: {
      element: 'Red radio button',
      ref: 'e2',
      checked: true,
    },
  })).toHaveResponse({
    code: expect.stringContaining('.setChecked(true)'),
    snapshot: expect.stringContaining('[checked]'),
  });
});

test('browser_set_checked (already checked)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Pre-checked Test</title>
    <label>
      <input type="checkbox" id="newsletter" checked />
      Subscribe to newsletter
    </label>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Verify already checked
  let response = await client.callTool({
    name: 'browser_snapshot',
    arguments: {},
  });
  expect(response).toHaveResponse({
    snapshot: expect.stringContaining('[checked]'),
  });

  // Uncheck it
  expect(await client.callTool({
    name: 'browser_set_checked',
    arguments: {
      element: 'Subscribe checkbox',
      ref: 'e2',
      checked: false,
    },
  })).toHaveResponse({
    code: expect.stringContaining('.setChecked(false)'),
  });

  // Verify unchecked - the snapshot should not contain [checked] for this element
  response = await client.callTool({
    name: 'browser_snapshot',
    arguments: {},
  });
  expect(response).toHaveResponse({
    snapshot: expect.not.stringContaining('[checked]'),
  });
});
