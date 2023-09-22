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

import { _baseTest as _test, expect as _expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import debugLogger from 'debug';
import { Registry }  from './registry';
import { spawnAsync } from './spawnAsync';
import type { CommonFixtures, CommonWorkerFixtures } from '../config/commonFixtures';
import { commonFixtures } from '../config/commonFixtures';
import { removeFolders } from '../../packages/playwright-core/lib/utils/fileUtils';

export const TMP_WORKSPACES = path.join(os.platform() === 'darwin' ? '/tmp' : os.tmpdir(), 'pwt', 'workspaces');

const debug = debugLogger('itest');

const expect = _expect.extend({
  toHaveLoggedSoftwareDownload(received: any, browsers: ('chromium' | 'firefox' | 'webkit' | 'ffmpeg')[]) {
    if (typeof received !== 'string')
      throw new Error(`Expected argument to be a string.`);

    const downloaded = new Set();
    for (const [, browser] of received.matchAll(/^.*(chromium|firefox|webkit|ffmpeg).*playwright build v\d+\)? downloaded.*$/img))
      downloaded.add(browser.toLowerCase());

    const expected = browsers;
    if (expected.length === downloaded.size && expected.every(browser => downloaded.has(browser))) {
      return {
        pass: true,
        message: () => 'Expected not to download browsers, but did.'
      };
    }
    return {
      pass: false,
      message: () => [
        `Browser download expectation failed!`,
        ` expected: ${[...expected].sort().join(', ')}`,
        `   actual: ${[...downloaded].sort().join(', ')}`,
      ].join('\n'),
    };
  }
});

type ExecOptions = { cwd?: string, env?: Record<string, string>, message?: string, expectToExitWithError?: boolean };
type ArgsOrOptions = [] | [...string[]] | [...string[], ExecOptions] | [ExecOptions];

type NPMTestOptions = {
  useRealCDN: boolean;
};

type NPMTestFixtures = {
  _auto: void;
  _browsersPath: string;
  tmpWorkspace: string;
  installedSoftwareOnDisk: (registryPath?: string) => Promise<string[]>;
  writeConfig: (allowGlobal: boolean) => Promise<void>;
  writeFiles: (nameToContents: Record<string, string>) => Promise<void>;
  exec: (cmd: string, ...argsAndOrOptions: ArgsOrOptions) => Promise<string>;
  tsc: (...argsAndOrOptions: ArgsOrOptions) => Promise<string>;
  registry: Registry;
};

