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
import type { Expect } from '@playwright/test';
import { test as _test, expect as _expect } from '@playwright/test';
import { spawnAsync } from 'playwright-core/lib/utils/spawnAsync';
import fs from 'fs';
import { promisify } from 'util';
import { rimraf } from 'playwright-core/lib/utilsBundle';
import path from 'path';
import os from 'os';
import type { Server } from 'http';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import type { SpawnOptions } from 'child_process';

const kPublicNpmRegistry = 'https://registry.npmjs.org';
const kContentTypeAbbreviatedMetadata = 'application/vnd.npm.install-v1+json';

/**
 * A minimal NPM Registry Server that can serve local packages, or proxy to the upstream registry.
 * This is useful in test installation behavior of packages that aren't yet published. It's particularly helpful
 * when your installation requires transitive dependencies that are also not yet published.
 *
 * See https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md for information on the offical APIs.
 */

_expect.extend({
  toHaveDownloaded(received: any, browsers: ('chromium' | 'firefox' | 'webkit')[]) {
    if (!(received instanceof ExecOutput))
      throw new Error(`Expected ExecOutput instance.`);

    const downloaded = new Set();
    for (const [, browser] of received.combined().matchAll(/^.*(chromium|firefox|webkit) v\d+ downloaded.*$/img))
      downloaded.add(browser);
    try {
      const expected = [...browsers];
      browsers.sort();
      const actual = [...downloaded];
      actual.sort();
      _expect(actual).toEqual(expected);
    } catch (err) {
      return {
        message: () => `Browser download expectation failed:\n${err.toString()}`,
        pass: false,
      };
    }

    return {
      pass: true,
    };
  }
});

interface CustomExpect extends Expect {
    (output: ExecOutput): {
        toHaveDownloaded(browsers: ('chromium'|'firefox'|'webkit')[]): void;
        toExitCleanly(): void;
    };
}

const expect = _expect as CustomExpect;

class Registry {
  private _workDir: string;
  private _url: string;
  private _objectsDir: string;
  private _packageMeta: Map<string, [any, string]> = new Map();
  private _log: { pkg: string, status: 'PROXIED' | 'LOCAL', type?: 'tar' | 'metadata' }[] = [];
  private _server: Server;

  constructor(workDir: string, url: string) {
    this._workDir = workDir;
    this._objectsDir = path.join(this._workDir);
    this._url = url;
  }

  url() { return this._url; }

  async shutdown() {
    return new Promise<void>((res, rej) => this._server.close(err => err ? rej(err) : res()));
  }

