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
import * as utils from '../utils';
import { getPlaywrightVersion } from '../common/userAgent';
import * as dockerApi from './dockerApi';
import type { Command } from '../utilsBundle';

const VRT_IMAGE_DISTRO = 'focal';
const VRT_IMAGE_NAME = `playwright:local-${getPlaywrightVersion()}-${VRT_IMAGE_DISTRO}`;
const VRT_CONTAINER_NAME = `playwright-${getPlaywrightVersion()}-${VRT_IMAGE_DISTRO}`;
const VRT_CONTAINER_LABEL_NAME = 'dev.playwright.vrt-service.version';
const VRT_CONTAINER_LABEL_VALUE = '1';

async function startPlaywrightContainer() {
  await checkDockerEngineIsRunningOrDie();

  let info = await containerInfo();
  if (!info) {
    process.stdout.write(`Starting docker container... `);
    const time = Date.now();
    info = await ensurePlaywrightContainerOrDie();
    const deltaMs = (Date.now() - time);
    console.log('Done in ' + (deltaMs / 1000).toFixed(1) + 's');
  }
  console.log([
    `- View screen:`,
    `      ${info.vncSession}`,
    `- Run tests with browsers inside container:`,
    `      npx playwright docker test`,
    `- Stop background container *manually* when you are done working with tests:`,
    `      npx playwright docker stop`,
  ].join('\n'));
}

async function stopAllPlaywrightContainers() {
  await checkDockerEngineIsRunningOrDie();

  const allContainers = await dockerApi.listContainers();
  const vrtContainers = allContainers.filter(container => container.labels[VRT_CONTAINER_LABEL_NAME] === VRT_CONTAINER_LABEL_VALUE);
  await Promise.all(vrtContainers.map(container => dockerApi.stopContainer({
    containerId: container.containerId,
    waitUntil: 'removed',
  })));
}

async function deletePlaywrightImage() {
  await checkDockerEngineIsRunningOrDie();

  const dockerImage = await findDockerImage(VRT_IMAGE_NAME);
  if (!dockerImage)
    return;

  if (await containerInfo())
    await stopAllPlaywrightContainers();
  await dockerApi.removeImage(dockerImage.imageId);
}

