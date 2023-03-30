/**
 * node-http-proxy
 *
 * Copyright (c) 2010-2016 Charlie Robbins, Jarrett Cruger & the Contributors.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
const URL = require('url');
const http = require('http');
const https = require('https');

const upgradeHeader = /(^|,)\s*upgrade\s*($|,)/i;

// This is a stripped-down version of
// https://github.com/http-party/node-http-proxy
// library that implements a basic reverse proxy
// for both HTTP and WS connections.
class ProxyServer {
  constructor(target, log = () => {}) {
    this._target = URL.parse(target);
    this._log = log;
    if (this._target.path !== '/')
      throw new Error('ERROR: target must have no path');
    this._agent = this._target.protocol === 'https:' ? https : http;
  }

  web(req, res) {
   if ((req.method === 'DELETE' || req.method === 'OPTIONS') && !req.headers['content-length']) {
      req.headers['content-length'] = '0';
      delete req.headers['transfer-encoding'];
    }

    // Request initalization
    const options = {
      protocol: this._target.protocol,
      hostname: this._target.hostname,
      port: this._target.port,
      path: req.url,
      method: req.method,
      headers: req.headers,
    };
    if (typeof options.headers.connection !== 'string' || !upgradeHeader.test(options.headers.connection))
      options.headers.connection = 'close';
    const proxyReq = this._agent.request(options);

    req.on('aborted', () => proxyReq.abort());

    const errorHandler = error => {
      this._log(error);
      if (req.socket.destroyed && err.code === 'ECONNRESET')
        return proxyReq.abort();
    }
    req.on('error', errorHandler);
    proxyReq.on('error', errorHandler);

    req.pipe(proxyReq);

    proxyReq.on('response', proxyRes => {
      if (!res.headersSent) {
        if (req.httpVersion !== '2.0' && !proxyRes.headers.connection)
          proxyRes.headers.connection = req.headers.connection || 'keep-alive';
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          if (value !== undefined)
            res.setHeader(String(key).trim(), value);
        }

        res.statusCode = proxyRes.statusCode;
        if (proxyRes.statusMessage)
          res.statusMessage = proxyRes.statusMessage;
      }
      if (!res.finished)
        proxyRes.pipe(res);
    });
  }

  ws(req, socket, head) {
    if (req.method !== 'GET' || !req.headers.upgrade || req.headers.upgrade.toLowerCase() !== 'websocket') {
      socket.destroy();
      return;
    }

    socket.setTimeout(0);
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 0);

    if (head && head.length)
      socket.unshift(head);

    const proxyReq = this._agent.request({
      protocol: this._target.protocol,
      hostname: this._target.hostname,
      port: this._target.port,
      path: req.url,
      method: req.method,
      headers: req.headers,
    });

    // Error Handler
    const errorHandler = err => {
      this._log(err);
      socket.end();
    }
    socket.on('error', errorHandler);
    proxyReq.on('error', errorHandler);
    proxyReq.on('response', function (res) {
      // if upgrade event isn't going to happen, close the socket
      if (!res.upgrade) {
        socket.write(createHTTPHeader('HTTP/' + res.httpVersion + ' ' + res.statusCode + ' ' + res.statusMessage, res.headers));
        res.pipe(socket);
      }
    });
    proxyReq.on('upgrade', function(proxyRes, proxySocket, proxyHead) {
      proxySocket.on('error', errorHandler);

      // The pipe below will end proxySocket if socket closes cleanly, but not
      // if it errors (eg, vanishes from the net and starts returning
      // EHOSTUNREACH). We need to do that explicitly.
      socket.on('error', () => proxySocket.end());

      proxySocket.setTimeout(0);
      proxySocket.setNoDelay(true);
      proxySocket.setKeepAlive(true, 0);

      if (proxyHead && proxyHead.length)
        proxySocket.unshift(proxyHead);

      //
      // Remark: Handle writing the headers to the socket when switching protocols
      // Also handles when a header is an array
      //
      socket.write(createHTTPHeader('HTTP/1.1 101 Switching Protocols', proxyRes.headers));
      proxySocket.pipe(socket).pipe(proxySocket);
    });
    return proxyReq.end();
  }
}

function createHTTPHeader(line, headers) {
  const lines = [line];
  for (const [key, arrayOrValue] of Object.entries(headers)) {
    for (const value of [arrayOrValue].flat())
      lines.push(key + ': ' + value);
  }
  return lines.join('\r\n') + '\r\n\r\n';
}

module.exports = { ProxyServer };
