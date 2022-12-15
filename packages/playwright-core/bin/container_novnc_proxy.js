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

const http = require('http');
const fs = require('fs');
const path = require('path');
const { debug, program } = require('../lib/utilsBundle');
const { ProxyServer } = require('../lib/third_party/http_proxy');

const debugLog = debug('pw:proxy');

program
    .command('start')
    .description('reverse proxy for novnc and playwright server')
    .option('--port <number>', 'port number')
    .option('--server-endpoint <url>', 'Playwright Server endpoint')
    .option('--novnc-endpoint <url>', 'novnc server endpoint')
    .option('--novnc-ws-path <string>', 'novnc websocket path')
    .action(async function(options) {
      launchReverseProxy(options.port, options.serverEndpoint, options.novncEndpoint, options.novncWsPath);
    });

program.parse(process.argv);

async function launchReverseProxy(port, serverEndpoint, novncEndpoint, novncWSPath) {
  const vncProxy = new ProxyServer(novncEndpoint, debugLog);
  const serverProxy = new ProxyServer(serverEndpoint, debugLog);

  const httpServer = http.createServer((request, response) => {
    if (request.url === '/' && request.method === 'GET') {
      response.writeHead(200, {
        'content-type': 'text/html',
      }).end(fs.readFileSync(path.join(__dirname, 'container_landing.html'), 'utf-8'));
    } else if ((request.url === '/screen' || request.url === '/screen/') && request.method === 'GET') {
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
  httpServer.listen(port, () => {
    console.log('Playwright container listening on', port);
  });
}

