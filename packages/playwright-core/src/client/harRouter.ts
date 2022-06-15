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
import type { HAREntry, HARFile, HARResponse } from '../../types/types';
import type { BrowserContext } from './browserContext';
import type { Route } from './network';
import type { Page } from './page';

type HarHandler = {
  pattern: string | RegExp;
  handler: (route: Route) => any;
};

export class HarRouter {
  private _harPathToHander: Map<string, HarHandler> = new Map();
  private readonly owner: BrowserContext | Page;

  constructor(owner: BrowserContext | Page) {
    this.owner = owner;
  }

  async routeFromHar(path: string, options?: { strict?: boolean; url?: string|RegExp; }): Promise<void> {
    const harFile = JSON.parse(await fs.promises.readFile(path, 'utf-8')) as HARFile;
    if (this._harPathToHander.has(path))
      await this.unrouteFromHar(path);
    const harHandler = {
      pattern: options?.url ?? /.*/,
      handler: async (route: Route) => {
        let response;
        try {
          response = harFindResponse(harFile, {
            url: route.request().url(),
            method: route.request().method()
          });
        } catch (e) {
          // TODO: throw or at least error log?
          // rewriteErrorMessage(e, e.message + `\n\nFailed to find matching entry for ${route.request().method()} ${route.request().url()} in ${path}`);
          // throw e;
        }
        if (response)
          await route.fulfill({ response });
        else if (options?.strict)
          await route.abort();
        else
          await route.fallback();
      }
    };
    this._harPathToHander.set(path, harHandler);
    await this.owner.route(harHandler.pattern, harHandler.handler);
  }

  async unrouteFromHar(path: string): Promise<void> {
    const harHandler = this._harPathToHander.get(path);
    if (!harHandler)
      return;
    this._harPathToHander.delete(path);
    await this.owner.unroute(harHandler.pattern, harHandler.handler);
  }
}

const redirectStatus = [301, 302, 303, 307, 308];

function harFindResponse(har: HARFile, params: { url: string, method: string }): HARResponse {
  const harLog = har.log;
  const visited = new Set<HAREntry>();
  let url = params.url;
  let method = params.method;
  while (true) {
    const entry = harLog.entries.find(entry => entry.request.url === url && entry.request.method === method);
    if (!entry)
      throw new Error(`No entry matching ${params.url}`);
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

    return entry.response;
  }
}
