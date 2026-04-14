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
import net from 'net';

import { test, expect } from './fixtures';

/**
 * Creates a minimal HTTP/HTTPS proxy server that records which hosts it proxied.
 * - For HTTP requests: forwards the request and returns the response.
 * - For HTTPS (CONNECT tunnel): establishes a TCP tunnel and responds 200.
 */
function createProxyServer(): Promise<{ server: http.Server; proxiedHosts: string[]; port: number }> {
  return new Promise(resolve => {
    const proxiedHosts: string[] = [];

    const server = http.createServer((req, res) => {
      // Plain HTTP proxy request
      const url = new URL(req.url!);
      proxiedHosts.push(url.hostname);

      const proxyReq = http.request({
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: req.method,
        headers: req.headers,
      }, proxyRes => {
        res.writeHead(proxyRes.statusCode!, proxyRes.headers);
        proxyRes.pipe(res);
      });

      req.pipe(proxyReq);
      proxyReq.on('error', () => res.end());
    });

    // Handle CONNECT (HTTPS tunnel)
    server.on('connect', (req, clientSocket, head) => {
      const [hostname, port] = req.url!.split(':');
      proxiedHosts.push(hostname);

      const serverSocket = net.connect(parseInt(port ?? '443'), hostname, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
      });

      serverSocket.on('error', () => clientSocket.destroy());
      clientSocket.on('error', () => serverSocket.destroy());
    });

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port;
      resolve({ server, proxiedHosts, port });
    });
  });
}

test('--proxy-server routes browser traffic through the proxy', async ({ startClient, server }) => {
  const { server: proxyServer, proxiedHosts, port } = await createProxyServer();

  try {
    const { client } = await startClient({
      args: [`--proxy-server=http://127.0.0.1:${port}`],
    });

    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    expect(proxiedHosts).toContain(new URL(server.PREFIX).hostname);
  } finally {
    proxyServer.close();
  }
});

test('--proxy-server with --isolated routes browser traffic through the proxy', async ({ startClient, server }) => {
  const { server: proxyServer, proxiedHosts, port } = await createProxyServer();

  try {
    const { client } = await startClient({
      args: [`--proxy-server=http://127.0.0.1:${port}`, '--isolated'],
    });

    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    expect(proxiedHosts).toContain(new URL(server.PREFIX).hostname);
  } finally {
    proxyServer.close();
  }
});

test('PLAYWRIGHT_MCP_PROXY_SERVER env var routes browser traffic through the proxy', async ({ startClient, server }) => {
  const { server: proxyServer, proxiedHosts, port } = await createProxyServer();

  try {
    const { client } = await startClient({
      env: { PLAYWRIGHT_MCP_PROXY_SERVER: `http://127.0.0.1:${port}` },
    });

    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    expect(proxiedHosts).toContain(new URL(server.PREFIX).hostname);
  } finally {
    proxyServer.close();
  }
});