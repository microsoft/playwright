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
    this._wsServer = new WebSocketServer({server: this._server });
    this._wsServer.shouldHandle = (request) => {
      const pathname = url.parse(request.url).pathname;
      return ['/ws', '/ws-emit-and-close'].includes(pathname);
    };
    this._wsServer.on('connection', (ws, request) => {
      const pathname = url.parse(request.url).pathname;
      if (this._onWebSocketConnectionData !== undefined)
        ws.send(this._onWebSocketConnectionData);
      if (pathname === '/ws-emit-and-close')
        ws.close(1003, 'closed by Playwright test-server');
    });
    this._server.listen(port);
    this._dirPath = dirPath;
    this.debugServer = require('debug')('pw:server');

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
    /** @type {!Set<string>} */
    this._gzipRoutes = new Set();
    /** @type {!Map<string, !Promise>} */
    this._requestSubscribers = new Map();
    /** @type {string|undefined} */
    this._onWebSocketConnectionData = undefined;

    const cross_origin = loopback || '127.0.0.1';
    const same_origin = loopback || 'localhost';
    const protocol = sslOptions ? 'https' : 'http';
    this.PORT = port;
    this.PREFIX = `${protocol}://${same_origin}:${port}`;
    this.CROSS_PROCESS_PREFIX = `${protocol}://${cross_origin}:${port}`;
    this.EMPTY_PAGE = `${protocol}://${same_origin}:${port}/empty.html`;
  }

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
      res.writeHead(302, { location: to });
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
      let body = Buffer.from([]);
      request.on('data', chunk => body = Buffer.concat([body, chunk]));
      request.on('end', () => resolve(body));
    });
    const pathName = url.parse(request.url).path;
    this.debugServer(`request ${request.method} ${pathName}`);
    if (this._auths.has(pathName)) {
      const auth = this._auths.get(pathName);
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
    if (this._requestSubscribers.has(pathName)) {
      this._requestSubscribers.get(pathName)[fulfillSymbol].call(null, request);
      this._requestSubscribers.delete(pathName);
    }
    const handler = this._routes.get(pathName);
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
    const mimeType = extensionToMime[extension] || 'application/octet-stream';
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

  waitForWebSocketConnectionRequest() {
    return new Promise(fullfil => {
      this._wsServer.once('connection', (ws, req) => fullfil(req));
    });
  }

  sendOnWebSocketConnection(data) {
    this._onWebSocketConnectionData = data;
  }
}

