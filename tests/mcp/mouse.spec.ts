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

import { test as baseTest, expect } from './fixtures';

const test = baseTest.extend({ mcpCaps: [['vision'], { option: true }] });

const eventsPage = `<!DOCTYPE html>
<html>
  <body style="width: 400px; height: 400px; margin: 0; padding: 0;">
    <div id='log'></div>
    <script>
      const logElement = document.querySelector('#log');
      const log = (...args) => {
        const el = document.createElement('div');
        el.textContent = args.join(' ');
        logElement.appendChild(el);
      };
      document.body.addEventListener('mousemove', (event) => {
        log('mousemove', event.clientX, event.clientY);
      });
      document.body.addEventListener('mousedown', (event) => {
        log('mousedown', 'button:' + event.button);
      });
      document.body.addEventListener('mouseup', (event) => {
        log('mouseup', 'button:' + event.button);
      });
      document.body.addEventListener('click', (event) => {
        log('click', 'button:' + event.button);
      });
      document.body.addEventListener('dblclick', (event) => {
        log('dblclick', 'button:' + event.button);
      });
      document.body.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        log('contextmenu', 'button:' + event.button);
      });
    </script>
  </body>
</html>`;

test.beforeEach(async ({ client, server }) => {
  server.setContent('/', eventsPage, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });
});

test('browser_mouse_click_xy (default)', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_mouse_click_xy',
    arguments: { x: 100, y: 100 },
  })).toHaveResponse({
    code: expect.stringContaining('await page.mouse.click(100, 100);'),
    snapshot: expect.stringMatching(/mousemove 100 100.*mousedown button:0.*mouseup button:0.*click button:0/s),
  });
});

test('browser_mouse_click_xy (right button)', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_mouse_click_xy',
    arguments: { x: 100, y: 100, button: 'right' },
  })).toHaveResponse({
    code: expect.stringContaining(`await page.mouse.click(100, 100, { button: 'right' });`),
    snapshot: expect.stringMatching(/mousemove 100 100.*mousedown button:2.*contextmenu button:2.*mouseup button:2/s),
  });
});

test('browser_mouse_click_xy (middle button)', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_mouse_click_xy',
    arguments: { x: 100, y: 100, button: 'middle' },
  })).toHaveResponse({
    code: expect.stringContaining(`await page.mouse.click(100, 100, { button: 'middle' });`),
    snapshot: expect.stringMatching(/mousemove 100 100.*mousedown button:1.*mouseup button:1/s),
  });
});

test('browser_mouse_click_xy (double click)', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_mouse_click_xy',
    arguments: { x: 100, y: 100, clickCount: 2 },
  })).toHaveResponse({
    code: expect.stringContaining(`await page.mouse.click(100, 100, { clickCount: 2 });`),
    snapshot: expect.stringMatching(/mousemove 100 100.*mousedown button:0.*mouseup button:0.*dblclick button:0/s),
  });
});
