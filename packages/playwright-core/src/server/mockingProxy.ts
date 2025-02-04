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
import url from 'url';
import type { APIRequestContext } from './fetch';
import { SdkObject } from './instrumentation';
import type { RequestContext, ResourceTiming, SecurityDetails } from './network';
import { Request, Response, Route } from './network';
import type { HeadersArray, } from './types';
import { HttpServer, ManualPromise, monotonicTime } from '../utils';
import { TLSSocket } from 'tls';
import type { AddressInfo } from 'net';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

export class MockingProxy extends SdkObject implements RequestContext {
  static Events = {
    Request: 'request',
    Response: 'response',
    RequestFailed: 'requestfailed',
    RequestFinished: 'requestfinished',
  };

  fetchRequest: APIRequestContext;
  private _httpServer = new WorkerHttpServer();
  onRoute = (route: Route) => route.continue({ isFallback: true });

  constructor(parent: SdkObject, requestContext: APIRequestContext) {
    super(parent, 'MockingProxy');
    this.fetchRequest = requestContext;

    this._httpServer.routePrefix('/', (req, res) => {
      this._proxy(req, res);
      return true;
    });
    this._httpServer.server().on('connect', (req, socket, head) => {
      // TODO: improve error message
      socket.end('HTTP/1.1 405 Method Not Allowed\r\n\r\n');
    });
  }

  async start(): Promise<void> {
    await this._httpServer.start();
  }

  async stop() {
    await this._httpServer.stop();
  }

  port() {
    return this._httpServer.port();
  }

  baseURL() {
    return `http://localhost:${this.port()}/`;
  }

