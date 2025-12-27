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

import { zodToJsonSchema } from '../../mcpBundle';

import type zod from 'zod';
import type * as loopTypes from '@lowire/loop';
import type { Context } from './context';

export type ToolSchema<Input extends zod.Schema> = Omit<loopTypes.Tool, 'inputSchema'> & {
  title: string;
  inputSchema: Input;
};

export type ToolDefinition<Input extends zod.Schema = zod.Schema> = {
  schema: ToolSchema<Input>;
  handle: (context: Context, params: zod.output<Input>) => Promise<loopTypes.ToolResult>;
};

export function defineTool<Input extends zod.Schema>(tool: ToolDefinition<Input>): ToolDefinition<Input> {
  return tool;
}

export function toolsForLoop(context: Context, toolDefinitions: ToolDefinition[], options: { resultSchema?: loopTypes.Schema } = {}): { tools: loopTypes.Tool[], callTool: loopTypes.ToolCallback } {
  const tools = toolDefinitions.map(tool => {
    const result: loopTypes.Tool = {
      name: tool.schema.name,
      description: tool.schema.description,
      inputSchema: zodToJsonSchema(tool.schema.inputSchema) as loopTypes.Schema,
    };
    return result;
  });
  if (options.resultSchema) {
    tools.push({
      name: 'report_result',
      description: 'Report the result of the task.',
      inputSchema: options.resultSchema,
    });
  }

  const callTool: loopTypes.ToolCallback = async params => {
    const intent = params.arguments._meta?.['dev.lowire/intent'];
    if (params.name === 'report_result') {
      return {
        content: [{ type: 'text', text: JSON.stringify(params.arguments) }],
        isError: false,
      };
    }

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
