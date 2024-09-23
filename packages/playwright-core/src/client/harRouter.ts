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

import { debugLogger } from '../utils/debugLogger';
import type { BrowserContext } from './browserContext';
import type { LocalUtils } from './localUtils';
import type { Route } from './network';
import type { URLMatch } from '../utils';
import type { Page } from './page';

type HarNotFoundAction = 'abort' | 'fallback';

export class HarRouter {
  private _localUtils: LocalUtils;
  private _harId: string;
  private _notFoundAction: HarNotFoundAction;
  private _options: { urlMatch?: URLMatch; baseURL?: string; };

  static async create(localUtils: LocalUtils, file: string, notFoundAction: HarNotFoundAction, options: { urlMatch?: URLMatch }): Promise<HarRouter> {
    const { harId, error } = await localUtils._channel.harOpen({ file });
    if (error)
      throw new Error(error);
    return new HarRouter(localUtils, harId!, notFoundAction, options);
  }

  private constructor(localUtils: LocalUtils, harId: string, notFoundAction: HarNotFoundAction, options: { urlMatch?: URLMatch }) {
    this._localUtils = localUtils;
    this._harId = harId;
    this._options = options;
    this._notFoundAction = notFoundAction;
  }

  private async _handle(route: Route) {
    const request = route.request();

    const response = await this._localUtils._channel.harLookup({
      harId: this._harId,
      url: request.url(),
      method: request.method(),
      headers: (await request.headersArray()),
      postData: request.postDataBuffer() || undefined,
      isNavigationRequest: request.isNavigationRequest()
    });

    if (response.action === 'redirect') {
      debugLogger.log('api', `HAR: ${route.request().url()} redirected to ${response.redirectURL}`);
      await route._redirectNavigationRequest(response.redirectURL!);
      return;
    }

    if (response.action === 'fulfill') {
      // If the response status is -1, the request was canceled or stalled, so we just stall it here.
      // See https://github.com/microsoft/playwright/issues/29311.
      // TODO: it'd be better to abort such requests, but then we likely need to respect the timing,
      // because the request might have been stalled for a long time until the very end of the
      // test when HAR was recorded but we'd abort it immediately.
      if (response.status === -1)
        return;
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers!.map(h => [h.name, h.value])),
        body: response.body!
      });
      return;
    }

    if (response.action === 'error')
      debugLogger.log('api', 'HAR: ' + response.message!);
    // Report the error, but fall through to the default handler.

    if (this._notFoundAction === 'abort') {
      await route.abort();
      return;
    }

    await route.fallback();
  }

  async addContextRoute(context: BrowserContext) {
    await context.route(this._options.urlMatch || '**/*', route => this._handle(route));
  }

  async addPageRoute(page: Page) {
    await page.route(this._options.urlMatch || '**/*', route => this._handle(route));
  }

  async [Symbol.asyncDispose]() {
    await this.dispose();
  }

  dispose() {
    this._localUtils._channel.harClose({ harId: this._harId }).catch(() => {});
  }
}
