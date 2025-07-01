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
import type { Context } from './context';
import type { ToolSchema } from '../loop';

export type Tool<Input extends z.Schema = z.Schema> = {
  schema: ToolSchema<Input>;
  handle: (context: Context, params: z.output<Input>) => Promise<{ content: string, code: string[] }>;
};

export function defineTool<Input extends z.Schema>(tool: Tool<Input>): Tool<Input> {
  return tool;
}
