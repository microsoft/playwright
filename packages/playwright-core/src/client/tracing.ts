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

import { isRegExp, isString } from '@isomorphic/rtti';
import { Artifact } from './artifact';
import { ChannelOwner } from './channelOwner';
import { DisposableStub } from './disposable';

import type { Page } from './page';
import type * as api from '../../types/types';
import type * as channels from '@protocol/channels';

export class Tracing extends ChannelOwner<channels.TracingChannel> implements api.Tracing {
  private _includeSources = false;
  private _additionalSources = new Set<string>();
  private _isLive = false;
  _tracesDir: string | undefined;
  private _stacksId: string | undefined;
  private _isTracing = false;
  private _harId: string | undefined;
  private _harRecorders = new Map<string, { path: string, content: 'embed' | 'attach' | 'omit' | undefined }>();

  static from(channel: channels.TracingChannel): Tracing {
    return (channel as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.TracingInitializer) {
    super(parent, type, guid, initializer);
  }

  async start(options: { name?: string, title?: string, snapshots?: boolean, screenshots?: boolean, sources?: boolean, live?: boolean } = {}) {
    await this._wrapApiCall(async () => {
      this._includeSources = !!options.sources;
      this._isLive = !!options.live;
      await this._channel.tracingStart({
        name: options.name,
        snapshots: options.snapshots,
        screenshots: options.screenshots,
        live: options.live,
      });
      const { traceName } = await this._channel.tracingStartChunk({ name: options.name, title: options.title });
      await this._startCollectingStacks(traceName, this._isLive);
    });
  }

  async startChunk(options: { name?: string, title?: string } = {}) {
    await this._wrapApiCall(async () => {
      const { traceName } = await this._channel.tracingStartChunk(options);
      await this._startCollectingStacks(traceName, this._isLive);
    });
  }

  async group(name: string, options: { location?: { file: string, line?: number, column?: number } } = {}) {
    if (options.location)
      this._additionalSources.add(options.location.file);
    await this._channel.tracingGroup({ name, location: options.location });
    return new DisposableStub(() => this.groupEnd());
  }

  async groupEnd() {
    await this._channel.tracingGroupEnd();
  }

  private async _startCollectingStacks(traceName: string, live: boolean) {
    if (!this._isTracing) {
      this._isTracing = true;
      this._connection.setIsTracing(true);
    }
    const result = await this._connection.localUtils()?.tracingStarted({ tracesDir: this._tracesDir, traceName, live });
    this._stacksId = result?.stacksId;
  }

  async stopChunk(options: { path?: string } = {}) {
    await this._wrapApiCall(async () => {
      await this._doStopChunk(options.path);
    });
  }

  async stop(options: { path?: string } = {}) {
    await this._wrapApiCall(async () => {
      await this._doStopChunk(options.path);
      await this._channel.tracingStop();
    });
  }

  async startHar(path: string, options: { content?: 'embed' | 'attach' | 'omit', mode?: 'full' | 'minimal', urlFilter?: string | RegExp } = {}) {
    await this._wrapApiCall(async () => {
      if (this._harId)
        throw new Error('HAR recording has already been started');
      const defaultContent = path.endsWith('.zip') ? 'attach' : 'embed';
      this._harId = await this._recordIntoHAR(path, null, {
        url: options.urlFilter,
        updateContent: options.content ?? defaultContent,
        updateMode: options.mode ?? 'full',
      });
    });
    return new DisposableStub(() => this.stopHar());
  }

  async stopHar() {
    await this._wrapApiCall(async () => {
      const harId = this._harId;
      if (!harId)
        throw new Error('HAR recording has not been started');
      this._harId = undefined;
      await this._exportHAR(harId);
    });
  }

  async _recordIntoHAR(har: string, page: Page | null, options: { url?: string | RegExp, updateContent?: 'attach' | 'embed' | 'omit', updateMode?: 'minimal' | 'full' } = {}): Promise<string> {
    const { harId } = await this._channel.harStart({
      page: page?._channel,
      options: {
        zip: har.endsWith('.zip'),
        content: options.updateContent ?? 'attach',
        urlGlob: isString(options.url) ? options.url : undefined,
        urlRegexSource: isRegExp(options.url) ? options.url.source : undefined,
        urlRegexFlags: isRegExp(options.url) ? options.url.flags : undefined,
        mode: options.updateMode ?? 'minimal',
      },
    });
    this._harRecorders.set(harId, { path: har, content: options.updateContent ?? 'attach' });
    return harId;
  }

  async _exportHAR(harId: string): Promise<void> {
    const harParams = this._harRecorders.get(harId);
    if (!harParams)
      return;
    this._harRecorders.delete(harId);
    const har = await this._channel.harExport({ harId });
    const artifact = Artifact.from(har.artifact);
    const isCompressed = harParams.content === 'attach' || harParams.path.endsWith('.zip');
    const needCompressed = harParams.path.endsWith('.zip');
    if (isCompressed && !needCompressed) {
      const localUtils = this._connection.localUtils();
      if (!localUtils)
        throw new Error('Uncompressed har is not supported in thin clients');
      await artifact.saveAs(harParams.path + '.tmp');
      await localUtils.harUnzip({ zipFile: harParams.path + '.tmp', harFile: harParams.path });
    } else {
      await artifact.saveAs(harParams.path);
    }
    await artifact.delete();
  }

  async _exportAllHars(): Promise<void> {
    await this._wrapApiCall(async () => {
      await Promise.all([...this._harRecorders.keys()].map(harId => this._exportHAR(harId)));
    }, { internal: true });
  }

  private async _doStopChunk(filePath: string | undefined) {
    this._resetStackCounter();

    const additionalSources = [...this._additionalSources];
    this._additionalSources.clear();

    if (!filePath) {
      // Not interested in artifacts.
      await this._channel.tracingStopChunk({ mode: 'discard' });
      if (this._stacksId)
        await this._connection.localUtils()!.traceDiscarded({ stacksId: this._stacksId });
      return;
    }

    const localUtils = this._connection.localUtils();
    if (!localUtils)
      throw new Error('Cannot save trace in thin clients');

    const isLocal = !this._connection.isRemote();

    if (isLocal) {
      const result = await this._channel.tracingStopChunk({ mode: 'entries' });
      await localUtils.zip({ zipFile: filePath, entries: result.entries!, mode: 'write', stacksId: this._stacksId, includeSources: this._includeSources, additionalSources });
      return;
    }

    const result = await this._channel.tracingStopChunk({ mode: 'archive' });

    // The artifact may be missing if the browser closed while stopping tracing.
    if (!result.artifact) {
      if (this._stacksId)
        await localUtils.traceDiscarded({ stacksId: this._stacksId });
      return;
    }

    // Save trace to the final local file.
    const artifact = Artifact.from(result.artifact);
    await artifact.saveAs(filePath);
    await artifact.delete();

    await localUtils.zip({ zipFile: filePath, entries: [], mode: 'append', stacksId: this._stacksId, includeSources: this._includeSources, additionalSources });
  }

  _resetStackCounter() {
    if (this._isTracing) {
      this._isTracing = false;
      this._connection.setIsTracing(false);
    }
  }
}
