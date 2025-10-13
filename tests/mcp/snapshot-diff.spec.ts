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

test('should return aria snapshot diff', async ({ client, server }) => {
  server.setContent('/', `
    <button>Button 1</button>
    <button>Button 2</button>
    <ul id=filler></ul>
    <script>
      const filler = document.getElementById('filler');
      for (let i = 0; i < 100; i++) {
        const li = document.createElement('li');
        li.textContent = 'Filler ' + i;
        filler.appendChild(li);
      }
      const [button1, button2] = document.querySelectorAll('button');
      button1.addEventListener('click', () => {
        const span = document.createElement('span');
        span.textContent = 'new text';
        button2.appendChild(span);
        button1.focus(); // without manual focus, webkit focuses body
      });
      button2.focus();
      button2.addEventListener('click', () => {
        button2.focus(); // without manual focus, webkit focuses body
      });
    </script>
  `, 'text/html');

  const listitems = new Array(100).fill(0).map((_, i) => `\n    - listitem [ref=e${5 + i}]: Filler ${i}`).join('');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  })).toHaveResponse({
    pageState: expect.stringContaining(`
  - button "Button 1" [ref=e2]
  - button "Button 2" [active] [ref=e3]
  - list [ref=e4]:${listitems}`),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button 2',
      ref: 'e3',
    },
  })).toHaveResponse({
    pageState: expect.stringContaining(`Page Snapshot:
\`\`\`yaml
- ref=e1 [unchanged]
\`\`\``),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button 1',
      ref: 'e2',
    },
  })).toHaveResponse({
    pageState: expect.stringContaining(`Page Snapshot:
\`\`\`yaml
- generic [ref=e1]:
  - button "Button 1" [active] [ref=e2]
  - button "Button 2new text" [ref=e105]
  - ref=e4 [unchanged]
\`\`\``),
  });

  // browser_snapshot forces a full snapshot.
  expect(await client.callTool({
    name: 'browser_snapshot',
  })).toHaveResponse({
    pageState: expect.stringContaining(`Page Snapshot:
\`\`\`yaml
- generic [ref=e1]:
  - button "Button 1" [active] [ref=e2]
  - button "Button 2new text" [ref=e105]
  - list [ref=e4]:${listitems}
\`\`\``),
  });
});

test('should reset aria snapshot diff upon navigation', async ({ client, server }) => {
  server.setContent('/before', `
    <button>Button 1</button>
    <button>Button 2</button>
    <ul id=filler></ul>
    <script>
      const filler = document.getElementById('filler');
      for (let i = 0; i < 100; i++) {
        const li = document.createElement('li');
        li.textContent = 'Filler ' + i;
        filler.appendChild(li);
      }
      document.querySelector('button').addEventListener('click', () => {
        window.location.href = '/after';
      });
      document.querySelectorAll('button')[1].focus();
    </script>
  `, 'text/html');

  server.setContent('/after', `
    <button>Button 1</button>
    <button>Button 2</button>
    <ul id=filler></ul>
    <script>
      const filler = document.getElementById('filler');
      for (let i = 0; i < 100; i++) {
        const li = document.createElement('li');
        li.textContent = 'Filler ' + i;
        filler.appendChild(li);
      }
      document.querySelectorAll('button')[1].focus();
    </script>
  `, 'text/html');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX + '/before',
    },
  })).toHaveResponse({
    pageState: expect.stringContaining(`
  - button "Button 1" [ref=e2]
  - button "Button 2" [active] [ref=e3]`),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button 1',
      ref: 'e2',
    },
  })).toHaveResponse({
    pageState: expect.stringContaining(`
  - button "Button 1" [ref=e2]
  - button "Button 2" [active] [ref=e3]`),
  });
});
