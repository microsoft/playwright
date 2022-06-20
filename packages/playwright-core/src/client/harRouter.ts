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

import { debugLogger } from '../common/debugLogger';
import type { BrowserContext } from './browserContext';
import { Events } from './events';
import type { LocalUtils } from './localUtils';
import type { Route } from './network';
import type { BrowserContextOptions } from './types';

type HarOptions = NonNullable<BrowserContextOptions['har']>;

export class HarRouter {
  private _pattern: string | RegExp;
  private _options: HarOptions | undefined;
  private _localUtils: LocalUtils;
  private _harId: string;

  static async create(localUtils: LocalUtils, options: HarOptions): Promise<HarRouter> {
    const { harId, error } = await localUtils._channel.harOpen({ file: options.path });
    if (error)
      throw new Error(error);
    return new HarRouter(localUtils, harId!, options);
  }

  constructor(localUtils: LocalUtils, harId: string, options?: HarOptions) {
    this._localUtils = localUtils;
    this._harId = harId;
    this._pattern = options?.urlFilter ?? /.*/;
    this._options = options;
  }

  private async _handle(route: Route) {
    const request = route.request();
    const response = await this._localUtils._channel.harLookup({
      harId: this._harId,
      url: request.url(),
      method: request.method(),
      headers: (await request.headersArray()),
      postData: request.postDataBuffer()?.toString('base64'),
      isNavigationRequest: request.isNavigationRequest()
    });

    if (response.action === 'redirect') {
      debugLogger.log('api', `HAR: ${route.request().url()} redirected to ${response.redirectURL}`);
      await route._abort(undefined, response.redirectURL);
      return;
    }

    if (response.action === 'fulfill') {
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers!.map(h => [h.name, h.value])),
        body: Buffer.from(response.body!, 'base64')
      });
      return;
    }

    if (response.action === 'error')
      debugLogger.log('api', 'HAR: ' + response.message!);
    // Report the error, but fall through to the default handler.

    if (this._options?.fallback === 'continue') {
      await route.fallback();
      return;
    }

    debugLogger.log('api', `HAR: ${route.request().method()} ${route.request().url()} aborted - no such entry in HAR file`);
    await route.abort();
  }

  async addRoute(context: BrowserContext) {
    await context.route(this._pattern, route => this._handle(route));
    context.once(Events.BrowserContext.Close, () => this.dispose());
  }

  dispose() {
    this._localUtils._channel.harClose({ harId: this._harId }).catch(() => {});
  }
}
