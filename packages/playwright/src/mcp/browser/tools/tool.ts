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

import type { z } from 'zod';
import type { Context } from '../context';
import type * as playwright from 'playwright-core';
import type { ToolCapability } from '../../config';
import type { Tab } from '../tab';
import type { Response } from '../response';
import type { ToolSchema } from '../../sdk/tool';

export type FileUploadModalState = {
  type: 'fileChooser';
  description: string;
  fileChooser: playwright.FileChooser;
};

export type DialogModalState = {
  type: 'dialog';
  description: string;
  dialog: playwright.Dialog;
};

export type ModalState = FileUploadModalState | DialogModalState;

export type Tool<Input extends z.Schema = z.Schema> = {
  capability: ToolCapability;
  schema: ToolSchema<Input>;
  handle: (context: Context, params: z.output<Input>, response: Response) => Promise<void>;
};

export function defineTool<Input extends z.Schema>(tool: Tool<Input>): Tool<Input> {
  return tool;
}

export type TabTool<Input extends z.Schema = z.Schema> = {
  capability: ToolCapability;
  schema: ToolSchema<Input>;
  clearsModalState?: ModalState['type'];
  handle: (tab: Tab, params: z.output<Input>, response: Response) => Promise<void>;
};

export function defineTabTool<Input extends z.Schema>(tool: TabTool<Input>): Tool<Input> {
  return {
    ...tool,
    handle: async (context, params, response) => {
      const tab = context.currentTabOrDie();
      const modalStates = tab.modalStates().map(state => state.type);
      if (tool.clearsModalState && !modalStates.includes(tool.clearsModalState))
        response.addError(`Error: The tool "${tool.schema.name}" can only be used when there is related modal state present.\n` + tab.modalStatesMarkdown().join('\n'));
      else if (!tool.clearsModalState && modalStates.length)
        response.addError(`Error: Tool "${tool.schema.name}" does not handle the modal state.\n` + tab.modalStatesMarkdown().join('\n'));
      else
        return tool.handle(tab, params, response);
    },
  };
}
