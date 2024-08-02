"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.GlobalAPIRequestContext = exports.BrowserContextAPIRequestContext = exports.APIRequestContext = void 0;
var http = _interopRequireWildcard(require("http"));
var https = _interopRequireWildcard(require("https"));
var _stream = require("stream");
var _url = _interopRequireDefault(require("url"));
var _zlib = _interopRequireDefault(require("zlib"));
var _timeoutSettings = require("../common/timeoutSettings");
var _userAgent = require("../utils/userAgent");
var _utils = require("../utils");
var _utilsBundle = require("../utilsBundle");
var _browserContext = require("./browserContext");
var _cookieStore = require("./cookieStore");
var _formData = require("./formData");
var _happyEyeballs = require("../utils/happy-eyeballs");
var _instrumentation = require("./instrumentation");
var _progress = require("./progress");
var _tracing = require("./trace/recorder/tracing");
var _network = require("./network");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
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

class APIRequestContext extends _instrumentation.SdkObject {
  static findResponseBody(guid) {
    for (const request of APIRequestContext.allInstances) {
      const body = request.fetchResponses.get(guid);
      if (body) return body;
    }
    return undefined;
  }
  constructor(parent) {
    super(parent, 'request-context');
    this.fetchResponses = new Map();
    this.fetchLog = new Map();
    this._activeProgressControllers = new Set();
    this._closeReason = void 0;
    APIRequestContext.allInstances.add(this);
  }
  _disposeImpl() {
    APIRequestContext.allInstances.delete(this);
    this.fetchResponses.clear();
    this.fetchLog.clear();
    this.emit(APIRequestContext.Events.Dispose);
  }
  disposeResponse(fetchUid) {
    this.fetchResponses.delete(fetchUid);
    this.fetchLog.delete(fetchUid);
  }
  _storeResponseBody(body) {
    const uid = (0, _utils.createGuid)();
    this.fetchResponses.set(uid, body);
    return uid;
  }
  async fetch(params, metadata) {
    var _params$method;
    const defaults = this._defaultOptions();
    const headers = {
      'user-agent': defaults.userAgent,
      'accept': '*/*',
      'accept-encoding': 'gzip,deflate,br'
    };
    if (defaults.extraHTTPHeaders) {
      for (const {
        name,
        value
      } of defaults.extraHTTPHeaders) setHeader(headers, name, value);
    }
    if (params.headers) {
      for (const {
        name,
        value
      } of params.headers) setHeader(headers, name, value);
    }
    const requestUrl = new URL(params.url, defaults.baseURL);
    if (params.params) {
      for (const {
        name,
        value
      } of params.params) requestUrl.searchParams.set(name, value);
    }
    const credentials = this._getHttpCredentials(requestUrl);
    if ((credentials === null || credentials === void 0 ? void 0 : credentials.send) === 'always') setBasicAuthorizationHeader(headers, credentials);
    const method = ((_params$method = params.method) === null || _params$method === void 0 ? void 0 : _params$method.toUpperCase()) || 'GET';
    const proxy = defaults.proxy;
    let agent;
    if (proxy && proxy.server !== 'per-context' && !shouldBypassProxy(requestUrl, proxy.bypass)) {
      var _proxyOpts$protocol;
      const proxyOpts = _url.default.parse(proxy.server);
      if ((_proxyOpts$protocol = proxyOpts.protocol) !== null && _proxyOpts$protocol !== void 0 && _proxyOpts$protocol.startsWith('socks')) {
        agent = new _utilsBundle.SocksProxyAgent({
          host: proxyOpts.hostname,
          port: proxyOpts.port || undefined
        });
      } else {
        if (proxy.username) proxyOpts.auth = `${proxy.username}:${proxy.password || ''}`;
        // TODO: We should use HttpProxyAgent conditional on proxyOpts.protocol instead of always using CONNECT method.
        agent = new _utilsBundle.HttpsProxyAgent(proxyOpts);
      }
    }
    const timeout = defaults.timeoutSettings.timeout(params);
    const deadline = timeout && (0, _utils.monotonicTime)() + timeout;
    const options = {
      method,
      headers,
      agent,
      maxRedirects: params.maxRedirects === 0 ? -1 : params.maxRedirects === undefined ? 20 : params.maxRedirects,
      timeout,
      deadline,
      __testHookLookup: params.__testHookLookup
    };
    // rejectUnauthorized = undefined is treated as true in node 12.
    if (params.ignoreHTTPSErrors || defaults.ignoreHTTPSErrors) options.rejectUnauthorized = false;
    const postData = serializePostData(params, headers);
    if (postData) setHeader(headers, 'content-length', String(postData.byteLength));
    const controller = new _progress.ProgressController(metadata, this);
    const fetchResponse = await controller.run(progress => {
      return this._sendRequest(progress, requestUrl, options, postData);
    });
    const fetchUid = this._storeResponseBody(fetchResponse.body);
    this.fetchLog.set(fetchUid, controller.metadata.log);
    if (params.failOnStatusCode && (fetchResponse.status < 200 || fetchResponse.status >= 400)) throw new Error(`${fetchResponse.status} ${fetchResponse.statusText}`);
    return {
      ...fetchResponse,
      fetchUid
    };
  }
  _parseSetCookieHeader(responseUrl, setCookie) {
    if (!setCookie) return [];
    const url = new URL(responseUrl);
    // https://datatracker.ietf.org/doc/html/rfc6265#section-5.1.4
    const defaultPath = '/' + url.pathname.substr(1).split('/').slice(0, -1).join('/');
    const cookies = [];
    for (const header of setCookie) {
      // Decode cookie value?
      const cookie = parseCookie(header);
      if (!cookie) continue;
      // https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.3
      if (!cookie.domain) cookie.domain = url.hostname;else (0, _utils.assert)(cookie.domain.startsWith('.') || !cookie.domain.includes('.'));
      if (!(0, _cookieStore.domainMatches)(url.hostname, cookie.domain)) continue;
      // https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.4
      if (!cookie.path || !cookie.path.startsWith('/')) cookie.path = defaultPath;
      cookies.push(cookie);
    }
    return cookies;
  }
  async _updateRequestCookieHeader(url, headers) {
    if (getHeader(headers, 'cookie') !== undefined) return;
    const cookies = await this._cookies(url);
    if (cookies.length) {
      const valueArray = cookies.map(c => `${c.name}=${c.value}`);
      setHeader(headers, 'cookie', valueArray.join('; '));
    }
  }
  async _sendRequest(progress, url, options, postData) {
    var _getHeader;
    await this._updateRequestCookieHeader(url, options.headers);
    const requestCookies = ((_getHeader = getHeader(options.headers, 'cookie')) === null || _getHeader === void 0 ? void 0 : _getHeader.split(';').map(p => {
      const [name, value] = p.split('=').map(v => v.trim());
      return {
        name,
        value
      };
    })) || [];
    const requestEvent = {
      url,
      method: options.method,
      headers: options.headers,
      cookies: requestCookies,
      postData
    };
    this.emit(APIRequestContext.Events.Request, requestEvent);
    return new Promise((fulfill, reject) => {
      const requestConstructor = (url.protocol === 'https:' ? https : http).request;
      // If we have a proxy agent already, do not override it.
      const agent = options.agent || (url.protocol === 'https:' ? _happyEyeballs.httpsHappyEyeballsAgent : _happyEyeballs.httpHappyEyeballsAgent);
      const requestOptions = {
        ...options,
        agent
      };
      const request = requestConstructor(url, requestOptions, async response => {
        const notifyRequestFinished = body => {
          const requestFinishedEvent = {
            requestEvent,
            httpVersion: response.httpVersion,
            statusCode: response.statusCode || 0,
            statusMessage: response.statusMessage || '',
            headers: response.headers,
            rawHeaders: response.rawHeaders,
            cookies,
            body
          };
          this.emit(APIRequestContext.Events.RequestFinished, requestFinishedEvent);
        };
        progress.log(`← ${response.statusCode} ${response.statusMessage}`);
        for (const [name, value] of Object.entries(response.headers)) progress.log(`  ${name}: ${value}`);
        const cookies = this._parseSetCookieHeader(response.url || url.toString(), response.headers['set-cookie']);
        if (cookies.length) {
          try {
            await this._addCookies(cookies);
          } catch (e) {
            // Cookie value is limited by 4096 characters in the browsers. If setCookies failed,
            // we try setting each cookie individually just in case only some of them are bad.
            await Promise.all(cookies.map(c => this._addCookies([c]).catch(() => {})));
          }
        }
        if (redirectStatus.includes(response.statusCode) && options.maxRedirects >= 0) {
          var _response$headers$loc;
          if (!options.maxRedirects) {
            reject(new Error('Max redirect count exceeded'));
            request.destroy();
            return;
          }
          const headers = {
            ...options.headers
          };
          removeHeader(headers, `cookie`);

          // HTTP-redirect fetch step 13 (https://fetch.spec.whatwg.org/#http-redirect-fetch)
          const status = response.statusCode;
          let method = options.method;
          if ((status === 301 || status === 302) && method === 'POST' || status === 303 && !['GET', 'HEAD'].includes(method)) {
            method = 'GET';
            postData = undefined;
            removeHeader(headers, `content-encoding`);
            removeHeader(headers, `content-language`);
            removeHeader(headers, `content-length`);
            removeHeader(headers, `content-location`);
            removeHeader(headers, `content-type`);
          }
          const redirectOptions = {
            method,
            headers,
            agent: options.agent,
            maxRedirects: options.maxRedirects - 1,
            timeout: options.timeout,
            deadline: options.deadline,
            __testHookLookup: options.__testHookLookup
          };
          // rejectUnauthorized = undefined is treated as true in node 12.
          if (options.rejectUnauthorized === false) redirectOptions.rejectUnauthorized = false;

          // HTTP-redirect fetch step 4: If locationURL is null, then return response.
          // Best-effort UTF-8 decoding, per spec it's US-ASCII only, but browsers are more lenient.
          // Node.js parses it as Latin1 via std::v8::String, so we convert it to UTF-8.
          const locationHeaderValue = Buffer.from((_response$headers$loc = response.headers.location) !== null && _response$headers$loc !== void 0 ? _response$headers$loc : '', 'latin1').toString('utf8');
          if (locationHeaderValue) {
            let locationURL;
            try {
              locationURL = new URL(locationHeaderValue, url);
            } catch (error) {
              reject(new Error(`uri requested responds with an invalid redirect URL: ${locationHeaderValue}`));
              request.destroy();
              return;
            }
            if (headers['host']) headers['host'] = locationURL.host;
            notifyRequestFinished();
            fulfill(this._sendRequest(progress, locationURL, redirectOptions, postData));
            request.destroy();
            return;
          }
        }
        if (response.statusCode === 401 && !getHeader(options.headers, 'authorization')) {
          const auth = response.headers['www-authenticate'];
          const credentials = this._getHttpCredentials(url);
          if (auth !== null && auth !== void 0 && auth.trim().startsWith('Basic') && credentials) {
            setBasicAuthorizationHeader(options.headers, credentials);
            notifyRequestFinished();
            fulfill(this._sendRequest(progress, url, options, postData));
            request.destroy();
            return;
          }
        }
        response.on('aborted', () => reject(new Error('aborted')));
        const chunks = [];
        const notifyBodyFinished = () => {
          const body = Buffer.concat(chunks);
          notifyRequestFinished(body);
          fulfill({
            url: response.url || url.toString(),
            status: response.statusCode || 0,
            statusText: response.statusMessage || '',
            headers: toHeadersArray(response.rawHeaders),
            body
          });
        };
        let body = response;
        let transform;
        const encoding = response.headers['content-encoding'];
        if (encoding === 'gzip' || encoding === 'x-gzip') {
          transform = _zlib.default.createGunzip({
            flush: _zlib.default.constants.Z_SYNC_FLUSH,
            finishFlush: _zlib.default.constants.Z_SYNC_FLUSH
          });
        } else if (encoding === 'br') {
          transform = _zlib.default.createBrotliDecompress();
        } else if (encoding === 'deflate') {
          transform = _zlib.default.createInflate();
        }
        if (transform) {
          // Brotli and deflate decompressors throw if the input stream is empty.
          const emptyStreamTransform = new SafeEmptyStreamTransform(notifyBodyFinished);
          body = (0, _stream.pipeline)(response, emptyStreamTransform, transform, e => {
            if (e) reject(new Error(`failed to decompress '${encoding}' encoding: ${e.message}`));
          });
          body.on('error', e => reject(new Error(`failed to decompress '${encoding}' encoding: ${e}`)));
        } else {
          body.on('error', reject);
        }
        body.on('data', chunk => chunks.push(chunk));
        body.on('end', notifyBodyFinished);
      });
      request.on('error', reject);
      const disposeListener = () => {
        reject(new Error('Request context disposed.'));
        request.destroy();
      };
      this.on(APIRequestContext.Events.Dispose, disposeListener);
      request.on('close', () => this.off(APIRequestContext.Events.Dispose, disposeListener));
      progress.log(`→ ${options.method} ${url.toString()}`);
      if (options.headers) {
        for (const [name, value] of Object.entries(options.headers)) progress.log(`  ${name}: ${value}`);
      }
      if (options.deadline) {
        const rejectOnTimeout = () => {
          reject(new Error(`Request timed out after ${options.timeout}ms`));
          request.destroy();
        };
        const remaining = options.deadline - (0, _utils.monotonicTime)();
        if (remaining <= 0) {
          rejectOnTimeout();
          return;
        }
        request.setTimeout(remaining, rejectOnTimeout);
      }
      if (postData) request.write(postData);
      request.end();
    });
  }
  _getHttpCredentials(url) {
    var _this$_defaultOptions, _this$_defaultOptions2;
    if (!((_this$_defaultOptions = this._defaultOptions().httpCredentials) !== null && _this$_defaultOptions !== void 0 && _this$_defaultOptions.origin) || url.origin.toLowerCase() === ((_this$_defaultOptions2 = this._defaultOptions().httpCredentials) === null || _this$_defaultOptions2 === void 0 || (_this$_defaultOptions2 = _this$_defaultOptions2.origin) === null || _this$_defaultOptions2 === void 0 ? void 0 : _this$_defaultOptions2.toLowerCase())) return this._defaultOptions().httpCredentials;
    return undefined;
  }
}
exports.APIRequestContext = APIRequestContext;
APIRequestContext.Events = {
  Dispose: 'dispose',
  Request: 'request',
  RequestFinished: 'requestfinished'
};
APIRequestContext.allInstances = new Set();
class SafeEmptyStreamTransform extends _stream.Transform {
  constructor(onEmptyStreamCallback) {
    super();
    this._receivedSomeData = false;
    this._onEmptyStreamCallback = void 0;
    this._onEmptyStreamCallback = onEmptyStreamCallback;
  }
  _transform(chunk, encoding, callback) {
    this._receivedSomeData = true;
    callback(null, chunk);
  }
  _flush(callback) {
    if (this._receivedSomeData) callback(null);else this._onEmptyStreamCallback();
  }
}
class BrowserContextAPIRequestContext extends APIRequestContext {
  constructor(context) {
    super(context);
    this._context = void 0;
    this._context = context;
    context.once(_browserContext.BrowserContext.Events.Close, () => this._disposeImpl());
  }
  tracing() {
    return this._context.tracing;
  }
  async dispose(options) {
    this._closeReason = options.reason;
    this.fetchResponses.clear();
  }
  _defaultOptions() {
    return {
      userAgent: this._context._options.userAgent || this._context._browser.userAgent(),
      extraHTTPHeaders: this._context._options.extraHTTPHeaders,
      httpCredentials: this._context._options.httpCredentials,
      proxy: this._context._options.proxy || this._context._browser.options.proxy,
      timeoutSettings: this._context._timeoutSettings,
      ignoreHTTPSErrors: this._context._options.ignoreHTTPSErrors,
      baseURL: this._context._options.baseURL
    };
  }
  async _addCookies(cookies) {
    await this._context.addCookies(cookies);
  }
  async _cookies(url) {
    return await this._context.cookies(url.toString());
  }
  async storageState() {
    return this._context.storageState();
  }
}
exports.BrowserContextAPIRequestContext = BrowserContextAPIRequestContext;
class GlobalAPIRequestContext extends APIRequestContext {
  constructor(playwright, options) {
    super(playwright);
    this._cookieStore = new _cookieStore.CookieStore();
    this._options = void 0;
    this._origins = void 0;
    this._tracing = void 0;
    this.attribution.context = this;
    const timeoutSettings = new _timeoutSettings.TimeoutSettings();
    if (options.timeout !== undefined) timeoutSettings.setDefaultTimeout(options.timeout);
    const proxy = options.proxy;
    if (proxy !== null && proxy !== void 0 && proxy.server) {
      let url = proxy === null || proxy === void 0 ? void 0 : proxy.server.trim();
      if (!/^\w+:\/\//.test(url)) url = 'http://' + url;
      proxy.server = url;
    }
    if (options.storageState) {
      this._origins = options.storageState.origins;
      this._cookieStore.addCookies(options.storageState.cookies || []);
    }
    this._options = {
      baseURL: options.baseURL,
      userAgent: options.userAgent || (0, _userAgent.getUserAgent)(),
      extraHTTPHeaders: options.extraHTTPHeaders,
      ignoreHTTPSErrors: !!options.ignoreHTTPSErrors,
      httpCredentials: options.httpCredentials,
      proxy,
      timeoutSettings
    };
    this._tracing = new _tracing.Tracing(this, options.tracesDir);
  }
  tracing() {
    return this._tracing;
  }
  async dispose(options) {
    this._closeReason = options.reason;
    await this._tracing.flush();
    await this._tracing.deleteTmpTracesDir();
    this._disposeImpl();
  }
  _defaultOptions() {
    return this._options;
  }
  async _addCookies(cookies) {
    this._cookieStore.addCookies(cookies);
  }
  async _cookies(url) {
    return this._cookieStore.cookies(url);
  }
  async storageState() {
    return {
      cookies: this._cookieStore.allCookies(),
      origins: this._origins || []
    };
  }
}
exports.GlobalAPIRequestContext = GlobalAPIRequestContext;
function toHeadersArray(rawHeaders) {
  const result = [];
  for (let i = 0; i < rawHeaders.length; i += 2) result.push({
    name: rawHeaders[i],
    value: rawHeaders[i + 1]
  });
  return result;
}
const redirectStatus = [301, 302, 303, 307, 308];
function parseCookie(header) {
  const pairs = header.split(';').filter(s => s.trim().length > 0).map(p => {
    let key = '';
    let value = '';
    const separatorPos = p.indexOf('=');
    if (separatorPos === -1) {
      // If only a key is specified, the value is left undefined.
      key = p.trim();
    } else {
      // Otherwise we assume that the key is the element before the first `=`
      key = p.slice(0, separatorPos).trim();
      // And the value is the rest of the string.
      value = p.slice(separatorPos + 1).trim();
    }
    return [key, value];
  });
  if (!pairs.length) return null;
  const [name, value] = pairs[0];
  const cookie = {
    name,
    value,
    domain: '',
    path: '',
    expires: -1,
    httpOnly: false,
    secure: false,
    // From https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite
    // The cookie-sending behavior if SameSite is not specified is SameSite=Lax.
    sameSite: 'Lax'
  };
  for (let i = 1; i < pairs.length; i++) {
    const [name, value] = pairs[i];
    switch (name.toLowerCase()) {
      case 'expires':
        const expiresMs = +new Date(value);
        // https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.1
        if (isFinite(expiresMs)) {
          if (expiresMs <= 0) cookie.expires = 0;else cookie.expires = Math.min(expiresMs / 1000, _network.kMaxCookieExpiresDateInSeconds);
        }
        break;
      case 'max-age':
        const maxAgeSec = parseInt(value, 10);
        if (isFinite(maxAgeSec)) {
          // From https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.2
          // If delta-seconds is less than or equal to zero (0), let expiry-time
          // be the earliest representable date and time.
          if (maxAgeSec <= 0) cookie.expires = 0;else cookie.expires = Math.min(Date.now() / 1000 + maxAgeSec, _network.kMaxCookieExpiresDateInSeconds);
        }
        break;
      case 'domain':
        cookie.domain = value.toLocaleLowerCase() || '';
        if (cookie.domain && !cookie.domain.startsWith('.') && cookie.domain.includes('.')) cookie.domain = '.' + cookie.domain;
        break;
      case 'path':
        cookie.path = value || '';
        break;
      case 'secure':
        cookie.secure = true;
        break;
      case 'httponly':
        cookie.httpOnly = true;
        break;
      case 'samesite':
        switch (value.toLowerCase()) {
          case 'none':
            cookie.sameSite = 'None';
            break;
          case 'lax':
            cookie.sameSite = 'Lax';
            break;
          case 'strict':
            cookie.sameSite = 'Strict';
            break;
        }
        break;
    }
  }
  return cookie;
}
function serializePostData(params, headers) {
  (0, _utils.assert)((params.postData ? 1 : 0) + (params.jsonData ? 1 : 0) + (params.formData ? 1 : 0) + (params.multipartData ? 1 : 0) <= 1, `Only one of 'data', 'form' or 'multipart' can be specified`);
  if (params.jsonData !== undefined) {
    setHeader(headers, 'content-type', 'application/json', true);
    return Buffer.from(params.jsonData, 'utf8');
  } else if (params.formData) {
    const searchParams = new URLSearchParams();
    for (const {
      name,
      value
    } of params.formData) searchParams.append(name, value);
    setHeader(headers, 'content-type', 'application/x-www-form-urlencoded', true);
    return Buffer.from(searchParams.toString(), 'utf8');
  } else if (params.multipartData) {
    const formData = new _formData.MultipartFormData();
    for (const field of params.multipartData) {
      if (field.file) formData.addFileField(field.name, field.file);else if (field.value) formData.addField(field.name, field.value);
    }
    setHeader(headers, 'content-type', formData.contentTypeHeader(), true);
    return formData.finish();
  } else if (params.postData !== undefined) {
    setHeader(headers, 'content-type', 'application/octet-stream', true);
    return params.postData;
  }
  return undefined;
}
function setHeader(headers, name, value, keepExisting = false) {
  const existing = Object.entries(headers).find(pair => pair[0].toLowerCase() === name.toLowerCase());
  if (!existing) headers[name] = value;else if (!keepExisting) headers[existing[0]] = value;
}
function getHeader(headers, name) {
  const existing = Object.entries(headers).find(pair => pair[0].toLowerCase() === name.toLowerCase());
  return existing ? existing[1] : undefined;
}
function removeHeader(headers, name) {
  delete headers[name];
}
function shouldBypassProxy(url, bypass) {
  if (!bypass) return false;
  const domains = bypass.split(',').map(s => {
    s = s.trim();
    if (!s.startsWith('.')) s = '.' + s;
    return s;
  });
  const domain = '.' + url.hostname;
  return domains.some(d => domain.endsWith(d));
}
function setBasicAuthorizationHeader(headers, credentials) {
  const {
    username,
    password
  } = credentials;
  const encoded = Buffer.from(`${username || ''}:${password || ''}`).toString('base64');
  setHeader(headers, 'authorization', `Basic ${encoded}`);
}