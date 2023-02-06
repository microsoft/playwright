/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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
/* eslint-disable no-console */

import path from 'path';
import { spawnAsync } from '../utils/spawnAsync';
import { createGuid } from '../utils';
import type { Command } from '../utilsBundle';
import { debug } from '../utilsBundle';
import type { AddressInfo } from 'net';
import http from 'http';
import { selfDestruct } from '../cli/driver';
import { PlaywrightServer } from '../remote/playwrightServer';

const { ProxyServer } = require('../third_party/http_proxy.js');
const debugLog = debug('pw:proxy');

export function addContainerCLI(program: Command) {
  const ctrCommand = program.command('container', { hidden: true })
      .description(`Manage container integration (EXPERIMENTAL)`);

  ctrCommand.command('install-services', { hidden: true })
      .description('install services required to run container agent')
      .action(async function() {
        const { code } = await spawnAsync('bash', [path.join(__dirname, 'container_install_deps.sh')], { stdio: 'inherit' });
        if (code !== 0)
          throw new Error('Failed to install server dependencies!');
      });

  ctrCommand.command('entrypoint', { hidden: true })
      .description('launch all services and container agent')
      .action(async function() {
        await spawnAsync('bash', [path.join(__dirname, 'container_entrypoint.sh')], { stdio: 'inherit' });
      });

  ctrCommand.command('start-agent', { hidden: true })
      .description('start container agent')
      .option('--port <number>', 'port number')
      .option('--novnc-endpoint <url>', 'novnc server endpoint')
      .action(async function(options) {
        launchContainerAgent(+(options.port ?? '0'), options.novncEndpoint);
      });
}

async function launchContainerAgent(port: number, novncEndpoint: string) {
  const novncWSPath = createGuid();
  const server = new PlaywrightServer({
    path: '/' + createGuid(),
    maxConnections: Infinity,
  });
  await server.listen(undefined);
  const serverEndpoint = server.address();
  process.on('exit', () => server.close().catch(console.error));
  process.stdin.on('close', () => selfDestruct());

  const vncProxy = new ProxyServer(novncEndpoint, debugLog);
  const serverProxy = new ProxyServer(serverEndpoint, debugLog);

  const httpServer = http.createServer((request, response) => {
    if (request.url === '/' && request.method === 'GET') {
      response.writeHead(307, {
        Location: `/screen/?resize=scale&autoconnect=1&path=${novncWSPath}`,
      }).end();
    } else if (request.url?.startsWith('/screen')) {
      request.url = request.url.substring('/screen'.length);
      vncProxy.web(request, response);
    } else {
      serverProxy.web(request, response);
    }
  });
  httpServer.on('error', error => debugLog(error));
  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url === '/' + novncWSPath)
      vncProxy.ws(request, socket, head);
    else
      serverProxy.ws(request, socket, head);
  });
  httpServer.listen(port, '0.0.0.0', () => {
    const { port } = httpServer.address() as AddressInfo;
    console.log(`Playwright Container running on http://localhost:${port}`);
  });
}

