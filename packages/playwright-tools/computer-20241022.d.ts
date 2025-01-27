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

import type playwright from 'playwright';
import { JSONSchemaType } from './types';

export type ToolResult = {
  output?: string;
  error?: string;
  base64_image?: string;
};

export type ToolCall = (page: playwright.Page, tool: string, parameters: { [key: string]: JSONSchemaType; }) => Promise<ToolResult>;

export const call: ToolCall;
