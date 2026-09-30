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

import assert from 'assert';
import net from 'net';
import http from 'http';
import crypto from 'crypto';

import debug from 'debug';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isUnderTest } from '@utils/debug';
import { createHttpServer, startHttpServer } from '@utils/network';
import { ManualPromise } from '@isomorphic/manualPromise';

import * as mcpServer from './server';

import type { ServerBackendFactory } from './server';
import type { SSEServerTransport as SSEServerTransportType } from '@modelcontextprotocol/sdk/server/sse.js';
import type { StreamableHTTPServerTransport as StreamableHTTPServerTransportType } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const testDebug = debug('pw:mcp:test');

export async function startMcpHttpServer(
  config: { host?: string, port?: number },
  serverBackendFactory: ServerBackendFactory,
  allowedHosts?: string[]
): Promise<string> {
  const httpServer = createHttpServer();
  await startHttpServer(httpServer, config);
  const address = httpServer.address();
  assert(address, 'Could not bind server socket');
  if (typeof address === 'string')
    throw new Error('Unexpected address type: ' + address);
  const bindHost = config.host;
  const host = !bindHost || bindHost === '0.0.0.0' || bindHost === '::' ? 'localhost' : net.isIPv6(bindHost) ? `[${bindHost}]` : bindHost;
  const url = `http://${host}:${address.port}`;
  // Loopback names cannot be rebound, so they are safe to allow for any bind address. The host passed via --host is chosen by the user.
  allowedHosts = allowedHosts?.map(h => h.toLowerCase()) ?? [...new Set([`localhost:${address.port}`, `127.0.0.1:${address.port}`, `[::1]:${address.port}`, new URL(url).host])];
  installHttpTransport(httpServer, serverBackendFactory, allowedHosts);
  return url;
}

function installHttpTransport(httpServer: http.Server, serverBackendFactory: ServerBackendFactory, allowedHosts: string[]) {
  const allowAnyHost = allowedHosts.includes('*');

  const sseSessions = new Map();
  const streamableSessions = new Map();
  httpServer.on('request', async (req, res) => {
    if (!allowAnyHost) {
      // Prevent DNS evil.com -> localhost rebind. Browsers always send Host, requests without it are not affected.
      const host = req.headers.host?.toLowerCase();
      if (host && !allowedHosts.includes(host)) {
        // Access from the browser is forbidden.
        res.statusCode = 403;
        return res.end('Access is only allowed at ' + allowedHosts.join(', '));
      }
    }

    const url = new URL(`http://localhost${req.url}`);
    if (url.pathname === '/killkillkill' && isUnderTest()) {
      res.statusCode = 200;
      res.end('Killing process');
      // Simulate Ctrl+C in a way that works on Windows too.
      process.emit('SIGINT');
      return;
    }
    if (url.pathname.startsWith('/sse'))
      await handleSSE(serverBackendFactory, req, res, url, sseSessions);
    else
      await handleStreamable(serverBackendFactory, req, res, streamableSessions);
  });
}

async function handleSSE(serverBackendFactory: ServerBackendFactory, req: http.IncomingMessage, res: http.ServerResponse, url: URL, sessions: Map<string, SSEServerTransportType>) {
  if (req.method === 'POST') {
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      res.statusCode = 400;
      return res.end('Missing sessionId');
    }

    const transport = sessions.get(sessionId);
    if (!transport) {
      res.statusCode = 404;
      return res.end('Session not found');
    }

    return await transport.handlePostMessage(req, res);
  } else if (req.method === 'GET') {
    const transport = new SSEServerTransport('/sse', res);
    sessions.set(transport.sessionId, transport);
    testDebug(`create SSE session`);
    await mcpServer.connect(serverBackendFactory, transport, Promise.resolve(), false);
    res.on('close', () => {
      testDebug(`delete SSE session`);
      sessions.delete(transport.sessionId);
    });
    return;
  }

  res.statusCode = 405;
  res.end('Method not allowed');
}

async function handleStreamable(serverBackendFactory: ServerBackendFactory, req: http.IncomingMessage, res: http.ServerResponse, sessions: Map<string, { transport: StreamableHTTPServerTransportType, transportInitialized: ManualPromise<void> }>) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (sessionId) {
    const sessionInfo = sessions.get(sessionId);
    if (!sessionInfo) {
      res.statusCode = 404;
      res.end('Session not found');
      return;
    }
    if (req.method === 'GET') {
      // As per spec, GET is for the event stream only, when we see it consider transport bidirectionally ready.
      const streamResponse = sessionInfo.transport.handleRequest(req, res);
      sessionInfo.transportInitialized.resolve();
      return streamResponse;
    }
    return sessionInfo.transport.handleRequest(req, res);
  }

  if (req.method === 'POST') {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: async sessionId => {
        testDebug(`create http session`);
        const sessionInfo = { transport, transportInitialized: new ManualPromise<void>() };
        sessions.set(sessionId, sessionInfo);
        await mcpServer.connect(serverBackendFactory, sessionInfo.transport, sessionInfo.transportInitialized, true);
      }
    });

    transport.onclose = () => {
      if (!transport.sessionId)
        return;
      sessions.delete(transport.sessionId);
      testDebug(`delete http session`);
    };

    await transport.handleRequest(req, res);
    return;
  }

  res.statusCode = 400;
  res.end('Invalid request');
}
