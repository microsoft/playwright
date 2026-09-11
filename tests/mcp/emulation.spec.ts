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

test('browser_emulate_media', async ({ client, server }) => {
  server.setContent('/', `
    <div id="scheme"></div>
    <div id="media"></div>
    <script>
      const colorScheme = matchMedia('(prefers-color-scheme: dark)');
      const print = matchMedia('print');
      const update = () => {
        document.getElementById('scheme').textContent = \`Color scheme: \${colorScheme.matches ? 'dark' : 'light'}\`;
        document.getElementById('media').textContent = \`Media type: \${print.matches ? 'print' : 'screen'}\`;
      };
      colorScheme.addEventListener('change', update);
      print.addEventListener('change', update);
      update();
    </script>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_emulate_media',
    arguments: { colorScheme: 'dark' },
  })).toHaveResponse({
    code: `await page.emulateMedia({ colorScheme: 'dark' });`,
  });
  await expect.poll(() => client.callTool({ name: 'browser_snapshot' })).toHaveResponse({
    inlineSnapshot: expect.stringContaining(`Color scheme: dark`),
  });

  expect(await client.callTool({
    name: 'browser_emulate_media',
    arguments: { media: 'screen', reducedMotion: 'reduce' },
  })).toHaveResponse({
    code: `await page.emulateMedia({ media: 'screen', reducedMotion: 'reduce' });`,
  });
  await expect.poll(() => client.callTool({ name: 'browser_snapshot' })).toHaveResponse({
    inlineSnapshot: expect.stringContaining(`Color scheme: dark`),
  });

  expect(await client.callTool({
    name: 'browser_emulate_media',
    arguments: { media: 'print' },
  })).toHaveResponse({
    code: `await page.emulateMedia({ media: 'print' });`,
  });
  await expect.poll(() => client.callTool({ name: 'browser_snapshot' })).toHaveResponse({
    inlineSnapshot: expect.stringContaining(`Media type: print`),
  });

  expect(await client.callTool({
    name: 'browser_emulate_media',
    arguments: { colorScheme: null, contrast: null, forcedColors: null, media: null, reducedMotion: null },
  })).toHaveResponse({
    code: `await page.emulateMedia({ colorScheme: null, contrast: null, forcedColors: null, media: null, reducedMotion: null });`,
  });
  await expect.poll(() => client.callTool({ name: 'browser_snapshot' })).toHaveResponse({
    inlineSnapshot: expect.stringContaining(`Media type: screen`),
  });
});

test('browser_emulate_media requires a media feature', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_emulate_media',
    arguments: {},
  })).toHaveResponse({
    error: expect.stringContaining('Specify at least one media feature to emulate.'),
    isError: true,
  });
});
