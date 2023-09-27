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

import http from 'http';
import https from 'https';
import url from 'url';
import type net from 'net';
import debugLogger from 'debug';
import path from 'path';
import fs from 'fs';
import { spawnAsync } from '../../packages/playwright-core/lib/utils/spawnAsync';
import { rimraf } from 'playwright-core/lib/utilsBundle';
import { TMP_WORKSPACES } from './npmTest';
import { createHttpServer } from '../../packages/playwright-core/lib/utils/network';
import { calculateSha1 } from '../../packages/playwright-core/lib/utils/crypto';

const PACKAGE_BUILDER_SCRIPT = path.join(__dirname, '..', '..', 'utils', 'pack_package.js');
const BROWSERS_CACHE_DIR = path.join(TMP_WORKSPACES, 'npm-test-browsers-cache');
const debug = debugLogger('itest');

async function globalSetup() {
  await rimraf(TMP_WORKSPACES);
  console.log(`Temporary workspaces will be created in ${TMP_WORKSPACES}. They will not be removed at the end. Set DEBUG=itest to determine which sub-dir a specific test is using.`);
  await fs.promises.mkdir(TMP_WORKSPACES, { recursive: true });

  if (process.env.PWTEST_INSTALLATION_TEST_SKIP_PACKAGE_BUILDS) {
    console.log('Skipped building packages. Unset PWTEST_INSTALLATION_TEST_SKIP_PACKAGE_BUILDS to build packages.');
  } else {
    console.log('Building packages. Set PWTEST_INSTALLATION_TEST_SKIP_PACKAGE_BUILDS to skip.');
    const outputDir = path.join(__dirname, 'output');
    await rimraf(outputDir);
    await fs.promises.mkdir(outputDir, { recursive: true });

    const build = async (buildTarget: string, pkgNameOverride?: string) => {
      const outPath = path.resolve(path.join(outputDir, `${buildTarget}.tgz`));
      const { code, stderr, stdout } = await spawnAsync('node', [PACKAGE_BUILDER_SCRIPT, buildTarget, outPath]);
      if (!!code)
        throw new Error(`Failed to build: ${buildTarget}:\n${stderr}\n${stdout}`);
      console.log('Built:', pkgNameOverride || buildTarget);
      return [pkgNameOverride || buildTarget, outPath];
    };

    const builds = await Promise.all([
      build('playwright-core'),
      build('playwright-test', '@playwright/test'),
      build('playwright'),
      build('playwright-chromium'),
      build('playwright-firefox'),
      build('playwright-webkit'),
      build('playwright-browser-chromium', '@playwright/browser-chromium'),
      build('playwright-browser-firefox', '@playwright/browser-firefox'),
      build('playwright-browser-webkit', '@playwright/browser-webkit'),
    ]);

    const buildPlaywrightTestPlugin = async () => {
      const cwd = path.resolve(path.join(__dirname, `playwright-test-plugin`));
      const tscResult = await spawnAsync('npx', ['tsc', '-p', 'tsconfig.json'], { cwd, shell: process.platform === 'win32' });
      if (tscResult.code)
        throw new Error(`Failed to build playwright-test-plugin:\n${tscResult.stderr}\n${tscResult.stdout}`);
      const packResult = await spawnAsync('npm', ['pack'], { cwd, shell: process.platform === 'win32' });
      if (packResult.code)
        throw new Error(`Failed to build playwright-test-plugin:\n${packResult.stderr}\n${packResult.stdout}`);
      const tgzName = packResult.stdout.trim();
      const outPath = path.resolve(path.join(outputDir, `playwright-test-plugin.tgz`));
      await fs.promises.rename(path.join(cwd, tgzName), outPath);
      console.log('Built playwright-test-plugin');
      return ['playwright-test-plugin', outPath];
    };
    builds.push(await buildPlaywrightTestPlugin());

    await fs.promises.writeFile(path.join(__dirname, '.registry.json'), JSON.stringify(Object.fromEntries(builds)));
  }

  const cdnProxyServer = createHttpServer(async (request: http.IncomingMessage, response: http.ServerResponse) => {
    const requestedPath = url.parse(request.url!).path;
    const cachedPath = path.join(BROWSERS_CACHE_DIR, calculateSha1(requestedPath));
    const cachedPathMetaInfo = cachedPath + '.metainfo';

    if (!fs.existsSync(cachedPath)) {
      const realUrl = 'https://playwright.azureedge.net' + requestedPath;
      debug(`[cdn proxy] downloading ${realUrl} headers=${JSON.stringify(request.headers)}`);
      const headers = { ...request.headers };
      delete headers['host'];
      const options = {
        ...url.parse(realUrl),
        method: request.method,
        headers,
      };
      const factory = options.protocol === 'https:' ? https : http;
      let doneCallback = () => {};
      const donePromise = new Promise<void>(f => doneCallback = () => {
        debug(`[cdn proxy] downloading ${realUrl} finished`);
        f();
      });
      const realRequest = factory.request(options, (realResponse: http.IncomingMessage) => {
        const metaInfo = {
          statusCode: realResponse.statusCode,
          statusMessage: realResponse.statusMessage || '',
          headers: realResponse.headers || {},
        };
        debug(`[cdn proxy] downloading ${realUrl} statusCode=${realResponse.statusCode}`);
        fs.mkdirSync(path.dirname(cachedPathMetaInfo), { recursive: true });
        fs.writeFileSync(cachedPathMetaInfo, JSON.stringify(metaInfo));
        realResponse.pipe(fs.createWriteStream(cachedPath, { highWaterMark: 1024 * 1024 })).on('close', doneCallback).on('finish', doneCallback).on('error', doneCallback);
      });
      request.pipe(realRequest);
      await donePromise;
    }

    const metaInfo = JSON.parse(fs.readFileSync(cachedPathMetaInfo, 'utf-8'));
    response.writeHead(metaInfo.statusCode, metaInfo.statusMessage, metaInfo.headers);
    const done = () => {
      debug(`[cdn proxy] serving ${request.url!} finished`);
      response.end();
    };
    fs.createReadStream(cachedPath, { highWaterMark: 1024 * 1024 }).pipe(response).on('close', done).on('error', done);
    debug(`[cdn proxy] serving ${request.url!} from cached ${cachedPath}`);
  });

  cdnProxyServer.listen(0);
  await new Promise(f => cdnProxyServer.once('listening', f));
  process.env.CDN_PROXY_HOST = `http://127.0.0.1:${(cdnProxyServer.address() as net.AddressInfo).port}`;
  console.log('Stared CDN proxy at ' + process.env.CDN_PROXY_HOST);

  return async () => {
    await new Promise(f => cdnProxyServer.close(f));
  };
}

export default globalSetup;
