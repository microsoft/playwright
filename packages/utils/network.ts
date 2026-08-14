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


import dns from 'dns';
import http from 'http';
import http2 from 'http2';
import https from 'https';
import net from 'net';

import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { getProxyForUrl } from 'proxy-from-env';
import { ManualPromise } from '@isomorphic/manualPromise';
import { rewriteErrorMessage } from './stackTrace';

export type ProxySettings = {
  server: string,
  bypass?: string,
  username?: string,
  password?: string
};

export type HTTPRequestParams = {
  url: string,
  method?: string,
  headers?: http.OutgoingHttpHeaders,
  data?: string | Buffer,
  rejectUnauthorized?: boolean,
  socketTimeout?: number,
};

export const NET_DEFAULT_TIMEOUT = 30_000;

export function httpRequest(params: HTTPRequestParams, onResponse: (r: http.IncomingMessage) => void, onError: (error: Error) => void): { cancel(error: Error | undefined): void } {
  let url = new URL(params.url);
  const options: https.RequestOptions = {
    method: params.method || 'GET',
    headers: params.headers,
    ...happyEyeballsOptions,
  };
  if (params.rejectUnauthorized !== undefined)
    options.rejectUnauthorized = params.rejectUnauthorized;

  const proxyURL = getProxyForUrl(params.url);
  if (proxyURL) {
    const parsedProxyURL = normalizeProxyURL(proxyURL);
    if (params.url.startsWith('http:')) {
      options.path = url.toString();
      const headers = (options.headers || {}) as http.OutgoingHttpHeaders;
      if (!Object.keys(headers).some(header => header.toLowerCase() === 'host'))
        headers.host = url.host;
      options.headers = headers;
      url = parsedProxyURL;
    } else {
      options.agent = new HttpsProxyAgent(parsedProxyURL);
    }
  }

  let cancelRequest: (e: Error | undefined) => void;
  const requestCallback = (res: http.IncomingMessage) => {
    const statusCode = res.statusCode || 0;
    if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
      // Close the original socket before following the redirect. Otherwise
      // it may stay idle and cause a timeout error.
      request.destroy();
      cancelRequest = httpRequest({ ...params, url: new URL(res.headers.location, params.url).toString() }, onResponse, onError).cancel;
    } else {
      onResponse(res);
    }
  };
  const request = url.protocol === 'https:' ?
    https.request(url, options, requestCallback) :
    http.request(url, options, requestCallback);
  request.on('error', error => onError(flattenAggregateError(error)));
  if (params.socketTimeout !== undefined) {
    request.setTimeout(params.socketTimeout, () =>  {
      onError(new Error(`Request to ${params.url} timed out after ${params.socketTimeout}ms`));
      request.abort();
    });
  }
  cancelRequest = e => {
    try {
      request.destroy(e);
    } catch {
    }
  };
  request.end(params.data);
  return { cancel: e => cancelRequest(e) };
}

function shouldBypassProxy(url: URL, bypass?: string): boolean {
  if (!bypass)
    return false;
  const domains = bypass.split(',').map(s => {
    s = s.trim();
    if (!s.startsWith('.'))
      s = '.' + s;
    return s;
  });
  const domain = '.' + url.hostname;
  return domains.some(d => domain.endsWith(d));
}

function normalizeProxyURL(proxy: string): URL {
  proxy = proxy.trim();
  // Browsers allow to specify proxy without a protocol, defaulting to http.
  if (!/^\w+:\/\//.test(proxy))
    proxy = 'http://' + proxy;
  return new URL(proxy);
}

export function createProxyAgent(proxy?: ProxySettings, forUrl?: URL) {
  if (!proxy)
    return;
  if (forUrl && proxy.bypass && shouldBypassProxy(forUrl, proxy.bypass))
    return;

  const proxyURL = normalizeProxyURL(proxy.server);
  if (proxyURL.protocol?.startsWith('socks')) {
    // SocksProxyAgent distinguishes between socks5 and socks5h.
    // socks5h is what we want, it means that hostnames are resolved by the proxy.
    // browsers behave the same way, even if socks5 is specified.
    if (proxyURL.protocol === 'socks5:')
      proxyURL.protocol = 'socks5h:';
    else if (proxyURL.protocol === 'socks4:')
      proxyURL.protocol = 'socks4a:';

    return new SocksProxyAgent(proxyURL);
  }
  if (proxy.username) {
    proxyURL.username = proxy.username;
    proxyURL.password = proxy.password || '';
  }

  if (forUrl && ['ws:', 'wss:'].includes(forUrl.protocol)) {
    // Force CONNECT method for WebSockets.
    return new HttpsProxyAgent(proxyURL);
  }

  // TODO: This branch should be different from above. We should use HttpProxyAgent conditional on proxyURL.protocol instead of always using CONNECT method.
  return new HttpsProxyAgent(proxyURL);
}

// Node.js family-agnostic lookup passes AI_ADDRCONFIG to getaddrinfo(), which can filter out
// addresses of a family that has no non-loopback interface, and "localhost" may miss addresses
// of a family that is not listed in /etc/hosts — e.g. resolving to only 127.0.0.1 even though
// ::1 is served. Separate family: 4 and family: 6 lookups do not have these problems. Native
// Happy Eyeballs (autoSelectFamily) then races connection attempts across the families.
const dualStackLookup: net.LookupFunction = (hostname, options, callback) => {
  const families = options.family === 4 || options.family === 6 ? [options.family] : [6, 4];
  void Promise.allSettled(families.map(family => dns.promises.lookup(hostname, { all: true, family }))).then(results => {
    const perFamily = results.map(result => result.status === 'fulfilled' ? result.value : []);
    const addresses: dns.LookupAddress[] = [];
    // Alternate IPv6 and IPv4 addresses per RFC 8305 (prefer IPv6 first).
    for (let i = 0; i < Math.max(...perFamily.map(list => list.length)); i++) {
      for (const list of perFamily) {
        if (list[i])
          addresses.push(list[i]);
      }
    }
    if (!addresses.length) {
      const firstError = results.map(result => result.status === 'rejected' ? result.reason : undefined).find(Boolean);
      callback(firstError ?? new Error(`Cannot resolve address for ${hostname}`), '');
      return;
    }
    if (options.all)
      callback(null, addresses);
    else
      callback(null, addresses[0].address, addresses[0].family);
  });
};

// Node.js aborts every connection attempt but the last one after autoSelectFamilyAttemptTimeout,
// and its 250ms default is too short for a TCP handshake over a slow network, failing connections
// that would have succeeded: https://github.com/nodejs/node/issues/54359. Floor it at 5s to
// survive two SYN retransmits, honoring a higher process-wide default when the user set one.
// Revisit when attempts run in parallel: https://github.com/nodejs/node/issues/48145.
export const happyEyeballsOptions = {
  lookup: dualStackLookup,
  autoSelectFamily: true,
  autoSelectFamilyAttemptTimeout: Math.max(5000, net.getDefaultAutoSelectFamilyAttemptTimeout()),
};

// When every raced connection attempt fails, Node.js reports an AggregateError with an
// empty message and the individual failures in the `errors` property. Surface those instead.
export function flattenAggregateError(error: Error): Error {
  const errors = (error as any).errors as Error[] | undefined;
  if (error.name === 'AggregateError' && !error.message && errors?.length)
    return rewriteErrorMessage(error, errors.map(e => e.message).join('\n'));
  return error;
}

export async function createSocket(host: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port, ...happyEyeballsOptions });
    socket.on('connect', () => resolve(socket));
    socket.on('error', error => reject(flattenAggregateError(error)));
  });
}

