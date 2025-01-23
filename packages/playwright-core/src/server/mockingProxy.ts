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
import type { RemoteAddr, RequestContext, ResourceTiming, SecurityDetails } from './network';
import { Request, Response, Route } from './network';
import type { HeadersArray, NormalizedContinueOverrides, NormalizedFulfillResponse } from './types';
import { ManualPromise, monotonicTime } from 'playwright-core/lib/utils';
import type { WorkerHttpServer } from './dispatchers/localUtilsDispatcher';
import { TLSSocket } from 'tls';
import type { AddressInfo } from 'net';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

type InterceptorResult =
| { result: 'continue', request: Request, overrides?: NormalizedContinueOverrides }
| { result: 'abort', request: Request, errorCode: string }
| { result: 'fulfill', request: Request, response: NormalizedFulfillResponse };

interface EventDelegate {
  onRequest(request: Request): void;
  onRequestFinished(request: Request, response: Response): void;
  onRequestFailed(request: Request): void;
  onResponse(request: Request, response: Response): void;
  onRoute(route: Route, request: Request): void;
}

export class ServerInterceptionRegistry extends SdkObject implements RequestContext {
  private _eventDelegate: EventDelegate;
  fetchRequest: APIRequestContext;
  private _matches?: (url: string) => boolean;

  constructor(parent: SdkObject, requestContext: APIRequestContext, eventDelegate: EventDelegate) {
    super(parent, 'serverInterceptionRegistry');
    this._eventDelegate = eventDelegate;
    this.fetchRequest = requestContext;
  }

  setRequestInterceptor(matches?: (url: string) => boolean) {
    this._matches = matches;
  }

  handle(url: string, method: string, body: Buffer | null, headers: HeadersArray): Promise<InterceptorResult> {
    const request = new Request(this, null, null, null, undefined, url, '', method, body, headers);
    request.setRawRequestHeaders(headers);
    this._eventDelegate.onRequest(request);

    if (!this._matches?.(url))
      return Promise.resolve({ result: 'continue', request });

    return new Promise(resolve => {
      const route = new Route(request, {
        async abort(errorCode) {
          resolve({ result: 'abort', request, errorCode });
        },
        async continue(overrides) {
          resolve({ result: 'continue', request, overrides });
        },
        async fulfill(response) {
          resolve({ result: 'fulfill', request, response });
        },
      });

      this._eventDelegate.onRoute(route, request);
    });
  }

  failed(request: Request, error: string) {
    request._setFailureText(error);
    this._eventDelegate.onRequestFailed(request);
  }

  response(request: Request, status: number, statusText: string, headers: HeadersArray, body: () => Promise<Buffer>, httpVersion: string, timing: ResourceTiming, securityDetails: SecurityDetails | undefined, serverAddr: RemoteAddr | undefined) {
    const response = new Response(request, status, statusText, headers, timing, body, false, httpVersion);
    response.setRawResponseHeaders(headers);
    response._securityDetailsFinished(securityDetails);
    response._serverAddrFinished(serverAddr);
    this._eventDelegate.onResponse(request, response);

    return {
      finished: async (responseEndTiming: number, transferSize: number, encodedBodySize: number) => {
        response._requestFinished(responseEndTiming);
        response.setTransferSize(transferSize);
        response.setEncodedBodySize(encodedBodySize);
        response.setResponseHeadersSize(transferSize - encodedBodySize);
        this._eventDelegate.onRequestFinished(request, response);
      }
    };
  }

  addRouteInFlight(route: Route): void {

  }

  removeRouteInFlight(route: Route): void {

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

export class MockingProxy {
  private readonly _registry: ServerInterceptionRegistry;

  constructor(registry: ServerInterceptionRegistry) {
    this._registry = registry;
  }

  install(server: WorkerHttpServer) {
    server.routePrefix('/', (req, res) => {
      this._proxy(req, res);
      return true;
    });
    server.server().on('connect', (req, socket, head) => {
      socket.end('HTTP/1.1 405 Method Not Allowed\r\n\r\n');
    });
  }

  private async _proxy(req: http.IncomingMessage, res: http.ServerResponse) {
    if (req.url?.startsWith('/'))
      req.url = req.url.substring(1);

    // Java URL likes removing double slashes from the pathname.
    if (req.url?.startsWith('http:/') && !req.url?.startsWith('http://'))
      req.url = req.url.replace('http:/', 'http://');
    if (req.url?.startsWith('https:/') && !req.url?.startsWith('https://'))
      req.url = req.url.replace('https:/', 'https://');

    delete req.headersDistinct.host;
    const headers = headersArray(req);
    const body = await collectBody(req);
    const result = await this._registry.handle(req.url!, req.method!, body, headers);
    switch (result.result) {
      case 'abort': {
        req.destroy(result.errorCode ? new Error(result.errorCode) : undefined);
        return;
      }
      case 'continue': {
        const { overrides } = result;
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
            const response = this._registry.response(
                result.request,
                proxyRes.statusCode!,
                proxyRes.statusMessage!, headersArray(proxyRes),
                () => responseBodyPromise,
                proxyRes.httpVersion,
                timings,
                securityDetails,
                { ipAddress: address.family === 'IPv6' ? `[${address.address}]` : address.address, port: address.port },
            );

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

              response.finished(
                  monotonicTime() - startAt,
                  socket.bytesRead - socketBytesReadStart,
                  body.byteLength
              );
              resolve();
            } catch (error) {
              this._registry.failed(result.request, error.toString());
              resolve();
            }
          });

          proxyReq.on('error', error => {
            this._registry.failed(result.request, error.toString());
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
      }
      case 'fulfill': {
        const { response: { status, headers, body, isBase64 } } = result;
        res.statusCode = status;
        for (const { name, value } of headers)
          res.appendHeader(name, value);
        res.sendDate = false;
        res.end(Buffer.from(body, isBase64 ? 'base64' : 'utf-8'));
        return;
      }
      default: {
        throw new Error('Unexpected result');
      }
    }
  }
}
