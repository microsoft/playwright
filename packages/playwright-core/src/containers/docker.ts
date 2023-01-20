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
import { getPlaywrightVersion, getUserAgent } from '../utils/userAgent';
import { urlToWSEndpoint } from '../server/dispatchers/localUtilsDispatcher';
import { WebSocketTransport } from '../server/transport';
import { SocksInterceptor } from '../server/socksInterceptor';
import * as dockerApi from './dockerApi';
import type { Command } from '../utilsBundle';
import * as playwright from '../..';

const VRT_IMAGE_DISTRO = 'focal';
const VRT_IMAGE_NAME = `playwright:local-${getPlaywrightVersion()}-${VRT_IMAGE_DISTRO}`;
const VRT_CONTAINER_NAME = `playwright-${getPlaywrightVersion()}-${VRT_IMAGE_DISTRO}`;
const VRT_CONTAINER_LABEL_NAME = 'dev.playwright.vrt-service.version';
const VRT_CONTAINER_LABEL_VALUE = '1';

async function startPlaywrightContainer(port: number) {
  await checkDockerEngineIsRunningOrDie();

  await stopAllPlaywrightContainers();

  process.stdout.write(`Starting docker container... `);
  const time = Date.now();
  const info = await ensurePlaywrightContainerOrDie(port);
  const deltaMs = (Date.now() - time);
  console.log('Done in ' + (deltaMs / 1000).toFixed(1) + 's');
  await tetherHostNetwork(info.httpEndpoint);
  console.log('Endpoint:', info.httpEndpoint);
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

  // 1. Build or pull base image.
  let baseImageName = process.env.PWTEST_DOCKER_BASE_IMAGE || '';
  if (!baseImageName) {
    const isDevelopmentMode = getPlaywrightVersion().includes('next');
    if (isDevelopmentMode) {
      // Use our docker build scripts in development mode!
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
    baseImageName = `mcr.microsoft.com/playwright:v${getPlaywrightVersion()}-${VRT_IMAGE_DISTRO}`;
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
  httpEndpoint: string;
}

async function printDockerStatus() {
  const isDockerEngine = await dockerApi.checkEngineRunning();
  const imageIsPulled = isDockerEngine && !!(await findDockerImage(VRT_IMAGE_NAME));
  const info = isDockerEngine ? await containerInfo() : undefined;
  console.log(JSON.stringify({
    dockerEngineRunning: isDockerEngine,
    imageName: VRT_IMAGE_NAME,
    imageIsPulled,
    containerEndpoint: info?.httpEndpoint ?? '',
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
  const REVERSE_PROXY_LINE_PREFIX = 'Playwright container listening on';
  const webSocketLine = logLines.find(line => line.startsWith(WS_LINE_PREFIX));
  const reverseProxyLine = logLines.find(line => line.startsWith(REVERSE_PROXY_LINE_PREFIX));
  if (!webSocketLine || !reverseProxyLine)
    return undefined;
  const httpEndpoint = containerUrlToHostUrl('http://127.0.0.1:' + reverseProxyLine.substring(REVERSE_PROXY_LINE_PREFIX.length).trim());
  return httpEndpoint ? { httpEndpoint } : undefined;
}

export async function ensurePlaywrightContainerOrDie(port: number): Promise<ContainerInfo> {
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

  const env: Record<string, string | undefined> = {
    DEBUG: process.env.DEBUG,
  };
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('PLAYWRIGHT_'))
      env[key] = value;
  }
  await dockerApi.launchContainer({
    imageId: pwImage.imageId,
    name: VRT_CONTAINER_NAME,
    autoRemove: true,
    ports: [
      { container: 5400, host: port },
    ],
    labels: {
      [VRT_CONTAINER_LABEL_NAME]: VRT_CONTAINER_LABEL_VALUE,
    },
    env,
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

async function tetherHostNetwork(endpoint: string) {
  const wsEndpoint = await urlToWSEndpoint(undefined /* progress */, endpoint);

  const headers: any = {
    'User-Agent': getUserAgent(),
    'x-playwright-network-tethering': '1',
    'x-playwright-proxy': '*',
  };
  const transport = await WebSocketTransport.connect(undefined /* progress */, wsEndpoint, headers, true /* followRedirects */);
  const socksInterceptor = new SocksInterceptor(transport, '*', undefined);
  transport.onmessage = json => socksInterceptor.interceptMessage(json);
  transport.onclose = () => {
    socksInterceptor.cleanup();
  };
  await transport.send({
    id: 1,
    guid: '',
    method: 'initialize',
    params: {
      'sdkLanguage': 'javascript'
    },
    metadata: {
      stack: [],
      apiName: '',
      internal: true
    },
  } as any);
}

export function addDockerCLI(program: Command) {
  const dockerCommand = program.command('docker', { hidden: true })
      .description(`Manage Docker integration (EXPERIMENTAL)`);

  dockerCommand.command('build')
      .description('build local docker image')
      .action(async function(options) {
        try {
          await buildPlaywrightImage();
        } catch (e) {
          console.error(e.stack ? e : e.message);
          process.exit(1);
        }
      });

  dockerCommand.command('start')
      .description('start docker container')
      .option('--port <port>', 'port to start container on. Auto-pick by default')
      .action(async function(options) {
        try {
          const port = options.port ? +options.port : 0;
          if (isNaN(port)) {
            console.error(`ERROR: bad port number "${options.port}"`);
            process.exit(1);
          }
          await startPlaywrightContainer(port);
        } catch (e) {
          console.error(e.stack ? e : e.message);
          process.exit(1);
        }
      });

  dockerCommand.command('stop')
      .description('stop docker container')
      .action(async function(options) {
        try {
          await stopAllPlaywrightContainers();
        } catch (e) {
          console.error(e.stack ? e : e.message);
          process.exit(1);
        }
      });

  dockerCommand.command('delete-image', { hidden: true })
      .description('delete docker image, if any')
      .action(async function(options) {
        try {
          await deletePlaywrightImage();
        } catch (e) {
          console.error(e.stack ? e : e.message);
          process.exit(1);
        }
      });

  dockerCommand.command('install-server-deps', { hidden: true })
      .description('install run-server dependencies')
      .action(async function() {
        const { code } = await spawnAsync('bash', [path.join(__dirname, '..', '..', 'bin', 'container_install_deps.sh')], { stdio: 'inherit' });
        if (code !== 0)
          throw new Error('Failed to install server dependencies!');
      });

  dockerCommand.command('run-server', { hidden: true })
      .description('run playwright server')
      .action(async function() {
        await spawnAsync('bash', [path.join(__dirname, '..', '..', 'bin', 'container_run_server.sh')], { stdio: 'inherit' });
      });

  dockerCommand.command('print-status-json', { hidden: true })
      .description('print docker status')
      .action(async function(options) {
        await printDockerStatus();
      });

  dockerCommand.command('launch', { hidden: true })
      .description('launch browser in container')
      .option('--browser <name>', 'browser to launch')
      .option('--endpoint <url>', 'server endpoint')
      .action(async function(options: { browser: string, endpoint: string }) {
        let browserType: playwright.BrowserType | undefined;
        if (options.browser === 'chromium')
          browserType = playwright.chromium;
        else if (options.browser === 'firefox')
          browserType = playwright.firefox;
        else if (options.browser === 'webkit')
          browserType = playwright.webkit;
        if (!browserType) {
          console.error('Unknown browser name: ', options.browser);
          process.exit(1);
        }
        const browser = await browserType.connect(options.endpoint, {
          headers: {
            'x-playwright-launch-options': JSON.stringify({
              headless: false,
              viewport: null,
            }),
          },
          _exposeNetwork: '*',
        } as any);
        const context = await browser.newContext();
        context.on('page', (page: playwright.Page) => {
          page.on('dialog', () => {});  // Prevent dialogs from being automatically dismissed.
          page.once('close', () => {
            const hasPage = browser.contexts().some((context: playwright.BrowserContext) => context.pages().length > 0);
            if (hasPage)
              return;
            // Avoid the error when the last page is closed because the browser has been closed.
            browser.close().catch((e: Error) => null);
          });
        });
        await context.newPage();
      });

  dockerCommand.command('tether', { hidden: true })
      .description('tether local network to the playwright server')
      .option('--endpoint <url>', 'server endpoint')
      .action(async function(options: { endpoint: string }) {
        await tetherHostNetwork(options.endpoint);
      });
}
