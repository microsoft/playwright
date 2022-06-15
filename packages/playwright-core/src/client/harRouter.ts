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
import type { BrowserContextOptions } from './types';

type HarOptions = NonNullable<BrowserContextOptions['har']>;

export class HarRouter {
  private _pattern: string | RegExp;
  private _handler: (route: Route) => Promise<void>;

  static async create(options: HarOptions): Promise<HarRouter> {
    const harFile = JSON.parse(await fs.promises.readFile(options.path, 'utf-8')) as HARFile;
    return new HarRouter(harFile, options);
  }

  constructor(harFile: HARFile, options?: HarOptions) {
    this._pattern = options?.urlFilter ?? /.*/;
    this._handler = async (route: Route) => {
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
      else if (options?.fallback === 'continue')
        await route.fallback();
      else
        await route.abort();
    };
  }

  async addRoute(context: BrowserContext) {
    await context.route(this._pattern, this._handler);
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
