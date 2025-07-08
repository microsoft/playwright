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
import type { CommonFixtures, CommonWorkerFixtures } from '../config/commonFixtures';
import { commonFixtures } from '../config/commonFixtures';
import { removeFolders } from '../../packages/playwright-core/lib/server/utils/fileUtils';
import { spawnAsync } from '../../packages/playwright-core/lib/server/utils/spawnAsync';
import type { SpawnOptions } from 'child_process';

export const TMP_WORKSPACES = path.join(os.platform() === 'darwin' ? '/tmp' : os.tmpdir(), 'pwt', 'workspaces');

const debug = debugLogger('itest');

const expect = _expect.extend({
  toHaveLoggedSoftwareDownload(received: string, browsers: ('chromium' | 'chromium-headless-shell' | 'firefox' | 'webkit' | 'winldd' |'ffmpeg')[]) {
    if (typeof received !== 'string')
      throw new Error(`Expected argument to be a string.`);

    const downloaded = new Set();
    let index = 0;
    while (true) {
      const match = received.substring(index).match(/(chromium|chromium headless shell|firefox|webkit|winldd|ffmpeg)[\s\d\.]+\(?playwright build v\d+\)? downloaded/im);
      if (!match)
        break;
      downloaded.add(match[1].replace(/\s/g, '-').toLowerCase());
      index += match.index + 1;
    }

    const expected = new Set(browsers);
    if (expected.size === downloaded.size && [...expected].every(browser => downloaded.has(browser))) {
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

type ExecOptions = SpawnOptions & { message?: string, expectToExitWithError?: boolean };
type ArgsOrOptions = [] | [...string[]] | [...string[], ExecOptions] | [ExecOptions];

type NPMTestOptions = {
  isolateBrowsers: boolean;
  allowGlobalInstall: boolean;
};

type NPMTestFixtures = {
  _auto: void;
  _browsersPath: string;
  tmpWorkspace: string;
  checkInstalledSoftwareOnDisk: (browsers: string[]) => Promise<void>;
  writeFiles: (nameToContents: Record<string, string>) => Promise<void>;
  exec: (cmd: string, ...argsAndOrOptions: ArgsOrOptions) => Promise<string>;
  tsc: (args: string) => Promise<string>;
  registry: Registry;
};

export const test = _test
    .extend<CommonFixtures, CommonWorkerFixtures>(commonFixtures)
    .extend<NPMTestFixtures & NPMTestOptions>({
      isolateBrowsers: [false, { option: true }],
      allowGlobalInstall: [false, { option: true }],
      _browsersPath: async ({ tmpWorkspace }, use) => use(path.join(tmpWorkspace, 'browsers')),
      _auto: [async ({ tmpWorkspace, exec, _browsersPath, registry, allowGlobalInstall }, use, testInfo) => {
        await exec('npm init -y');
        const sourceDir = path.join(__dirname, 'fixture-scripts');
        const contents = await fs.promises.readdir(sourceDir);
        await Promise.all(contents.map(f => fs.promises.copyFile(path.join(sourceDir, f), path.join(tmpWorkspace, f))));

        const packages = JSON.parse((await fs.promises.readFile(path.join(__dirname, '.registry.json'), 'utf8')));
        const prefixed = Object.fromEntries(Object.entries(packages).map(entry => ([entry[0], 'file:' + entry[1]])));
        const packageJSON = JSON.parse(await fs.promises.readFile(path.join(tmpWorkspace, 'package.json'), 'utf-8'));
        packageJSON.pnpm = { overrides: prefixed };
        await fs.promises.writeFile(path.join(tmpWorkspace, 'package.json'), JSON.stringify(packageJSON, null, 2));

        const yarnLines = [
          `registry "${registry.url()}/"`,
          `cache "${testInfo.outputPath('npm_cache')}"`,
        ];
        const npmLines = [
          `registry = ${registry.url()}/`,
          `cache = ${testInfo.outputPath('npm_cache')}`,
          // Required after https://github.com/npm/cli/pull/8185.
          'replace-registry-host=never',
        ];
        if (!allowGlobalInstall) {
          yarnLines.push(`prefix "${testInfo.outputPath('npm_global')}"`);
          npmLines.push(`prefix = ${testInfo.outputPath('npm_global')}`);
        }
        await fs.promises.writeFile(path.join(tmpWorkspace, '.yarnrc'), yarnLines.join('\n'), 'utf-8');
        await fs.promises.writeFile(path.join(tmpWorkspace, '.npmrc'), npmLines.join('\n'), 'utf-8');

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
          for (const [name, contents] of Object.entries(nameToContents)) {
            await fs.promises.mkdir(path.join(tmpWorkspace, path.dirname(name)), { recursive: true });
            await fs.promises.writeFile(path.join(tmpWorkspace, name), contents);
          }
        });
      },
      tmpWorkspace: async ({}, use) => {
        // We want a location that won't have a node_modules dir anywhere along its path
        const tmpWorkspace = path.join(TMP_WORKSPACES, path.basename(test.info().outputDir));
        await fs.promises.mkdir(tmpWorkspace, { recursive: true });
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
      checkInstalledSoftwareOnDisk: async ({ isolateBrowsers, _browsersPath }, use) => {
        await use(async expected => {
          if (!isolateBrowsers)
            throw new Error(`Test that checks browser installation must set "isolateBrowsers" to true`);
          const actual = await fs.promises.readdir(_browsersPath).catch(() => []).then(files => files.map(f => f.split('-')[0].replace(/_/g, '-')).filter(f => !f.startsWith('.')));
          expect(new Set(actual)).toEqual(new Set(expected));
        });
      },
      exec: async ({ tmpWorkspace, _browsersPath, isolateBrowsers }, use, testInfo) => {
        await use(async (cmd: string, ...argsAndOrOptions: [] | [...string[]] | [...string[], ExecOptions] | [ExecOptions]) => {
          let options: ExecOptions = {};
          if (typeof argsAndOrOptions[argsAndOrOptions.length - 1] === 'object')
            options = argsAndOrOptions.pop() as ExecOptions;

          const command = [cmd, ...argsAndOrOptions].join(' ');

          let result!: {stdout: string, stderr: string, code: number | null, error?: Error};
          const cwd = options.cwd ?? tmpWorkspace;
          // NB: We end up running npm-in-npm, so it's important that we do NOT forward process.env and instead cherry-pick environment variables.
          const PATH = sanitizeEnvPath(process.env.PATH || '');
          const env = {
            'PATH': PATH,
            'DISPLAY': process.env.DISPLAY,
            'XAUTHORITY': process.env.XAUTHORITY,
            ...(isolateBrowsers ? { PLAYWRIGHT_BROWSERS_PATH: _browsersPath } : {}),
            ...options.env,
          };
          await test.step(`exec: ${command}`, async () => {
            result = await spawnAsync(command, { shell: true, cwd, env });
          });

          const stdio = result.stdout + result.stderr;
          const commandEnv = Object.entries(env).map(e => `${e[0]}=${e[1]}`).join(' ');
          const fullCommand = `cd ${cwd} && ${commandEnv} ${command}`;
          await testInfo.attach(command, { body: `COMMAND: ${fullCommand}\n\nEXIT CODE: ${result.code}\n\n====== STDOUT + STDERR ======\n\n${stdio}` });

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
        await exec('npm i typescript@5.2.2 @types/node@18');
        await use((args: string) => exec('npx', 'tsc', args, { shell: process.platform === 'win32' }));
      },
    });

function sanitizeEnvPath(value: string) {
  if (process.platform === 'win32')
    return value.split(';').filter(path => !path.endsWith('node_modules\\.bin')).join(';');
  return value.split(':').filter(path => !path.endsWith('node_modules/.bin')).join(':');
}

export { expect };
