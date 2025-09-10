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

test.use({ mcpArgs: ['--caps=testing'] });

test('browser_verify_element_visible', async ({ client, server }) => {
  server.setContent('/', `
    <title>Test Page</title>
    <button>Submit</button>
    <h1>Welcome</h1>
    <div role="alert" aria-label="Success message"></div>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_verify_element_visible',
    arguments: {
      role: 'button',
      accessibleName: 'Submit',
    },
  })).toHaveResponse({
    result: 'Done',
    code: `await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();`,
  });

  expect(await client.callTool({
    name: 'browser_verify_element_visible',
    arguments: {
      role: 'heading',
      accessibleName: 'Welcome',
    },
  })).toHaveResponse({
    result: 'Done',
    code: `await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();`,
  });

  expect(await client.callTool({
    name: 'browser_verify_element_visible',
    arguments: {
      role: 'alert',
      accessibleName: 'Success message',
    },
  })).toHaveResponse({
    result: 'Done',
    code: `await expect(page.getByRole('alert', { name: 'Success message' })).toBeVisible();`,
  });
});

test('browser_verify_element_visible (not found)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Test Page</title>
    <button>Submit</button>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_verify_element_visible',
    arguments: {
      role: 'button',
      accessibleName: 'Cancel',
    },
  })).toHaveResponse({
    isError: true,
    result: 'Element with role "button" and accessible name "Cancel" not found',
  });
});

test('browser_verify_text_visible', async ({ client, server }) => {
  server.setContent('/', `
    <title>Test Page</title>
    <p>Hello world</p>
    <div>Welcome to our site</div>
    <span>Status: Active</span>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_verify_text_visible',
    arguments: {
      text: 'Hello world',
    },
  })).toHaveResponse({
    result: 'Done',
    code: `await expect(page.getByText('Hello world')).toBeVisible();`,
  });

  expect(await client.callTool({
    name: 'browser_verify_text_visible',
    arguments: {
      text: 'Welcome to our site',
    },
  })).toHaveResponse({
    result: 'Done',
    code: `await expect(page.getByText('Welcome to our site')).toBeVisible();`,
  });

  expect(await client.callTool({
    name: 'browser_verify_text_visible',
    arguments: {
      text: 'Status: Active',
    },
  })).toHaveResponse({
    result: 'Done',
    code: `await expect(page.getByText('Status: Active')).toBeVisible();`,
  });
});

test('browser_verify_text_visible (not found)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Test Page</title>
    <p>Hello world</p>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_verify_text_visible',
    arguments: {
      text: 'Goodbye world',
    },
  })).toHaveResponse({
    isError: true,
    result: 'Text not found',
  });
});

test('browser_verify_text_visible (with quotes)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Test Page</title>
    <p>She said "Hello world"</p>
    <div>It's a beautiful day</div>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_verify_text_visible',
    arguments: {
      text: 'She said "Hello world"',
    },
  })).toHaveResponse({
    result: 'Done',
    code: `await expect(page.getByText('She said "Hello world"')).toBeVisible();`,
  });

  expect(await client.callTool({
    name: 'browser_verify_text_visible',
    arguments: {
      text: "It's a beautiful day",
    },
  })).toHaveResponse({
    result: 'Done',
    code: `await expect(page.getByText('It\\'s a beautiful day')).toBeVisible();`,
  });
});

test('browser_verify_list_visible', async ({ client, server }) => {
  server.setContent('/', `
    <title>Test Page</title>
    <ul>
      <li>Apple</li>
      <li>Banana</li>
      <li>Cherry</li>
    </ul>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_verify_list_visible',
    arguments: {
      element: 'Fruit list',
      ref: 'e2',
      items: ['Apple', 'Banana', 'Cherry'],
    },
  })).toHaveResponse({
    result: 'Done',
    code: expect.stringContaining(`await expect(page.locator('body')).toMatchAriaSnapshot(\`
- list:
  - listitem: "Apple"
  - listitem: "Banana"
  - listitem: "Cherry"
\`);`),
  });
});

test('browser_verify_list_visible (partial items)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Test Page</title>
    <ul>
      <li>Apple</li>
      <li>Banana</li>
      <li>Cherry</li>
      <li>Date</li>
    </ul>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_verify_list_visible',
    arguments: {
      element: 'Fruit list',
      ref: 'e2',
      items: ['Apple', 'Cherry'],
    },
  })).toHaveResponse({
    result: 'Done',
    code: expect.stringContaining(`await expect(page.locator('body')).toMatchAriaSnapshot(\`
- list:
  - listitem: "Apple"
  - listitem: "Cherry"
\`);`),
  });
});

