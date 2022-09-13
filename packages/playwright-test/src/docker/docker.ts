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
import fs from 'fs';
import { spawnAsync } from 'playwright-core/lib/utils/spawnAsync';
import * as utils from 'playwright-core/lib/utils';
import { getPlaywrightVersion } from 'playwright-core/lib/common/userAgent';
import * as dockerApi from './dockerApi';

const VRT_IMAGE_DISTRO = 'focal';
const VRT_IMAGE_NAME = `playwright:local-${getPlaywrightVersion()}-${VRT_IMAGE_DISTRO}`;
const VRT_CONTAINER_NAME = `playwright-${getPlaywrightVersion()}-${VRT_IMAGE_DISTRO}`;

export async function deleteImage() {
  const dockerImage = await findDockerImage(VRT_IMAGE_NAME);
  if (!dockerImage)
    return;

  if (await containerInfo())
    await stopContainer();
  await dockerApi.removeImage(dockerImage.imageId);
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
  const buildScriptText = await fs.promises.readFile(path.join(__dirname, 'build_docker_image.sh'), 'utf8');
  const containerId = await dockerApi.launchContainer({
    imageId: dockerImage.imageId,
    autoRemove: false,
    command: ['/bin/bash', '-c', buildScriptText],
    waitUntil: 'not-running',
  });

  // 4. Commit a new image based on the launched container with installed VNC & noVNC.
  const [vrtRepo, vrtTag] = VRT_IMAGE_NAME.split(':');
  await dockerApi.commitContainer({
    containerId,
    repo: vrtRepo,
    tag: vrtTag,
    entrypoint: '/entrypoint.sh',
    env: {
      'DISPLAY_NUM': '99',
      'DISPLAY': ':99',
    },
  });
  await dockerApi.removeContainer(containerId);
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
  const logLines = await dockerApi.getContainerLogs(containerId);
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

  await dockerApi.launchContainer({
    imageId: pwImage.imageId,
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
  if (!containerId)
    return;
  await dockerApi.stopContainer({
    containerId,
    waitUntil: 'removed',
  });
}

export async function ensureDockerEngineIsRunningOrDie() {
  if (await dockerApi.checkEngineRunning())
    return;
  console.error(utils.wrapInASCIIBox([
    `Docker is not running!`,
    `Please install and launch docker:`,
    ``,
    `    https://docs.docker.com/get-docker`,
    ``,
  ].join('\n'), 1));
  process.exit(1);
}

async function findDockerImage(imageName: string): Promise<dockerApi.DockerImage|undefined> {
  const images = await dockerApi.listImages();
  return images.find(image => image.names.includes(imageName));
}

async function findRunningDockerContainerId(): Promise<string|undefined> {
  const containers = await dockerApi.listContainers();
  const dockerImage = await findDockerImage(VRT_IMAGE_NAME);
  const container = dockerImage ? containers.find(container => container.imageId === dockerImage.imageId) : undefined;
  return container?.state === 'running' ? container.containerId : undefined;
}

