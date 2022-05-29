/**
 * Copyright 2017 Google Inc. All rights reserved.
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

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const util = require('util');
const mime = require('mime');
const WebSocketServer = require('ws').Server;

const fulfillSymbol = Symbol('fullfil callback');
const rejectSymbol = Symbol('reject callback');

const gzipAsync = util.promisify(zlib.gzip.bind(zlib));

class TestServer {
  /**
   * @param {string} dirPath
   * @param {number} port
   * @param {string=} loopback
   * @return {!Promise<TestServer>}
   */
  static async create(dirPath, port, loopback) {
    const server = new TestServer(dirPath, port, loopback);
    await new Promise(x => server._server.once('listening', x));
    return server;
  }

  /**
   * @param {string} dirPath
   * @param {number} port
   * @param {string=} loopback
   * @return {!Promise<TestServer>}
   */
  static async createHTTPS(dirPath, port, loopback) {
    const server = new TestServer(dirPath, port, loopback, {
      key: await fs.promises.readFile(path.join(__dirname, 'key.pem')),
      cert: await fs.promises.readFile(path.join(__dirname, 'cert.pem')),
      passphrase: 'aaaa',
    });
    await new Promise(x => server._server.once('listening', x));
    return server;
  }

  /**
   * @param {string} dirPath
   * @param {number} port
   * @param {string=} loopback
   * @param {!Object=} sslOptions
   */
  constructor(dirPath, port, loopback, sslOptions) {
    if (sslOptions)
      this._server = https.createServer(sslOptions, this._onRequest.bind(this));
    else
      this._server = http.createServer(this._onRequest.bind(this));
    this._server.on('connection', socket => this._onSocket(socket));
    this._wsServer = new WebSocketServer({ noServer: true });
    this._server.on('upgrade', async (request, socket, head) => {
      const pathname = url.parse(request.url).pathname;
      if (pathname === '/ws-slow')
        await new Promise(f => setTimeout(f, 2000));
      if (!['/ws', '/ws-slow'].includes(pathname)) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }
      this._wsServer.handleUpgrade(request, socket, head, ws => {
        // Next emit is only for our internal 'connection' listeners.
        this._wsServer.emit('connection', ws, request);
      });
    });
    this._server.listen(port);
    this._dirPath = dirPath;
    this.debugServer = require('debug')('pw:testserver');

    this._startTime = new Date();
    this._cachedPathPrefix = null;

    /** @type {!Set<!NodeJS.Socket>} */
    this._sockets = new Set();
    /** @type {!Map<string, function(!http.IncomingMessage,http.ServerResponse)>} */
    this._routes = new Map();
    /** @type {!Map<string, !{username:string, password:string}>} */
    this._auths = new Map();
    /** @type {!Map<string, string>} */
    this._csp = new Map();
    /** @type {!Map<string, Object>} */
    this._extraHeaders = new Map();
    /** @type {!Set<string>} */
    this._gzipRoutes = new Set();
    /** @type {!Map<string, !Promise>} */
    this._requestSubscribers = new Map();

    const cross_origin = loopback || '127.0.0.1';
    const same_origin = loopback || 'localhost';
    const protocol = sslOptions ? 'https' : 'http';
    this.PORT = port;
    this.PREFIX = `${protocol}://${same_origin}:${port}`;
    this.CROSS_PROCESS_PREFIX = `${protocol}://${cross_origin}:${port}`;
    this.EMPTY_PAGE = `${protocol}://${same_origin}:${port}/empty.html`;
  }

  /**
   * @param {*} socket 
   */
  _onSocket(socket) {
    this._sockets.add(socket);
    // ECONNRESET and HPE_INVALID_EOF_STATE are legit errors given
    // that tab closing aborts outgoing connections to the server.
    socket.on('error', error => {
      if (error.code !== 'ECONNRESET' && error.code !== 'HPE_INVALID_EOF_STATE')
        throw error;
    });
    socket.once('close', () => this._sockets.delete(socket));
  }

  /**
   * @param {string} pathPrefix
   */
  enableHTTPCache(pathPrefix) {
    this._cachedPathPrefix = pathPrefix;
  }

  /**
   * @param {string} path
   * @param {string} username
   * @param {string} password
   */
  setAuth(path, username, password) {
    this.debugServer(`set auth for ${path} to ${username}:${password}`);
    this._auths.set(path, {username, password});
  }

  /**
   * @param {string} path 
   */
  enableGzip(path) {
    this._gzipRoutes.add(path);
  }

  /**
   * @param {string} path
   * @param {string} csp
   */
  setCSP(path, csp) {
    this._csp.set(path, csp);
  }

  /**
   * @param {string} path
   * @param {Object<string, string>} object
   */
  setExtraHeaders(path, object) {
    this._extraHeaders.set(path, object);
  }

  async stop() {
    this.reset();
    for (const socket of this._sockets)
      socket.destroy();
    this._sockets.clear();
    await new Promise(x => this._server.close(x));
  }

  /**
   * @param {string} path
   * @param {function(!http.IncomingMessage,http.ServerResponse)} handler
   */
  setRoute(path, handler) {
    this._routes.set(path, handler);
  }

  /**
   * @param {string} from
   * @param {string} to
   */
  setRedirect(from, to) {
    this.setRoute(from, (req, res) => {
      let headers = this._extraHeaders.get(req.url) || {};
      res.writeHead(302, { ...headers, location: to });
      res.end();
    });
  }

  /**
   * @param {string} path
   * @return {!Promise<!http.IncomingMessage>}
   */
  waitForRequest(path) {
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
    const error = new Error('Static Server has been reset');
    for (const subscriber of this._requestSubscribers.values())
      subscriber[rejectSymbol].call(null, error);
    this._requestSubscribers.clear();
  }

  /**
   * @param {http.IncomingMessage} request
   * @param {http.ServerResponse} response
   */
  _onRequest(request, response) {
    request.on('error', error => {
      if (error.code === 'ECONNRESET')
        response.end();
      else
        throw error;
    });
    request.postBody = new Promise(resolve => {
      const chunks = [];
      request.on('data', chunk => {
        chunks.push(chunk);
      });
      request.on('end', () => resolve(Buffer.concat(chunks)));
    });
    const path = url.parse(request.url).path;
    this.debugServer(`request ${request.method} ${path}`);
    if (this._auths.has(path)) {
      const auth = this._auths.get(path);
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
      this._requestSubscribers.get(path)[fulfillSymbol].call(null, request);
      this._requestSubscribers.delete(path);
    }
    const handler = this._routes.get(path);
    if (handler) {
      handler.call(null, request, response);
    } else {
      this.serveFile(request, response);
    }
  }

  /**
   * @param {!http.IncomingMessage} request
   * @param {!http.ServerResponse} response
   * @param {string|undefined} filePath
   */
  async serveFile(request, response, filePath) {
    let pathName = url.parse(request.url).path;
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
      response.setHeader('Content-Security-Policy', this._csp.get(pathName));

    if (this._extraHeaders.has(pathName)) {
      const object = this._extraHeaders.get(pathName);
      for (const key in object)
        response.setHeader(key, object[key]);
    }

    const {err, data} = await fs.promises.readFile(filePath).then(data => ({data})).catch(err => ({err}));
    // The HTTP transaction might be already terminated after async hop here - do nothing in this case.
    if (response.writableEnded)
      return;
    if (err) {
      response.statusCode = 404;
      response.end(`File not found: ${filePath}`);
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
        response.end(result);
    } else {
      response.end(data);
    }
  }

  /**
   * @param {*} handler 
   */
  onceWebSocketConnection(handler) {
    this._wsServer.once('connection', handler);
  }

  waitForWebSocketConnectionRequest() {
    return new Promise(fullfil => {
      this._wsServer.once('connection', (ws, req) => fullfil(req));
    });
  }

  /**
   * @param {*} data 
   */
  sendOnWebSocketConnection(data) {
    this.onceWebSocketConnection(ws => ws.send(data));
  }
}

module.exports = {TestServer};