test('browser_verify_list_visible (item not found)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Test Page</title>
    <ul>
      <li>Apple</li>
      <li>Banana</li>
    </ul>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_verify_list_visible',
    arguments: {
      element: 'Fruit list',
      ref: 'e2',
      items: ['Apple', 'Cherry'],
    },
  })).toHaveResponse({
    isError: true,
    result: 'Item "Cherry" not found',
  });
});

test('browser_verify_value (textbox)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Test Page</title>
    <form>
      <input type="text" aria-label="Name" value="John Doe" />
      <input type="email" aria-label="Email" value="john@example.com" />
    </form>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_verify_value',
    arguments: {
      type: 'textbox',
      element: 'Name textbox',
      ref: 'e3',
      value: 'John Doe',
    },
  })).toHaveResponse({
    result: 'Done',
    code: expect.stringContaining(`await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('John Doe');`),
  });

  expect(await client.callTool({
    name: 'browser_verify_value',
    arguments: {
      type: 'textbox',
      element: 'Email textbox',
      ref: 'e4',
      value: 'john@example.com',
    },
  })).toHaveResponse({
    result: 'Done',
    code: expect.stringContaining(`await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue('john@example.com');`),
  });
});

test('browser_verify_value (textbox wrong value)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Test Page</title>
    <form>
      <input type="text" name="name" value="John Doe" />
    </form>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_verify_value',
    arguments: {
      type: 'textbox',
      element: 'Name textbox',
      ref: 'e3',
      value: 'Jane Smith',
    },
  })).toHaveResponse({
    isError: true,
    result: 'Expected value "Jane Smith", but got "John Doe"',
  });
});

test('browser_verify_value (checkbox checked)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Test Page</title>
    <form>
      <input type="checkbox" name="subscribe" checked />
      <label for="subscribe">Subscribe to newsletter</label>
    </form>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_verify_value',
    arguments: {
      type: 'checkbox',
      element: 'Subscribe checkbox',
      ref: 'e3',
      value: 'true',
    },
  })).toHaveResponse({
    result: 'Done',
    code: expect.stringContaining(`await expect(page.getByRole('checkbox')).toBeChecked();`),
  });
});

test('browser_verify_value (checkbox unchecked)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Test Page</title>
    <form>
      <input type="checkbox" name="subscribe" />
      <label for="subscribe">Subscribe to newsletter</label>
    </form>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_verify_value',
    arguments: {
      type: 'checkbox',
      element: 'Subscribe checkbox',
      ref: 'e3',
      value: 'false',
    },
  })).toHaveResponse({
    result: 'Done',
    code: expect.stringContaining(`await expect(page.getByRole('checkbox')).not.toBeChecked();`),
  });
});

test('browser_verify_value (checkbox wrong value)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Test Page</title>
    <form>
      <input type="checkbox" name="subscribe" checked />
      <label for="subscribe">Subscribe to newsletter</label>
    </form>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_verify_value',
    arguments: {
      type: 'checkbox',
      element: 'Subscribe checkbox',
      ref: 'e3',
      value: 'false',
    },
  })).toHaveResponse({
    isError: true,
    result: 'Expected value "false", but got "true"',
  });
});

test('browser_verify_value (radio checked)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Test Page</title>
    <form>
      <label for="red">Red</label>
      <input id="red" type="radio" name="color" value="red" checked />
      <label for="blue">Blue</label>
      <input id="blue" type="radio" name="color" value="blue" />
    </form>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_verify_value',
    arguments: {
      type: 'radio',
      element: 'Color radio',
      ref: 'e3',
      value: 'true',
    },
  })).toHaveResponse({
    result: 'Done',
    code: expect.stringContaining(`await expect(page.getByRole('radio', { name: 'Red' })).toBeChecked();`),
  });
});

test('browser_verify_value (slider)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Test Page</title>
    <form>
      <input type="range" name="volume" min="0" max="100" value="75" />
      <label>Volume</label>
    </form>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_verify_value',
    arguments: {
      type: 'slider',
      element: 'Volume slider',
      ref: 'e3',
      value: '75',
    },
  })).toHaveResponse({
    result: 'Done',
    code: expect.stringContaining(`await expect(page.getByRole('slider')).toHaveValue('75');`),
  });
});

test('browser_verify_value (combobox)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Test Page</title>
    <form>
      <select name="country">
        <option>Choose a country</option>
        <option selected>United States</option>
        <option>United Kingdom</option>
      </select>
    </form>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_verify_value',
    arguments: {
      type: 'combobox',
      element: 'Country select',
      ref: 'e3',
      value: 'United States',
    },
  })).toHaveResponse({
    result: 'Done',
    code: expect.stringContaining(`await expect(page.getByRole('combobox')).toHaveValue('United States');`),
  });
});