export const test = _test
    .extend<CommonFixtures, CommonWorkerFixtures>(commonFixtures)
    .extend<NPMTestFixtures & NPMTestOptions>({
      useRealCDN: [false, { option: true }],
      _browsersPath: async ({ tmpWorkspace }, use) => use(path.join(tmpWorkspace, 'browsers')),
      _auto: [async ({ tmpWorkspace, exec, _browsersPath, writeConfig }, use) => {
        await exec('npm init -y');
        const sourceDir = path.join(__dirname, 'fixture-scripts');
        const contents = await fs.promises.readdir(sourceDir);
        await Promise.all(contents.map(f => fs.promises.copyFile(path.join(sourceDir, f), path.join(tmpWorkspace, f))));

        const packages = JSON.parse((await fs.promises.readFile(path.join(__dirname, '.registry.json'), 'utf8')));
        const prefixed = Object.fromEntries(Object.entries(packages).map(entry => ([entry[0], 'file:' + entry[1]])));
        const packageJSON = JSON.parse(await fs.promises.readFile(path.join(tmpWorkspace, 'package.json'), 'utf-8'));
        packageJSON.pnpm = { overrides: prefixed };
        await fs.promises.writeFile(path.join(tmpWorkspace, 'package.json'), JSON.stringify(packageJSON, null, 2));

        await writeConfig(false);

        await use();
        if (test.info().status === test.info().expectedStatus) {
          // Browsers are large, we remove them after each test to save disk space.
          await removeFolders([_browsersPath]);
        }
      }, {
        auto: true,
      }],
      writeFiles: async ({ tmpWorkspace }, use) => {
        await use(async (nameToContents: Record<string, string>) => {
          for (const [name, contents] of Object.entries(nameToContents))
            await fs.promises.writeFile(path.join(tmpWorkspace, name), contents);
        });
      },
      tmpWorkspace: async ({}, use) => {
        // We want a location that won't have a node_modules dir anywhere along its path
        const tmpWorkspace = path.join(TMP_WORKSPACES, path.basename(test.info().outputDir));
        await fs.promises.mkdir(tmpWorkspace);
        debug(`Workspace Folder: ${tmpWorkspace}`);
        await use(tmpWorkspace);
      },
      registry: async ({}, use, testInfo) => {
        const port = testInfo.workerIndex + 16123;
        const url = `http://127.0.0.1:${port}`;
        const registry = new Registry(testInfo.outputPath('registry'), url);
        await registry.start(JSON.parse((await fs.promises.readFile(path.join(__dirname, '.registry.json'), 'utf8'))));
        await use(registry);
        await registry.shutdown();
      },
      writeConfig: async ({ tmpWorkspace, registry }, use, testInfo) => {
        await use(async (allowGlobal: boolean) => {
          const yarnLines = [
            `registry "${registry.url()}/"`,
            `cache "${testInfo.outputPath('npm_cache')}"`,
          ];
          const npmLines = [
            `registry = ${registry.url()}/`,
            `cache = ${testInfo.outputPath('npm_cache')}`,
          ];
          if (!allowGlobal) {
            yarnLines.push(`prefix "${testInfo.outputPath('npm_global')}"`);
            npmLines.push(`prefix = ${testInfo.outputPath('npm_global')}`);
          }
          await fs.promises.writeFile(path.join(tmpWorkspace, '.yarnrc'), yarnLines.join('\n'), 'utf-8');
          await fs.promises.writeFile(path.join(tmpWorkspace, '.npmrc'), npmLines.join('\n'), 'utf-8');
        });
      },
      installedSoftwareOnDisk: async ({ _browsersPath }, use) => {
        await use(async (registryPath?: string) => fs.promises.readdir(registryPath || _browsersPath).catch(() => []).then(files => files.map(f => f.split('-')[0]).filter(f => !f.startsWith('.'))));
      },
      exec: async ({ useRealCDN, tmpWorkspace, _browsersPath }, use, testInfo) => {
        await use(async (cmd: string, ...argsAndOrOptions: [] | [...string[]] | [...string[], ExecOptions] | [ExecOptions]) => {
          let args: string[] = [];
          let options: ExecOptions = {};
          if (typeof argsAndOrOptions[argsAndOrOptions.length - 1] === 'object')
            options = argsAndOrOptions.pop() as ExecOptions;

          args = argsAndOrOptions as string[];

          let result!: Awaited<ReturnType<typeof spawnAsync>>;
          await test.step(`exec: ${[cmd, ...args].join(' ')}`, async () => {
            result = await spawnAsync(cmd, args, {
              shell: true,
              cwd: options.cwd ?? tmpWorkspace,
              // NB: We end up running npm-in-npm, so it's important that we do NOT forward process.env and instead cherry-pick environment variables.
              env: {
                'PATH': process.env.PATH,
                'DISPLAY': process.env.DISPLAY,
                'XAUTHORITY': process.env.XAUTHORITY,
                'PLAYWRIGHT_BROWSERS_PATH': _browsersPath,
                ...(useRealCDN ? {} : { PLAYWRIGHT_DOWNLOAD_HOST: process.env.CDN_PROXY_HOST }),
                ...options.env,
              }
            });
          });

          const command = [cmd, ...args].join(' ');
          const stdio = result.stdout + result.stderr;
          await testInfo.attach(command, { body: `COMMAND: ${command}\n\nEXIT CODE: ${result.code}\n\n====== STDOUT + STDERR ======\n\n${stdio}` });

          // This means something is really off with spawn
          if (result.error)
            throw result.error;

          const error: string[] = [];
          if (options.expectToExitWithError && result.code === 0)
            error.push(`Expected the command to exit with an error, but exited cleanly.`);
          else if (!options.expectToExitWithError && result.code !== 0)
            error.push(`Expected the command to exit cleanly (0 status code), but exited with ${result.code}.`);

          if (!error.length)
            return stdio;

          if (options.message)
            error.push(`Message: ${options.message}`);
          error.push(`Command: ${command}`);
          error.push(`EXIT CODE: ${result.code}`);
          error.push(`====== STDIO ======\n${stdio}`);

          throw new Error(error.join('\n'));
        });
      },
      tsc: async ({ exec }, use) => {
        await exec('npm i --foreground-scripts typescript@3.8 @types/node@14');
        await use((...args: ArgsOrOptions) => exec('npx', '-p', 'typescript@4.1.6', 'tsc', ...args));
      },
    });


export { expect };
