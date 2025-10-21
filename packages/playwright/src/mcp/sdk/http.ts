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

import { debug } from 'playwright-core/lib/utilsBundle';

import * as mcpBundle from './bundle';
import * as mcpServer from './server';

import type { ServerBackendFactory } from './server';
import type { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const testDebug = debug('pw:mcp:test');
const httpDebug = debug('pw:mcp:http');

export async function startHttpServer(config: { host?: string, port?: number, ssePath?: string }, abortSignal?: AbortSignal): Promise<http.Server> {
  const { host, port } = config;
  const httpServer = http.createServer();
  decorateServer(httpServer);

  httpDebug(`Starting HTTP server - Host: ${host || 'localhost'}, Port: ${port || 'auto'}`);

  await new Promise<void>((resolve, reject) => {
    httpServer.on('error', (err) => {
      httpDebug(`HTTP server error: ${err.message}`);
      reject(err);
    });
    abortSignal?.addEventListener('abort', () => {
      httpDebug('HTTP server abort signal received');
      httpServer.close();
      reject(new Error('Aborted'));
    });
    httpServer.listen(port, host, () => {
      const address = httpServer.address();
      const addressStr = httpAddressToString(address);
      httpDebug(`HTTP server started successfully - Listening on: ${addressStr}`);
      resolve();
      httpServer.removeListener('error', reject);
    });
  });
  return httpServer;
}

export function httpAddressToString(address: string | net.AddressInfo | null): string {
  assert(address, 'Could not bind server socket');
  if (typeof address === 'string')
    return address;
  const resolvedPort = address.port;
  let resolvedHost = address.family === 'IPv4' ? address.address : `[${address.address}]`;
  if (resolvedHost === '0.0.0.0' || resolvedHost === '[::]')
    resolvedHost = 'localhost';
  return `http://${resolvedHost}:${resolvedPort}`;
}

export async function installHttpTransport(httpServer: http.Server, serverBackendFactory: ServerBackendFactory, unguessableUrl: boolean, allowedHosts?: string[], ssePath?: string) {
  const url = httpAddressToString(httpServer.address());
  const host = new URL(url).host;
  allowedHosts = (allowedHosts || [host]).map(h => h.toLowerCase());
  const allowAnyHost = allowedHosts.includes('*');
  const pathPrefix = unguessableUrl ? `/${crypto.randomUUID()}` : '';
  const effectiveSsePath = ssePath || '/sse';

  httpDebug(`Installing HTTP transport - URL: ${url}, SSE Path: ${effectiveSsePath}`);
  httpDebug(`Allowed hosts: ${allowAnyHost ? 'ALL (*)' : allowedHosts.join(', ')}`);
  if (pathPrefix)
    httpDebug(`Path prefix (unguessable): ${pathPrefix}`);

  const sseSessions = new Map();
  const streamableSessions = new Map();
  httpServer.on('request', async (req, res) => {
    const startTime = Date.now();
    const clientIp = req.socket.remoteAddress;

    // Log incoming request
    httpDebug(`[${req.method}] ${req.url} - Client: ${clientIp}`);

    if (!allowAnyHost) {
      const host = req.headers.host?.toLowerCase();
      if (!host) {
        httpDebug(`[400] Missing host header - Client: ${clientIp}`);
        res.statusCode = 400;
        return res.end('Missing host');
      }

      // Prevent DNS evil.com -> localhost rebind.
      if (!allowedHosts.includes(host)) {
        // Access from the browser is forbidden.
        httpDebug(`[403] Host not allowed: ${host} - Client: ${clientIp}`);
        res.statusCode = 403;
        return res.end('Access is only allowed at ' + allowedHosts.join(', '));
      }
    }

    if (!req.url?.startsWith(pathPrefix)) {
      httpDebug(`[404] Path not found: ${req.url} - Client: ${clientIp}`);
      res.statusCode = 404;
      return res.end('Not found');
    }

    const path = req.url?.slice(pathPrefix.length);
    const url = new URL(`http://localhost${path}`);

    // Health check endpoint
    if (url.pathname === '/health' && req.method === 'GET') {
      httpDebug(`[HEALTH] Health check requested - Client: ${clientIp}`);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'healthy' }));
      const duration = Date.now() - startTime;
      httpDebug(`[200] /health - ${duration}ms - Client: ${clientIp}`);
      return;
    }

    if (url.pathname === '/killkillkill' && req.method === 'GET') {
      httpDebug(`[KILL] Shutdown requested - Client: ${clientIp}`);
      res.statusCode = 200;
      res.end('Killing process');
      // Simulate Ctrl+C in a way that works on Windows too.
      process.emit('SIGINT');
      return;
    }

    if (url.pathname.startsWith(effectiveSsePath)) {
      httpDebug(`[SSE] SSE endpoint accessed: ${url.pathname} - Client: ${clientIp}`);
      await handleSSE(serverBackendFactory, req, res, url, sseSessions, effectiveSsePath);
      const duration = Date.now() - startTime;
      httpDebug(`[SSE] Request completed - ${duration}ms - Client: ${clientIp}`);
    } else {
      httpDebug(`[MCP] Streamable HTTP endpoint accessed: ${url.pathname} - Client: ${clientIp}`);
      await handleStreamable(serverBackendFactory, req, res, streamableSessions);
      const duration = Date.now() - startTime;
      httpDebug(`[MCP] Request completed - ${duration}ms - Client: ${clientIp}`);
    }
  });

  return `${url}${pathPrefix}`;
}

