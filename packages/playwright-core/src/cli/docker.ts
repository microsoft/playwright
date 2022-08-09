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

import http from 'http';
import * as utils from '../utils';
import { spawnAsync } from '../utils/spawnAsync';
import { getPlaywrightVersion } from '../common/userAgent';

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

const VRT_IMAGE_DISTRO = 'jammy';
const VRT_IMAGE_NAME = `playwright:local-${getPlaywrightVersion()}-${VRT_IMAGE_DISTRO}`;
const VRT_CONTAINER_NAME = `playwright-${getPlaywrightVersion()}-${VRT_IMAGE_DISTRO}`;

const GENERATE_FLUXBOX_BROWSERS_MENU = `
  const { chromium, firefox, webkit } = require('playwright-core');

  console.log(\`
    [begin] (fluxbox)
      [submenu] (Browsers) {}
        [exec] (Chromium) { $\{chromium.executablePath()} --no-sandbox --test-type= } <>
        [exec] (Firefox) { $\{firefox.executablePath()} } <>
        [exec] (WebKit) { $\{webkit.executablePath()} } <>
      [end]
      [include] (/etc/X11/fluxbox/fluxbox-menu)
    [end]
  \`);
`;

const CONTAINER_ENTRY_POINT = `#!/bin/bash
  set -e
  SCREEN_WIDTH=1360
  SCREEN_HEIGHT=1020
  SCREEN_DEPTH=24
  SCREEN_DPI=96
  GEOMETRY="$SCREEN_WIDTH""x""$SCREEN_HEIGHT""x""$SCREEN_DEPTH"

  nohup /usr/bin/xvfb-run --server-num=$DISPLAY_NUM \
       --listen-tcp \
       --server-args="-screen 0 "$GEOMETRY" -fbdir /var/tmp -dpi "$SCREEN_DPI" -listen tcp -noreset -ac +extension RANDR" \
       /usr/bin/fluxbox -display "$DISPLAY" >/dev/null 2>&1 &

  for i in $(seq 1 50)
    do
      if xdpyinfo -display $DISPLAY >/dev/null 2>&1; then
        break
      fi
      echo "Waiting for Xvfb..."
      sleep 0.2
    done


  nohup x11vnc -forever -shared -rfbport 5900 -rfbportv6 5900 -display "$DISPLAY" >/dev/null 2>&1 &
  nohup /opt/bin/noVNC/utils/novnc_proxy --listen 7900 --vnc localhost:5900 >/dev/null 2>&1 &
  cd /ms-playwright-agent
  NOVNC_UUID=$(cat /proc/sys/kernel/random/uuid)
  echo "novnc is listening on http://127.0.0.1:7900?path=$NOVNC_UUID&resize=scale"
  PW_UUID=$(cat /proc/sys/kernel/random/uuid)
  npx playwright run-server --port=5400 --path=/$PW_UUID
`;

const NOVNC_REF = '1.3.0';
const WEBSOCKIFY_REF = '0.10.0';
const CONTAINER_BUILD_SCRIPT = `
  # Generate entry point script
  cat <<'EOF' >/start.sh
  ${CONTAINER_ENTRY_POINT}
  EOF
  chmod 755 /start.sh

  export DEBIAN_FRONTEND=noninteractive

  # Install FluxBox, VNC & noVNC
  mkdir -p /opt/bin && chmod +x /dev/shm \
      && apt-get update && apt-get install -y unzip fluxbox x11vnc \
      && curl -L -o noVNC.zip "https://github.com/novnc/noVNC/archive/v${NOVNC_REF}.zip" \
      && unzip -x noVNC.zip \
      && rm -rf noVNC-${NOVNC_REF}/{docs,tests} \
      && mv noVNC-${NOVNC_REF} /opt/bin/noVNC \
      && cp /opt/bin/noVNC/vnc.html /opt/bin/noVNC/index.html \
      && rm noVNC.zip \
      && curl -L -o websockify.zip "https://github.com/novnc/websockify/archive/v${WEBSOCKIFY_REF}.zip" \
      && unzip -x websockify.zip \
      && rm websockify.zip \
      && rm -rf websockify-${WEBSOCKIFY_REF}/{docs,tests} \
      && mv websockify-${WEBSOCKIFY_REF} /opt/bin/noVNC/utils/websockify

  # Configure FluxBox menus
  cd /ms-playwright-agent
  cat <<'EOF' | node > configuration.txt
  ${GENERATE_FLUXBOX_BROWSERS_MENU}
  EOF
  mkdir /root/.fluxbox && mv /ms-playwright-agent/configuration.txt /root/.fluxbox/menu
`.split('\n').map(line => line.substring(2)).join('\n');

