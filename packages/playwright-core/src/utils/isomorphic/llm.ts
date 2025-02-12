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

export type LLMMessage = {
    role: 'user' | 'assistant' | 'developer';
    content: string;
};

export interface LLM {
    chatCompletion(messages: LLMMessage[], signal: AbortSignal): AsyncGenerator<string>;
}

async function *parseSSE(body: Response['body']): AsyncGenerator<string> {
  const reader = body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done)
      break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop()!;
    for (const event of events) {
      const contentStart = event.indexOf('data: ');
      if (contentStart === -1)
        continue;
      yield event.substring(contentStart + 'data: '.length);
    }
  }
}

export class OpenAI implements LLM {

  constructor(private apiKey: string, private baseURL = 'https://api.openai.com') {}

  async *chatCompletion(messages: LLMMessage[])  {
    const url = new URL('./v1/chat/completions', this.baseURL);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        stream: true,
      }),
    });

    if (response.status !== 200 || !response.body)
      throw new Error('Failed to chat with OpenAI, unexpected status: ' + response.status + await response.text());

    for await (const eventString of parseSSE(response.body)) {
      if (eventString === '[DONE]')
        break;
      const event = JSON.parse(eventString);
      if (event.object === 'chat.completion.chunk') {
        if (event.choices[0].finish_reason)
          break;
        yield event.choices[0].delta.content;
      }
    }
  }
}

export class Anthropic implements LLM {
  constructor(private apiKey: string, private baseURL = 'https://api.anthropic.com') {}
  async *chatCompletion(messages: LLMMessage[]): AsyncGenerator<string> {
    const response = await fetch(new URL('./v1/messages', this.baseURL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        messages: messages.filter(({ role }) => role !== 'developer'),
        system: messages.find(({ role }) => role === 'developer')?.content,
        max_tokens: 1024,
        stream: true,
      })
    });

    if (response.status !== 200 || !response.body)
      throw new Error('Failed to chat with Anthropic, unexpected status: ' + response.status + await response.text());

    for await (const eventString of parseSSE(response.body)) {
      const event = JSON.parse(eventString);
      if (event.type  === 'content_block_delta')
        yield event.delta.text;
    }
  }
}

export class LLMChat {
  conversations: Conversation[] = [];

  constructor(readonly api: LLM) {}

  startConversation(systemPrompt: string) {
    const conversation = new Conversation(this, systemPrompt);
    this.conversations.push(conversation);
    return conversation;
  }
}

export class Conversation {
  history: LLMMessage[];

  constructor(private chat: LLMChat, systemPrompt: string) {
    this.history = [{ role: 'developer', content: systemPrompt }];
  }

  async *send(message: string, signal: AbortSignal) {
    const response: LLMMessage = { role: 'assistant', content: '' };
    this.history.push({ role: 'user', content: message }, response);
    for await (const chunk of this.chat.api.chatCompletion(this.history, signal)) {
      response.content += chunk;
      yield response.content;
    }
  }
}
