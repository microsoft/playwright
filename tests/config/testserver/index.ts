/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import fs from 'fs';
import type http from 'http';
import mime from 'mime';
import type net from 'net';
import path from 'path';
import url from 'url';
import util from 'util';
import type stream from 'stream';
import ws from 'ws';
import zlib, { gzip } from 'zlib';
import { createHttpServer, createHttpsServer } from '../../../packages/playwright-core/lib/utils/network';

const fulfillSymbol = Symbol('fulfil callback');
const rejectSymbol = Symbol('reject callback');

const gzipAsync = util.promisify(gzip.bind(zlib));

type UpgradeActions = {
  doUpgrade: () => void;
  socket: stream.Duplex;
};

export class TestServer {
  private _server: http.Server;
  private _wsServer: ws.WebSocketServer;
  private _dirPath: string;
  readonly debugServer: any;
  private _startTime: Date;
  private _cachedPathPrefix: string | null;
  private _routes = new Map<string, (arg0: http.IncomingMessage, arg1: http.ServerResponse) => any>();
  private _auths = new Map<string, { username: string; password: string; }>();
  private _csp = new Map<string, string>();
  private _extraHeaders = new Map<string, object>();
  private _gzipRoutes = new Set<string>();
  private _requestSubscribers = new Map<string, Promise<any>>();
  private _upgradeCallback: (actions: UpgradeActions) => void | undefined;
  readonly PORT: number;
  readonly PREFIX: string;
  readonly CROSS_PROCESS_PREFIX: string;
  readonly EMPTY_PAGE: string;

  static async create(dirPath: string, port: number, loopback?: string): Promise<TestServer> {
    const server = new TestServer(dirPath, port, loopback);
    await new Promise(x => server._server.once('listening', x));
    return server;
  }

  static async createHTTPS(dirPath: string, port: number, loopback?: string): Promise<TestServer> {
    const server = new TestServer(dirPath, port, loopback, {
      key: await fs.promises.readFile(path.join(__dirname, 'key.pem')),
      cert: await fs.promises.readFile(path.join(__dirname, 'cert.pem')),
      passphrase: 'aaaa',
    });
    await new Promise(x => server._server.once('listening', x));
    return server;
  }

  constructor(dirPath: string, port: number, loopback?: string, sslOptions?: object) {
    if (sslOptions)
      this._server = createHttpsServer(sslOptions, this._onRequest.bind(this));
    else
      this._server = createHttpServer(this._onRequest.bind(this));
    this._server.on('connection', socket => this._onSocket(socket));
    this._wsServer = new ws.WebSocketServer({ noServer: true });
    this._server.on('upgrade', async (request, socket, head) => {
      const doUpgrade = () => {
        this._wsServer.handleUpgrade(request, socket, head, ws => {
          // Next emit is only for our internal 'connection' listeners.
          this._wsServer.emit('connection', ws, request);
        });
      };
      if (this._upgradeCallback) {
        this._upgradeCallback({ doUpgrade, socket });
        return;
      }
      const pathname = url.parse(request.url!).path;
      if (pathname === '/ws-401') {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\nUnauthorized body');
        socket.destroy();
        return;
      }
      if (pathname === '/ws-slow')
        await new Promise(f => setTimeout(f, 2000));
      if (!['/ws', '/ws-slow'].includes(pathname)) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }
      doUpgrade();
    });
    this._server.listen(port);
    this._dirPath = dirPath;
    this.debugServer = require('debug')('pw:testserver');

    this._startTime = new Date();
    this._cachedPathPrefix = null;

