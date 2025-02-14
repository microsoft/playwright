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

import * as React from 'react';
import { EventEmitter } from '@testIsomorphic/events';
import { useCookies } from '@web/uiUtils';

export type LLMMessage = {
  role: 'user' | 'assistant' | 'developer';
  content: string;
  displayContent?: string;
};

interface LLM {
  readonly name: string;
  chatCompletion(messages: LLMMessage[], signal: AbortSignal): AsyncGenerator<string>;
}

// https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream
async function *parseSSE(body: NonNullable<Response['body']>): AsyncGenerator<{ type: string, data: string, id: string }> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  let lastEventId = '';
  let type: string = '';
  let data = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done)
      break;
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop()!; // last line is either empty or incomplete

    for (const line of lines) {
      if (line.length === 0) {
        if (data === '') {
          data = '';
          type = '';
          continue;
        }

        if (data[data.length - 1] === '\n')
          data = data.substring(0, data.length - 1);

        const event = { type: type || 'message', data, id: lastEventId };
        type = '';
        data = '';

        yield event;
      }
      if (line[0] === ':')
        continue;

      let name = '';
      let value = '';
      const colon = line.indexOf(':');
      if (colon === -1) {
        name = line;
      } else {
        name = line.substring(0, colon);
        value = line[colon + 1] === ' ' ? line.substring(colon + 2) : line.substring(colon + 1);
      }

      switch (name) {
        case 'event':
          type = value;
          break;
        case 'data':
          data += value + '\n';
          break;
        case 'id':
          lastEventId = value;
          break;
        case 'retry':
        default:
          // not implemented
          break;
      }
    }
  }
}

class OpenAI implements LLM {

  name = 'OpenAI';

  constructor(private apiKey: string, private baseURL = 'https://api.openai.com') {}

  async *chatCompletion(messages: LLMMessage[], signal: AbortSignal)  {
    const url = new URL('./v1/chat/completions', this.baseURL);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'x-pw-serviceworker': 'forward',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // TODO: make configurable
        messages: messages.map(({ role, content }) => ({ role, content })),
        stream: true,
      }),
      signal,
    });

    if (response.status !== 200 || !response.body)
      throw new Error('Failed to chat with OpenAI, unexpected status: ' + response.status + await response.text());

    for await (const sseEvent of parseSSE(response.body)) {
      const event = JSON.parse(sseEvent.data);
      if (event.object === 'chat.completion.chunk') {
        if (event.choices[0].finish_reason)
          break;
        yield event.choices[0].delta.content;
      }
    }
  }
}

class Anthropic implements LLM {
  name = 'Anthropic';
  constructor(private apiKey: string, private baseURL = 'https://api.anthropic.com') {}
  async *chatCompletion(messages: LLMMessage[], signal: AbortSignal): AsyncGenerator<string> {
    const response = await fetch(new URL('./v1/messages', this.baseURL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'x-pw-serviceworker': 'forward',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022', // TODO: make configurable
        messages: messages.filter(({ role }) => role !== 'developer').map(({ role, content }) => ({ role, content })),
        system: messages.find(({ role }) => role === 'developer')?.content,
        max_tokens: 1024,
        stream: true,
      }),
      signal,
    });

    if (response.status !== 200 || !response.body)
      throw new Error('Failed to chat with Anthropic, unexpected status: ' + response.status + await response.text());

    for await (const sseEvent of parseSSE(response.body)) {
      const event = JSON.parse(sseEvent.data);
      if (event.type  === 'content_block_delta')
        yield event.delta.text;
    }
  }
}

class LLMChat {
  conversations = new Map<string, Conversation>();

  constructor(readonly api: LLM) {}

  getConversation(id: string) {
    return this.conversations.get(id);
  }

  startConversation(id: string, systemPrompt: string) {
    const conversation = new Conversation(this, systemPrompt);
    this.conversations.set(id, conversation); // TODO: cleanup
    return conversation;
  }
}

export class Conversation {
  history: LLMMessage[];
  onChange = new EventEmitter<void>();
  private _abortControllers = new Set<AbortController>();

  constructor(public chat: LLMChat, systemPrompt: string) {
    this.history = [{ role: 'developer', content: systemPrompt }];
  }

  async send(content: string, displayContent?: string) {
    const response: LLMMessage = { role: 'assistant', content: '' };
    this.history.push({ role: 'user', content, displayContent }, response);
    const abortController = new AbortController();
    this._abortControllers.add(abortController);
    this.onChange.fire();
    try {
      for await (const chunk of this.chat.api.chatCompletion(this.history, abortController.signal)) {
        response.content += chunk;
        this.onChange.fire();
      }
    } finally {
      this._abortControllers.delete(abortController);
      this.onChange.fire();
    }
  }

  isSending(): boolean {
    return this._abortControllers.size > 0;
  }

  abortSending() {
    for (const controller of this._abortControllers)
      controller.abort();
    this._abortControllers.clear();
    this.onChange.fire();
  }

  isEmpty() {
    return this.history.length < 2;
  }
}


const llmContext = React.createContext<LLMChat | undefined>(undefined);

export function LLMProvider({ children }: React.PropsWithChildren<{}>) {
  const cookiePairs = useCookies();
  const chat = React.useMemo(() => {
    const cookies = Object.fromEntries(cookiePairs);
    if (cookies.openai_api_key)
      return new LLMChat(new OpenAI(cookies.openai_api_key, cookies.openai_base_url));
    if (cookies.anthropic_api_key)
      return new LLMChat(new Anthropic(cookies.anthropic_api_key, cookies.anthropic_base_url));
  }, [cookiePairs]);
  return <llmContext.Provider value={chat}>{children}</llmContext.Provider>;
}

export function useLLMChat() {
  const chat = React.useContext(llmContext);
  if (!chat)
    throw new Error('No LLM chat available, make sure theres a LLMProvider above');
  return chat;
}

export function useIsLLMAvailable() {
  return !!React.useContext(llmContext);
}

export function useLLMConversation(id: string) {
  const conversation = useLLMChat().getConversation(id);
  if (!conversation)
    throw new Error('No conversation found for id: ' + id);
  const [history, setHistory] = React.useState(conversation.history);
  React.useEffect(() => {
    function update() {
      setHistory([...conversation!.history]);
    }
    update();
    const subscription = conversation.onChange.event(update);
    return subscription.dispose;
  }, [conversation]);

  return [history, conversation] as const;
}