async function buildPlaywrightImage() {
  await checkDockerEngineIsRunningOrDie();

  const isDevelopmentMode = getPlaywrightVersion().includes('next');
  let baseImageName = `mcr.microsoft.com/playwright:v${getPlaywrightVersion()}-${VRT_IMAGE_DISTRO}`;
  // 1. Build or pull base image.
  if (isDevelopmentMode) {
    // Use our docker build scripts in development mode!
    if (!process.env.PWTEST_DOCKER_BASE_IMAGE) {
      const arch = process.arch === 'arm64' ? '--arm64' : '--amd64';
      throw createStacklessError(utils.wrapInASCIIBox([
        `You are in DEVELOPMENT mode!`,
        ``,
        `1. Build local base image`,
        `     ./utils/docker/build.sh ${arch} ${VRT_IMAGE_DISTRO} playwright:localbuild`,
        `2. Use the local base to build VRT image:`,
        `     PWTEST_DOCKER_BASE_IMAGE=playwright:localbuild npx playwright docker build`,
      ].join('\n'), 1));
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
  // 3. Delete previous build of the playwright image to avoid untagged images.
  await deletePlaywrightImage();
  // 4. Launch container and install VNC in it
  console.log(`Building ${VRT_IMAGE_NAME}...`);
  const containerId = await dockerApi.launchContainer({
    imageId: dockerImage.imageId,
    autoRemove: false,
    workingDir: '/ms-playwright-agent',
    command: ['npx', 'playwright', 'docker', 'install-server-deps'],
    waitUntil: 'not-running',
  });

  // 4. Commit a new image based on the launched container with installed VNC & noVNC.
  const [vrtRepo, vrtTag] = VRT_IMAGE_NAME.split(':');
  await dockerApi.commitContainer({
    containerId,
    repo: vrtRepo,
    tag: vrtTag,
    workingDir: '/ms-playwright-agent',
    entrypoint: ['npx', 'playwright', 'docker', 'run-server'],
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

async function printDockerStatus() {
  const isDockerEngine = await dockerApi.checkEngineRunning();
  const imageIsPulled = isDockerEngine && !!(await findDockerImage(VRT_IMAGE_NAME));
  const info = isDockerEngine ? await containerInfo() : undefined;
  console.log(JSON.stringify({
    dockerEngineRunning: isDockerEngine,
    imageName: VRT_IMAGE_NAME,
    imageIsPulled,
    containerWSEndpoint: info?.wsEndpoint ?? '',
    containerVNCEndpoint: info?.vncSession ?? '',
  }, null, 2));
}

export async function containerInfo(): Promise<ContainerInfo|undefined> {
  const allContainers = await dockerApi.listContainers();
  const pwDockerImage = await findDockerImage(VRT_IMAGE_NAME);
  const container = allContainers.find(container => container.imageId === pwDockerImage?.imageId && container.state === 'running');
  if (!container)
    return undefined;
  const logLines = await dockerApi.getContainerLogs(container.containerId);

  const containerUrlToHostUrl = (address: string) => {
    const url = new URL(address);
    const portBinding = container.portBindings.find(binding => binding.containerPort === +url.port);
    if (!portBinding)
      return undefined;

    url.host = portBinding.ip;
    url.port = portBinding.hostPort + '';
    return url.toString();
  };

  const WS_LINE_PREFIX = 'Listening on ws://';
  const webSocketLine = logLines.find(line => line.startsWith(WS_LINE_PREFIX));
  const NOVNC_LINE_PREFIX = 'novnc is listening on ';
  const novncLine = logLines.find(line => line.startsWith(NOVNC_LINE_PREFIX));
  if (!novncLine || !webSocketLine)
    return undefined;
  const wsEndpoint = containerUrlToHostUrl('ws://' + webSocketLine.substring(WS_LINE_PREFIX.length));
  const vncSession = containerUrlToHostUrl(novncLine.substring(NOVNC_LINE_PREFIX.length));
  return wsEndpoint && vncSession ? { wsEndpoint, vncSession } : undefined;
}

export async function ensurePlaywrightContainerOrDie(): Promise<ContainerInfo> {
  const pwImage = await findDockerImage(VRT_IMAGE_NAME);
  if (!pwImage) {
    throw createStacklessError('\n' + utils.wrapInASCIIBox([
      `Failed to find local docker image.`,
      `Please build local docker image with the following command:`,
      ``,
      `    npx playwright docker build`,
      ``,
      `<3 Playwright Team`,
    ].join('\n'), 1));
  }

  let info = await containerInfo();
  if (info)
    return info;

  // The `npx playwright docker build` command is *NOT GUARANTEED* to produce
  // images with the same SHA.
  //
  // Consider the following sequence of actions:
  // 1. Build first version of image: `npx playwright docker build`
  // 2. Run container off the image: `npx playwright docker start`
  // 3. Build second version of image: `npx playwright docker build`
  //
  // Our container auto-detection is based on the parent image SHA.
  // If the image produced at Step 3 has a different SHA then the one produced on Step 1,
  // then we **won't be able** to auto-detect the container from Step 2.
  //
  // Additionally, we won't be able to launch a new container based off image
  // from Step 3, since it will have a conflicting container name.
  //
  // We check if there's a same-named container running to detect & handle this situation.
  const hasSameNamedContainer = async () => (await dockerApi.listContainers()).some(container => container.names.includes(VRT_CONTAINER_NAME));
  if (await hasSameNamedContainer()) {
    // Since we mark all our containers with labels, we'll be able to stop it.
    await stopAllPlaywrightContainers();
    // If it wasn't our container, then it was launched manually and has to be
    // stopped manually as well.
    if (await hasSameNamedContainer()) {
      throw createStacklessError('\n' + utils.wrapInASCIIBox([
        `There is already a container with name ${VRT_CONTAINER_NAME}`,
        `Please stop this container manually and rerun tests:`,
        ``,
        `    docker kill ${VRT_CONTAINER_NAME}`,
        ``,
        `<3 Playwright Team`,
      ].join('\n'), 1));
    }
  }

  await dockerApi.launchContainer({
    imageId: pwImage.imageId,
    name: VRT_CONTAINER_NAME,
    autoRemove: true,
    ports: [5400, 7900],
    labels: {
      [VRT_CONTAINER_LABEL_NAME]: VRT_CONTAINER_LABEL_VALUE,
    },
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

export async function checkDockerEngineIsRunningOrDie() {
  if (await dockerApi.checkEngineRunning())
    return;
  throw createStacklessError(utils.wrapInASCIIBox([
    `Docker is not running!`,
    `Please install and launch docker:`,
    ``,
    `    https://docs.docker.com/get-docker`,
    ``,
  ].join('\n'), 1));
}

async function findDockerImage(imageName: string): Promise<dockerApi.DockerImage|undefined> {
  const images = await dockerApi.listImages();
  return images.find(image => image.names.includes(imageName));
}

function createStacklessError(message: string) {
  const error = new Error(message);
  error.stack = '';
  return error;
}

export function addDockerCLI(program: Command) {
  const dockerCommand = program.command('docker')
      .description(`Manage Docker integration (EXPERIMENTAL)`);

  dockerCommand.command('build')
      .description('build local docker image')
      .action(async function(options) {
        try {
          await buildPlaywrightImage();
        } catch (e) {
          console.error(e.stack ? e : e.message);
        }
      });

  dockerCommand.command('start')
      .description('start docker container')
      .action(async function(options) {
        try {
          await startPlaywrightContainer();
        } catch (e) {
          console.error(e.stack ? e : e.message);
        }
      });

  dockerCommand.command('stop')
      .description('stop docker container')
      .action(async function(options) {
        try {
          await stopAllPlaywrightContainers();
        } catch (e) {
          console.error(e.stack ? e : e.message);
        }
      });

  dockerCommand.command('delete-image', { hidden: true })
      .description('delete docker image, if any')
      .action(async function(options) {
        try {
          await deletePlaywrightImage();
        } catch (e) {
          console.error(e.stack ? e : e.message);
        }
      });

  dockerCommand.command('install-server-deps', { hidden: true })
      .description('delete docker image, if any')
      .action(async function() {
        const { code } = await spawnAsync('bash', [path.join(__dirname, '..', '..', 'bin', 'container_install_deps.sh')], { stdio: 'inherit' });
        if (code !== 0)
          throw new Error('Failed to install server dependencies!');
      });

  dockerCommand.command('run-server', { hidden: true })
      .description('delete docker image, if any')
      .action(async function() {
        await spawnAsync('bash', [path.join(__dirname, '..', '..', 'bin', 'container_run_server.sh')], { stdio: 'inherit' });
      });

  dockerCommand.command('print-status-json', { hidden: true })
      .description('print docker status')
      .action(async function(options) {
        await printDockerStatus();
      });
}
