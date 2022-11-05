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

// Docker engine API.
// See https://docs.docker.com/engine/api/v1.41/

const DOCKER_API_VERSION = '1.41';

export interface DockerImage {
  imageId: string;
  names: string[];
}

export interface PortBinding {
  ip: string;
  hostPort: number;
  containerPort: number;
}

export interface DockerContainer {
  containerId: string;
  labels: Record<string, string>;
  imageId: string;
  state: 'created'|'restarting'|'running'|'removing'|'paused'|'exited'|'dead';
  names: string[];
  portBindings: PortBinding[];
}

export async function listContainers(): Promise<DockerContainer[]> {
  const containers = (await getJSON('/containers/json')) ?? [];
  return containers.map((container: any) => ({
    containerId: container.Id,
    imageId: container.ImageID,
    state: container.State,
    // Note: container names are usually prefixed with '/'.
    // See https://github.com/moby/moby/issues/6705
    names: (container.Names ?? []).map((name: string) => name.startsWith('/') ? name.substring(1) : name),
    portBindings: container.Ports?.map((portInfo: any) => ({
      ip: portInfo.IP,
      hostPort: portInfo.PublicPort,
      containerPort: portInfo.PrivatePort,
    })) ?? [],
    labels: container.Labels ?? {},
  }));
}

interface LaunchContainerOptions {
  imageId: string;
  autoRemove: boolean;
  command?: string[];
  labels?: Record<string, string>;
  ports?: { container: number, host: number }[],
  name?: string;
  workingDir?: string;
  waitUntil?: 'not-running' | 'next-exit' | 'removed';
  env?: { [key: string]: string | number | boolean | undefined };
}

export async function launchContainer(options: LaunchContainerOptions): Promise<string> {
  const ExposedPorts: any = {};
  const PortBindings: any = {};
  for (const port of (options.ports ?? [])) {
    ExposedPorts[`${port.container}/tcp`] = {};
    PortBindings[`${port.container}/tcp`] = [{ HostPort: port.host + '', HostIp: '127.0.0.1' }];
  }
  const container = await postJSON(`/containers/create` + (options.name ? '?name=' + options.name : ''), {
    Cmd: options.command,
    WorkingDir: options.workingDir,
    Labels: options.labels ?? {},
    AttachStdout: true,
    AttachStderr: true,
    Image: options.imageId,
    ExposedPorts,
    Env: dockerProtocolEnv(options.env),
    HostConfig: {
      Init: true,
      AutoRemove: options.autoRemove,
      ShmSize: 2 * 1024 * 1024 * 1024,
      PortBindings,
    },
  });
  await postJSON(`/containers/${container.Id}/start`);
  if (options.waitUntil)
    await postJSON(`/containers/${container.Id}/wait?condition=${options.waitUntil}`);
  return container.Id;
}

interface StopContainerOptions {
  containerId: string,
  waitUntil?: 'not-running' | 'next-exit' | 'removed';
}

export async function stopContainer(options: StopContainerOptions) {
  await Promise.all([
    // Make sure to wait for the container to be removed.
    postJSON(`/containers/${options.containerId}/wait?condition=${options.waitUntil ?? 'not-running'}`),
    postJSON(`/containers/${options.containerId}/kill`),
  ]);
}

export async function removeContainer(containerId: string) {
  await Promise.all([
    // Make sure to wait for the container to be removed.
    postJSON(`/containers/${containerId}/wait?condition=removed`),
    callDockerAPI('delete', `/containers/${containerId}`),
  ]);
}

export async function getContainerLogs(containerId: string): Promise<string[]> {
  const rawLogs = await callDockerAPI('get', `/containers/${containerId}/logs?stdout=true&stderr=true`).catch(e => '');
  if (!rawLogs)
    return [];
  // Docker might prefix every log line with 8 characters. Stip them out.
  // See https://github.com/moby/moby/issues/7375
  // This doesn't happen if the containers is launched manually with attached terminal.
  return rawLogs.split('\n').map(line => {
    if ([0, 1, 2].includes(line.charCodeAt(0)))
      return line.substring(8);
    return line;
  });
}

interface CommitContainerOptions {
  containerId: string,
  repo: string,
  tag: string,
  entrypoint?: string[],
  workingDir?: string,
  env?: {[key: string]: string | number | boolean | undefined},
}

function dockerProtocolEnv(env?: {[key: string]: string | number | boolean | undefined}): string[] {
  const result = [];
  for (const [key, value] of Object.entries(env ?? {}))
    result.push(`${key}=${value}`);
  return result;
}

export async function commitContainer(options: CommitContainerOptions) {
  await postJSON(`/commit?container=${options.containerId}&repo=${options.repo}&tag=${options.tag}`, {
    Entrypoint: options.entrypoint,
    WorkingDir: options.workingDir,
    Env: dockerProtocolEnv(options.env),
  });
}

export async function listImages(): Promise<DockerImage[]> {
  const rawImages: any[] = (await getJSON('/images/json')) ?? [];
  return rawImages.map((rawImage: any) => ({
    imageId: rawImage.Id,
    names: rawImage.RepoTags ?? [],
  }));
}

export async function removeImage(imageId: string) {
  await callDockerAPI('delete', `/images/${imageId}`);
}

export async function checkEngineRunning() {
  try {
    await callDockerAPI('get', '/info');
    return true;
  } catch (e) {
    return false;
  }
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

function callDockerAPI(method: 'post'|'get'|'delete', url: string, body: Buffer|string|undefined = undefined): Promise<string> {
  const dockerSocket = process.platform === 'win32' ? '\\\\.\\pipe\\docker_engine' : '/var/run/docker.sock';
  return new Promise((resolve, reject) => {
    const request = http.request({
      socketPath: dockerSocket,
      path: `/v${DOCKER_API_VERSION}${url}`,
      timeout: 30000,
      method,
    }, (response: http.IncomingMessage) => {
      let body = '';
      response.on('data', function(chunk){
        body += chunk;
      });
      response.on('end', function(){
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300)
          reject(new Error(`${method} ${url} FAILED with statusCode ${response.statusCode} and body\n${body}`));
        else
          resolve(body);
      });
    });
    request.on('error', function(e){
      reject(e);
    });
    if (body) {
      request.setHeader('Content-Type', 'application/json');
      request.setHeader('Content-Length', body.length);
      request.write(body);
    } else {
      request.setHeader('Content-Type', 'text/plain');
    }
    request.end();
  });
}
