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

import { z } from 'zod';
import OpenAI from 'openai';
import debug from 'debug';
import { zodToJsonSchema } from 'zod-to-json-schema';

const model = 'gpt-4.1';
/* eslint-disable no-console */

export interface Context {
  readonly tools: Tool<any>[];
  beforeTask?(task: string): Promise<void>;
  runTool(tool: Tool<any>, params: Record<string, unknown>): Promise<{ content: string }>;
  afterTask?(): Promise<void>;
}

export type ToolSchema<Input extends z.Schema> = {
  name: string;
  description: string;
  inputSchema: Input;
};

export type Tool<Input extends z.Schema = z.Schema> = {
  schema: ToolSchema<Input>;
};

export async function runTasks(context: Context, tasks: string[]) {
  const openai = new OpenAI();
  for (const task of tasks)
    await runTask(openai, context, task);
}

async function runTask(openai: OpenAI, context: Context, task: string) {
  console.log('Perform task:', task);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'user',
      content: `Peform following task: ${task}. Once the task is complete, call the "done" tool.`
    }
  ];

  await context.beforeTask?.(task);

  for (let iteration = 0; iteration < 5; ++iteration) {
    debug('history')(messages);
    const response = await openai.chat.completions.create({
      model,
      messages,
      tools: context.tools.map(asOpenAIDeclaration),
      tool_choice: 'auto'
    });

    const message = response.choices[0].message;
    if (!message.tool_calls?.length)
      throw new Error('Unexpected response from LLM: ' + message.content);

    messages.push({
      role: 'assistant',
      tool_calls: message.tool_calls
    });

    for (const toolCall of message.tool_calls) {
      const functionCall = toolCall.function;
      console.log('Call tool:', functionCall.name, functionCall.arguments);

      const tool = context.tools.find(tool => tool.schema.name === functionCall.name);
      if (!tool)
        throw new Error('Unknown tool: ' + functionCall.name);

      if (functionCall.name === 'done') {
        await context.afterTask?.();
        return;
      }

      try {
        const { content } = await context.runTool(tool, JSON.parse(functionCall.arguments));
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content,
        });
      } catch (error) {
        console.log('Tool error:', error);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: `Error while executing tool "${functionCall.name}": ${error instanceof Error ? error.message : String(error)}\n\nPlease try to recover and complete the task.`,
        });
        for (const ignoredToolCall of message.tool_calls.slice(message.tool_calls.indexOf(toolCall) + 1)) {
          messages.push({
            role: 'tool',
            tool_call_id: ignoredToolCall.id,
            content: `This tool call is skipped due to previous error.`,
          });
        }
        break;
      }
    }
  }
  throw new Error('Failed to perform step, max attempts reached');
}

function asOpenAIDeclaration(tool: Tool<any>): OpenAI.Chat.Completions.ChatCompletionTool {
  const parameters = zodToJsonSchema(tool.schema.inputSchema);
  delete parameters.$schema;
  delete (parameters as any).additionalProperties;
  return {
    type: 'function',
    function: {
      name: tool.schema.name,
      description: tool.schema.description,
      parameters,
    },
  };
}

export async function runOneShot(prompt: string): Promise<string> {
  const openai = new OpenAI();
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'user',
      content: prompt
    }
  ];
  const response = await openai.chat.completions.create({
    model,
    messages,
  });
  const message = response.choices[0].message;
  if (!message.content)
    throw new Error('Unexpected response from LLM: ' + message.content);
  return message.content;
}