  private async _proxy(req: http.IncomingMessage, res: http.ServerResponse) {
    if (req.url?.startsWith('/'))
      req.url = req.url.substring(1);

    if (!req.url?.startsWith('pw_meta:')) {
      res.statusCode = 400;
      res.end('Playwright mocking proxy received invalid URL, must start with "pw_meta:"');
      return;
    }

    const correlation = req.url.substring('pw_meta:'.length, req.url.indexOf('/'));
    req.url = req.url.substring(req.url.indexOf('/') + 1);

    // Java URL likes removing double slashes from the pathname.
    if (req.url?.startsWith('http:/') && !req.url?.startsWith('http://'))
      req.url = req.url.replace('http:/', 'http://');
    if (req.url?.startsWith('https:/') && !req.url?.startsWith('https://'))
      req.url = req.url.replace('https:/', 'https://');

    delete req.headersDistinct.host;
    const headers = headersArray(req);
    const body = await collectBody(req);
    const request = new Request(this, null, null, null, undefined, req.url!, '', req.method!, body, headers);
    request.setRawRequestHeaders(headers);
    this.emit(MockingProxy.Events.Request, { request, correlation });

    const route = new Route(request, {
      abort: async errorCode => {
        req.destroy(errorCode ? new Error(errorCode) : undefined);
      },
      continue: async overrides => {
        const proxyUrl = url.parse(overrides?.url ?? req.url!);
        const httpLib = proxyUrl.protocol === 'https:' ? https : http;
        const proxyHeaders = overrides?.headers ?? headers;
        const proxyMethod = overrides?.method ?? req.method;
        const proxyBody = overrides?.postData ?? body;

        const startAt = monotonicTime();
        let connectEnd: number | undefined;
        let connectStart: number | undefined;
        let dnsLookupAt: number | undefined;
        let tlsHandshakeAt: number | undefined;
        let socketBytesReadStart = 0;

        return new Promise<void>(resolve => {
          const proxyReq = httpLib.request({
            ...proxyUrl,
            headers: headersArrayToOutgoingHeaders(proxyHeaders),
            method: proxyMethod,
          }, async proxyRes => {
            const responseStart = monotonicTime();
            const timings: ResourceTiming = {
              startTime: startAt / 1000,
              connectStart: connectStart ? (connectStart - startAt) : -1,
              connectEnd: connectEnd ? (connectEnd - startAt) : -1,
              domainLookupStart: -1,
              domainLookupEnd: dnsLookupAt ? (dnsLookupAt - startAt) : -1,
              requestStart: -1,
              responseStart: (responseStart - startAt),
              secureConnectionStart: tlsHandshakeAt ? (tlsHandshakeAt - startAt) : -1,
            };

            const socket = proxyRes.socket;

            let securityDetails: SecurityDetails | undefined;
            if (socket instanceof TLSSocket) {
              const peerCertificate = socket.getPeerCertificate();
              securityDetails = {
                protocol: socket.getProtocol() ?? undefined,
                subjectName: peerCertificate.subject.CN,
                validFrom: new Date(peerCertificate.valid_from).getTime() / 1000,
                validTo: new Date(peerCertificate.valid_to).getTime() / 1000,
                issuer: peerCertificate.issuer.CN
              };
            }

            const address = socket.address() as AddressInfo;
            const responseBodyPromise = new ManualPromise<Buffer>();
            const response = new Response(request, proxyRes.statusCode!, proxyRes.statusMessage!, headersArray(proxyRes), timings, () => responseBodyPromise, false, proxyRes.httpVersion);
            response.setRawResponseHeaders(headersArray(proxyRes));
            response._securityDetailsFinished(securityDetails);
            response._serverAddrFinished({ ipAddress: address.family === 'IPv6' ? `[${address.address}]` : address.address, port: address.port });
            this.emit(MockingProxy.Events.Response, response);

            try {
              res.writeHead(proxyRes.statusCode!, proxyRes.headers);

              const chunks: Buffer[] = [];
              await pipeline(
                  proxyRes,
                  new Transform({
                    transform(chunk, encoding, callback) {
                      chunks.push(chunk);
                      callback(undefined, chunk);
                    },
                  }),
                  res
              );
              const body = Buffer.concat(chunks);
              responseBodyPromise.resolve(body);

              const transferSize = socket.bytesRead - socketBytesReadStart;
              const encodedBodySize = body.byteLength;
              response._requestFinished(monotonicTime() - startAt);
              response.setTransferSize(transferSize);
              response.setEncodedBodySize(encodedBodySize);
              response.setResponseHeadersSize(transferSize - encodedBodySize);
              this.emit(MockingProxy.Events.RequestFinished, request);
              resolve();
            } catch (error) {
              request._setFailureText('' + error);
              this.emit(MockingProxy.Events.RequestFailed, request);
              resolve();
            }
          });

          proxyReq.on('error', error => {
            request._setFailureText('' + error);
            this.emit(MockingProxy.Events.RequestFailed, request);
            res.statusCode = 502;
            res.end(resolve);
          });
          proxyReq.once('socket', socket => {
            if (proxyReq.reusedSocket)
              return;

            socketBytesReadStart = socket.bytesRead;

            socket.once('lookup', () => { dnsLookupAt = monotonicTime(); });
            socket.once('connectionAttempt', () => { connectStart = monotonicTime(); });
            socket.once('connect', () => { connectEnd = monotonicTime(); });
            socket.once('secureConnect', () => { tlsHandshakeAt = monotonicTime(); });
          });
          proxyReq.end(proxyBody);
        });
      },
      fulfill: async ({ status, headers, body, isBase64 }) => {
        res.statusCode = status;
        for (const { name, value } of headers)
          res.appendHeader(name, value);
        res.sendDate = false;
        res.end(Buffer.from(body, isBase64 ? 'base64' : 'utf-8'));
      },
    });

    await this.onRoute(route);
  }

  addRouteInFlight(route: Route): void {
    // no-op, might be useful for warnings
  }

  removeRouteInFlight(route: Route): void {
    // no-op, might be useful for warnings
  }
}

function headersArray(req: Pick<http.IncomingMessage, 'headersDistinct'>): HeadersArray {
  return Object.entries(req.headersDistinct).flatMap(([name, values = []]) => values.map(value => ({ name, value })));
}

function headersArrayToOutgoingHeaders(headers: HeadersArray) {
  const result: http.OutgoingHttpHeaders = {};
  for (const { name, value } of headers) {
    if (result[name] === undefined)
      result[name] = value;
    else if (Array.isArray(result[name]))
      result[name].push(value);
    else
      result[name] = [result[name] as string, value];
  }
  return result;
}

async function collectBody(req: http.IncomingMessage) {
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

class WorkerHttpServer extends HttpServer {
  override handleCORS(request: http.IncomingMessage, response: http.ServerResponse): boolean {
    return false;
  }
}
