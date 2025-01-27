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

/* eslint-disable no-console */

import playwright from 'playwright';
import browser from '@playwright/experimental-tools/browser';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources';

dotenv.config();

const openai = new OpenAI();

export const system = `
You are a web tester.

<Instructions>to
- Perform test according to the provided checklist
- Use browser tools to perform actions on web page
- Never ask questions, always perform a best guess action
- When ready use "reportResult" tool to report result
- You can only make one tool call at a time.
</Instructions>`;

type Message = ChatCompletionMessageParam & {
  history: any
};

const reportTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'reportResult',
    description: 'Submit test result',
    parameters: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether test passed' },
        result: { type: 'string', description: 'Result of the test if requested' },
        error: { type: 'string', description: 'Error if test failed' },
      },
      required: ['success'],
      additionalProperties: false,
    },
  }
};

async function openAIAgentLoop(page: playwright.Page, task: string) {
  const pageTools: ChatCompletionTool[] = browser.schema.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        ...tool.parameters,
        additionalProperties: false,
      },
    }
  }));

  const tools = [reportTool, ...pageTools];

  const history: Message[] = [
    {
      role: 'system', content: system, history: system
    },
    {
      role: 'user',
      history: `Task: ${task}`,
      content: `Task: ${task}\n\n${await browser.snapshot(page)}`,
    }
  ];

  // Run agentic loop, cap steps.
  for (let i = 0; i < 50; i++) {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: toOpenAIMessages(history),
      tools,
      store: true,
    });

    console.log(JSON.stringify(completion, null, 2));

    const toolCalls = completion.choices[0]?.message?.tool_calls;
    if (!toolCalls || toolCalls.length !== 1 || toolCalls[0].type !== 'function') {
      history.push({ role: 'user', content: 'expected exactly one tool call', history: 'expected exactly one tool call' });
      continue;
    }

    const toolCall = toolCalls[0];
    if (toolCall.function.name === 'reportResult') {
      console.log(JSON.parse(toolCall.function.arguments));
      return;
    }

    history.push({ ...completion.choices[0].message, history: null });

    // Run the Playwright tool.
    const params = JSON.parse(toolCall.function.arguments);
    const { error, snapshot, code } = await browser.call(page, toolCall.function.name, params);
    console.log({ error, code, snapshot });
    if (code.length)
      console.log(code.join('\n'));

    if (toolCall.function.name === 'log')
      return;

    // Report the result.
    const resultText = error ? `Error: ${error}\n` : 'Done\n';
    history.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: resultText + snapshot,
      history: resultText,
    });
  }
}

function toOpenAIMessages(messages: Message[]): ChatCompletionMessageParam[] {
  return messages.map((message, i) => {
    const copy: Message = { ...message };
    delete copy.history;
    if (i === messages.length - 1)
      return copy;
    copy.content = message.history;
    return copy;
  });
}

async function main() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();
  await openAIAgentLoop(page, `
    - Go to http://github.com/microsoft
    - Search for "playwright" repository
    - Navigate to it
    - Capture snapshot for toolbar with Code, Issues, etc.
    - Capture snapshot for branch selector
    - Assert that number of Issues is present
    - Switch into the Issues tab
    - Report 3 first issues
  `);
  await browser.close();
}

void main();