const extensionToMime = {
  'ai': 'application/postscript',
  'apng': 'image/apng',
  'appcache': 'text/cache-manifest',
  'au': 'audio/basic',
  'bmp': 'image/bmp',
  'cer': 'application/pkix-cert',
  'cgm': 'image/cgm',
  'coffee': 'text/coffeescript',
  'conf': 'text/plain',
  'crl': 'application/pkix-crl',
  'css': 'text/css',
  'csv': 'text/csv',
  'def': 'text/plain',
  'doc': 'application/msword',
  'dot': 'application/msword',
  'drle': 'image/dicom-rle',
  'dtd': 'application/xml-dtd',
  'ear': 'application/java-archive',
  'emf': 'image/emf',
  'eps': 'application/postscript',
  'exr': 'image/aces',
  'fits': 'image/fits',
  'g3': 'image/g3fax',
  'gbr': 'application/rpki-ghostbusters',
  'gif': 'image/gif',
  'glb': 'model/gltf-binary',
  'gltf': 'model/gltf+json',
  'gz': 'application/gzip',
  'h261': 'video/h261',
  'h263': 'video/h263',
  'h264': 'video/h264',
  'heic': 'image/heic',
  'heics': 'image/heic-sequence',
  'heif': 'image/heif',
  'heifs': 'image/heif-sequence',
  'htm': 'text/html',
  'html': 'text/html',
  'ics': 'text/calendar',
  'ief': 'image/ief',
  'ifb': 'text/calendar',
  'iges': 'model/iges',
  'igs': 'model/iges',
  'in': 'text/plain',
  'ini': 'text/plain',
  'jade': 'text/jade',
  'jar': 'application/java-archive',
  'jls': 'image/jls',
  'jp2': 'image/jp2',
  'jpe': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'jpf': 'image/jpx',
  'jpg': 'image/jpeg',
  'jpg2': 'image/jp2',
  'jpgm': 'video/jpm',
  'jpgv': 'video/jpeg',
  'jpm': 'image/jpm',
  'jpx': 'image/jpx',
  'js': 'application/javascript',
  'json': 'application/json',
  'json5': 'application/json5',
  'jsx': 'text/jsx',
  'jxr': 'image/jxr',
  'kar': 'audio/midi',
  'ktx': 'image/ktx',
  'less': 'text/less',
  'list': 'text/plain',
  'litcoffee': 'text/coffeescript',
  'log': 'text/plain',
  'm1v': 'video/mpeg',
  'm21': 'application/mp21',
  'm2a': 'audio/mpeg',
  'm2v': 'video/mpeg',
  'm3a': 'audio/mpeg',
  'm4a': 'audio/mp4',
  'm4p': 'application/mp4',
  'man': 'text/troff',
  'manifest': 'text/cache-manifest',
  'markdown': 'text/markdown',
  'mathml': 'application/mathml+xml',
  'md': 'text/markdown',
  'mdx': 'text/mdx',
  'me': 'text/troff',
  'mesh': 'model/mesh',
  'mft': 'application/rpki-manifest',
  'mid': 'audio/midi',
  'midi': 'audio/midi',
  'mj2': 'video/mj2',
  'mjp2': 'video/mj2',
  'mjs': 'application/javascript',
  'mml': 'text/mathml',
  'mov': 'video/quicktime',
  'mp2': 'audio/mpeg',
  'mp21': 'application/mp21',
  'mp2a': 'audio/mpeg',
  'mp3': 'audio/mpeg',
  'mp4': 'video/mp4',
  'mp4a': 'audio/mp4',
  'mp4s': 'application/mp4',
  'mp4v': 'video/mp4',
  'mpe': 'video/mpeg',
  'mpeg': 'video/mpeg',
  'mpg': 'video/mpeg',
  'mpg4': 'video/mp4',
  'mpga': 'audio/mpeg',
  'mrc': 'application/marc',
  'ms': 'text/troff',
  'msh': 'model/mesh',
  'n3': 'text/n3',
  'oga': 'audio/ogg',
  'ogg': 'audio/ogg',
  'ogv': 'video/ogg',
  'ogx': 'application/ogg',
  'otf': 'font/otf',
  'p10': 'application/pkcs10',
  'p7c': 'application/pkcs7-mime',
  'p7m': 'application/pkcs7-mime',
  'p7s': 'application/pkcs7-signature',
  'p8': 'application/pkcs8',
  'pdf': 'application/pdf',
  'pki': 'application/pkixcmp',
  'pkipath': 'application/pkix-pkipath',
  'png': 'image/png',
  'ps': 'application/postscript',
  'pskcxml': 'application/pskc+xml',
  'qt': 'video/quicktime',
  'rmi': 'audio/midi',
  'rng': 'application/xml',
  'roa': 'application/rpki-roa',
  'roff': 'text/troff',
  'rsd': 'application/rsd+xml',
  'rss': 'application/rss+xml',
  'rtf': 'application/rtf',
  'rtx': 'text/richtext',
  's3m': 'audio/s3m',
  'sgi': 'image/sgi',
  'sgm': 'text/sgml',
  'sgml': 'text/sgml',
  'shex': 'text/shex',
  'shtml': 'text/html',
  'sil': 'audio/silk',
  'silo': 'model/mesh',
  'slim': 'text/slim',
  'slm': 'text/slim',
  'snd': 'audio/basic',
  'spx': 'audio/ogg',
  'stl': 'model/stl',
  'styl': 'text/stylus',
  'stylus': 'text/stylus',
  'svg': 'image/svg+xml',
  'svgz': 'image/svg+xml',
  't': 'text/troff',
  't38': 'image/t38',
  'text': 'text/plain',
  'tfx': 'image/tiff-fx',
  'tif': 'image/tiff',
  'tiff': 'image/tiff',
  'tr': 'text/troff',
  'ts': 'video/mp2t',
  'tsv': 'text/tab-separated-values',
  'ttc': 'font/collection',
  'ttf': 'font/ttf',
  'ttl': 'text/turtle',
  'txt': 'text/plain',
  'uri': 'text/uri-list',
  'uris': 'text/uri-list',
  'urls': 'text/uri-list',
  'vcard': 'text/vcard',
  'vrml': 'model/vrml',
  'vtt': 'text/vtt',
  'war': 'application/java-archive',
  'wasm': 'application/wasm',
  'wav': 'audio/wav',
  'weba': 'audio/webm',
  'webm': 'video/webm',
  'webmanifest': 'application/manifest+json',
  'webp': 'image/webp',
  'wmf': 'image/wmf',
  'woff': 'font/woff',
  'woff2': 'font/woff2',
  'wrl': 'model/vrml',
  'x3d': 'model/x3d+xml',
  'x3db': 'model/x3d+fastinfoset',
  'x3dbz': 'model/x3d+binary',
  'x3dv': 'model/x3d-vrml',
  'x3dvz': 'model/x3d+vrml',
  'x3dz': 'model/x3d+xml',
  'xaml': 'application/xaml+xml',
  'xht': 'application/xhtml+xml',
  'xhtml': 'application/xhtml+xml',
  'xm': 'audio/xm',
  'xml': 'text/xml',
  'xsd': 'application/xml',
  'xsl': 'application/xml',
  'xslt': 'application/xslt+xml',
  'yaml': 'text/yaml',
  'yml': 'text/yaml',
  'zip': 'application/zip'
};

module.exports = {TestServer};
