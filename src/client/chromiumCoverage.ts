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

import * as channels from './channels';
import * as api from '../../types/types';
import { Page } from './page';

export class ChromiumCoverage implements api.ChromiumCoverage {
  private _page: Page;

  constructor(page: Page) {
    this._page = page;
  }

  async startJSCoverage(options: channels.PageCrStartJSCoverageOptions = {}) {
    return this._page._wrapApiCall('coverage.startJSCoverage', async channel => {
      await channel.crStartJSCoverage(options);
    });
  }

  async stopJSCoverage(): Promise<channels.PageCrStopJSCoverageResult['entries']> {
    return this._page._wrapApiCall('coverage.stopJSCoverage', async channel => {
      return (await channel.crStopJSCoverage()).entries;
    });
  }

  async startCSSCoverage(options: channels.PageCrStartCSSCoverageOptions = {}) {
    return this._page._wrapApiCall('coverage.startCSSCoverage', async channel => {
      await channel.crStartCSSCoverage(options);
    });
  }

  async stopCSSCoverage(): Promise<channels.PageCrStopCSSCoverageResult['entries']> {
    return this._page._wrapApiCall('coverage.stopCSSCoverage', async channel => {
      return (await channel.crStopCSSCoverage()).entries;
    });
  }
}