    const cross_origin = loopback || '127.0.0.1';
    const same_origin = loopback || 'localhost';
    const protocol = sslOptions ? 'https' : 'http';
    this.PORT = port;
    this.PREFIX = `${protocol}://${same_origin}:${port}`;
    this.CROSS_PROCESS_PREFIX = `${protocol}://${cross_origin}:${port}`;
    this.EMPTY_PAGE = `${protocol}://${same_origin}:${port}/empty.html`;
  }

  _onSocket(socket: net.Socket) {
    // ECONNRESET and HPE_INVALID_EOF_STATE are legit errors given
    // that tab closing aborts outgoing connections to the server.
    // HPE_INVALID_METHOD is a legit error when a client (e.g. Chromium which
    // makes https requests to http sites) makes a https connection to a http server.
    socket.on('error', error => {
      if (!['ECONNRESET', 'HPE_INVALID_EOF_STATE', 'HPE_INVALID_METHOD'].includes((error as any).code))
        throw error;
    });
  }

  enableHTTPCache(pathPrefix: string) {
    this._cachedPathPrefix = pathPrefix;
  }

  setAuth(path: string, username: string, password: string) {
    this.debugServer(`set auth for ${path} to ${username}:${password}`);
    this._auths.set(path, { username, password });
  }

  enableGzip(path: string) {
    this._gzipRoutes.add(path);
  }

  setCSP(path: string, csp: string) {
    this._csp.set(path, csp);
  }

  setExtraHeaders(path: string, object: Record<string, string>) {
    this._extraHeaders.set(path, object);
  }

  async stop() {
    this.reset();
    await new Promise(x => this._server.close(x));
  }

  setRoute(path: string, handler: (arg0: http.IncomingMessage & { postBody: Promise<Buffer> }, arg1: http.ServerResponse) => any) {
    this._routes.set(path, handler);
  }

  setRedirect(from: string, to: string) {
    this.setRoute(from, (req, res) => {
      const headers = this._extraHeaders.get(req.url!) || {};
      res.writeHead(302, { ...headers, location: to });
      res.end();
    });
  }

  waitForRequest(path: string): Promise<http.IncomingMessage & { postBody: Promise<Buffer> }> {
    let promise = this._requestSubscribers.get(path);
    if (promise)
      return promise;
    let fulfill, reject;
    promise = new Promise((f, r) => {
      fulfill = f;
      reject = r;
    });
    promise[fulfillSymbol] = fulfill;
    promise[rejectSymbol] = reject;
    this._requestSubscribers.set(path, promise);
    return promise;
  }

  reset() {
    this._routes.clear();
    this._auths.clear();
    this._csp.clear();
    this._extraHeaders.clear();
    this._gzipRoutes.clear();
    this._upgradeCallback = undefined;
    this._wsServer.removeAllListeners('connection');
    this._server.closeAllConnections();
    const error = new Error('Static Server has been reset');
    for (const subscriber of this._requestSubscribers.values())
      subscriber[rejectSymbol].call(null, error);
    this._requestSubscribers.clear();
  }

  _onRequest(request: http.IncomingMessage, response: http.ServerResponse) {
    request.on('error', error => {
      if ((error as any).code === 'ECONNRESET')
        response.end();
      else
        throw error;
    });
    (request as any).postBody = new Promise(resolve => {
      const chunks: Buffer[] = [];
      request.on('data', chunk => {
        chunks.push(chunk);
      });
      request.on('end', () => resolve(Buffer.concat(chunks)));
    });
    const path = url.parse(request.url!).path;
    this.debugServer(`request ${request.method} ${path}`);
    if (this._auths.has(path)) {
      const auth = this._auths.get(path)!;
      const credentials = Buffer.from((request.headers.authorization || '').split(' ')[1] || '', 'base64').toString();
      this.debugServer(`request credentials ${credentials}`);
      this.debugServer(`actual credentials ${auth.username}:${auth.password}`);
      if (credentials !== `${auth.username}:${auth.password}`) {
        this.debugServer(`request write www-auth`);
        response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Secure Area"' });
        response.end('HTTP Error 401 Unauthorized: Access is denied');
        return;
      }
    }
    // Notify request subscriber.
    if (this._requestSubscribers.has(path)) {
      this._requestSubscribers.get(path)![fulfillSymbol].call(null, request);
      this._requestSubscribers.delete(path);
    }
    const handler = this._routes.get(path);
    if (handler)
      handler.call(null, request, response);
    else
      this.serveFile(request, response);
  }

  serveFile(request: http.IncomingMessage, response: http.ServerResponse, filePath?: string): void {
    this._serveFile(request, response, filePath).catch(e => {
      this.debugServer(`error: ${e}`);
    });
  }

  private async _serveFile(request: http.IncomingMessage, response: http.ServerResponse, filePath?: string): Promise<void> {
    let pathName = url.parse(request.url!).path;
    if (!filePath) {
      if (pathName === '/')
        pathName = '/index.html';
      filePath = path.join(this._dirPath, pathName.substring(1));
    }

    if (this._cachedPathPrefix !== null && filePath.startsWith(this._cachedPathPrefix)) {
      if (request.headers['if-modified-since']) {
        response.statusCode = 304; // not modified
        response.end();
        return;
      }
      response.setHeader('Cache-Control', 'public, max-age=31536000, no-cache');
      response.setHeader('Last-Modified', this._startTime.toISOString());
    } else {
      response.setHeader('Cache-Control', 'no-cache, no-store');
    }
    if (this._csp.has(pathName))
      response.setHeader('Content-Security-Policy', this._csp.get(pathName)!);

    if (this._extraHeaders.has(pathName)) {
      const object = this._extraHeaders.get(pathName);
      for (const key in object)
        response.setHeader(key, object[key]);
    }

    const { err, data } = await fs.promises.readFile(filePath).then(data => ({ data, err: undefined })).catch(err => ({ data: undefined, err }));
    // The HTTP transaction might be already terminated after async hop here - do nothing in this case.
    if (response.writableEnded)
      return;
    if (err) {
      response.statusCode = 404;
      response.setHeader('Content-Type', 'text/plain');
      response.end(request.method !== 'HEAD' ? `File not found: ${filePath}` : null);
      return;
    }
    const extension = filePath.substring(filePath.lastIndexOf('.') + 1);
    const mimeType = mime.getType(extension) || 'application/octet-stream';
    const isTextEncoding = /^text\/|^application\/(javascript|json)/.test(mimeType);
    const contentType = isTextEncoding ? `${mimeType}; charset=utf-8` : mimeType;
    response.setHeader('Content-Type', contentType);
    if (this._gzipRoutes.has(pathName)) {
      response.setHeader('Content-Encoding', 'gzip');
      const result = await gzipAsync(data);
      // The HTTP transaction might be already terminated after async hop here.
      if (!response.writableEnded)
        response.end(request.method !== 'HEAD' ? result : null);
    } else {
      response.end(request.method !== 'HEAD' ? data : null);
    }
  }

  onceWebSocketConnection(handler: (socket: ws.WebSocket, request: http.IncomingMessage) => void) {
    this._wsServer.once('connection', handler);
  }

  waitForWebSocketConnectionRequest() {
    return new Promise<http.IncomingMessage & { headers: http.IncomingHttpHeaders }>(fulfil => {
      this._wsServer.once('connection', (ws, req) => fulfil(req));
    });
  }

  waitForUpgrade() {
    return new Promise<UpgradeActions>(fulfill => this._upgradeCallback = fulfill);
  }

  waitForWebSocket() {
    return new Promise<ws.WebSocket>(fulfill => this._wsServer.once('connection', (ws, req) => fulfill(ws)));
  }

  sendOnWebSocketConnection(data) {
    this.onceWebSocketConnection(ws => ws.send(data));
  }
}
