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
const mime = require('mime');
const WebSocketServer = require('ws').Server;

const fulfillSymbol = Symbol('fullfil callback');
const rejectSymbol = Symbol('reject callback');

class TestServer {
  /**
   * @param {string} dirPath
   * @param {number} port
   * @return {!TestServer}
   */
  static async create(dirPath, port) {
    const server = new TestServer(dirPath, port);
    await new Promise(x => server._server.once('listening', x));
    return server;
  }

  /**
   * @param {string} dirPath
   * @param {number} port
   * @return {!TestServer}
   */
  static async createHTTPS(dirPath, port) {
    const server = new TestServer(dirPath, port, {
      key: fs.readFileSync(path.join(__dirname, 'key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
      passphrase: 'aaaa',
    });
    await new Promise(x => server._server.once('listening', x));
    return server;
  }

  /**
   * @param {string} dirPath
   * @param {number} port
   * @param {!Object=} sslOptions
   */
  constructor(dirPath, port, sslOptions) {
    if (sslOptions)
      this._server = https.createServer(sslOptions, this._onRequest.bind(this));
    else
      this._server = http.createServer(this._onRequest.bind(this));
    this._server.on('connection', socket => this._onSocket(socket));
    this._wsServer = new WebSocketServer({server: this._server});
    this._wsServer.on('connection', this._onWebSocketConnection.bind(this));
    this._server.listen(port);
    this._dirPath = dirPath;

    this._startTime = new Date();
    this._cachedPathPrefix = null;

    /** @type {!Set<!net.Socket>} */
    this._sockets = new Set();

    /** @type {!Map<string, function(!IncomingMessage, !ServerResponse)>} */
    this._routes = new Map();
    /** @type {!Map<string, !{username:string, password:string}>} */
    this._auths = new Map();
    /** @type {!Map<string, string>} */
    this._csp = new Map();
    /** @type {!Set<string>} */
    this._gzipRoutes = new Set();
    /** @type {!Map<string, !Promise>} */
    this._requestSubscribers = new Map();
  }

  _onSocket(socket) {
    this._sockets.add(socket);
    // ECONNRESET is a legit error given
    // that tab closing simply kills process.
    socket.on('error', error => {
      if (error.code !== 'ECONNRESET')
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
    this._auths.set(path, {username, password});
  }

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

  async stop() {
    this.reset();
    for (const socket of this._sockets)
      socket.destroy();
    this._sockets.clear();
    await new Promise(x => this._server.close(x));
  }

  /**
   * @param {string} path
   * @param {function(!IncomingMessage, !ServerResponse)} handler
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
      res.writeHead(302, { location: to });
      res.end();
    });
  }

  /**
   * @param {string} path
   * @return {!Promise<!IncomingMessage>}
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
    this._gzipRoutes.clear();
    const error = new Error('Static Server has been reset');
    for (const subscriber of this._requestSubscribers.values())
      subscriber[rejectSymbol].call(null, error);
    this._requestSubscribers.clear();
  }

  _onRequest(request, response) {
    request.on('error', error => {
      if (error.code === 'ECONNRESET')
        response.end();
      else
        throw error;
    });
    request.postBody = new Promise(resolve => {
      let body = '';
      request.on('data', chunk => body += chunk);
      request.on('end', () => resolve(body));
    });
    const pathName = url.parse(request.url).path;
    if (this._auths.has(pathName)) {
      const auth = this._auths.get(pathName);
      const credentials = Buffer.from((request.headers.authorization || '').split(' ')[1] || '', 'base64').toString();
      if (credentials !== `${auth.username}:${auth.password}`) {
        response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Secure Area"' });
        response.end('HTTP Error 401 Unauthorized: Access is denied');
        return;
      }
    }
    // Notify request subscriber.
    if (this._requestSubscribers.has(pathName)) {
      this._requestSubscribers.get(pathName)[fulfillSymbol].call(null, request);
      this._requestSubscribers.delete(pathName);
    }
    const handler = this._routes.get(pathName);
    if (handler) {
      handler.call(null, request, response);
    } else {
      const pathName = url.parse(request.url).path;
      this.serveFile(request, response, pathName);
    }
  }

  /**
   * @param {!IncomingMessage} request
   * @param {!ServerResponse} response
   * @param {string} pathName
   */
  serveFile(request, response, pathName) {
    if (pathName === '/')
      pathName = '/index.html';
    const filePath = path.join(this._dirPath, pathName.substring(1));

    if (this._cachedPathPrefix !== null && filePath.startsWith(this._cachedPathPrefix)) {
      if (request.headers['if-modified-since']) {
        response.statusCode = 304; // not modified
        response.end();
        return;
      }
      response.setHeader('Cache-Control', 'public, max-age=31536000');
      response.setHeader('Last-Modified', this._startTime.toISOString());
    } else {
      response.setHeader('Cache-Control', 'no-cache, no-store');
    }
    if (this._csp.has(pathName))
      response.setHeader('Content-Security-Policy', this._csp.get(pathName));

    fs.readFile(filePath, (err, data) => {
      if (err) {
        response.statusCode = 404;
        response.end(`File not found: ${filePath}`);
        return;
      }
      const mimeType = mime.getType(filePath);
      const isTextEncoding = /^text\/|^application\/(javascript|json)/.test(mimeType);
      const contentType = isTextEncoding ? `${mimeType}; charset=utf-8` : mimeType;
      response.setHeader('Content-Type', contentType);
      if (this._gzipRoutes.has(pathName)) {
        response.setHeader('Content-Encoding', 'gzip');
        const zlib = require('zlib');
        zlib.gzip(data, (_, result) => {
          response.end(result);
        });
      } else {
        response.end(data);
      }
    });
  }

  _onWebSocketConnection(connection) {
    connection.send('opened');
  }
}

module.exports = {TestServer};