export function createHttpServer(requestListener?: (req: http.IncomingMessage, res: http.ServerResponse) => void): http.Server;
export function createHttpServer(options: http.ServerOptions, requestListener?: (req: http.IncomingMessage, res: http.ServerResponse) => void): http.Server;
export function createHttpServer(...args: any[]): http.Server {
  const server = http.createServer(...args);
  decorateServer(server);
  return server;
}

export function createHttpsServer(requestListener?: (req: http.IncomingMessage, res: http.ServerResponse) => void): https.Server;
export function createHttpsServer(options: https.ServerOptions, requestListener?: (req: http.IncomingMessage, res: http.ServerResponse) => void): https.Server;
export function createHttpsServer(...args: any[]): https.Server {
  const server = https.createServer(...args);
  decorateServer(server);
  return server;
}

export function createHttp2Server(onRequestHandler?: (request: http2.Http2ServerRequest, response: http2.Http2ServerResponse) => void,): http2.Http2SecureServer;
export function createHttp2Server(options: http2.SecureServerOptions, onRequestHandler?: (request: http2.Http2ServerRequest, response: http2.Http2ServerResponse) => void,): http2.Http2SecureServer;
export function createHttp2Server(...args: any[]): http2.Http2SecureServer {
  const server = http2.createSecureServer(...args);
  decorateServer(server);
  return server;
}

export async function startHttpServer(server: http.Server, options: { host?: string, port?: number }) {
  const { host = 'localhost', port = 0 } = options;
  const errorPromise = new ManualPromise();
  const errorListener = (error: Error) => errorPromise.reject(error);
  server.on('error', errorListener);
  try {
    server.listen(port, host);
    await Promise.race([
      new Promise(cb => server.once('listening', cb)),
      errorPromise,
    ]);
  } finally {
    server.removeListener('error', errorListener);
  }
}

export async function isURLAvailable(url: URL, ignoreHTTPSErrors: boolean, onLog?: (data: string) => void, onStdErr?: (data: string) => void) {
  let statusCode = await httpStatusCode(url, ignoreHTTPSErrors, onLog, onStdErr);
  if (statusCode === 404 && url.pathname === '/') {
    const indexUrl = new URL(url);
    indexUrl.pathname = '/index.html';
    statusCode = await httpStatusCode(indexUrl, ignoreHTTPSErrors, onLog, onStdErr);
  }
  return statusCode >= 200 && statusCode < 404;
}

async function httpStatusCode(url: URL, ignoreHTTPSErrors: boolean, onLog?: (data: string) => void, onStdErr?: (data: string) => void): Promise<number> {
  return new Promise(resolve => {
    onLog?.(`HTTP GET: ${url}`);
    httpRequest({
      url: url.toString(),
      headers: { Accept: '*/*' },
      rejectUnauthorized: !ignoreHTTPSErrors
    }, res => {
      res.resume();
      const statusCode = res.statusCode ?? 0;
      onLog?.(`HTTP Status: ${statusCode}`);
      resolve(statusCode);
    }, error => {
      if ((error as NodeJS.ErrnoException).code === 'DEPTH_ZERO_SELF_SIGNED_CERT')
        onStdErr?.(`[WebServer] Self-signed certificate detected. Try adding ignoreHTTPSErrors: true to config.webServer.`);
      onLog?.(`Error while checking if ${url} is available: ${error.message}`);
      resolve(0);
    });
  });
}

export function decorateServer(server: net.Server) {
  const sockets = new Set<net.Socket>();
  server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });

  const close = server.close;
  server.close = (callback?: (err?: Error) => void) => {
    for (const socket of sockets)
      socket.destroy();
    sockets.clear();
    return close.call(server, callback);
  };
}
