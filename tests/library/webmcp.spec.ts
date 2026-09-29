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

import { browserTest as test, expect } from '../config/browserTest';

test.use({
  launchOptions: async ({ launchOptions, browserName }, use) => {
    if (browserName === 'firefox') {
      await use({
        ...launchOptions,
        firefoxUserPrefs: {
          ...launchOptions.firefoxUserPrefs,
          'dom.modelcontext.enabled': true,
          'dom.modelcontext.testing.enabled': true,
        },
      });
      return;
    }
    await use({ ...launchOptions, args: [...(launchOptions.args ?? []), '--enable-features=WebMCP'] });
  },
});

test.skip(({ browserName }) => browserName === 'webkit', 'WebKit does not implement WebMCP');
test.skip(({ isBidi }) => isBidi, 'WebMCP is not implemented over BiDi');

function registerScript(tools: string) {
  return `<script>
    const modelContext = document.modelContext || navigator.modelContext;
    ${tools}
  </script>`;
}

const kAdd = `
  modelContext.registerTool({
    name: 'add',
    description: 'Adds two numbers',
    inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] },
    annotations: { readOnlyHint: true },
    async execute(input) { return { content: [{ type: 'text', text: String(input.a + input.b) }] }; },
  });
`;

const kAddSchema = { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] };

