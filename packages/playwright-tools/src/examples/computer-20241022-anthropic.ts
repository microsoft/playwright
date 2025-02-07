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

import Anthropic from '@anthropic-ai/sdk';
import computer from '@playwright/experimental-tools/computer-20241022';
import dotenv from 'dotenv';
import playwright from 'playwright';

import type { BetaImageBlockParam, BetaTextBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { ToolResult } from '@playwright/experimental-tools/computer-20241022';

dotenv.config();

const anthropic = new Anthropic();

export const system = `
You are a web tester.

<Instructions>
- Perform test according to the provided checklist
- Use browser tools to perform actions on web page
- Never ask questions, always perform a best guess action
- Use one tool at a time, wait for its result before proceeding.
- When ready use "reportResult" tool to report result
</Instructions>`;

const computerTool: Anthropic.Beta.BetaToolUnion = {
  type: 'computer_20241022',
  name: 'computer',
  display_width_px: 1920,
  display_height_px: 1080,
  display_number: 1,
};

const reportTool: Anthropic.Tool = {
  name: 'reportResult',
  description: 'Submit test result',
  input_schema: {
    type: 'object',
    properties: {
      'success': { type: 'boolean', description: 'Whether test passed' },
      'result': { type: 'string', description: 'Result of the test if some information has been requested' },
      'error': { type: 'string', description: 'Error message if test failed' }
    },
    required: ['success']
  }
};

type Message = Anthropic.Beta.Messages.BetaMessageParam & {
  history: Anthropic.Beta.Messages.BetaMessageParam['content']
};

async function anthropicAgentLoop(page: playwright.Page, task: string) {
  // Add report tool.
  const tools = [reportTool, computerTool];

  const history: Message[] = [{
    role: 'user',
    history: `Task: ${task}`,
    content: `Task: ${task}`,
  }];

  // Run agentic loop, cap steps.
  for (let i = 0; i < 50; i++) {
    const response = await anthropic.beta.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      temperature: 0,
      tools,
      system,
      messages: toAnthropicMessages(history),
      betas: ['computer-use-2024-10-22'],
    });

    history.push({ role: 'assistant', content: response.content, history: response.content });

    const toolUse = response.content.find(block => block.type === 'tool_use');
    if (!toolUse) {
      history.push({ role: 'user', content: 'expected exactly one tool call', history: 'expected exactly one tool call' });
      continue;
    }

    if (toolUse.name === 'reportResult') {
      console.log(toolUse.input);
      return;
    }

    const result: ToolResult = await computer.call(page, toolUse.name, toolUse.input as any);
    const contentEntry: BetaTextBlockParam | BetaImageBlockParam = result.base64_image ? {
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: result.base64_image }
    } : {
      type: 'text',
      text: result.output || '',
    };
    history.push({
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: [contentEntry],
      }],
      history: [{
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: [{ type: 'text', text: '<redacted>' }],
      }],
    });
  }
}

function toAnthropicMessages(messages: Message[]): Anthropic.Beta.Messages.BetaMessageParam[] {
  return messages.map((message, i) => {
    if (i === messages.length - 1)
      return { ...message, history: undefined };
    return { ...message, content: message.history, history: undefined };
  });
}

const githubTask = `
  - Search for "playwright" repository
  - Navigate to it
  - Switch into the Issues tab
  - Report 3 first issues
`;

async function main() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('http://github.com/microsoft');
  await anthropicAgentLoop(page, githubTask);
  await browser.close();
}

void main();
