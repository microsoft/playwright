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

type ServerResponse = import('http').ServerResponse;
type IncomingMessage = import('http').IncomingMessage;

export class TestServer {
  static create(dirPath: string, port: number, loopback?: string): Promise<TestServer>;
  static createHTTPS(dirPath: string, port: number, loopback?: string): Promise<TestServer>;
  enableHTTPCache(pathPrefix: string);
  setAuth(path: string, username: string, password: string);
  enableGzip(path: string);
  setCSP(path: string, csp: string);
  stop(): Promise<void>;
  setRoute(path: string, handler: (message: IncomingMessage & { postBody: Promise<Buffer> }, response: ServerResponse) => void);
  setRedirect(from: string, to: string);
  waitForRequest(path: string): Promise<IncomingMessage & { postBody: Promise<Buffer> }>;
  waitForWebSocketConnectionRequest(): Promise<IncomingMessage>;
  sendOnWebSocketConnection(data: string);
  reset();
  serveFile(request: IncomingMessage, response: ServerResponse);
  serveFile(request: IncomingMessage, response: ServerResponse, filePath: string);

  PORT: number;
  PREFIX: string;
  CROSS_PROCESS_PREFIX: string;
  EMPTY_PAGE: string;
}
