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

import type * as api from '../../types/types';
import type * as channels from '../protocol/channels';
import { Artifact } from './artifact';
import { ChannelOwner } from './channelOwner';
import type { LocalUtils } from './localUtils';

export class Tracing extends ChannelOwner<channels.TracingChannel> implements api.Tracing {
  _localUtils!: LocalUtils;

  static from(channel: channels.TracingChannel): Tracing {
    return (channel as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.TracingInitializer) {
    super(parent, type, guid, initializer);
  }

  async start(options: { name?: string, title?: string, snapshots?: boolean, screenshots?: boolean, sources?: boolean } = {}) {
    await this._wrapApiCall(async () => {
      await this._channel.tracingStart(options);
      await this._channel.tracingStartChunk({ title: options.title });
    });
  }

  async startChunk(options: { title?: string } = {}) {
    await this._channel.tracingStartChunk(options);
  }

  async stopChunk(options: { path?: string } = {}) {
    await this._doStopChunk(options.path);
  }

  async stop(options: { path?: string } = {}) {
    await this._wrapApiCall(async () => {
      await this._doStopChunk(options.path);
      await this._channel.tracingStop();
    });
  }

  private async _doStopChunk(filePath: string | undefined) {
    const isLocal = !this._connection.isRemote();

    let mode: channels.TracingTracingStopChunkParams['mode'] = 'doNotSave';
    if (filePath) {
      if (isLocal)
        mode = 'compressTraceAndSources';
      else
        mode = 'compressTrace';
    }

    const result = await this._channel.tracingStopChunk({ mode });
    if (!filePath) {
      // Not interested in artifacts.
      return;
    }

    // The artifact may be missing if the browser closed while stopping tracing.
    if (!result.artifact)
      return;

    // Save trace to the final local file.
    const artifact = Artifact.from(result.artifact);
    await artifact.saveAs(filePath);
    await artifact.delete();

    // Add local sources to the remote trace if necessary.
    if (result.sourceEntries?.length)
      await this._localUtils.zip(filePath, result.sourceEntries);
  }
}