export async function deleteImage() {
  const dockerImage = await findDockerImage(VRT_IMAGE_NAME);
  if (!dockerImage)
    return;

  if (await containerInfo())
    await stopContainer();
  await callDockerAPI('delete', `/images/${dockerImage.Id}`);
}

export async function buildImage() {
  const isDevelopmentMode = getPlaywrightVersion().includes('next');
  let baseImageName = `mcr.microsoft.com/playwright:v${getPlaywrightVersion()}-${VRT_IMAGE_DISTRO}`;
  // 1. Build or pull base image.
  if (isDevelopmentMode) {
    // Use our docker build scripts in development mode!
    if (!process.env.PWTEST_DOCKER_BASE_IMAGE) {
      const arch = process.arch === 'arm64' ? '--arm64' : '--amd64';
      console.error(utils.wrapInASCIIBox([
        `You are in DEVELOPMENT mode!`,
        ``,
        `1. Build local base image`,
        `     ./utils/docker/build.sh ${arch} ${VRT_IMAGE_DISTRO} playwright:localbuild`,
        `2. Use the local base to build VRT image:`,
        `     PWTEST_DOCKER_BASE_IMAGE=playwright:localbuild npx playwright docker build`,
      ].join('\n'), 1));
      process.exit(1);
    }
    baseImageName = process.env.PWTEST_DOCKER_BASE_IMAGE;
  } else {
    const { code } = await spawnAsync('docker', ['pull', baseImageName], { stdio: 'inherit' });
    if (code !== 0)
      throw new Error('Failed to pull docker image!');
  }
  // 2. Find pulled docker image
  const dockerImage = await findDockerImage(baseImageName);
  if (!dockerImage)
    throw new Error(`Failed to pull ${baseImageName}`);
  // 3. Launch container and install VNC in it
  console.log(`Building ${VRT_IMAGE_NAME}...`);
  const containerId = await launchContainer({
    image: dockerImage,
    autoRemove: false,
    command: ['/bin/bash', '-c', CONTAINER_BUILD_SCRIPT],
  });
  await postJSON(`/containers/${containerId}/wait`);

  // 4. Commit a new image based on the launched container with installed VNC & noVNC.
  const [vrtRepo, vrtTag] = VRT_IMAGE_NAME.split(':');
  await postJSON(`/commit?container=${containerId}&repo=${vrtRepo}&tag=${vrtTag}`, {
    Entrypoint: ['/start.sh'],
    Env: [
      'DISPLAY_NUM=99',
      'DISPLAY=:99',
    ],
  });
  await Promise.all([
    // Make sure to wait for the container to be removed.
    postJSON(`/containers/${containerId}/wait?condition=removed`),
    callDockerAPI('delete', `/containers/${containerId}`),
  ]);
  console.log(`Done!`);
}

interface ContainerInfo {
  wsEndpoint: string;
  vncSession: string;
}

export async function containerInfo(): Promise<ContainerInfo|undefined> {
  const containerId = await findRunningDockerContainerId();
  if (!containerId)
    return undefined;
  const rawLogs = await callDockerAPI('get', `/containers/${containerId}/logs?stdout=true&stderr=true`).catch(e => '');
  if (!rawLogs)
    return undefined;
  // Docker might prefix every log line with 8 characters. Stip them out.
  // See https://github.com/moby/moby/issues/7375
  // This doesn't happen if the containers is launched manually with attached terminal.
  const logLines = rawLogs.split('\n').map(line => {
    if ([0, 1, 2].includes(line.charCodeAt(0)))
      return line.substring(8);
    return line;
  });
  const WS_LINE_PREFIX = 'Listening on ws://';
  const webSocketLine = logLines.find(line => line.startsWith(WS_LINE_PREFIX));
  const NOVNC_LINE_PREFIX = 'novnc is listening on ';
  const novncLine = logLines.find(line => line.startsWith(NOVNC_LINE_PREFIX));
  return novncLine && webSocketLine ? {
    wsEndpoint: 'ws://' + webSocketLine.substring(WS_LINE_PREFIX.length),
    vncSession: novncLine.substring(NOVNC_LINE_PREFIX.length),
  } : undefined;
}

