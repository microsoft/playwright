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

import http from 'http';
import https from 'https';
import net from 'net';
import tls from 'tls';

import { generateSelfSignedCertificate } from '@utils/crypto';
import { httpHappyEyeballsAgent, httpsHappyEyeballsAgent } from '@utils/happyEyeballs';
import { createHttpServer, createHttpsServer, createProxyAgent, shouldBypassProxy, startHttpServer } from '@utils/network';
import { urlMatches } from '@isomorphic/urlMatch';

import { ResponseCache } from './cache';
import { isDefaultStorable, isHardBlocked } from './cacheSemantics';

import type { CachedResponse } from './cache';
import type { ProxySettings } from '@utils/network';

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'proxy-connection']);
const LOOPBACK_BYPASS = 'localhost, 127.0.0.1, ::1, [::1]';

export type HttpCacheDecision = {
  disposition?: 'cache' | 'no-cache' | 'default';
  identity?: string | null;
};
export type HttpCachePolicy = (request: Request) => HttpCacheDecision;
export type HttpCacheMatch = string | RegExp | HttpCachePolicy | undefined;

export type CacheEntry = { cache: ResponseCache, match: HttpCacheMatch };

type Selection = { cache: ResponseCache, read: boolean, write: 'force' | 'never' | 'default', identity: string };

export class CacheProxy {
  private _entry: CacheEntry;
  private _proxy: ProxySettings | undefined;
  private _proxyAgent: http.Agent | undefined;
  private _httpServer: http.Server;
  private _httpsServer: https.Server;
  private _inflight = new Map<string, Promise<CachedResponse | undefined>>();

  constructor(entry: CacheEntry, proxy?: ProxySettings) {
    this._entry = entry;
    this._proxy = proxy;
    this._proxyAgent = createProxyAgent(proxy, undefined, { keepAlive: true });
    const { cert, key } = generateSelfSignedCertificate();

    this._httpServer = createHttpServer((req, res) => this._handleRequest(req, res, false));
    this._httpServer.on('connect', (req, socket, head) => this._onConnect(req, socket as net.Socket, head));
    this._httpServer.on('upgrade', (req, socket, head) => this._onUpgrade(req, socket as net.Socket, head, false));
    this._httpsServer = createHttpsServer({ cert, key }, (req, res) => this._handleRequest(req, res, true));
    this._httpsServer.on('upgrade', (req, socket, head) => this._onUpgrade(req, socket as net.Socket, head, true));
  }

  async start(): Promise<string> {
    await startHttpServer(this._httpServer, { host: '127.0.0.1', port: 0 });
    const address = this._httpServer.address() as net.AddressInfo;
    return `http://127.0.0.1:${address.port}`;
  }

  async stop() {
    await Promise.all([
      new Promise<void>(resolve => this._httpServer.close(() => resolve())),
      new Promise<void>(resolve => this._httpsServer.close(() => resolve())),
    ]);
    this._proxyAgent?.destroy();
  }

  private _onConnect(req: http.IncomingMessage, socket: net.Socket, head: Buffer) {
    socket.on('error', () => {});
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    // A CONNECT tunnel carries either TLS (https / wss) or a plaintext HTTP
    // request (http / ws). Peek the first byte - 0x16 is the TLS handshake -
    // and hand the socket to the matching server instead of assuming TLS.
    // Pause first so no data is lost between the sniff and the server attaching.
    const route = (first: Buffer) => {
      socket.pause();
      socket.unshift(first);
      if (first[0] === 0x16) {
        this._httpsServer.emit('connection', socket);
      } else {
        // The http server does not resume a socket handed over while paused
        // (the TLS server does), so the tunnelled request would never parse.
        this._httpServer.emit('connection', socket);
        socket.resume();
      }
    };
    if (head && head.length)
      route(head);
    else
      socket.once('data', route);
  }

  // A throwing match callback or any handler error must never take down the
  // runner process the proxy lives in.
  private _handleRequest(req: http.IncomingMessage, res: http.ServerResponse, isTls: boolean) {
    req.on('error', () => {});
    Promise.resolve().then(() => this._onRequest(req, res, isTls)).catch(() => {
      if (!res.headersSent)
        res.writeHead(502);
      res.end();
    });
  }

