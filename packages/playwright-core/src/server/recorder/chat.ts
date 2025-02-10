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

import { WebSocketTransport } from '../transport';

import type { ConnectionTransport, ProtocolResponse } from '../transport';

export type ChatMessage = {
  content: string;
  user: 'user' | 'assistant';
};

export class Chat {
  private _history: ChatMessage[] = [];
  private _connectionPromise: Promise<Connection> | undefined;
  private _chatSinks = new Map<string, (chunk: string) => void>();
  private _wsEndpoint: string;

  constructor(wsEndpoint: string) {
    this._wsEndpoint =  wsEndpoint;
  }

  clearHistory() {
    this._history = [];
  }

  async post<T>(prompt: string): Promise<T | null> {
    await this._append('user', prompt);
    let text = await asString(await this._post());
    if (text.startsWith('```json') && text.endsWith('```'))
      text = text.substring('```json'.length, text.length - '```'.length);
    for (let i = 0; i < 3; ++i) {
      try {
        return JSON.parse(text);
      } catch (e) {
        await this._append('user', String(e));
      }
    }
    throw new Error('Failed to parse response: ' + text);
  }

  private async _append(user: ChatMessage['user'], content: string) {
    this._history.push({ user, content });
  }

  private async _connection(): Promise<Connection> {
    if (!this._connectionPromise) {
      this._connectionPromise = WebSocketTransport.connect(undefined, this._wsEndpoint).then(transport => {
        return new Connection(transport, (method, params) => this._dispatchEvent(method, params), () => {});
      });
    }
    return this._connectionPromise;
  }

  private _dispatchEvent(method: string, params: any) {
    if (method === 'chatChunk') {
      const { chatId, chunk } = params;
      const chunkSink = this._chatSinks.get(chatId)!;
      chunkSink(chunk);
      if (!chunk)
        this._chatSinks.delete(chatId);
    }
  }

  private async _post(): Promise<AsyncIterable<string>> {
    const connection = await this._connection();
    const result = await connection.send('chat', { history: this._history });
    const { chatId } = result;
    const { iterable, addChunk } = iterablePump();
    this._chatSinks.set(chatId, addChunk);
    return iterable;
  }
}

export async function asString(stream: AsyncIterable<string>): Promise<string> {
  let result = '';
  for await (const chunk of stream)
    result += chunk;
  return result;
}

type ChunkIterator = {
  iterable: AsyncIterable<string>;
  addChunk: (chunk: string) => void;
};

function iterablePump(): ChunkIterator {
  let controller: ReadableStreamDefaultController<string>;
  const stream = new ReadableStream<string>({ start: c => controller = c });

  const iterable = (async function* () {
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done)
        break;
      yield value!;
    }
  })();

  return {
    iterable,
    addChunk: chunk => {
      if (chunk)
        controller.enqueue(chunk);
      else
        controller.close();
    }
  };
}

class Connection {
  private readonly _transport: ConnectionTransport;
  private _lastId = 0;
  private _closed = false;
  private _pending = new Map<number, { resolve: (result: any) => void; reject: (error: any) => void; }>();
  private _onEvent: (method: string, params: any) => void;
  private _onClose: () => void;

  constructor(transport: ConnectionTransport, onEvent: (method: string, params: any) => void, onClose: () => void) {
    this._transport = transport;
    this._onEvent = onEvent;
    this._onClose = onClose;
    this._transport.onmessage = this._dispatchMessage.bind(this);
    this._transport.onclose = this._close.bind(this);
  }

  send(method: string, params: any): Promise<any> {
    const id = this._lastId++;
    const message = { id, method, params };
    this._transport.send(message);
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
    });
  }

  private _dispatchMessage(message: ProtocolResponse) {
    if (message.id === undefined) {
      this._onEvent(message.method!, message.params);
      return;
    }

    const callback = this._pending.get(message.id);
    this._pending.delete(message.id);
    if (!callback)
      return;

    if (message.error) {
      callback.reject(new Error(message.error.message));
      return;
    }
    callback.resolve(message.result);
  }

  _close() {
    this._closed = true;
    this._transport.onmessage = undefined;
    this._transport.onclose = undefined;
    for (const { reject } of this._pending.values())
      reject(new Error('Connection closed'));
    this._onClose();
  }

  isClosed() {
    return this._closed;
  }

  close() {
    if (!this._closed)
      this._transport.close();
  }
}