async function handleSSE(serverBackendFactory: ServerBackendFactory, req: http.IncomingMessage, res: http.ServerResponse, url: URL, sessions: Map<string, SSEServerTransport>, ssePath: string) {
  const clientIp = req.socket.remoteAddress;

  if (req.method === 'POST') {
    const sessionId = url.searchParams.get('sessionId');
    httpDebug(`[SSE-POST] Session message - SessionID: ${sessionId || 'missing'} - Client: ${clientIp}`);

    if (!sessionId) {
      httpDebug(`[SSE-POST] Missing sessionId parameter - Client: ${clientIp}`);
      res.statusCode = 400;
      return res.end('Missing sessionId');
    }

    const transport = sessions.get(sessionId);
    if (!transport) {
      httpDebug(`[SSE-POST] Session not found: ${sessionId} - Client: ${clientIp}`);
      res.statusCode = 404;
      return res.end('Session not found');
    }

    httpDebug(`[SSE-POST] Processing message for session: ${sessionId} - Client: ${clientIp}`);
    return await transport.handlePostMessage(req, res);
  } else if (req.method === 'GET') {
    const transport = new mcpBundle.SSEServerTransport(ssePath, res);
    sessions.set(transport.sessionId, transport);
    httpDebug(`[SSE-GET] New SSE session created: ${transport.sessionId} - Client: ${clientIp} - Total sessions: ${sessions.size}`);
    testDebug(`create SSE session: ${transport.sessionId}`);
    await mcpServer.connect(serverBackendFactory, transport, false);
    res.on('close', () => {
      httpDebug(`[SSE-GET] Session closed: ${transport.sessionId} - Client: ${clientIp} - Remaining sessions: ${sessions.size - 1}`);
      testDebug(`delete SSE session: ${transport.sessionId}`);
      sessions.delete(transport.sessionId);
    });
    return;
  }

  httpDebug(`[SSE] Method not allowed: ${req.method} - Client: ${clientIp}`);
  res.statusCode = 405;
  res.end('Method not allowed');
}

async function handleStreamable(serverBackendFactory: ServerBackendFactory, req: http.IncomingMessage, res: http.ServerResponse, sessions: Map<string, StreamableHTTPServerTransport>) {
  const clientIp = req.socket.remoteAddress;
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId) {
    httpDebug(`[MCP-HTTP] Existing session request - SessionID: ${sessionId} - Client: ${clientIp}`);
    const transport = sessions.get(sessionId);
    if (!transport) {
      httpDebug(`[MCP-HTTP] Session not found: ${sessionId} - Client: ${clientIp}`);
      res.statusCode = 404;
      res.end('Session not found');
      return;
    }
    httpDebug(`[MCP-HTTP] Processing request for session: ${sessionId} - Client: ${clientIp}`);
    return await transport.handleRequest(req, res);
  }

  if (req.method === 'POST') {
    httpDebug(`[MCP-HTTP] New session initialization - Client: ${clientIp}`);
    const transport = new mcpBundle.StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: async (sessionId: string) => {
        httpDebug(`[MCP-HTTP] Session initialized: ${sessionId} - Client: ${clientIp} - Total sessions: ${sessions.size + 1}`);
        testDebug(`create http session: ${transport.sessionId}`);
        await mcpServer.connect(serverBackendFactory, transport, true);
        sessions.set(sessionId, transport);
      }
    });

    transport.onclose = () => {
      if (!transport.sessionId)
        return;
      httpDebug(`[MCP-HTTP] Session closed: ${transport.sessionId} - Client: ${clientIp} - Remaining sessions: ${sessions.size - 1}`);
      sessions.delete(transport.sessionId);
      testDebug(`delete http session: ${transport.sessionId}`);
    };

    await transport.handleRequest(req, res);
    return;
  }

  httpDebug(`[MCP-HTTP] Invalid request method: ${req.method} - Client: ${clientIp}`);
  res.statusCode = 400;
  res.end('Invalid request');
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