  private async _onRequest(req: http.IncomingMessage, res: http.ServerResponse, isTls: boolean) {
    req.url = requestUrl(req, isTls);
    const url = req.url;
    const method = req.method || 'GET';

    const selected = method === 'GET' ? this._select(req, url) : undefined;
    if (!selected || (!selected.read && selected.write === 'never')) {
      this._passThrough(req, res, url, method);
      return;
    }

    const key = ResponseCache.key('GET', url, selected.identity);
    if (selected.read) {
      const cached = await selected.cache.get(key, req.headers);
      if (cached) {
        writeResponse(res, cached);
        return;
      }
    }
    this._serveMiss(selected, key, url, req, res);
  }

  private _serveMiss(selected: Selection, key: string, url: string, req: http.IncomingMessage, res: http.ServerResponse) {
    // Coalesce concurrent misses onto a single upstream fetch, but only while
    // that fetch is being buffered for storage - a streamed (non-storable)
    // response can't be shared, so waiters on it fetch their own.
    const inflight = this._inflight.get(key);
    if (inflight) {
      void inflight.then(response => {
        if (response)
          writeResponse(res, response);
        else
          this._fetchAndServe(selected, key, url, req, res, false);
      });
      return;
    }
    this._fetchAndServe(selected, key, url, req, res, true);
  }

  private _fetchAndServe(selected: Selection, key: string, url: string, req: http.IncomingMessage, res: http.ServerResponse, coalesce: boolean) {
    // Waiters receive the buffered response, or undefined when this fetch
    // ended up streaming (or failing) and cannot be shared.
    let finish: (response?: CachedResponse) => void = () => {};
    if (coalesce) {
      const buffered = new Promise<CachedResponse | undefined>(resolve => finish = response => {
        this._inflight.delete(key);
        resolve(response);
      });
      this._inflight.set(key, buffered);
    }
    const fail = () => {
      finish();
      failResponse(res);
    };

    const upstream = this._requestUpstream(url, 'GET', forwardHeaders(req.headers));
    upstream.on('error', fail);
    res.on('close', () => upstream.destroy());
    upstream.on('response', proxyRes => {
      proxyRes.on('error', fail);
      const status = proxyRes.statusCode || 502;
      const store = selected.write === 'force'
        ? !isHardBlocked(req.headers, status, proxyRes.headers)
        : selected.write === 'default' && isDefaultStorable(req.headers, status, proxyRes.headers);
      // Stream anything we won't store straight through, so SSE, long-poll, and
      // large dynamic responses are never buffered in the runner process.
      if (!store) {
        finish();
        res.writeHead(status, filterHeadersFlat(proxyRes.rawHeaders));
        proxyRes.pipe(res);
        return;
      }
      const chunks: Buffer[] = [];
      proxyRes.on('data', chunk => chunks.push(chunk));
      proxyRes.on('end', () => {
        const response: CachedResponse = {
          status,
          statusText: proxyRes.statusMessage || '',
          headers: pairsFromRaw(proxyRes.rawHeaders).filter(([name]) => !HOP_BY_HOP.has(name.toLowerCase())),
          body: Buffer.concat(chunks),
        };
        finish(response);
        selected.cache.set(key, url, req.headers, response).catch(() => {});
        writeResponse(res, response);
      });
    });
    upstream.end();
  }

