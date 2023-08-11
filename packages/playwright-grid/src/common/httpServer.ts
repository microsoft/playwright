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

import debug from 'debug';
import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';
import { URL } from 'url';
import { Server as WebSocketServer } from 'ws';

export type ServerRouteHandler = (request: http.IncomingMessage, response: http.ServerResponse) => boolean;

export class HttpServer {
  private _log: debug.Debugger;
  readonly server: https.Server | http.Server;
  private _urlPrefix: string;
  private _routes: { prefix?: string, exact?: string, handler: ServerRouteHandler }[] = [];
  private _isSecure: boolean;

  static async create(options: { httpsKey?: string, httpsCert?: string }) {
    if (options.httpsKey && options.httpsCert) {
      return new HttpServer({
        key: await fs.promises.readFile(options.httpsKey, 'utf8'),
        cert: await fs.promises.readFile(options.httpsCert, 'utf8'),
      });
    }
    return new HttpServer();
  }

  private constructor(options?: { key: string, cert: string }) {
    this._log = debug(`pw:grid:http`);
    this._urlPrefix = '';
    this._isSecure = !!options;
    this.server = options ? https.createServer(options, this._onRequest.bind(this)) : http.createServer(this._onRequest.bind(this));
  }

  routePrefix(prefix: string, handler: ServerRouteHandler) {
    this._routes.push({ prefix, handler });
  }

  routePath(path: string, handler: ServerRouteHandler) {
    this._routes.push({ exact: path, handler });
  }

  createWebSocketServer() {
    return new WebSocketServer({ server: this.server });
  }

  async start(port?: number): Promise<string> {
    this._log('starting server', port);
    this.server.listen(port);
    await new Promise(cb => this.server!.once('listening', cb));
    const address = this.server.address();
    this._urlPrefix = typeof address === 'string' ? address : `${this._isSecure ? 'https' : 'http'}://127.0.0.1:${address!.port}`;
    return this._urlPrefix;
  }

  async stop() {
    await new Promise(cb => this.server!.close(cb));
  }

  urlPrefix() {
    return this._urlPrefix;
  }

  serveFile(response: http.ServerResponse, absoluteFilePath: string, headers?: { [name: string]: string }): boolean {
    try {
      const content = fs.readFileSync(absoluteFilePath);
      response.statusCode = 200;
      const contentType = extensionToMime[path.extname(absoluteFilePath).substring(1)] || 'application/octet-stream';
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
    this._log('web request', request.url);
    request.on('error', () => response.end());
    try {
      if (!request.url) {
        response.end();
        return;
      }
      const url = new URL('http://localhost' + request.url);
      this._log('url pathname', url.pathname);
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

const extensionToMime: { [key: string]: string } = {
  'css': 'text/css',
  'html': 'text/html',
  'jpeg': 'image/jpeg',
  'jpg': 'image/jpeg',
  'js': 'application/javascript',
  'png': 'image/png',
  'ttf': 'font/ttf',
  'svg': 'image/svg+xml',
  'webp': 'image/webp',
  'woff': 'font/woff',
  'woff2': 'font/woff2',
};