export async function ensureContainerOrDie(): Promise<ContainerInfo> {
  const pwImage = await findDockerImage(VRT_IMAGE_NAME);
  if (!pwImage) {
    console.error('\n' + utils.wrapInASCIIBox([
      `Failed to find local docker image.`,
      `Please build local docker image with the following command:`,
      ``,
      `    npx playwright docker build`,
      ``,
      `<3 Playwright Team`,
    ].join('\n'), 1));
    process.exit(1);
  }

  let info = await containerInfo();
  if (info)
    return info;

  await launchContainer({
    image: pwImage,
    name: VRT_CONTAINER_NAME,
    autoRemove: true,
    ports: [5400, 7900],
  });

  // Wait for the service to become available.
  const startTime = Date.now();
  const timeouts = [0, 100, 100, 200, 500, 1000];
  do {
    await new Promise(x => setTimeout(x, timeouts.shift() ?? 1000));
    info = await containerInfo();
  } while (!info && Date.now() < startTime + 60000);

  if (!info)
    throw new Error('Failed to launch docker container!');
  return info;
}

export async function stopContainer() {
  const containerId = await findRunningDockerContainerId();
  if (!containerId) {
    console.log(`Container is not running.`);
    return undefined;
  }
  await Promise.all([
    // Make sure to wait for the container to be removed.
    postJSON(`/containers/${containerId}/wait?condition=removed`),
    postJSON(`/containers/${containerId}/kill`),
  ]);
}

export async function ensureDockerEngineIsRunningOrDie() {
  try {
    await callDockerAPI('get', '/info');
  } catch (e) {
    console.error(utils.wrapInASCIIBox([
      `Docker is not running!`,
      `Please install if necessary and launch docker first:`,
      ``,
      `    https://docs.docker.com/get-docker`,
      ``,
    ].join('\n'), 1));
    process.exit(1);
  }
}

async function findDockerImage(imageName: string): Promise<DockerImage|undefined> {
  const images: DockerImage[] | null = await getJSON('/images/json');
  return images ? images.find(image => image.RepoTags?.includes(imageName)) : undefined;
}

interface Container {
  ImageID: string;
  State: string;
  Names: [string];
  Id: string;
}

async function findRunningDockerContainerId(): Promise<string|undefined> {
  const containers: (Container[]|undefined) = await getJSON('/containers/json');
  if (!containers)
    return undefined;
  // 1. Try findind a container with our name. This happens if the container is launched
  // automatically with `npx playwright docker start`.
  let container = containers.find((container: Container) => container.Names.some(name => name.includes(VRT_CONTAINER_NAME)));
  // 2. Alternatively, the container might be launched manually with a direct docker command.
  // In this case, we should look for a container with a proper base image.
  if (!container) {
    const dockerImage = await findDockerImage(VRT_IMAGE_NAME);
    container = dockerImage ? containers.find((container: Container) => container.ImageID === dockerImage.Id) : undefined;
  }
  return container?.State === 'running' ? container.Id : undefined;
}

interface ContainerOptions {
  image: DockerImage;
  autoRemove: boolean;
  command?: string[];
  ports?: Number[];
  name?: string;
}

async function launchContainer(options: ContainerOptions): Promise<string> {
  const ExposedPorts: any = {};
  const PortBindings: any = {};
  for (const port of (options.ports ?? [])) {
    ExposedPorts[`${port}/tcp`] = {};
    PortBindings[`${port}/tcp`] = [{ HostPort: port + '' }];
  }
  const container = await postJSON(`/containers/create` + (options.name ? '?name=' + options.name : ''), {
    Cmd: options.command,
    AttachStdout: true,
    AttachStderr: true,
    Image: options.image.Id,
    ExposedPorts,
    HostConfig: {
      Init: true,
      AutoRemove: options.autoRemove,
      ShmSize: 2 * 1024 * 1024 * 1024,
      PortBindings,
    },
  });
  await postJSON(`/containers/${container.Id}/start`);
  return container.Id;
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

const DOCKER_API_VERSION = '1.41';

function callDockerAPI(method: 'post'|'get'|'delete', url: string, body: Buffer|string|undefined = undefined): Promise<string> {
  const dockerSocket = process.platform === 'win32' ? '\\\\.\\pipe\\docker_engine' : '/var/run/docker.sock';
  return new Promise((resolve, reject) => {
    const request = http.request({
      socketPath: dockerSocket,
      path: `/v${DOCKER_API_VERSION}${url}`,
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

