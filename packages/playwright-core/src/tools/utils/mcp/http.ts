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
import { createHttpServer, startHttpServer } from '@utils/network';

import * as mcpServer from './server';

import type { ServerBackendFactory } from './server';
import type { SSEServerTransport as SSEServerTransportType } from '@modelcontextprotocol/sdk/server/sse.js';
import type { StreamableHTTPServerTransport as StreamableHTTPServerTransportType } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const testDebug = debug('pw:mcp:test');

export type HttpTransportOptions = {
  allowedHosts?: string[];
  authToken?: string;
};

export async function startMcpHttpServer(
  config: { host?: string, port?: number },
  serverBackendFactory: ServerBackendFactory,
  options: HttpTransportOptions = {}
): Promise<string> {
  const httpServer = createHttpServer();
  await startHttpServer(httpServer, config);
  return await installHttpTransport(httpServer, serverBackendFactory, options, config.host);
}

export function addressToString(address: string | net.AddressInfo | null, options: {
  protocol: 'http' | 'ws';
  normalizeLoopback?: boolean;
}): string {
  assert(address, 'Could not bind server socket');
  if (typeof address === 'string')
    throw new Error('Unexpected address type: ' + address);
  let host = address.family === 'IPv4' ? address.address : `[${address.address}]`;
  if (options.normalizeLoopback && (host === '0.0.0.0' || host === '[::]' || host === '[::1]' || host === '127.0.0.1'))
    host = 'localhost';
  return `${options.protocol}://${host}:${address.port}`;
}

const REALM = 'MCP';

function isLoopbackHost(host: string | undefined): boolean {
  if (!host)
    return false;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function sendAuthChallenge(res: http.ServerResponse, error?: { code: string, description: string }) {
  // RFC 6750 Section 3 — Bearer challenge.
  let challenge = `Bearer realm="${REALM}"`;
  let status = 401;
  if (error) {
    challenge += `, error="${error.code}", error_description="${error.description}"`;
    if (error.code === 'invalid_request')
      status = 400;
  }
  res.statusCode = status;
  res.setHeader('WWW-Authenticate', challenge);
  res.end();
}

function validateBearerToken(req: http.IncomingMessage, res: http.ServerResponse, expectedToken: string): boolean {
  // OAuth 2.1 Section 5.1.1: token MUST be in Authorization header, MUST NOT be in URI query.
  const url = new URL(`http://localhost${req.url}`);
  if (url.searchParams.has('access_token')) {
    sendAuthChallenge(res, { code: 'invalid_request', description: 'access_token must not be in the URI query string' });
    return false;
  }

  const header = req.headers['authorization'];
  if (!header) {
    sendAuthChallenge(res);
    return false;
  }

  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (!match) {
    sendAuthChallenge(res, { code: 'invalid_request', description: 'malformed Authorization header' });
    return false;
  }

  const presented = Buffer.from(match[1], 'utf8');
  const expected = Buffer.from(expectedToken, 'utf8');
  // Constant-time comparison; length-mismatched buffers are not equal but we still compare to
  // avoid leaking length via timing.
  const padded = presented.length === expected.length ? presented : Buffer.alloc(expected.length);
  if (presented.length !== expected.length || !crypto.timingSafeEqual(padded, expected)) {
    sendAuthChallenge(res, { code: 'invalid_token', description: 'token is invalid or expired' });
    return false;
  }

  return true;
}

async function installHttpTransport(httpServer: http.Server, serverBackendFactory: ServerBackendFactory, options: HttpTransportOptions, configuredHost: string | undefined) {
  const url = addressToString(httpServer.address(), { protocol: 'http', normalizeLoopback: true });
  const host = new URL(url).host;
  const allowedHosts = (options.allowedHosts || [host]).map(h => h.toLowerCase());
  const allowAnyHost = allowedHosts.includes('*');
  const authToken = options.authToken;

  if (!authToken && configuredHost && !isLoopbackHost(configuredHost)) {
    // eslint-disable-next-line no-console
    console.error(
        `Warning: MCP server is bound to a non-loopback host (${configuredHost}) without --auth-token set. ` +
        `Anyone with network access to this port can drive the browser. ` +
        `See https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization`
    );
  }

  const sseSessions = new Map();
  const streamableSessions = new Map();
  httpServer.on('request', async (req, res) => {
    if (!allowAnyHost) {
      const host = req.headers.host?.toLowerCase();
      if (!host) {
        res.statusCode = 400;
        return res.end('Missing host');
      }

      // Prevent DNS evil.com -> localhost rebind.
      if (!allowedHosts.includes(host)) {
        // Access from the browser is forbidden.
        res.statusCode = 403;
        return res.end('Access is only allowed at ' + allowedHosts.join(', '));
      }
    }

    const url = new URL(`http://localhost${req.url}`);
    if (url.pathname === '/killkillkill') {
      // Require POST plus a custom header to prevent cross-origin CSRF
      // (a browser-coerced <img> GET or simple <form> POST can't add custom headers,
      // and any cross-origin request with custom headers is blocked by CORS preflight).
      if (req.method !== 'POST' || req.headers['x-pw-mcp-kill'] !== '1') {
        res.statusCode = 405;
        return res.end();
      }
      res.statusCode = 200;
      res.end('Killing process');
      // Simulate Ctrl+C in a way that works on Windows too.
      process.emit('SIGINT');
      return;
    }

    // Bearer-token gate for MCP endpoints. Per the MCP authorization spec, when authorization is
    // required and not yet proven, the server MUST respond with HTTP 401.
    // The /killkillkill endpoint above has its own CSRF protection and does not need bearer auth.
    if (authToken && !validateBearerToken(req, res, authToken))
      return;

    if (url.pathname.startsWith('/sse'))
      await handleSSE(serverBackendFactory, req, res, url, sseSessions);
    else
      await handleStreamable(serverBackendFactory, req, res, streamableSessions);
  });

  return url;
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
    await mcpServer.connect(serverBackendFactory, transport, false);
    res.on('close', () => {
      testDebug(`delete SSE session`);
      sessions.delete(transport.sessionId);
    });
    return;
  }

  res.statusCode = 405;
  res.end('Method not allowed');
}

async function handleStreamable(serverBackendFactory: ServerBackendFactory, req: http.IncomingMessage, res: http.ServerResponse, sessions: Map<string, StreamableHTTPServerTransportType>) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (sessionId) {
    const transport = sessions.get(sessionId);
    if (!transport) {
      res.statusCode = 404;
      res.end('Session not found');
      return;
    }
    return await transport.handleRequest(req, res);
  }

  if (req.method === 'POST') {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: async sessionId => {
        testDebug(`create http session`);
        await mcpServer.connect(serverBackendFactory, transport, true);
        sessions.set(sessionId, transport);
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
