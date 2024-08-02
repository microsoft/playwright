"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NET_DEFAULT_TIMEOUT = void 0;
exports.constructURLBasedOnBaseURL = constructURLBasedOnBaseURL;
exports.createHttpServer = createHttpServer;
exports.createHttpsServer = createHttpsServer;
exports.fetchData = fetchData;
exports.httpRequest = httpRequest;
exports.isURLAvailable = isURLAvailable;
exports.urlMatches = urlMatches;
exports.urlMatchesEqual = urlMatchesEqual;
var _http = _interopRequireDefault(require("http"));
var _https = _interopRequireDefault(require("https"));
var _utilsBundle = require("../utilsBundle");
var _url = _interopRequireDefault(require("url"));
var _rtti = require("./rtti");
var _glob = require("./glob");
var _happyEyeballs = require("./happy-eyeballs");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
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

const NET_DEFAULT_TIMEOUT = exports.NET_DEFAULT_TIMEOUT = 30_000;
function httpRequest(params, onResponse, onError) {
  var _params$timeout;
  const parsedUrl = _url.default.parse(params.url);
  let options = {
    ...parsedUrl,
    agent: parsedUrl.protocol === 'https:' ? _happyEyeballs.httpsHappyEyeballsAgent : _happyEyeballs.httpHappyEyeballsAgent,
    method: params.method || 'GET',
    headers: params.headers
  };
  if (params.rejectUnauthorized !== undefined) options.rejectUnauthorized = params.rejectUnauthorized;
  const timeout = (_params$timeout = params.timeout) !== null && _params$timeout !== void 0 ? _params$timeout : NET_DEFAULT_TIMEOUT;
  const proxyURL = (0, _utilsBundle.getProxyForUrl)(params.url);
  if (proxyURL) {
    const parsedProxyURL = _url.default.parse(proxyURL);
    if (params.url.startsWith('http:')) {
      options = {
        path: parsedUrl.href,
        host: parsedProxyURL.hostname,
        port: parsedProxyURL.port,
        headers: options.headers,
        method: options.method
      };
    } else {
      parsedProxyURL.secureProxy = parsedProxyURL.protocol === 'https:';
      options.agent = new _utilsBundle.HttpsProxyAgent(parsedProxyURL);
      options.rejectUnauthorized = false;
    }
  }
  const requestCallback = res => {
    const statusCode = res.statusCode || 0;
    if (statusCode >= 300 && statusCode < 400 && res.headers.location) httpRequest({
      ...params,
      url: new URL(res.headers.location, params.url).toString()
    }, onResponse, onError);else onResponse(res);
  };
  const request = options.protocol === 'https:' ? _https.default.request(options, requestCallback) : _http.default.request(options, requestCallback);
  request.on('error', onError);
  if (timeout !== undefined) {
    const rejectOnTimeout = () => {
      onError(new Error(`Request to ${params.url} timed out after ${timeout}ms`));
      request.abort();
    };
    if (timeout <= 0) {
      rejectOnTimeout();
      return;
    }
    request.setTimeout(timeout, rejectOnTimeout);
  }
  request.end(params.data);
}
function fetchData(params, onError) {
  return new Promise((resolve, reject) => {
    httpRequest(params, async response => {
      if (response.statusCode !== 200) {
        const error = onError ? await onError(params, response) : new Error(`fetch failed: server returned code ${response.statusCode}. URL: ${params.url}`);
        reject(error);
        return;
      }
      let body = '';
      response.on('data', chunk => body += chunk);
      response.on('error', error => reject(error));
      response.on('end', () => resolve(body));
    }, reject);
  });
}
function urlMatchesEqual(match1, match2) {
  if ((0, _rtti.isRegExp)(match1) && (0, _rtti.isRegExp)(match2)) return match1.source === match2.source && match1.flags === match2.flags;
  return match1 === match2;
}
function urlMatches(baseURL, urlString, match) {
  if (match === undefined || match === '') return true;
  if ((0, _rtti.isString)(match) && !match.startsWith('*')) match = constructURLBasedOnBaseURL(baseURL, match);
  if ((0, _rtti.isString)(match)) match = (0, _glob.globToRegex)(match);
  if ((0, _rtti.isRegExp)(match)) return match.test(urlString);
  if (typeof match === 'string' && match === urlString) return true;
  const url = parsedURL(urlString);
  if (!url) return false;
  if (typeof match === 'string') return url.pathname === match;
  if (typeof match !== 'function') throw new Error('url parameter should be string, RegExp or function');
  return match(url);
}
function parsedURL(url) {
  try {
    return new URL(url);
  } catch (e) {
    return null;
  }
}
function constructURLBasedOnBaseURL(baseURL, givenURL) {
  try {
    return new URL(givenURL, baseURL).toString();
  } catch (e) {
    return givenURL;
  }
}
function createHttpServer(...args) {
  const server = _http.default.createServer(...args);
  decorateServer(server);
  return server;
}
function createHttpsServer(...args) {
  const server = _https.default.createServer(...args);
  decorateServer(server);
  return server;
}
async function isURLAvailable(url, ignoreHTTPSErrors, onLog, onStdErr) {
  let statusCode = await httpStatusCode(url, ignoreHTTPSErrors, onLog, onStdErr);
  if (statusCode === 404 && url.pathname === '/') {
    const indexUrl = new URL(url);
    indexUrl.pathname = '/index.html';
    statusCode = await httpStatusCode(indexUrl, ignoreHTTPSErrors, onLog, onStdErr);
  }
  return statusCode >= 200 && statusCode < 404;
}
async function httpStatusCode(url, ignoreHTTPSErrors, onLog, onStdErr) {
  return new Promise(resolve => {
    onLog === null || onLog === void 0 || onLog(`HTTP GET: ${url}`);
    httpRequest({
      url: url.toString(),
      headers: {
        Accept: '*/*'
      },
      rejectUnauthorized: !ignoreHTTPSErrors
    }, res => {
      var _res$statusCode;
      res.resume();
      const statusCode = (_res$statusCode = res.statusCode) !== null && _res$statusCode !== void 0 ? _res$statusCode : 0;
      onLog === null || onLog === void 0 || onLog(`HTTP Status: ${statusCode}`);
      resolve(statusCode);
    }, error => {
      if (error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') onStdErr === null || onStdErr === void 0 || onStdErr(`[WebServer] Self-signed certificate detected. Try adding ignoreHTTPSErrors: true to config.webServer.`);
      onLog === null || onLog === void 0 || onLog(`Error while checking if ${url} is available: ${error.message}`);
      resolve(0);
    });
  });
}
function decorateServer(server) {
  const sockets = new Set();
  server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  const close = server.close;
  server.close = callback => {
    for (const socket of sockets) socket.destroy();
    sockets.clear();
    return close.call(server, callback);
  };
}