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

import { debugLogger } from '@utils/debugLogger';
import { createHttpServer } from '@utils/network';

import type { IncomingMessage, Server, ServerResponse } from 'http';

export type DialogRequest = {
  type: 'alert' | 'confirm' | 'prompt';
  message: string;
  defaultValue: string;
};

export type DialogResult = {
  accept: boolean;
  promptText?: string;
};

type DialogHandler = (req: DialogRequest) => Promise<DialogResult>;

export class DialogBridge {
  private readonly _server: Server;
  private readonly _baseUrl: string;
  private readonly _handlers = new Map<string, DialogHandler>();

  static async start(): Promise<DialogBridge> {
    const server = createHttpServer();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('DialogBridge: failed to bind HTTP server');
    return new DialogBridge(server, `http://127.0.0.1:${address.port}`);
  }

  private constructor(server: Server, baseUrl: string) {
    this._server = server;
    this._baseUrl = baseUrl;
    this._server.on('request', (req, res) => this._handleRequest(req, res));
  }

  endpointFor(pageId: string): string {
    return `${this._baseUrl}/dialog?tab=${encodeURIComponent(pageId)}`;
  }

  registerTab(pageId: string, handler: DialogHandler): void {
    this._handlers.set(pageId, handler);
  }

  unregisterTab(pageId: string): void {
    this._handlers.delete(pageId);
  }

  async close(): Promise<void> {
    this._handlers.clear();
    await new Promise<void>(resolve => this._server.close(() => resolve()));
  }

  private _writeCorsHeaders(res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
  }

  private async _handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this._writeCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const url = new URL(req.url || '/', this._baseUrl);
    if (!(req.method === 'POST' && url.pathname === '/dialog')) {
      res.statusCode = 404;
      res.end();
      return;
    }

    const tab = url.searchParams.get('tab') || '';
    const handler = this._handlers.get(tab);
    if (!handler) {
      // Either the tab is gone or the page raced ahead of registerTab. Reply
      // 404 so the page-side override silently falls through.
      res.statusCode = 404;
      res.end();
      return;
    }

    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let parsed: DialogRequest;
      try {
        const json = JSON.parse(body);
        if (json.type !== 'alert' && json.type !== 'confirm' && json.type !== 'prompt')
          throw new Error(`Invalid dialog type: ${json.type}`);
        parsed = {
          type: json.type,
          message: typeof json.message === 'string' ? json.message : '',
          defaultValue: typeof json.defaultValue === 'string' ? json.defaultValue : '',
        };
      } catch (e) {
        debugLogger.log('error', `DialogBridge: bad request body: ${(e as Error).message}`);
        res.statusCode = 400;
        res.end();
        return;
      }

      try {
        const result = await handler(parsed);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          accept: !!result.accept,
          promptText: result.promptText,
        }));
      } catch (e) {
        debugLogger.log('error', `DialogBridge: handler error: ${(e as Error).message}`);
        res.statusCode = 500;
        res.end();
      }
    });
  }
}
