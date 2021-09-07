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
import fs from 'fs';
import os from 'os';
import path from 'path';
import { removeFolders, existsAsync } from '../utils/utils';
import { PlaywrightClient } from '../remote/playwrightClient';

function defaultDockerImageName() {
  const packageJson = require('./../../package.json');
  return `mcr.microsoft.com/playwright:v${packageJson.version}-focal`;
}

export class PlaywrightDocker {
  private _client: any;
  private _containerId: any;
  private _dockerTmpDir: string = '';
  private _imageName: string;

  constructor(imageName: string = defaultDockerImageName()) {
    this._imageName = imageName;
  }

  async setup(workerIndex: number) {
    this._dockerTmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-docker-tmpdir'));

    const isDebugMode = !!process.env.PWDEBUG;

    const port = 10507 + workerIndex;
    const images = await getJSON('/images/json');
    const pwImage = images.find((image: any) => image.RepoTags.includes(this._imageName));
    const containerEnv = [
      'PW_DOCKER_CONNECTION_TIMEOUT=20000',
      'PW_SOCKS_PROXY_PORT=1', // Enable port forwarding over PlaywrightClient
    ];
    const containerExposedPorts = {
      [`${port}/tcp`]: {},
    };
    const containerPortBindings = {
      [`${port}/tcp`]: [
        { HostPort: port + '' },
      ],
    };
    if (isDebugMode) {
      containerEnv.push(`PWDEBUG=${process.env.PWDEBUG}`);
      containerExposedPorts['7900/tcp'] = {};
      containerPortBindings['7900/tcp'] = [
        { HostPort: (7900 + workerIndex) + '' },
      ];
      /* eslint-disable no-console */
      console.log(`Look inside Docker: http://localhost:${7900 + workerIndex}`);
    }

    const container = await postJSON('/containers/create', {
      Env: containerEnv,
      WorkingDir: '/ms-playwright-docker',
      Cmd: [ 'bash', 'start_server.sh', port + '', ],
      AttachStdout: true,
      AttachStderr: true,
      ExposedPorts: containerExposedPorts,
      Image: pwImage.Id,
      HostConfig: {
        Init: true,
        PortBindings: containerPortBindings,
        AutoRemove: true,
        ShmSize: 2 * 1024 * 1024 * 1024,
        // Used to get the wsEndpoint from the PlaywrightServer
        LogConfig: {
          Type: 'json-file',
          Config: { },
        },
      },
    });
    this._containerId = container.Id;
    await postJSON(`/containers/${this._containerId}/start`);
    while (true) {
      // Pull container logs until we get stdout with websocket.
      const logs = await fetch('get', `/containers/${this._containerId}/logs?stdout=1`);
      if (logs === null)
        throw new Error('ERROR: failed to start docker container');
      if (logs && logs.includes('ws://'))
        break;
      await new Promise(x => setTimeout(x, 100));
    }
    this._client = await PlaywrightClient.connect({ wsEndpoint: `ws://localhost:${port}/ws` });
    this._client.playwright()._enablePortForwarding();

    return this._client.playwright();
  }

  async teardown() {
    await removeFolders([this._dockerTmpDir]);
    if (this._client)
      await this._client.close();
    if (this._containerId)
      await postJSON(`/containers/${this._containerId}/stop?t=0`);
  }
}

async function getJSON(url: string): Promise<any> {
  const result = await fetch('get', url);
  if (!result)
    return result;
  return JSON.parse(result);
}

async function postJSON(url: string, json: any = undefined) {
  const result = await fetch('post', url, json ? JSON.stringify(json) : undefined);
  if (!result)
    return result;
  return JSON.parse(result);
}

const dockerSocket: string = (() => {
  if (os.platform() === 'win32')
    return '\\\\.\\pipe\\docker_engine';
  return '/var/run/docker.sock';
})();

function fetch(method: 'post'|'get', url: string, body: Buffer|string|undefined = undefined): Promise<string|null> {
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

