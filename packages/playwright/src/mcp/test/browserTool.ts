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
import type * as mcp from '../sdk/exports';
import type * as playwright from '../../../index';

export type BrowserTool<Input extends z.Schema = z.Schema> = {
  schema: mcp.ToolSchema<Input>;
  handle: (page: playwright.Page, params: z.output<Input>) => Promise<mcp.CallToolResult>;
};

export function defineBrowserTool<Input extends z.Schema>(tool: BrowserTool<Input>): BrowserTool<Input> {
  return tool;
}
