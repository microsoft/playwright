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
import type { Context } from './context';
import type * as playwright from '../../..';
import type { Tab } from './tab';
import type { Response } from './response';

export type { CallToolResult, CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

type ToolSchema<Input extends z.Schema> = {
  name: string;
  title: string;
  description: string;
  inputSchema: Input;
  type: 'input' | 'assertion' | 'action' | 'readOnly';
};

export type ToolCapability = 'config' | 'core' | 'core-navigation' | 'core-tabs' | 'core-input' | 'core-install' | 'network' | 'pdf' | 'storage' | 'testing' | 'vision' | 'devtools';

export type FileUploadModalState = {
  type: 'fileChooser';
  description: string;
  fileChooser: playwright.FileChooser;
  clearedBy: { tool: string; skill: string };
};

export type DialogModalState = {
  type: 'dialog';
  description: string;
  dialog: playwright.Dialog;
  clearedBy: { tool: string; skill: string };
};

export type ModalState = FileUploadModalState | DialogModalState;

export type Tool<Input extends z.Schema = z.Schema> = {
  capability: ToolCapability;
  skillOnly?: boolean;
  schema: ToolSchema<Input>;
  handle: (context: Context, params: z.output<Input>, response: Response) => Promise<void>;
};

export function defineTool<Input extends z.Schema>(tool: Tool<Input>): Tool<Input> {
  return tool;
}

export type TabTool<Input extends z.Schema = z.Schema> = {
  capability: ToolCapability;
  skillOnly?: boolean;
  schema: ToolSchema<Input>;
  clearsModalState?: ModalState['type'];
  handle: (tab: Tab, params: z.output<Input>, response: Response) => Promise<void>;
};

const tabIdSchema = z.string().optional().describe('Tab ID to target a specific tab, obtained from browser_tabs({ action: "new" }).');

export function defineTabTool<Input extends z.ZodObject<z.ZodRawShape>>(tool: TabTool<Input>): Tool<Input> {
  const inputSchema = tool.schema.inputSchema.extend({ tabId: tabIdSchema }) as unknown as Input;
  return {
    ...tool,
    schema: { ...tool.schema, inputSchema },
    handle: async (context, params, response) => {
      const tabId = (params as { tabId?: string }).tabId;
      let tab: Tab;
      if (tabId) {
        const found = context.tabById(tabId);
        if (!found)
          throw new Error(`Tab "${tabId}" not found`);
        tab = found;
      } else {
        tab = await context.ensureTab();
      }
      const modalStates = tab.modalStates().map(state => state.type);
      if (tool.clearsModalState && !modalStates.includes(tool.clearsModalState))
        response.addError(`Error: The tool "${tool.schema.name}" can only be used when there is related modal state present.`);
      else if (!tool.clearsModalState && modalStates.length)
        response.addError(`Error: Tool "${tool.schema.name}" does not handle the modal state.`);
      else
        return tool.handle(tab, params, response);
    },
  };
}
