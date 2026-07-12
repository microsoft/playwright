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

test.describe('unresponsive tab', () => {
  test.skip(({ mcpBrowser }) => mcpBrowser !== 'chromium' && mcpBrowser !== 'chrome', 'busy-loop blocking Runtime.evaluate is a chromium CDP concern');

  test.beforeEach(async ({ client, server }) => {
    // Busy-loop the renderer's main thread for 3.5s, blocking any CDP
    // Runtime.evaluate call (like page.title()) from completing until the
    // loop ends -- faithfully simulating a Memory-Saver-discarded tab whose
    // renderer never answers CDP calls, without needing real browser
    // discard.
    //
    // The loop is deferred 200ms past the 'load' event (instead of running
    // synchronously during load) so that `browser_tabs new`, which awaits
    // navigation/load, returns control to us before the tab goes
    // unresponsive. It must stay the *current* tab throughout: MCP requests
    // are handled one at a time, so there is no way to fire a background
    // request that starts the loop concurrently with our test's own calls
    // -- and backgrounding this tab (selecting another one, which calls
    // page.bringToFront() on it) would let Chrome's background-tab timer
    // throttling delay or suspend the scheduled loop indefinitely. Keeping
    // it current sidesteps that while still exercising the real bug: the
    // response-building step in response.ts calls headerSnapshot() for
    // *every* open tab on every single command, regardless of which tab is
    // current.
    server.setContent('/busy-loop', `
      <title>Busy</title>
      <script>
        window.addEventListener('load', () => {
          setTimeout(() => {
            const end = Date.now() + 3500;
            while (Date.now() < end) {}
          }, 200);
        });
      </script>
    `, 'text/html');

    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });
  });

  test('does not block other commands and marks the tab as unresponsive', async ({ client, server }) => {
    // Opens as tab 1 and becomes the current tab.
    await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'new', url: server.PREFIX + '/busy-loop' },
    });

    // Let the deferred loop actually start (200ms delay + some slack for
    // dispatch) before we probe it -- it still has ~3s left to run at that
    // point, comfortably past our 3000ms timeout guard.
    await new Promise(resolve => setTimeout(resolve, 500));

    const start = Date.now();
    const listResponse = parseResponse(await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'list' },
    }));
    const elapsed = Date.now() - start;

    // Must complete well within the old 30s hang, and comfortably before the
    // busy-loop's own 3.5s finishes -- proving the 3000ms guard, not luck.
    expect(elapsed).toBeLessThan(3500);
    expect(listResponse.result).toContain('[unresponsive]');
    // Tab 0 (hello-world, untouched by the busy loop) must still report its
    // real title, proving one wedged tab doesn't poison the others even
    // though every command's response renders headers for all open tabs.
    expect(listResponse.result).toContain('[Title](' + server.HELLO_WORLD + ')');

    // Snapshotting also must not hang, even though it still has to render
    // headers for the (still unresponsive) busy tab in its response.
    const snapshotStart = Date.now();
    await client.callTool({ name: 'browser_snapshot' });
    expect(Date.now() - snapshotStart).toBeLessThan(3000);
  });
});
