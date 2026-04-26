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

test('browser_recording_start starts a recording session', async ({ client }) => {
    expect(await client.callTool({
        name: 'browser_recording_start',
        arguments: {},
    })).toHaveResponse({
        result: expect.stringContaining('Recording started'),
    });

    // Clean up
    await client.callTool({ name: 'browser_recording_stop', arguments: {} });
});

test('browser_recording_get returns empty message before any interactions', async ({ client }) => {
    await client.callTool({ name: 'browser_recording_start', arguments: {} });

    expect(await client.callTool({
        name: 'browser_recording_get',
        arguments: {},
    })).toHaveResponse({
        result: expect.stringContaining('No interactions'),
    });

    await client.callTool({ name: 'browser_recording_stop', arguments: {} });
});

test('browser_recording_get returns empty message when not recording', async ({ client }) => {
    expect(await client.callTool({
        name: 'browser_recording_get',
        arguments: {},
    })).toHaveResponse({
        result: expect.stringContaining('No interactions'),
    });
});

test('browser_recording_stop returns interaction count', async ({ client }) => {
    await client.callTool({ name: 'browser_recording_start', arguments: {} });

    expect(await client.callTool({
        name: 'browser_recording_stop',
        arguments: {},
    })).toHaveResponse({
        result: expect.stringContaining('Recording stopped'),
    });
});

test('browser_recording captures navigation', async ({ client, server }) => {
    await client.callTool({ name: 'browser_recording_start', arguments: {} });

    await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.HELLO_WORLD },
    });

    expect(await client.callTool({
        name: 'browser_recording_get',
        arguments: {},
    })).toHaveResponse({
        result: expect.stringContaining(`page.goto('${server.HELLO_WORLD}')`),
    });

    await client.callTool({ name: 'browser_recording_stop', arguments: {} });
});

test('browser_recording captures multiple navigations', async ({ client, server }) => {
    await client.callTool({ name: 'browser_recording_start', arguments: {} });

    await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.HELLO_WORLD },
    });
    await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.EMPTY_PAGE },
    });

    const result = await client.callTool({
        name: 'browser_recording_get',
        arguments: {},
    });
    expect(result).toHaveResponse({
        result: expect.stringContaining(`page.goto('${server.HELLO_WORLD}')`),
    });
    expect(result).toHaveResponse({
        result: expect.stringContaining(`page.goto('${server.EMPTY_PAGE}')`),
    });

    await client.callTool({ name: 'browser_recording_stop', arguments: {} });
});

test('browser_recording_start errors when already recording', async ({ client }) => {
    await client.callTool({ name: 'browser_recording_start', arguments: {} });

    expect(await client.callTool({
        name: 'browser_recording_start',
        arguments: {},
    })).toHaveResponse({
        error: expect.stringContaining('already in progress'),
        isError: true,
    });

    await client.callTool({ name: 'browser_recording_stop', arguments: {} });
});

test('browser_recording captures click on interactive element', async ({ client, server }) => {
    server.setContent('/recording-form', `
    <title>Recording Form</title>
    <body>
      <button id="submit-btn">Submit</button>
    </body>
  `, 'text/html');

    await client.callTool({ name: 'browser_recording_start', arguments: {} });

    await client.callTool({
        name: 'browser_navigate',
        arguments: { url: `${server.PREFIX}/recording-form` },
    });

    // Trigger a click using Playwright's click tool (generates a real DOM click event)
    await client.callTool({
        name: 'browser_click',
        arguments: {
            element: 'Submit',
            ref: 'e2',
        },
    });

    const result = await client.callTool({
        name: 'browser_recording_get',
        arguments: {},
    });
    expect(result).toHaveResponse({
        result: expect.stringContaining('page.goto('),
    });

    await client.callTool({ name: 'browser_recording_stop', arguments: {} });
});

test('browser_recording can be restarted after stop', async ({ client, server }) => {
    // First session
    await client.callTool({ name: 'browser_recording_start', arguments: {} });
    await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.HELLO_WORLD },
    });
    await client.callTool({ name: 'browser_recording_stop', arguments: {} });

    // Second session should start fresh
    await client.callTool({ name: 'browser_recording_start', arguments: {} });

    expect(await client.callTool({
        name: 'browser_recording_get',
        arguments: {},
    })).toHaveResponse({
        result: expect.stringContaining('No interactions'),
    });

    await client.callTool({ name: 'browser_recording_stop', arguments: {} });
});
