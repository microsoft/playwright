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

import * as types from '../../types';
import { PageChannel } from '../channels';

export class ChromiumCoverage {
  private _channel: PageChannel;

  constructor(channel: PageChannel) {
    this._channel = channel;
  }

  async startJSCoverage(options: types.JSCoverageOptions = {}) {
    await this._channel.crStartJSCoverage(options);
  }

  async stopJSCoverage(): Promise<types.JSCoverageEntry[]> {
    return (await this._channel.crStopJSCoverage()).entries;
  }

  async startCSSCoverage(options: types.CSSCoverageOptions = {}) {
    await this._channel.crStartCSSCoverage(options);
  }

  async stopCSSCoverage(): Promise<types.CSSCoverageEntry[]> {
    return (await this._channel.crStopCSSCoverage()).entries;
  }
}
