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

import { z } from 'playwright-core/lib/mcpBundle';
import { defineTool, defineTabTool } from './tool';

const navigate = defineTool({
  capability: 'core-navigation',

  schema: {
    name: 'browser_navigate',
    title: 'Navigate to a URL',
    description: 'Navigate to a URL',
    inputSchema: z.object({
      url: z.string().describe('The URL to navigate to'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const tab = await context.ensureTab();
    let url = params.url;
    try {
      new URL(url);
    } catch (e) {
      if (url.startsWith('localhost'))
        url = 'http://' + url;
      else
        url = 'https://' + url;
    }

    await tab.navigate(url);

    response.setIncludeSnapshot();
    response.addCode(`await page.goto('${params.url}');`);
  },
});

const open = defineTool({
  capability: 'core-navigation',
  skillOnly: true,
  schema: {
    name: 'browser_open',
    title: 'Open URL',
    description: 'Open a URL in the browser',
    inputSchema: z.object({
      url: z.string().describe('The URL to open'),
      headed: z.boolean().optional().describe('Run browser in headed mode'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const forceHeadless = params.headed ? 'headed' : 'headless';
    const tab = await context.ensureTab({ forceHeadless });
    let url = params.url;
    try {
      new URL(url);
    } catch (e) {
      if (url.startsWith('localhost'))
        url = 'http://' + url;
      else
        url = 'https://' + url;
    }

    await tab.navigate(url);

    response.setIncludeSnapshot();
    response.addCode(`await page.goto('${params.url}');`);
  },
});

const goBack = defineTabTool({
  capability: 'core-navigation',
  schema: {
    name: 'browser_navigate_back',
    title: 'Go back',
    description: 'Go back to the previous page in the history',
    inputSchema: z.object({}),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    await tab.page.goBack();
    response.setIncludeSnapshot();
    response.addCode(`await page.goBack();`);
  },
});

const goForward = defineTabTool({
  capability: 'core-navigation',
  skillOnly: true,
  schema: {
    name: 'browser_navigate_forward',
    title: 'Go forward',
    description: 'Go forward to the next page in the history',
    inputSchema: z.object({}),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    await tab.page.goForward();
    response.setIncludeSnapshot();
    response.addCode(`await page.goForward();`);
  },
});

const reload = defineTabTool({
  capability: 'core-navigation',
  skillOnly: true,
  schema: {
    name: 'browser_reload',
    title: 'Reload the page',
    description: 'Reload the current page',
    inputSchema: z.object({}),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    await tab.page.reload();
    response.setIncludeSnapshot();
    response.addCode(`await page.reload();`);
  },
});

export default [
  navigate,
  open,
  goBack,
  goForward,
  reload,
];
