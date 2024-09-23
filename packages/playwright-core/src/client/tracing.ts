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
import type * as channels from '@protocol/channels';
import { Artifact } from './artifact';
import { ChannelOwner } from './channelOwner';

export class Tracing extends ChannelOwner<channels.TracingChannel> implements api.Tracing {
  private _includeSources = false;
  _tracesDir: string | undefined;
  private _stacksId: string | undefined;
  private _isTracing = false;

  static from(channel: channels.TracingChannel): Tracing {
    return (channel as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.TracingInitializer) {
    super(parent, type, guid, initializer);
    this.markAsInternalType();
  }

  async start(options: { name?: string, title?: string, snapshots?: boolean, screenshots?: boolean, sources?: boolean, _live?: boolean } = {}) {
    this._includeSources = !!options.sources;
    await this._channel.tracingStart({
      name: options.name,
      snapshots: options.snapshots,
      screenshots: options.screenshots,
      live: options._live,
    });
    const { traceName } = await this._channel.tracingStartChunk({ name: options.name, title: options.title });
    await this._startCollectingStacks(traceName);
  }

  async startChunk(options: { name?: string, title?: string } = {}) {
    const { traceName } = await this._channel.tracingStartChunk(options);
    await this._startCollectingStacks(traceName);
  }

  private async _startCollectingStacks(traceName: string) {
    if (!this._isTracing) {
      this._isTracing = true;
      this._connection.setIsTracing(true);
    }
    const result = await this._connection.localUtils()._channel.tracingStarted({ tracesDir: this._tracesDir, traceName });
    this._stacksId = result.stacksId;
  }

  async stopChunk(options: { path?: string } = {}) {
    await this._doStopChunk(options.path);
  }

  async stop(options: { path?: string } = {}) {
    await this._doStopChunk(options.path);
    await this._channel.tracingStop();
  }

  private async _doStopChunk(filePath: string | undefined) {
    this._resetStackCounter();

    if (!filePath) {
      // Not interested in artifacts.
      await this._channel.tracingStopChunk({ mode: 'discard' });
      if (this._stacksId)
        await this._connection.localUtils()._channel.traceDiscarded({ stacksId: this._stacksId });
      return;
    }

    const isLocal = !this._connection.isRemote();

    if (isLocal) {
      const result = await this._channel.tracingStopChunk({ mode: 'entries' });
      await this._connection.localUtils()._channel.zip({ zipFile: filePath, entries: result.entries!, mode: 'write', stacksId: this._stacksId, includeSources: this._includeSources });
      return;
    }

    const result = await this._channel.tracingStopChunk({ mode: 'archive' });

    // The artifact may be missing if the browser closed while stopping tracing.
    if (!result.artifact) {
      if (this._stacksId)
        await this._connection.localUtils()._channel.traceDiscarded({ stacksId: this._stacksId });
      return;
    }

    // Save trace to the final local file.
    const artifact = Artifact.from(result.artifact);
    await artifact.saveAs(filePath);
    await artifact.delete();

    await this._connection.localUtils()._channel.zip({ zipFile: filePath, entries: [], mode: 'append', stacksId: this._stacksId, includeSources: this._includeSources });
  }

  _resetStackCounter() {
    if (this._isTracing) {
      this._isTracing = false;
      this._connection.setIsTracing(false);
    }
  }
}
