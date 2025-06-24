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

import OpenAI from 'openai';
import debug from 'debug';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { Tool } from './tools/tool';
import { Context } from './context';

/* eslint-disable no-console */

export async function runTasks(context: Context, tasks: string[]): Promise<string> {
  const openai = new OpenAI();
  const allCode: string[] = [
    `test('generated code', async ({ page }) => {`,
  ];
  for (const task of tasks) {
    const { taskCode } = await runTask(openai, context, task);
    if (taskCode.length)
      allCode.push('', ...taskCode.map(code => `  ${code}`));
  }
  allCode.push('});');
  return allCode.join('\n');
}

async function runTask(openai: OpenAI, context: Context, task: string): Promise<{ taskCode: string[] }> {
  console.log('Perform task:', task);

  const taskCode: string[] = [
    `// ${task}`,
  ];

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'user',
      content: `Peform following task: ${task}. Once the task is complete, call the "done" tool.`
    }
  ];

  for (let iteration = 0; iteration < 5; ++iteration) {
    debug('history')(messages);
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
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

      if (functionCall.name === 'done')
        return { taskCode };

      const tool = context.tools.find(tool => tool.schema.name === functionCall.name);
      if (!tool)
        throw new Error('Unknown tool: ' + functionCall.name);

      const { code, content } = await context.run(tool, JSON.parse(functionCall.arguments));
      taskCode.push(...code);

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content,
      });
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