  async start(packages: { [pkg: string]: string }) {
    await fs.promises.mkdir(this._workDir, { recursive: true });
    await fs.promises.mkdir(this._objectsDir, { recursive: true });

    await Promise.all(Object.entries(packages).map(([pkg, tar]) => this._addPackage(pkg, tar)));

    this._server = http.createServer(async (req, res) => {
      // 1. Only support GET requests
      if (req.method !== 'GET')
        return res.writeHead(405).end();

      // 2. Determine what package is being asked for.
      //    The paths we can handle look like:
      //    - /<userSuppliedPackageName>/*/<userSuppliedTarName i.e. some *.tgz>
      //    - /<userSuppliedPackageName>/*
      //    - /<userSuppliedPackageName>
      const url = new URL(req.url, kPublicNpmRegistry);
      let [/* empty */, userSuppliedPackageName, /* empty */, userSuppliedTarName] = url.pathname.split('/');
      if (userSuppliedPackageName)
        userSuppliedPackageName = decodeURIComponent(userSuppliedPackageName);
      if (userSuppliedTarName)
        userSuppliedTarName = decodeURIComponent(userSuppliedTarName);

      // 3. If we have local metadata, serve directly (otherwise, proxy to upstream).
      if (this._packageMeta.has(userSuppliedPackageName)) {
        const [metadata, objectPath] = this._packageMeta.get(userSuppliedPackageName);
        if (userSuppliedTarName) { // Tarball request.
          if (path.basename(objectPath) !== userSuppliedTarName) {
            res.writeHead(404).end();
            return;
          }
          this._logAccess({ status: 'LOCAL', type: 'tar', pkg: userSuppliedPackageName });
          const fileStream = fs.createReadStream(objectPath);
          fileStream.pipe(res, { end: true });
          fileStream.on('error', console.log);
          res.on('error', console.log);
          return;
        } else { // Metadata request.
          this._logAccess({ status: 'LOCAL', type: 'metadata', pkg: userSuppliedPackageName });
          res.setHeader('content-type', kContentTypeAbbreviatedMetadata);
          res.write(JSON.stringify(metadata, null, ' '));
          res.end();
        }
      } else { // Fall through to official registry
        this._logAccess({ status: 'PROXIED', pkg: userSuppliedPackageName });
        const client = { req, res };
        const toNpm = https.request({
          host: url.host,
          headers: { ...req.headers, 'host': url.host },
          method: req.method,
          path: url.pathname,
          searchParams: url.searchParams,
          protocol: 'https:',
        }, fromNpm => {
          client.res.writeHead(fromNpm.statusCode, fromNpm.statusMessage, fromNpm.headers);
          fromNpm.on('error', err => console.log(`error: `, err));
          fromNpm.pipe(client.res, { end: true });
        });
        client.req.pipe(toNpm);
        client.req.on('error', err => console.log(`error: `, err));
      }
    });

    this._server.listen(Number.parseInt(new URL(this._url).port, 10), 'localhost');
    await new Promise<void>((res, rej) => {
      this._server.on('listening', () => res());
      this._server.on('error', rej);
    });
  }

  public assertLocalPackage(pkg) {
    const summary = this._log.reduce((acc, f) => {
      if (f.pkg === pkg) {
        acc.local = f.status === 'LOCAL' || acc.local;
        acc.proxied = f.status === 'PROXIED' || acc.proxied;
      }

      return acc;
    }, { local: false, proxied: false });

    if (summary.local && !summary.proxied)
      return;

    throw new Error(`${pkg} was not accessed strictly locally: local: ${summary.local}, proxied: ${summary.proxied}`);
  }

  private async _addPackage(pkg: string, tarPath: string) {
    const tmpDir = await fs.promises.mkdtemp(path.join(this._workDir, '.staging-package-'));
    const { stderr, code } = await spawnAsync('tar', ['-xvzf', tarPath, '-C', tmpDir]);
    if (!!code)
      throw new Error(`Failed to untar ${pkg}: ${stderr}`);

    const packageJson = JSON.parse((await fs.promises.readFile(path.join(tmpDir, 'package', 'package.json'))).toString());
    if (pkg !== packageJson.name)
      throw new Error(`Package name mismatch: ${pkg} is called ${packageJson.name} in its package.json`);

    const now = new Date().toISOString();
    const shasum = crypto.createHash('sha1').update(await fs.promises.readFile(tarPath)).digest().toString('hex');
    const tarball = new URL(this._url);
    tarball.pathname = `${tarball.pathname}${tarball.pathname.endsWith('/') ? '' : '/'}${encodeURIComponent(pkg)}/-/${shasum}.tgz`;
    const metadata = {
      'dist-tags': {
        latest: packageJson.version,
        [packageJson.version]: packageJson.version,
      },
      'modified': now,
      'name': pkg,
      'versions': {
        [packageJson.version]: {
          _hasShrinkwrap: false,
          name: pkg,
          version: packageJson.version,
          dependencies: packageJson.dependencies || {},
          optionalDependencies: packageJson.optionalDependencies || {},
          devDependencies: packageJson.devDependencies || {},
          bundleDependencies: packageJson.bundleDependencies || {},
          peerDependencies: packageJson.peerDependencies || {},
          bin: packageJson.bin || {},
          directories: packageJson.directories || [],
          scripts: packageJson.scripts || {},
          dist: {
            tarball: tarball.toString(),
            shasum,
          },
          engines: packageJson.engines || {},
        },
      },
    };

    const object = path.join(this._objectsDir, `${shasum}.tgz`);
    await fs.promises.copyFile(tarPath, object);
    this._packageMeta.set(pkg, [metadata, object]);
  }

