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
import { defineTabTool } from './tool';

const console = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_console_messages',
    title: 'Get console messages',
    description: 'Returns all console messages',
    inputSchema: z.object({
      level: z.enum(['error', 'warning', 'info', 'debug']).default('info').describe('Level of the console messages to return. Each level includes the messages of more severe levels. Defaults to "info".'),
      filename: z.string().optional().describe('Filename to save the console messages to. If not provided, messages are returned as text.'),
    }),
    type: 'readOnly',
  },
  handle: async (tab, params, response) => {
    const messages = await tab.consoleMessages(params.level);
    const text = messages.map(message => message.toString()).join('\n');
    await response.addResult('Console', text, { prefix: 'console', ext: 'log', suggestedFilename: params.filename });
  },
});

const consoleClear = defineTabTool({
  capability: 'core',
  skillOnly: true,
  schema: {
    name: 'browser_console_clear',
    title: 'Clear console messages',
    description: 'Clear all console messages',
    inputSchema: z.object({}),
    type: 'readOnly',
  },
  handle: async tab => {
    await tab.clearConsoleMessages();
  },
});

export default [
  console,
  consoleClear,
];
