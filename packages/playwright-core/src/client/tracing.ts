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

import * as api from '../../types/types';
import * as channels from '../protocol/channels';
import { Artifact } from './artifact';
import { BrowserContext } from './browserContext';

export class Tracing implements api.Tracing {
  private _context: BrowserContext;

  constructor(channel: BrowserContext) {
    this._context = channel;
  }

  async start(options: { name?: string, title?: string, snapshots?: boolean, screenshots?: boolean, sources?: boolean } = {}) {
    await this._context._wrapApiCall(async () => {
      await this._context._channel.tracingStart(options);
      await this._context._channel.tracingStartChunk({ title: options.title });
    });
  }

  async startChunk(options: { title?: string } = {}) {
    await this._context._channel.tracingStartChunk(options);
  }

  async stopChunk(options: { path?: string } = {}) {
    await this._doStopChunk(this._context._channel, options.path);
  }

  async stop(options: { path?: string } = {}) {
    await this._context._wrapApiCall(async () => {
      await this._doStopChunk(this._context._channel, options.path);
      await this._context._channel.tracingStop();
    });
  }

  private async _doStopChunk(channel: channels.BrowserContextChannel, filePath: string | undefined) {
    const isLocal = !this._context._connection.isRemote();

    let mode: channels.BrowserContextTracingStopChunkParams['mode'] = 'doNotSave';
    if (filePath) {
      if (isLocal)
        mode = 'compressTraceAndSources';
      else
        mode = 'compressTrace';
    }

    const result = await channel.tracingStopChunk({ mode });
    if (!filePath) {
      // Not interested in artifacts.
      return;
    }

    // Save trace to the final local file.
    const artifact = Artifact.from(result.artifact!);
    await artifact.saveAs(filePath);
    await artifact.delete();

    // Add local sources to the remote trace if necessary.
    if (result.sourceEntries?.length)
      await this._context._localUtils.zip(filePath, result.sourceEntries);
  }
}
