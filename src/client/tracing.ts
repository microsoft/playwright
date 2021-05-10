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

import * as channels from '../protocol/channels';
import { Artifact } from './artifact';
import { BrowserContext } from './browserContext';

export class Tracing {
  private _context: BrowserContext;

  constructor(channel: BrowserContext) {
    this._context = channel;
  }

  async start(options: { snapshots?: boolean, screenshots?: boolean } = {}) {
    await this._context._wrapApiCall('tracing.start', async (channel: channels.BrowserContextChannel) => {
      return await channel.tracingStart(options);
    });
  }

  async stop() {
    await this._context._wrapApiCall('tracing.stop', async (channel: channels.BrowserContextChannel) => {
      await channel.tracingStop();
    });
  }

  async export(path: string): Promise<void> {
    const result = await this._context._wrapApiCall('tracing.export', async (channel: channels.BrowserContextChannel) => {
      return await channel.tracingExport();
    });
    const artifact = Artifact.from(result.artifact);
    if (this._context.browser()?._remoteType)
      artifact._isRemote = true;
    await artifact.saveAs(path);
    await artifact.delete();
  }
}
