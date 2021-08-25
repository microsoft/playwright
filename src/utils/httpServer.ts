/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as http from 'http';
import fs from 'fs';
import path from 'path';
import * as mime from 'mime';

export type ServerRouteHandler = (request: http.IncomingMessage, response: http.ServerResponse) => boolean;

export class HttpServer {
  private _server: http.Server | undefined;
  private _urlPrefix: string;
  private _routes: { prefix?: string, exact?: string, handler: ServerRouteHandler }[] = [];

  constructor() {
    this._urlPrefix = '';
  }

  routePrefix(prefix: string, handler: ServerRouteHandler) {
    this._routes.push({ prefix, handler });
  }

  routePath(path: string, handler: ServerRouteHandler) {
    this._routes.push({ exact: path, handler });
  }

  async start(port?: number): Promise<string> {
    this._server = http.createServer(this._onRequest.bind(this));
    this._server.listen(port);
    await new Promise(cb => this._server!.once('listening', cb));
    const address = this._server.address();
    this._urlPrefix = typeof address === 'string' ? address : `http://127.0.0.1:${address.port}`;
    return this._urlPrefix;
  }

  async stop() {
    await new Promise(cb => this._server!.close(cb));
  }

  urlPrefix() {
    return this._urlPrefix;
  }

  serveFile(response: http.ServerResponse, absoluteFilePath: string, headers?: { [name: string]: string }): boolean {
    try {
      const content = fs.readFileSync(absoluteFilePath);
      response.statusCode = 200;
      const contentType = mime.getType(path.extname(absoluteFilePath)) || 'application/octet-stream';
      response.setHeader('Content-Type', contentType);
      response.setHeader('Content-Length', content.byteLength);
      for (const [name, value] of Object.entries(headers || {}))
        response.setHeader(name, value);
      response.end(content);
      return true;
    } catch (e) {
      return false;
    }
  }

  private _onRequest(request: http.IncomingMessage, response: http.ServerResponse) {
    request.on('error', () => response.end());
    try {
      if (!request.url) {
        response.end();
        return;
      }
      const url = new URL('http://localhost' + request.url);
      for (const route of this._routes) {
        if (route.exact && url.pathname === route.exact && route.handler(request, response))
          return;
        if (route.prefix && url.pathname.startsWith(route.prefix) && route.handler(request, response))
          return;
      }
      response.statusCode = 404;
      response.end();
    } catch (e) {
      response.end();
    }
  }
}