function serve(server: any, path: string, body: string) {
  server.setRoute(path, (req: any, res: any) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>WebMCP</title>${body}`);
  });
}

test('should list tools registered by the page', async ({ page, server }) => {
  serve(server, '/', registerScript(kAdd + `
    modelContext.registerTool({
      name: 'noop',
      description: 'Does nothing',
      async execute() {},
    });
  `));
  await page.webmcp.enable();
  await page.goto(server.PREFIX + '/');

  // Browsers list tools in their own order.
  const tools = (await page.webmcp.tools()).sort((a, b) => a.name.localeCompare(b.name));
  expect(tools).toEqual([
    {
      name: 'add',
      description: 'Adds two numbers',
      inputSchema: kAddSchema,
      annotations: { readOnly: true },
    },
    {
      name: 'noop',
      description: 'Does nothing',
    },
  ]);
});

test('should report no tools when the page registers none', async ({ page, server }) => {
  await page.webmcp.enable();
  await page.goto(server.EMPTY_PAGE);
  expect(await page.webmcp.tools()).toEqual([]);
});

test('should call a tool', async ({ page, server }) => {
  serve(server, '/', registerScript(kAdd));
  await page.webmcp.enable();
  await page.goto(server.PREFIX + '/');

  expect(await page.webmcp.callTool('add', { a: 2, b: 40 })).toEqual({ content: [{ type: 'text', text: '42' }] });
});

test('should return isError results as is', async ({ page, server }) => {
  serve(server, '/', registerScript(`
    modelContext.registerTool({
      name: 'broken',
      description: 'Always fails',
      async execute() { return { content: [{ type: 'text', text: 'nope' }], isError: true }; },
    });
  `));
  await page.webmcp.enable();
  await page.goto(server.PREFIX + '/');

  expect(await page.webmcp.callTool('broken')).toEqual({ content: [{ type: 'text', text: 'nope' }], isError: true });
});

test('should throw when the tool throws', async ({ page, server }) => {
  serve(server, '/', registerScript(`
    modelContext.registerTool({
      name: 'throwing',
      description: 'Throws',
      async execute() { throw new Error('boom'); },
    });
  `));
  await page.webmcp.enable();
  await page.goto(server.PREFIX + '/');

  const error = await page.webmcp.callTool('throwing').catch(e => e);
  expect(error.message).toContain('boom');
});

test('should throw for an unknown tool', async ({ page, server }) => {
  serve(server, '/', registerScript(kAdd));
  await page.webmcp.enable();
  await page.goto(server.PREFIX + '/');

  const error = await page.webmcp.callTool('missing').catch(e => e);
  expect(error.message).toContain('No WebMCP tool named "missing"');
  expect(error.message).toContain('Available tools: add');
});

test('should time out when the tool does not settle', async ({ page, server }) => {
  serve(server, '/', registerScript(`
    modelContext.registerTool({
      name: 'stuck',
      description: 'Never resolves',
      execute() { return new Promise(() => {}); },
    });
  `));
  await page.webmcp.enable();
  await page.goto(server.PREFIX + '/');

  const error = await page.webmcp.callTool('stuck', {}, { timeout: 500 }).catch(e => e);
  expect(error.message).toContain('Timeout 500ms exceeded');
});

test('should drop tools after navigation', async ({ page, server }) => {
  serve(server, '/', registerScript(kAdd));
  await page.webmcp.enable();
  await page.goto(server.PREFIX + '/');
  expect(await page.webmcp.tools()).toHaveLength(1);

  await page.goto(server.EMPTY_PAGE);
  expect(await page.webmcp.tools()).toEqual([]);
  const error = await page.webmcp.callTool('add', { a: 1, b: 1 }).catch(e => e);
  expect(error.message).toContain('The frame does not register any WebMCP tools');
});

test('should emit toolschanged when navigating away from the tools', async ({ page, server }) => {
  serve(server, '/', registerScript(kAdd));
  await page.webmcp.enable();
  await page.goto(server.PREFIX + '/');
  expect(await page.webmcp.tools()).toHaveLength(1);

  const changed = page.webmcp.waitForEvent('toolschanged');
  await page.goto(server.EMPTY_PAGE);
  expect(await changed).toEqual([]);
});

test('should list tools registered before enable', async ({ page, server }) => {
  serve(server, '/', registerScript(kAdd));
  await page.goto(server.PREFIX + '/');

  await page.webmcp.enable();
  expect(await page.webmcp.tools()).toEqual([expect.objectContaining({ name: 'add' })]);
  expect(await page.webmcp.callTool('add', { a: 1, b: 2 })).toEqual({ content: [{ type: 'text', text: '3' }] });
});

test('should throw when used before enable', async ({ page }) => {
  const error = await page.webmcp.tools().catch(e => e);
  expect(error.message).toContain('WebMCP is not enabled. Call webmcp.enable() first.');
});

test('should stop after disable and resume after enable', async ({ page, server }) => {
  serve(server, '/', registerScript(kAdd));
  const disposable = await page.webmcp.enable();
  await page.goto(server.PREFIX + '/');
  expect(await page.webmcp.tools()).toHaveLength(1);

  const events: string[][] = [];
  page.webmcp.on('toolschanged', tools => events.push(tools.map(tool => tool.name)));
  await disposable.dispose();
  const error = await page.webmcp.tools().catch(e => e);
  expect(error.message).toContain('WebMCP is not enabled.');
  await page.evaluate(() => {
    const modelContext = (document as any).modelContext || (navigator as any).modelContext;
    modelContext.registerTool({ name: 'late', description: 'Registered later', async execute() {} });
  });
  await page.goto(server.EMPTY_PAGE);
  await page.goto(server.PREFIX + '/');
  expect(events).toEqual([]);

  await page.webmcp.enable();
  expect((await page.webmcp.tools()).map(tool => tool.name)).toEqual(['add']);
  const changed = page.webmcp.waitForEvent('toolschanged');
  await page.goto(server.EMPTY_PAGE);
  expect(await changed).toEqual([]);
});

test('should emit toolschanged when the page unregisters a tool', async ({ page, server, browserName }) => {
  test.skip(browserName !== 'firefox', 'Chromium does not implement unregisterTool');
  serve(server, '/', registerScript(kAdd));
  await page.webmcp.enable();
  await page.goto(server.PREFIX + '/');
  expect(await page.webmcp.tools()).toHaveLength(1);

  const changed = page.webmcp.waitForEvent('toolschanged');
  await page.evaluate(() => (navigator as any).modelContext.unregisterTool('add'));
  expect(await changed).toEqual([]);
});

test('should emit toolschanged when the page registers a tool', async ({ page, server }) => {
  serve(server, '/', registerScript(kAdd));
  await page.webmcp.enable();
  await page.goto(server.PREFIX + '/');

  const events: string[][] = [];
  page.webmcp.on('toolschanged', tools => events.push(tools.map(tool => tool.name)));
  const changed = page.webmcp.waitForEvent('toolschanged');
  await page.evaluate(() => {
    const modelContext = (document as any).modelContext || (navigator as any).modelContext;
    modelContext.registerTool({ name: 'late', description: 'Registered later', async execute() {} });
  });
  const tools = await changed;
  expect(tools.map(tool => tool.name)).toEqual(['add', 'late']);
  expect(events).toEqual([['add', 'late']]);
});

test('should list declarative tools', async ({ page, server, browserName }) => {
  test.skip(browserName !== 'chromium', 'Only Chromium implements declarative tools');
  serve(server, '/', `
    <form toolname="subscribe" tooldescription="Subscribes to the newsletter">
      <input name="email" type="email">
      <button>Subscribe</button>
    </form>
  `);
  await page.webmcp.enable();
  await page.goto(server.PREFIX + '/');

  expect(await page.webmcp.tools()).toEqual([expect.objectContaining({
    name: 'subscribe',
    description: 'Subscribes to the newsletter',
    inputSchema: expect.objectContaining({ type: 'object', properties: { email: { type: 'string' } } }),
  })]);

  // A declarative tool waits for the user to submit the form.
  const error = await page.webmcp.callTool('subscribe', { email: 'me@example.com' }, { timeout: 500 }).catch(e => e);
  expect(error.message).toContain('Timeout 500ms exceeded');

  const changed = page.webmcp.waitForEvent('toolschanged');
  await page.evaluate(() => document.querySelector('form')!.remove());
  expect(await changed).toEqual([]);
});

test('should scope tools to their frame', async ({ page, server, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox does not support registering WebMCP tools in iframes yet, https://bugzilla.mozilla.org/show_bug.cgi?id=2019743');
  serve(server, '/', registerScript(kAdd) + `<iframe src="/frame.html"></iframe>`);
  serve(server, '/frame.html', registerScript(`
    modelContext.registerTool({
      name: 'subscribe',
      description: 'Subscribes to the newsletter',
      async execute() { return { content: [{ type: 'text', text: 'subscribed' }] }; },
    });
  `));
  await page.webmcp.enable();
  await page.goto(server.PREFIX + '/');

  const childFrame = page.frames()[1];
  await childFrame.webmcp.enable();
  expect(await page.webmcp.tools()).toEqual([expect.objectContaining({ name: 'add' })]);
  expect(await childFrame.webmcp.tools()).toEqual([expect.objectContaining({ name: 'subscribe' })]);
  expect(await childFrame.webmcp.callTool('subscribe')).toEqual({ content: [{ type: 'text', text: 'subscribed' }] });

  const error = await page.webmcp.callTool('subscribe').catch(e => e);
  expect(error.message).toContain('No WebMCP tool named "subscribe"');
  expect(error.message).toContain('Available tools: add');
});

test('should call same-name tools in their own frame', async ({ page, server, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox does not support registering WebMCP tools in iframes yet, https://bugzilla.mozilla.org/show_bug.cgi?id=2019743');
  const registerEcho = (text: string) => registerScript(`
    modelContext.registerTool({
      name: 'echo',
      description: 'Echoes',
      async execute() { return { content: [{ type: 'text', text: '${text}' }] }; },
    });
  `);
  serve(server, '/', registerEcho('main') + `<iframe src="/frame.html"></iframe>`);
  serve(server, '/frame.html', registerEcho('frame'));
  await page.webmcp.enable();
  await page.goto(server.PREFIX + '/');
  const childFrame = page.frames()[1];
  await childFrame.webmcp.enable();

  expect(await page.webmcp.callTool('echo')).toEqual({ content: [{ type: 'text', text: 'main' }] });
  expect(await childFrame.webmcp.callTool('echo')).toEqual({ content: [{ type: 'text', text: 'frame' }] });
});
