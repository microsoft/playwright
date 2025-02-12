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
import crypto from 'crypto';
import fs from 'fs';
import type { Server } from 'http';
import type http from 'http';
import https from 'https';
import path from 'path';
import { spawnAsync } from '../../packages/playwright-core/lib/server/utils/spawnAsync';
import { createHttpServer } from '../../packages/playwright-core/lib/server/utils/network';

const kPublicNpmRegistry = 'https://registry.npmjs.org';
const kContentTypeAbbreviatedMetadata = 'application/vnd.npm.install-v1+json';

/**
 * A minimal NPM Registry Server that can serve local packages, or proxy to the upstream registry.
 * This is useful in test installation behavior of packages that aren't yet published. It's particularly helpful
 * when your installation requires transitive dependencies that are also not yet published.
 *
 * See https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md for information on the official APIs.
 */
export class Registry {
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

    this._server = createHttpServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
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

    this._server.listen(Number.parseInt(new URL(this._url).port, 10), '127.0.0.1');
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

    const packageJson = JSON.parse((await fs.promises.readFile(path.join(tmpDir, 'package', 'package.json'), 'utf8')));
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
