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

test('browser_frame_click', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Main Page</h1>
        <iframe src="/iframe.html"></iframe>
      </body>
    </html>
  `, 'text/html');

  server.setContent('/iframe.html', `
    <!DOCTYPE html>
    <html>
      <body>
        <button id="testBtn">Click Me</button>
        <div id="result"></div>
        <script>
          document.getElementById('testBtn').addEventListener('click', () => {
            document.getElementById('result').textContent = 'Clicked!';
          });
        </script>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Get snapshot to find the iframe reference
  const snapshot = await client.callTool({
    name: 'browser_snapshot',
    arguments: {},
  });

  expect(await client.callTool({
    name: 'browser_frame_click',
    arguments: {
      frameSelector: 'iframe',
      element: 'Click Me button',
      ref: 'f1e2', // This should match the ref from the snapshot
    },
  })).toHaveResponse({
    code: expect.stringContaining(`await page.frameLocator('iframe').locator('aria-ref=f1e2').click();`),
  });
});

test('browser_frame_type', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Main Page</h1>
        <iframe src="/iframe.html"></iframe>
      </body>
    </html>
  `, 'text/html');

  server.setContent('/iframe.html', `
    <!DOCTYPE html>
    <html>
      <body>
        <input type="text" id="textInput" placeholder="Type here" />
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_frame_type',
    arguments: {
      frameSelector: 'iframe',
      element: 'text input',
      ref: 'f1e2',
      text: 'Hello World',
    },
  })).toHaveResponse({
    code: expect.stringContaining(`await page.frameLocator('iframe').locator('aria-ref=f1e2').fill('Hello World');`),
  });
});

test('browser_frame_fill', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <body>
        <iframe src="/iframe.html"></iframe>
      </body>
    </html>
  `, 'text/html');

  server.setContent('/iframe.html', `
    <!DOCTYPE html>
    <html>
      <body>
        <input type="email" placeholder="Email" />
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_frame_fill',
    arguments: {
      frameSelector: 'iframe',
      element: 'Email input',
      ref: 'f1e2',
      text: 'test@example.com',
    },
  })).toHaveResponse({
    code: expect.stringContaining(`await page.frameLocator('iframe').locator('aria-ref=f1e2').fill('test@example.com');`),
  });
});

test('browser_frame_hover', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <body>
        <iframe src="/iframe.html"></iframe>
      </body>
    </html>
  `, 'text/html');

  server.setContent('/iframe.html', `
    <!DOCTYPE html>
    <html>
      <body>
        <div id="hoverDiv" style="padding: 20px; background: blue;">Hover over me</div>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_frame_hover',
    arguments: {
      frameSelector: 'iframe',
      element: 'hover div',
      ref: 'f1e2',
    },
  })).toHaveResponse({
    code: expect.stringContaining(`await page.frameLocator('iframe').locator('aria-ref=f1e2').hover();`),
  });
});

test('browser_frame_select_option', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <body>
        <iframe src="/iframe.html"></iframe>
      </body>
    </html>
  `, 'text/html');

  server.setContent('/iframe.html', `
    <!DOCTYPE html>
    <html>
      <body>
        <select id="country">
          <option value="">Choose a country</option>
          <option value="us">United States</option>
          <option value="uk">United Kingdom</option>
        </select>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_frame_select_option',
    arguments: {
      frameSelector: 'iframe',
      element: 'country select',
      ref: 'f1e2',
      values: ['us'],
    },
  })).toHaveResponse({
    code: expect.stringContaining(`await page.frameLocator('iframe').locator('aria-ref=f1e2').selectOption(['us']);`),
  });
});

test('browser_frame_check and uncheck', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <body>
        <iframe src="/iframe.html"></iframe>
      </body>
    </html>
  `, 'text/html');

  server.setContent('/iframe.html', `
    <!DOCTYPE html>
    <html>
      <body>
        <label>
          <input type="checkbox" id="terms" />
          I agree to terms
        </label>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Test check
  expect(await client.callTool({
    name: 'browser_frame_check',
    arguments: {
      frameSelector: 'iframe',
      element: 'terms checkbox',
      ref: 'f1e3',
    },
  })).toHaveResponse({
    code: expect.stringContaining(`await page.frameLocator('iframe').locator('aria-ref=f1e3').check();`),
  });

  // Test uncheck
  expect(await client.callTool({
    name: 'browser_frame_uncheck',
    arguments: {
      frameSelector: 'iframe',
      element: 'terms checkbox',
      ref: 'f1e3',
    },
  })).toHaveResponse({
    code: expect.stringContaining(`await page.frameLocator('iframe').locator('aria-ref=f1e3').uncheck();`),
  });
});

test('browser_frame_click with double click', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <body>
        <iframe src="/iframe.html"></iframe>
      </body>
    </html>
  `, 'text/html');

  server.setContent('/iframe.html', `
    <!DOCTYPE html>
    <html>
      <body>
        <button id="dblClickBtn">Double Click Me</button>
        <div id="result"></div>
        <script>
          document.getElementById('dblClickBtn').addEventListener('dblclick', () => {
            document.getElementById('result').textContent = 'Double Clicked!';
          });
        </script>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_frame_click',
    arguments: {
      frameSelector: 'iframe',
      element: 'Double Click Me button',
      ref: 'f1e2',
      doubleClick: true,
    },
  })).toHaveResponse({
    code: expect.stringContaining(`await page.frameLocator('iframe').locator('aria-ref=f1e2').dblclick();`),
  });
});

test('browser_frame_type with slowly and submit', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <body>
        <iframe src="/iframe.html"></iframe>
      </body>
    </html>
  `, 'text/html');

  server.setContent('/iframe.html', `
    <!DOCTYPE html>
    <html>
      <body>
        <form>
          <input type="text" id="searchInput" />
        </form>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_frame_type',
    arguments: {
      frameSelector: 'iframe',
      element: 'search input',
      ref: 'f1e3',
      text: 'search query',
      slowly: true,
      submit: true,
    },
  })).toHaveResponse({
    code: expect.stringContaining(`await page.frameLocator('iframe').locator('aria-ref=f1e3').pressSequentially('search query');`),
  });
});
