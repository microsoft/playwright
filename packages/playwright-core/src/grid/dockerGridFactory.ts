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
import { GridAgentLaunchOptions, GridFactory } from './gridServer';
import * as utils from '../utils/utils';

const dockerFactory: GridFactory = {
  name: 'Agents launched inside Docker container',
  capacity: Infinity,
  launchTimeout: 30000,
  retireTimeout: Infinity,
  launch: async (options: GridAgentLaunchOptions) => {
    const { vncUrl } = await launchDockerGridAgent(options.agentId, options.gridURL);
    /* eslint-disable no-console */
    console.log(``);
    console.log(`✨ Running browsers inside docker container: ${vncUrl} ✨`);
  }
};

export default dockerFactory;

interface DockerImage {
  Containers: number;
  Created: number;
  Id: string;
  Labels: null | Record<string, string>;
  ParentId: string;
  RepoDigests: null | string[];
  RepoTags: null | string[];
  SharedSize: number;
  Size: number;
  VirtualSize: number;
}

async function launchDockerGridAgent(agentId: string, gridURL: string): Promise<{vncUrl: string }> {
  const gridPort = new URL(gridURL).port || '80';
  const images: DockerImage[] | null = await getJSON('/images/json');

  if (!images) {
    throw new Error(`\n` + utils.wrapInASCIIBox([
      `Failed to list docker images`,
      `Please ensure docker is running.`,
      ``,
      `<3 Playwright Team`,
    ].join('\n'), 1));
  }

  const imageName = process.env.PWTEST_IMAGE_NAME ?? `mcr.microsoft.com/playwright:v${require('../../package.json').version}-focal`;
  const pwImage = images.find(image => image.RepoTags?.includes(imageName));

  if (!pwImage) {
    throw new Error(`\n` + utils.wrapInASCIIBox([
      `Failed to find ${imageName} docker image.`,
      `Please pull docker image with the following command:`,
      ``,
      `    npx playwright install docker-image`,
      ``,
      `<3 Playwright Team`,
    ].join('\n'), 1));
  }
  const Env = [
    'PW_SOCKS_PROXY_PORT=1', // Enable port forwarding over PlaywrightClient
  ];
  const forwardIfDefined = (envName: string) => {
    if (process.env[envName])
      Env.push(`CI=${process.env[envName]}`);
  };
  forwardIfDefined('CI');
  forwardIfDefined('PWDEBUG');
  forwardIfDefined('DEBUG');
  forwardIfDefined('DEBUG_FILE');
  forwardIfDefined('SELENIUM_REMOTE_URL');

  const container = await postJSON('/containers/create', {
    Env,
    WorkingDir: '/ms-playwright-agent',
    Cmd: [ 'bash', 'start_agent.sh', agentId, `http://host.docker.internal:${gridPort}` ],
    AttachStdout: true,
    AttachStderr: true,
    Image: pwImage.Id,
    ExposedPorts: {
      '7900/tcp': { }
    },
    HostConfig: {
      Init: true,
      AutoRemove: true,
      ShmSize: 2 * 1024 * 1024 * 1024,
      ExtraHosts: process.platform === 'linux' ? [
        'host.docker.internal:host-gateway', // Enable host.docker.internal on Linux.
      ] : [],
      PortBindings: {
        '7900/tcp': [{ HostPort: '0' }]
      },
    },
  });
  await postJSON(`/containers/${container.Id}/start`);
  const info = await getJSON(`/containers/${container.Id}/json`);
  const vncPort = info?.NetworkSettings?.Ports['7900/tcp'];
  return {
    vncUrl: `http://localhost:${vncPort[0].HostPort}`,
  };
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
