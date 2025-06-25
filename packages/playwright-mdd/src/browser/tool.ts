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
import type * as playwright from 'playwright-core';
import type { Context } from './context';
import type { ToolSchema } from '../loop';

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

export type ToolActionResult = string | undefined | void;

export type ToolResult = {
  code: string[];
  action?: () => Promise<void>;
  captureSnapshot: boolean;
  waitForNetwork: boolean;
};

export type Tool<Input extends z.Schema = z.Schema> = {
  schema: ToolSchema<Input>;
  clearsModalState?: ModalState['type'];
  handle: (context: Context, params: z.output<Input>) => Promise<ToolResult>;
};

export function defineTool<Input extends z.Schema>(tool: Tool<Input>): Tool<Input> {
  return tool;
}
