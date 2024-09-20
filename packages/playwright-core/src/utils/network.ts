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
import http2 from 'http2';
import type net from 'net';
import { getProxyForUrl } from '../utilsBundle';
import { HttpsProxyAgent } from '../utilsBundle';
import url from 'url';
import { httpHappyEyeballsAgent, httpsHappyEyeballsAgent } from './happy-eyeballs';

export type HTTPRequestParams = {
  url: string,
  method?: string,
  headers?: http.OutgoingHttpHeaders,
  data?: string | Buffer,
  timeout?: number,
  rejectUnauthorized?: boolean,
};

export const NET_DEFAULT_TIMEOUT = 30_000;

export function httpRequest(params: HTTPRequestParams, onResponse: (r: http.IncomingMessage) => void, onError: (error: Error) => void) {
  const parsedUrl = url.parse(params.url);
  let options: https.RequestOptions = {
    ...parsedUrl,
    agent: parsedUrl.protocol === 'https:' ? httpsHappyEyeballsAgent : httpHappyEyeballsAgent,
    method: params.method || 'GET',
    headers: params.headers,
  };
  if (params.rejectUnauthorized !== undefined)
    options.rejectUnauthorized = params.rejectUnauthorized;

  const timeout = params.timeout ?? NET_DEFAULT_TIMEOUT;

  const proxyURL = getProxyForUrl(params.url);
  if (proxyURL) {
    const parsedProxyURL = url.parse(proxyURL);
    if (params.url.startsWith('http:')) {
      options = {
        path: parsedUrl.href,
        host: parsedProxyURL.hostname,
        port: parsedProxyURL.port,
        headers: options.headers,
        method: options.method
      };
    } else {
      (parsedProxyURL as any).secureProxy = parsedProxyURL.protocol === 'https:';

      options.agent = new HttpsProxyAgent(parsedProxyURL);
      options.rejectUnauthorized = false;
    }
  }

  const requestCallback = (res: http.IncomingMessage) => {
    const statusCode = res.statusCode || 0;
    if (statusCode >= 300 && statusCode < 400 && res.headers.location)
      httpRequest({ ...params, url: new URL(res.headers.location, params.url).toString() }, onResponse, onError);
    else
      onResponse(res);
  };
  const request = options.protocol === 'https:' ?
    https.request(options, requestCallback) :
    http.request(options, requestCallback);
  request.on('error', onError);
  if (timeout !== undefined) {
    const rejectOnTimeout = () =>  {
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

export function fetchData(params: HTTPRequestParams, onError?: (params: HTTPRequestParams, response: http.IncomingMessage) => Promise<Error>): Promise<string> {
  return new Promise((resolve, reject) => {
    httpRequest(params, async response => {
      if (response.statusCode !== 200) {
        const error = onError ? await onError(params, response) : new Error(`fetch failed: server returned code ${response.statusCode}. URL: ${params.url}`);
        reject(error);
        return;
      }
      let body = '';
      response.on('data', (chunk: string) => body += chunk);
      response.on('error', (error: any) => reject(error));
      response.on('end', () => resolve(body));
    }, reject);
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

export function createHttp2Server(  onRequestHandler?: (request: http2.Http2ServerRequest, response: http2.Http2ServerResponse) => void,): http2.Http2SecureServer;
export function createHttp2Server(options: http2.SecureServerOptions, onRequestHandler?: (request: http2.Http2ServerRequest, response: http2.Http2ServerResponse) => void,): http2.Http2SecureServer;
export function createHttp2Server(...args: any[]): http2.Http2SecureServer {
  const server = http2.createSecureServer(...args);
  decorateServer(server);
  return server;
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

function decorateServer(server: net.Server) {
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
