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
import { getProxyForUrl } from '../utilsBundle';
import { HttpsProxyAgent } from '../utilsBundle';
import * as URL from 'url';

export async function createSocket(host: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    socket.on('connect', () => resolve(socket));
    socket.on('error', error => reject(error));
  });
}

export type HTTPRequestParams = {
  url: string,
  method?: string,
  headers?: http.OutgoingHttpHeaders,
  data?: string | Buffer,
  timeout?: number,
};

export function httpRequest(params: HTTPRequestParams, onResponse: (r: http.IncomingMessage) => void, onError: (error: Error) => void) {
  const parsedUrl = URL.parse(params.url);
  let options: https.RequestOptions = { ...parsedUrl };
  options.method = params.method || 'GET';
  options.headers = params.headers;

  const proxyURL = getProxyForUrl(params.url);
  if (proxyURL) {
    if (params.url.startsWith('http:')) {
      const proxy = URL.parse(proxyURL);
      options = {
        path: parsedUrl.href,
        host: proxy.hostname,
        port: proxy.port,
      };
    } else {
      const parsedProxyURL = URL.parse(proxyURL);
      (parsedProxyURL as any).secureProxy = parsedProxyURL.protocol === 'https:';

      options.agent = new HttpsProxyAgent(parsedProxyURL);
      options.rejectUnauthorized = false;
    }
  }

  const requestCallback = (res: http.IncomingMessage) => {
    const statusCode = res.statusCode || 0;
    if (statusCode >= 300 && statusCode < 400 && res.headers.location)
      httpRequest({ ...params, url: res.headers.location }, onResponse, onError);
    else
      onResponse(res);
  };
  const request = options.protocol === 'https:' ?
    https.request(options, requestCallback) :
    http.request(options, requestCallback);
  request.on('error', onError);
  if (params.timeout !== undefined) {
    const rejectOnTimeout = () =>  {
      onError(new Error(`Request to ${params.url} timed out after ${params.timeout}ms`));
      request.abort();
    };
    if (params.timeout <= 0) {
      rejectOnTimeout();
      return;
    }
    request.setTimeout(params.timeout, rejectOnTimeout);
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
