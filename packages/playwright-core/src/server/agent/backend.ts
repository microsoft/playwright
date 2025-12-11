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

import toolDefinitions from './tools';
import { zodToJsonSchema } from '../../mcpBundle';

import type * as loopTypes from '@lowire/loop';
import type { Context } from './context';

export function toolsForLoop(context: Context): { tools: loopTypes.Tool[], callTool: loopTypes.ToolCallback } {
  const tools = toolDefinitions.map(tool => {
    const result: loopTypes.Tool = {
      name: tool.schema.name,
      description: tool.schema.description,
      inputSchema: zodToJsonSchema(tool.schema.inputSchema) as loopTypes.Schema,
    };
    return result;
  });

  const callTool: loopTypes.ToolCallback = async params => {
    const intent = params.arguments._meta?.['dev.lowire/intent'];
    const tool = toolDefinitions.find(t => t.schema.name === params.name);
    if (!tool) {
      return {
        content: [{ type: 'text',
          text: `Tool ${params.name} not found. Available tools: ${toolDefinitions.map(t => t.schema.name)}`
        }],
        isError: true,
      };
    }

    try {
      return await context.callTool(tool, params.arguments, { intent });
    } catch (error) {
      return {
        content: [{ type: 'text', text: error.message }],
        isError: true,
      };
    }
  };

  return {
    tools,
    callTool,
  };
}
