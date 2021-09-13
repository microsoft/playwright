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

import http from 'http';
import os from 'os';

export async function launchAgent(agentId: string, gridPort: number) {
  const images = await getJSON('/images/json');
  let imageName = process.env.PW_IMAGE_NAME;
  if (!imageName) {
    const packageJson = require('../../package.json');
    imageName = `mcr.microsoft.com/playwright:v${packageJson.version}-focal`;
  }
  const pwImage = images.find((image: any) => image.RepoTags.includes(imageName));
  if (!pwImage) {
    // TODO: instructions how to pull given image.
    throw new Error(`Failed to find ${imageName} docker image.`);
  }
  const container = await postJSON('/containers/create', {
    Env: [
      'PW_SOCKS_PROXY_PORT=1', // Enable port forwarding over PlaywrightClient
    ],
    WorkingDir: '/ms-playwright-agent',
    Cmd: [ 'bash', 'start_agent.sh', agentId, `http://host.docker.internal:${gridPort}` ],
    AttachStdout: true,
    AttachStderr: true,
    Image: pwImage.Id,
    HostConfig: {
      Init: true,
      AutoRemove: true,
      ShmSize: 2 * 1024 * 1024 * 1024,
      ExtraHosts: process.platform === 'linux' ? [
        'host.docker.internal:host-gateway', // Enable host.docker.internal on Linux.
      ] : [],
    },
  });
  await postJSON(`/containers/${container.Id}/start`);
}

async function getJSON(url: string): Promise<any> {
  const result = await callDockerAPI('get', url);
  if (!result)
    return result;
  return JSON.parse(result);
}

async function postJSON(url: string, json: any = undefined) {
  const result = await callDockerAPI('post', url, json ? JSON.stringify(json) : undefined);
  if (!result)
    return result;
  return JSON.parse(result);
}

function callDockerAPI(method: 'post'|'get', url: string, body: Buffer|string|undefined = undefined): Promise<string|null> {
  const dockerSocket = os.platform() === 'win32' ? '\\\\.\\pipe\\docker_engine' : '/var/run/docker.sock';
  return new Promise((resolve, reject) => {
    const request = http.request({
      socketPath: dockerSocket,
      path: url,
      method,
    }, (response: http.IncomingMessage) => {
      let body = '';
      response.on('data', function(chunk){
        body += chunk;
      });
      response.on('end', function(){
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          console.error(`ERROR ${method} ${url}`, response.statusCode, body);
          resolve(null);
        } else {
          resolve(body);
        }
      });
    });
    request.on('error', function(e){
      console.error('Error fetching json: ' + e);
      resolve(null);
    });
    if (body) {
      request.setHeader('Content-Type', 'application/json');
      request.setHeader('Content-Length', body.length);
      request.write(body);
    }
    request.end();
  });
}
