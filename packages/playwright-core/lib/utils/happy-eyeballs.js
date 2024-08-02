"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createSocket = createSocket;
exports.httpsHappyEyeballsAgent = exports.httpHappyEyeballsAgent = void 0;
var dns = _interopRequireWildcard(require("dns"));
var http = _interopRequireWildcard(require("http"));
var https = _interopRequireWildcard(require("https"));
var net = _interopRequireWildcard(require("net"));
var tls = _interopRequireWildcard(require("tls"));
var _manualPromise = require("./manualPromise");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
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

// Implementation(partial) of Happy Eyeballs 2 algorithm described in
// https://www.rfc-editor.org/rfc/rfc8305

// Same as in Chromium (https://source.chromium.org/chromium/chromium/src/+/5666ff4f5077a7e2f72902f3a95f5d553ea0d88d:net/socket/transport_connect_job.cc;l=102)
const connectionAttemptDelayMs = 300;
class HttpHappyEyeballsAgent extends http.Agent {
  createConnection(options, oncreate) {
    // There is no ambiguity in case of IP address.
    if (net.isIP(clientRequestArgsToHostName(options))) return net.createConnection(options);
    createConnectionAsync(options, oncreate, /* useTLS */false).catch(err => oncreate === null || oncreate === void 0 ? void 0 : oncreate(err));
  }
}
class HttpsHappyEyeballsAgent extends https.Agent {
  createConnection(options, oncreate) {
    // There is no ambiguity in case of IP address.
    if (net.isIP(clientRequestArgsToHostName(options))) return tls.connect(options);
    createConnectionAsync(options, oncreate, /* useTLS */true).catch(err => oncreate === null || oncreate === void 0 ? void 0 : oncreate(err));
  }
}
const httpsHappyEyeballsAgent = exports.httpsHappyEyeballsAgent = new HttpsHappyEyeballsAgent();
const httpHappyEyeballsAgent = exports.httpHappyEyeballsAgent = new HttpHappyEyeballsAgent();
async function createSocket(host, port) {
  return new Promise((resolve, reject) => {
    if (net.isIP(host)) {
      const socket = net.createConnection({
        host,
        port
      });
      socket.on('connect', () => resolve(socket));
      socket.on('error', error => reject(error));
    } else {
      createConnectionAsync({
        host,
        port
      }, (err, socket) => {
        if (err) reject(err);
        if (socket) resolve(socket);
      }, /* useTLS */false).catch(err => reject(err));
    }
  });
}
async function createConnectionAsync(options, oncreate, useTLS) {
  const lookup = options.__testHookLookup || lookupAddresses;
  const hostname = clientRequestArgsToHostName(options);
  const addresses = await lookup(hostname);
  const sockets = new Set();
  let firstError;
  let errorCount = 0;
  const handleError = (socket, err) => {
    var _firstError;
    if (!sockets.delete(socket)) return;
    ++errorCount;
    (_firstError = firstError) !== null && _firstError !== void 0 ? _firstError : firstError = err;
    if (errorCount === addresses.length) oncreate === null || oncreate === void 0 || oncreate(firstError);
  };
  const connected = new _manualPromise.ManualPromise();
  for (const {
    address
  } of addresses) {
    const socket = useTLS ? tls.connect({
      ...options,
      port: options.port,
      host: address,
      servername: hostname
    }) : net.createConnection({
      ...options,
      port: options.port,
      host: address
    });

    // Each socket may fire only one of 'connect', 'timeout' or 'error' events.
    // None of these events are fired after socket.destroy() is called.
    socket.on('connect', () => {
      connected.resolve();
      oncreate === null || oncreate === void 0 || oncreate(null, socket);
      // TODO: Cache the result?
      // Close other outstanding sockets.
      sockets.delete(socket);
      for (const s of sockets) s.destroy();
      sockets.clear();
    });
    socket.on('timeout', () => {
      // Timeout is not an error, so we have to manually close the socket.
      socket.destroy();
      handleError(socket, new Error('Connection timeout'));
    });
    socket.on('error', e => handleError(socket, e));
    sockets.add(socket);
    await Promise.race([connected, new Promise(f => setTimeout(f, connectionAttemptDelayMs))]);
    if (connected.isDone()) break;
  }
}
async function lookupAddresses(hostname) {
  const addresses = await dns.promises.lookup(hostname, {
    all: true,
    family: 0,
    verbatim: true
  });
  let firstFamily = addresses.filter(({
    family
  }) => family === 6);
  let secondFamily = addresses.filter(({
    family
  }) => family === 4);
  // Make sure first address in the list is the same as in the original order.
  if (firstFamily.length && firstFamily[0] !== addresses[0]) {
    const tmp = firstFamily;
    firstFamily = secondFamily;
    secondFamily = tmp;
  }
  const result = [];
  // Alternate ipv6 and ipv4 addresses.
  for (let i = 0; i < Math.max(firstFamily.length, secondFamily.length); i++) {
    if (firstFamily[i]) result.push(firstFamily[i]);
    if (secondFamily[i]) result.push(secondFamily[i]);
  }
  return result;
}
function clientRequestArgsToHostName(options) {
  if (options.hostname) return options.hostname;
  if (options.host) return options.host;
  throw new Error('Either options.hostname or options.host must be provided');
}