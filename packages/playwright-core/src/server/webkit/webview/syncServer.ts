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

import { createGuid } from '@utils/crypto';
import { debugLogger } from '@utils/debugLogger';
import { createHttpServer } from '@utils/network';

import type { IncomingMessage, Server, ServerResponse } from 'http';

// Receives the parsed JSON request body and returns a value that is serialized
// back to the caller as JSON.
type SyncHandler = (body: any) => Promise<any>;

export type SyncHandlerRegistration = {
  endpoint: string;
  dispose(): void;
};

// Small HTTP server that lets page-side scripts perform synchronous XHR calls
// into the server. Each handler is registered under an unguessable guid path so
// the endpoint cannot be discovered by a script running in the page just by
// knowing the (randomly bound) port.
export class SyncServer {
  private readonly _server: Server;
  private readonly _baseUrl: string;
  private readonly _handlers = new Map<string, SyncHandler>();

  static async start(): Promise<SyncServer> {
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
      throw new Error('SyncServer: failed to bind HTTP server');
    return new SyncServer(server, `http://127.0.0.1:${address.port}`);
  }

  private constructor(server: Server, baseUrl: string) {
    this._server = server;
    this._baseUrl = baseUrl;
    this._server.on('request', (req, res) => this._handleRequest(req, res));
  }

  addHandler(handler: SyncHandler): SyncHandlerRegistration {
    const guid = createGuid();
    this._handlers.set(guid, handler);
    return {
      endpoint: `${this._baseUrl}/${guid}`,
      dispose: () => this._handlers.delete(guid),
    };
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
    const handler = this._handlers.get(url.pathname.slice(1));
    if (req.method !== 'POST' || !handler) {
      // Either the handler is gone or the page raced ahead of addHandler. Reply
      // 404 so the page-side override silently falls through.
      res.statusCode = 404;
      res.end();
      return;
    }

    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let parsed: any;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        debugLogger.log('error', `SyncServer: bad request body: ${(e as Error).message}`);
        res.statusCode = 400;
        res.end();
        return;
      }

      try {
        const result = await handler(parsed);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } catch (e) {
        debugLogger.log('error', `SyncServer: handler error: ${(e as Error).message}`);
        res.statusCode = 500;
        res.end();
      }
    });
  }
}