  private _select(req: http.IncomingMessage, url: string): Selection | undefined {
    // The cache targets remote environments; loopback always passes through,
    // regardless of how the browser or context was pointed at the proxy.
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return undefined;
    }
    if (shouldBypassProxy(parsed, LOOPBACK_BYPASS))
      return undefined;
    const entry = this._entry;
    let decision: HttpCacheDecision = {};
    if (typeof entry.match === 'function')
      decision = entry.match(toWebRequest(req, url)) || {};
    else if (entry.match !== undefined && !urlMatches(undefined, url, entry.match))
      return undefined;
    return { cache: entry.cache, identity: decision.identity ?? '', ...resolveDisposition(decision) };
  }

  private _passThrough(req: http.IncomingMessage, res: http.ServerResponse, url: string, method: string) {
    const fail = () => failResponse(res);
    const upstream = this._requestUpstream(url, method, forwardHeaders(req.headers));
    upstream.on('response', proxyRes => {
      proxyRes.on('error', fail);
      res.writeHead(proxyRes.statusCode || 502, filterHeadersFlat(proxyRes.rawHeaders));
      proxyRes.pipe(res);
    });
    upstream.on('error', fail);
    req.on('error', () => upstream.destroy());
    req.pipe(upstream);
  }

  private _requestUpstream(url: string, method: string, headers: http.OutgoingHttpHeaders): http.ClientRequest {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;
    const direct = this._proxyAgent === undefined || shouldBypassProxy(parsed, this._proxy?.bypass);
    const agent = direct ? (isHttps ? httpsHappyEyeballsAgent : httpHappyEyeballsAgent) : this._proxyAgent;
    return mod.request(parsed, {
      method,
      headers,
      agent,
      rejectUnauthorized: false,
    });
  }

  private _onUpgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer, isTls: boolean) {
    socket.on('error', () => {});
    const target = new URL(requestUrl(req, isTls));
    const host = target.hostname;
    const port = Number(target.port) || (isTls ? 443 : 80);
    const onConnect = () => {
      const lines = [`${req.method} ${target.pathname}${target.search} HTTP/1.1`];
      for (const [name, value] of Object.entries(req.headers))
        lines.push(`${name}: ${Array.isArray(value) ? value.join(', ') : value}`);
      upstream.write(lines.join('\r\n') + '\r\n\r\n');
      if (head && head.length)
        upstream.write(head);
      socket.pipe(upstream);
      upstream.pipe(socket);
    };
    const upstream = isTls
      ? tls.connect({ host, port, rejectUnauthorized: false, servername: net.isIP(host) ? undefined : host }, onConnect)
      : net.connect({ host, port }, onConnect);
    upstream.on('error', () => socket.destroy());
  }
}

// Match callbacks receive a standard WHATWG Request. Unlike a browser's,
// Node's Request keeps "forbidden" headers (host, cookie, sec-fetch-*), so
// no information is lost; the copy also keeps callbacks from mutating the
// live incoming request.
function toWebRequest(req: http.IncomingMessage, url: string): Request {
  const headers: [string, string][] = [];
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined)
      continue;
    if (Array.isArray(value))
      headers.push(...value.map(item => [name, item] as [string, string]));
    else
      headers.push([name, value]);
  }
  return new Request(url, { method: req.method, headers });
}

// Tunnelled requests arrive in origin form (`GET /path`), direct proxy
// requests in absolute form; reconstruct via the Host header when needed.
function requestUrl(req: http.IncomingMessage, isTls: boolean): string {
  const raw = req.url || '/';
  if (/^\w+:\/\//.test(raw))
    return raw;
  return `${isTls ? 'https' : 'http'}://${req.headers.host}${raw}`;
}

function resolveDisposition(decision: HttpCacheDecision): { read: boolean, write: 'force' | 'never' | 'default' } {
  if (decision.disposition === 'no-cache')
    return { read: false, write: 'never' };
  if (decision.disposition === 'cache')
    return { read: true, write: 'force' };
  return { read: true, write: 'default' };
}

function failResponse(res: http.ServerResponse) {
  if (!res.headersSent) {
    res.writeHead(502);
    res.end();
  } else {
    res.destroy();
  }
}


function forwardHeaders(headers: http.IncomingHttpHeaders): http.OutgoingHttpHeaders {
  const result: http.OutgoingHttpHeaders = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined && !HOP_BY_HOP.has(name.toLowerCase()))
      result[name] = value;
  }
  return result;
}

function writeResponse(res: http.ServerResponse, cached: CachedResponse) {
  const raw: string[] = [];
  for (const [name, value] of cached.headers) {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP.has(lower) || lower === 'content-length')
      continue;
    raw.push(name, value);
  }
  raw.push('Content-Length', String(cached.body.length));
  res.writeHead(cached.status, cached.statusText || undefined, raw);
  res.end(cached.body);
}

function filterHeadersFlat(rawHeaders: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i + 1 < rawHeaders.length; i += 2) {
    if (!HOP_BY_HOP.has(rawHeaders[i].toLowerCase()))
      result.push(rawHeaders[i], rawHeaders[i + 1]);
  }
  return result;
}

function pairsFromRaw(rawHeaders: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < rawHeaders.length; i += 2)
    pairs.push([rawHeaders[i], rawHeaders[i + 1]]);
  return pairs;
}