  private _logAccess(info: {status: 'PROXIED' | 'LOCAL', pkg: string, type?: 'tar' | 'metadata'}) {
    this._log.push(info);
  }
}

export type SpawnResult = {
  stdout: string,
  stderr: string,
  code: number,
  error?: any,
};

export class ExecOutput {
  public readonly raw: SpawnResult;

  constructor(result: SpawnResult) {
    this.raw = result;
  }

  combined() {
    return `${this.raw.stdout}\n${this.raw.stderr}\n`;
  }
}

export const test = _test.extend<{
    _autoCopyScripts: void,
    envOverrides: Record<string, string>;
    tmpWorkspace: string,
    nodeVersion: number,
    writeFiles: (nameToContents: Record<string, string>) => Promise<void>,
    exec: (cmd: string, args: string[], fixtureOverrides?: SpawnOptions) => Promise<ExecOutput>
    npm: (...args: string[]) => Promise<ExecOutput>,
    npx: (...args: string[]) => Promise<ExecOutput>,
    tsc: (...args: string[]) => Promise<ExecOutput>,
    registry: Registry,
        }>({
          _autoCopyScripts: [async ({ tmpWorkspace }, use) => {
            const dstDir = path.join(tmpWorkspace);
            const sourceDir = path.join(__dirname, 'fixture-scripts');
            const contents = await fs.promises.readdir(sourceDir);
            await Promise.all(contents.map(f => fs.promises.copyFile(path.join(sourceDir, f), path.join(dstDir, f))));
            await use();
          }, {
            auto: true,
          }],
          nodeVersion: async ({}, use) => {
            await use(+process.versions.node.split('.')[0]);
          },
          writeFiles: async ({ tmpWorkspace }, use) => {
            await use(async (nameToContents: Record<string, string>) => {
              for (const [name, contents] of Object.entries(nameToContents))
                await fs.promises.writeFile(path.join(tmpWorkspace, name), contents);
            });
          },
          envOverrides: async ({}, use) => {
            await use({});
          },
          tmpWorkspace: async ({}, use) => {
            // We want a location that won't have a node_modules dir anywhere along its path
            const tmpWorkspace = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-installation-tests-workspace-'));
            await use(tmpWorkspace);
            await promisify(rimraf)(tmpWorkspace);
          },
          registry: async ({}, use, testInfo) => {
            const port = testInfo.workerIndex + 16123;
            const url = `http://localhost:${port}`;
            const registry = new Registry(testInfo.outputPath('registry'), url);
            await registry.start(JSON.parse((await fs.promises.readFile(path.join(__dirname, './registry.json'))).toString()));
            await use(registry);
            await registry.shutdown();
          },
          exec: async ({ registry, tmpWorkspace, envOverrides }, use, testInfo) => {
            await use(async (cmd: string, args: string[], fixtureOverrides?: SpawnOptions) => {
              const result = new ExecOutput(await spawnAsync(cmd, args, {
                shell: true,
                cwd: tmpWorkspace,
                env: {
                  ...process.env,
                  'PLAYWRIGHT_BROWSERS_PATH': path.join(tmpWorkspace, 'browsers'),
                  'npm_config_cache': testInfo.outputPath('npm_cache'),
                  'npm_config_registry': registry.url(),
                  'npm_config_prefix': testInfo.outputPath('npm_global'),
                  ...envOverrides,
                },
                ...fixtureOverrides }));

              if (result.raw.code)
                throw result;

              return result;
            });
          },
          tsc: async ({ npm, npx }, use) => {
            await npm('i', '--foreground-scripts', 'typescript@3.8', '@types/node@14');
            await use((...args: string[]) => npx('-p', 'typescript@3.8', 'tsc', ...args));
          },
          npm: async ({ exec }, use) => {
            await use((...args) => exec('npm', args));
          },
          npx: async ({ exec }, use) => {
            await use((...args) => exec('npx', ['--yes', ...args]));
          },
        });


export { expect };
