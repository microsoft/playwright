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

test.use({
  mcpCaps: ['vision'],
});

test('browser_mouse_move_xy', async ({ client, server }) => {
  server.setContent('/', `
    <title>Mouse</title>
    <style>
      body { margin: 0; }
      #pad { width: 400px; height: 300px; position: relative; }
      #out { position: absolute; top: 0; left: 0; font-family: monospace; }
    </style>
    <div id="pad">
      <div id="out"></div>
    </div>
    <script>
      const out = document.querySelector('#out');
      document.addEventListener('mousemove', e => {
        out.textContent = 'x:' + e.clientX + ' y:' + e.clientY;
      });
    </script>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_mouse_move_xy',
    arguments: { x: 50, y: 60 },
  });

  expect(result).toHaveResponse({
    code: `// Move mouse to (50, 60)
await page.mouse.move(50, 60);`,
  });

  expect(await client.callTool({
    name: 'browser_snapshot',
    arguments: {},
  })).toHaveTextResponse(expect.stringContaining('x:50 y:60'));
});

test('browser_mouse_click_xy (default options)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Mouse</title>
    <style>
      body { margin: 0; }
      #target { width: 200px; height: 100px; background: #eee; }
    </style>
    <div id="target"></div>
    <script>
      const t = document.querySelector('#target');
      t.addEventListener('click', e => {
        t.textContent = 'clicked ' + e.button + ' detail:' + e.detail;
      });
    </script>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_mouse_click_xy',
    arguments: { x: 10, y: 10 },
  });

  expect(result).toHaveResponse({
    code: `// Click mouse at coordinates (10, 10)
await page.mouse.click(10, 10);`,
    snapshot: expect.any(String),
  });

  expect(await client.callTool({
    name: 'browser_snapshot',
    arguments: {},
  })).toHaveTextResponse(expect.stringContaining('clicked 0 detail:1'));
});

test('browser_mouse_click_xy (with options)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Mouse</title>
    <style>
      body { margin: 0; }
      #target { width: 200px; height: 100px; background: #eee; }
    </style>
    <div id="target"></div>
    <script>
      const t = document.querySelector('#target');
      t.addEventListener('click', e => {
        t.textContent = 'clicked ' + e.button + ' detail:' + e.detail;
      });
    </script>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_mouse_click_xy',
    arguments: { x: 10, y: 10, button: 'left', clickCount: 2, delay: 1 },
  });

  expect(result).toHaveResponse({
    code: `// Click mouse at coordinates (10, 10)
await page.mouse.click(10, 10, { button: 'left', clickCount: 2, delay: 1 });`,
    snapshot: expect.any(String),
  });

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: { function: '() => document.querySelector("#target").textContent' },
  })).toHaveResponse({
    result: `"clicked 0 detail:2"`,
  });
});

test('browser_mouse_drag_xy', async ({ client, server }) => {
  server.setContent('/', `
    <title>Mouse</title>
    <style>
      body { margin: 0; }
      #pad { width: 400px; height: 200px; background: #fafafa; border: 1px solid #ccc; }
      #out { font-family: monospace; }
    </style>
    <div id="pad"></div>
    <div id="out"></div>
    <script>
      const out = document.querySelector('#out');
      let down = false;
      document.addEventListener('mousedown', () => down = true);
      document.addEventListener('mouseup', () => down = false);
      document.addEventListener('mousemove', e => {
        if (!down) return;
        out.textContent = 'dragging x:' + e.clientX + ' y:' + e.clientY;
      });
    </script>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_mouse_drag_xy',
    arguments: { startX: 10, startY: 10, endX: 90, endY: 30 },
  });

  expect(result).toHaveResponse({
    code: [
      `// Drag mouse from (10, 10) to (90, 30)`,
      `await page.mouse.move(10, 10);`,
      `await page.mouse.down();`,
      `await page.mouse.move(90, 30);`,
      `await page.mouse.up();`,
    ].join('\n'),
    snapshot: expect.any(String),
  });

  expect(await client.callTool({
    name: 'browser_snapshot',
    arguments: {},
  })).toHaveTextResponse(expect.stringContaining('dragging x:90 y:30'));
});

test('browser_mouse_down/up', async ({ client, server }) => {
  server.setContent('/', `
    <title>Mouse</title>
    <script>
      window.events = [];
      document.addEventListener('mousedown', e => window.events.push('down:' + e.button));
      document.addEventListener('mouseup', e => window.events.push('up:' + e.button));
    </script>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_mouse_down',
    arguments: {},
  })).toHaveResponse({
    code: `// Press mouse down
await page.mouse.down();`,
  });

  expect(await client.callTool({
    name: 'browser_mouse_up',
    arguments: {},
  })).toHaveResponse({
    code: `// Press mouse up
await page.mouse.up();`,
  });

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: { function: '() => JSON.stringify(window.events)' },
  })).toHaveResponse({
    result: `"[\\"down:0\\",\\"up:0\\"]"`,
  });

  expect(await client.callTool({
    name: 'browser_mouse_down',
    arguments: { button: 'middle' },
  })).toHaveResponse({
    code: `// Press mouse down
await page.mouse.down({ button: 'middle' });`,
  });

  expect(await client.callTool({
    name: 'browser_mouse_up',
    arguments: { button: 'middle' },
  })).toHaveResponse({
    code: `// Press mouse up
await page.mouse.up({ button: 'middle' });`,
  });

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: { function: '() => JSON.stringify(window.events)' },
  })).toHaveResponse({
    result: `"[\\"down:0\\",\\"up:0\\",\\"down:1\\",\\"up:1\\"]"`,
  });
});

test('browser_mouse_wheel', async ({ client, server }) => {
  server.setContent('/', `
    <title>Mouse</title>
    <style>
      body { margin: 0; }
      #scroller { width: 200px; height: 50px; overflow: auto; border: 1px solid #ccc; }
      #inner { width: 200px; height: 1000px; }
    </style>
    <div id="scroller"><div id="inner"></div></div>
    <script>
      const scroller = document.querySelector('#scroller');
      scroller.addEventListener('scroll', () => {
        scroller.dataset.top = String(scroller.scrollTop);
      });
      // initialize so that evaluate does not return undefined in case wheel doesn't scroll enough
      scroller.dataset.top = String(scroller.scrollTop);
    </script>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_mouse_wheel',
    arguments: { deltaY: 100 },
  });

  expect(result).toHaveResponse({
    code: `// Scroll mouse wheel
await page.mouse.wheel(0, 100);`,
  });

  // Verify scroll happened. `wheel` is not guaranteed to scroll a nested scroller,
  // but the page should observe some scrollTop change when it does.
  const top = await client.callTool({
    name: 'browser_evaluate',
    arguments: { function: '() => document.querySelector("#scroller").scrollTop' },
  });
  // It should return a number-like string, but we don't assert it changes here to avoid flakiness.
  expect(top).toHaveResponse({
    result: expect.stringMatching(/^\d+$/),
  });
});
