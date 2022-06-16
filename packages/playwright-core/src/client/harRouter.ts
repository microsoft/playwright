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

import fs from 'fs';
import type { HAREntry, HARFile } from '../../types/types';
import { debugLogger } from '../common/debugLogger';
import { rewriteErrorMessage } from '../utils/stackTrace';
import { ZipFile } from '../utils/zipFile';
import type { BrowserContext } from './browserContext';
import { Events } from './events';
import type { Route } from './network';
import type { BrowserContextOptions } from './types';

type HarOptions = NonNullable<BrowserContextOptions['har']>;

export class HarRouter {
  private _pattern: string | RegExp;
  private _harFile: HARFile;
  private _zipFile: ZipFile | null;
  private _options: HarOptions | undefined;

  static async create(options: HarOptions): Promise<HarRouter> {
    if (options.path.endsWith('.zip')) {
      const zipFile = new ZipFile(options.path);
      const har = await zipFile.read('har.har');
      const harFile = JSON.parse(har.toString()) as HARFile;
      return new HarRouter(harFile, zipFile, options);
    }
    const harFile = JSON.parse(await fs.promises.readFile(options.path, 'utf-8')) as HARFile;
    return new HarRouter(harFile, null, options);
  }

  constructor(harFile: HARFile, zipFile: ZipFile | null, options?: HarOptions) {
    this._harFile = harFile;
    this._zipFile = zipFile;
    this._pattern = options?.urlFilter ?? /.*/;
    this._options = options;
  }

  private async _handle(route: Route) {
    let entry;
    try {
      entry = harFindResponse(this._harFile, {
        url: route.request().url(),
        method: route.request().method()
      });
    } catch (e) {
      rewriteErrorMessage(e, `Error while finding entry for ${route.request().method()} ${route.request().url()} in HAR file:\n${e.message}`);
      debugLogger.log('api', e);
    }

    if (entry) {
      // If navigation is being redirected, restart it with the final url to ensure the document's url changes.
      if (entry.request.url !== route.request().url() && route.request().isNavigationRequest()) {
        debugLogger.log('api', `redirecting HAR navigation: ${route.request().url()} => ${entry.request.url}`);
        await route._abort(undefined, entry.request.url);
        return;
      }
      debugLogger.log('api', `serving from HAR: ${route.request().method()} ${route.request().url()}`);
      const response = entry.response;
      const sha1 = (response.content as any)._sha1;

      if (this._zipFile && sha1) {
        const body = await this._zipFile.read(sha1).catch(() => {
          debugLogger.log('api', `payload ${sha1} for request ${route.request().url()} is not found in archive`);
          return null;
        });
        if (body) {
          await route.fulfill({
            status: response.status,
            headers: Object.fromEntries(response.headers.map(h => [h.name, h.value])),
            body
          });
          return;
        }
      }

      await route.fulfill({ response });
      return;
    }

    if (this._options?.fallback === 'continue') {
      await route.fallback();
      return;
    }

    debugLogger.log('api', `request not in HAR, aborting: ${route.request().method()} ${route.request().url()}`);
    await route.abort();
  }

  async addRoute(context: BrowserContext) {
    await context.route(this._pattern, route => this._handle(route));
    context.once(Events.BrowserContext.Close, () => this.dispose());
  }

  dispose() {
    this._zipFile?.close();
  }
}

const redirectStatus = [301, 302, 303, 307, 308];

function harFindResponse(har: HARFile, params: { url: string, method: string }): HAREntry | undefined {
  const harLog = har.log;
  const visited = new Set<HAREntry>();
  let url = params.url;
  let method = params.method;
  while (true) {
    const entry = harLog.entries.find(entry => entry.request.url === url && entry.request.method === method);
    if (!entry)
      return;
    if (visited.has(entry))
      throw new Error(`Found redirect cycle for ${params.url}`);
    visited.add(entry);

    const locationHeader = entry.response.headers.find(h => h.name.toLowerCase() === 'location');
    if (redirectStatus.includes(entry.response.status) && locationHeader) {
      const locationURL = new URL(locationHeader.value, url);
      url = locationURL.toString();
      if ((entry.response.status === 301 || entry.response.status === 302) && method === 'POST' ||
        entry.response.status === 303 && !['GET', 'HEAD'].includes(method)) {
        // HTTP-redirect fetch step 13 (https://fetch.spec.whatwg.org/#http-redirect-fetch)
        method = 'GET';
      }
      continue;
    }

    return entry;
  }
}
