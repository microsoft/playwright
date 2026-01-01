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

test('test geolocation capability available with --caps=geolocation', async ({ startClient }) => {
    const { client } = await startClient({
        args: ['--caps=geolocation'],
    });
    const { tools } = await client.listTools();
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('browser_set_geolocation');
    expect(toolNames).toContain('browser_clear_geolocation');
});

test('browser_set_geolocation', async ({ startClient, server }) => {
    server.setContent('/', `
    <title>Geolocation Test</title>
    <div id="coords">Waiting...</div>
    <script>
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          document.getElementById('coords').textContent = 
            'Lat: ' + pos.coords.latitude.toFixed(2) + ', Lng: ' + pos.coords.longitude.toFixed(2);
        },
        (err) => {
          document.getElementById('coords').textContent = 'Error: ' + err.message;
        }
      );
    </script>
  `, 'text/html');

    const { client } = await startClient({
        args: ['--caps=geolocation'],
    });

    // Set geolocation to San Francisco coordinates
    expect(await client.callTool({
        name: 'browser_set_geolocation',
        arguments: {
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy: 100,
        },
    })).toHaveResponse({
        code: expect.stringContaining(`await page.context().setGeolocation`),
    });

    // Navigate to page - geolocation will be fetched automatically
    await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
    });

    // Verify the mocked coordinates are returned
    await expect.poll(() => client.callTool({ name: 'browser_snapshot' })).toHaveResponse({
        pageState: expect.stringContaining('Lat: 37.77'),
    });
});

test('browser_clear_geolocation', async ({ startClient }) => {
    const { client } = await startClient({
        args: ['--caps=geolocation'],
    });

    // Set geolocation first
    await client.callTool({
        name: 'browser_set_geolocation',
        arguments: {
            latitude: 37.7749,
            longitude: -122.4194,
        },
    });

    // Clear geolocation
    expect(await client.callTool({
        name: 'browser_clear_geolocation',
        arguments: {},
    })).toHaveResponse({
        code: expect.stringContaining(`await page.context().setGeolocation(null)`),
    });
});
