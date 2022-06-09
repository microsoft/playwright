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
import { mime, wsServer } from '../utilsBundle';
import type { WebSocketServer } from '../utilsBundle';
import { assert } from './';

export type ServerRouteHandler = (request: http.IncomingMessage, response: http.ServerResponse) => boolean;

export class HttpServer {
  private _server: http.Server;
  private _urlPrefix: string;
  private _port: number = 0;
  private _started = false;
  private _routes: { prefix?: string, exact?: string, handler: ServerRouteHandler }[] = [];
  private _activeSockets = new Set<import('net').Socket>();
  constructor(address: string = '') {
    this._urlPrefix = address;
    this._server = http.createServer(this._onRequest.bind(this));
  }

  createWebSocketServer(): WebSocketServer {
    return new wsServer({ server: this._server });
  }

  routePrefix(prefix: string, handler: ServerRouteHandler) {
    this._routes.push({ prefix, handler });
  }

  routePath(path: string, handler: ServerRouteHandler) {
    this._routes.push({ exact: path, handler });
  }

  port(): number {
    return this._port;
  }

  async start(port?: number): Promise<string> {
    assert(!this._started, 'server already started');
    this._started = true;
    this._server.on('connection', socket => {
      this._activeSockets.add(socket);
      socket.once('close', () => this._activeSockets.delete(socket));
    });
    this._server.listen(port);
    await new Promise(cb => this._server!.once('listening', cb));
    const address = this._server.address();
    assert(address, 'Could not bind server socket');
    if (!this._urlPrefix) {
      if (typeof address === 'string') {
        this._urlPrefix = address;
      } else {
        this._port = address.port;
        this._urlPrefix = `http://127.0.0.1:${address.port}`;
      }
    }
    return this._urlPrefix;
  }

  async stop() {
    for (const socket of this._activeSockets)
      socket.destroy();
    await new Promise(cb => this._server!.close(cb));
  }

  urlPrefix(): string {
    return this._urlPrefix;
  }

  serveFile(request: http.IncomingMessage, response: http.ServerResponse, absoluteFilePath: string, headers?: { [name: string]: string }): boolean {
    try {
      for (const [name, value] of Object.entries(headers || {}))
        response.setHeader(name, value);
      if (request.headers.range)
        this._serveRangeFile(request, response, absoluteFilePath);
      else
        this._serveFile(response, absoluteFilePath);
      return true;
    } catch (e) {
      return false;
    }
  }

  _serveFile(response: http.ServerResponse, absoluteFilePath: string) {
    const content = fs.readFileSync(absoluteFilePath);
    response.statusCode = 200;
    const contentType = mime.getType(path.extname(absoluteFilePath)) || 'application/octet-stream';
    response.setHeader('Content-Type', contentType);
    response.setHeader('Content-Length', content.byteLength);
    response.end(content);
  }

  _serveRangeFile(request: http.IncomingMessage, response: http.ServerResponse, absoluteFilePath: string) {
    const range = request.headers.range;
    if (!range || !range.startsWith('bytes=') || range.includes(', ') || [...range].filter(char => char === '-').length !== 1) {
      response.statusCode = 400;
      return response.end('Bad request');
    }

    // Parse the range header: https://datatracker.ietf.org/doc/html/rfc7233#section-2.1
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');

    // Both start and end (when passing to fs.createReadStream) and the range header are inclusive and start counting at 0.
    let start: number;
    let end: number;
    const size = fs.statSync(absoluteFilePath).size;
    if (startStr !== '' && endStr === '') {
      // No end specified: use the whole file
      start = +startStr;
      end = size - 1;
    } else if (startStr === '' && endStr !== '') {
      // No start specified: calculate start manually
      start = size - +endStr;
      end = size - 1;
    } else {
      start = +startStr;
      end = +endStr;
    }

    // Handle unavailable range request
    if (Number.isNaN(start) || Number.isNaN(end) || start >= size || end >= size || start > end) {
      // Return the 416 Range Not Satisfiable: https://datatracker.ietf.org/doc/html/rfc7233#section-4.4
      response.writeHead(416, {
        'Content-Range': `bytes */${size}`
      });
      return response.end();
    }

    // Sending Partial Content: https://datatracker.ietf.org/doc/html/rfc7233#section-4.1
    response.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': mime.getType(path.extname(absoluteFilePath))!,
    });

    const readable = fs.createReadStream(absoluteFilePath, { start, end });
    readable.pipe(response);
  }

  private _onRequest(request: http.IncomingMessage, response: http.ServerResponse) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Request-Method', '*');
    response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
    if (request.headers.origin)
      response.setHeader('Access-Control-Allow-Headers', request.headers.origin);

    if (request.method === 'OPTIONS') {
      response.writeHead(200);
      response.end();
      return;
    }

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
