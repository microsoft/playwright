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

import * as z from 'zod';
import { defineTool } from './tool';
import { extensionSessionFor } from './extensionSession';
import { renderTabsMarkdown } from './response';

const browserTabs = defineTool({
  capability: 'core-tabs',

  schema: {
    name: 'browser_tabs',
    title: 'Manage tabs',
    description: 'List, create, close, or select a browser tab.',
    inputSchema: z.object({
      action: z.enum(['list', 'new', 'close', 'select']).describe('Operation to perform'),
      index: z.number().optional().describe('Tab index, used for close/select. If omitted for close, current tab is closed.'),
      url: z.string().optional().describe('URL to navigate to in the new tab, used for new.'),
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
        if (params.url) {
          const url = await tab.checkUrlAndNavigate(params.url);
          response.setIncludeSnapshot();
          response.addAction({ name: 'navigate', url });
        }
        break;
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
    response.addTextResult(result.join('\n'));
  },
});

const browserSetGroupLabel = defineTool({
  capability: 'core-tabs',
  extensionOnly: true,

  schema: {
    name: 'browser_set_group_label',
    title: 'Label the tab group',
    description: 'Set a short label on this session\'s browser tab group, shown to the user as "Playwright · <label>". Call it once, early in the task, so the user can tell which tab group belongs to which task, especially when several agents share the browser.',
    inputSchema: z.object({
      label: z.string().trim().min(1).max(50).describe('Short label describing the current task, e.g. "checkout flow bug".'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const session = extensionSessionFor((await context.ensureBrowserContext()).browser());
    if (!session)
      throw new Error('This tool is only available when connected to a browser via the Playwright Extension.');
    const { title } = await session.setGroupLabel(params.label);
    response.addTextResult(`Tab group renamed to "${title}".`);
  },
});

export default [
  browserTabs,
  browserSetGroupLabel,
];
