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

import { z } from '../../mcpBundle';
import { defineTool } from './tool';
import { renderTabsMarkdown } from './response';

const browserTabs = defineTool({
  capability: 'core-tabs',

  schema: {
    name: 'browser_tabs',
    title: 'Manage tabs',
    description: [
      'List, create, close, or select a browser tab.',
      '',
      'When opening a new tab, the response includes a `tabId` — a stable identifier for',
      'that tab. Pass `tabId` to any other browser tool to direct its action at a specific',
      'tab rather than whichever tab happens to be active.  This is especially useful when',
      'multiple agents (or parallel tool calls) share the same browser session: each agent',
      'opens its own tab, keeps its `tabId`, and never interferes with the others.',
      '',
      'Backward compatibility: omitting `tabId` in other tools continues to work as before,',
      'targeting the currently active tab.',
    ].join('
'),
    inputSchema: z.object({
      action: z.enum(['list', 'new', 'close', 'select']).describe('Operation to perform'),
      index: z.number().optional().describe('Tab index, used for close/select. If omitted for close, current tab is closed.'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    switch (params.action) {
      case 'list': {
        await context.ensureTab();
        break;
      }
      case 'new': {
        const tab = await context.newTab();
        // Return the stable tabId so callers can pin subsequent tool calls to this tab.
        response.addTextResult(`Opened new tab. tabId: ${tab.tabId}`);
        const tabHeaders = await Promise.all(context.tabs().map(t => t.headerSnapshot()));
        const result = renderTabsMarkdown(tabHeaders);
        response.addTextResult(result.join('
'));
        return;
      }
      case 'close': {
        await context.closeTab(params.index);
        break;
      }
      case 'select': {
        if (params.index === undefined)
          throw new Error('Tab index is required');
        await context.selectTab(params.index);
        break;
      }
    }
    const tabHeaders = await Promise.all(context.tabs().map(tab => tab.headerSnapshot()));
    const result = renderTabsMarkdown(tabHeaders);
    response.addTextResult(result.join('
'));
  },
});

export default [
  browserTabs,
];
