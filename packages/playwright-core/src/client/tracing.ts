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
import { ParsedStackTrace } from '../utils/stackTrace';
import { calculateSha1 } from '../utils/utils';
import { Artifact } from './artifact';
import { BrowserContext } from './browserContext';
import { ClientInstrumentationListener } from './clientInstrumentation';

export class Tracing implements api.Tracing {
  private _context: BrowserContext;
  private _sources = new Set<string>();
  private _instrumentationListener: ClientInstrumentationListener;

  constructor(channel: BrowserContext) {
    this._context = channel;
    this._instrumentationListener = {
      onApiCallBegin: (apiCall: string, stackTrace: ParsedStackTrace | null) => {
        for (const frame of stackTrace?.frames || [])
          this._sources.add(frame.file);
      }
    };
  }

  async start(options: { name?: string, title?: string, snapshots?: boolean, screenshots?: boolean, sources?: boolean } = {}) {
    if (options.sources)
      this._context._instrumentation!.addListener(this._instrumentationListener);
    await this._context._wrapApiCall(async () => {
      await this._context._channel.tracingStart(options);
      await this._context._channel.tracingStartChunk({ title: options.title });
    });
  }

  async startChunk(options: { title?: string } = {}) {
    this._sources = new Set();
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
    const sources = this._sources;
    this._sources = new Set();
    this._context._instrumentation!.removeListener(this._instrumentationListener);
    const isLocal = !this._context._connection.isRemote();

    const result = await channel.tracingStopChunk({ save: !!filePath, skipCompress: isLocal });
    if (!filePath) {
      // Not interested in artifacts.
      return;
    }

    const sourceEntries: channels.NameValue[] = [];
    for (const value of sources)
      sourceEntries.push({ name: 'resources/src@' + calculateSha1(value) + '.txt', value });

    if (!isLocal) {
      // We run against remote Playwright, compress on remote side.
      const artifact = Artifact.from(result.artifact!);
      await artifact.saveAs(filePath);
      await artifact.delete();
    }

    if (isLocal || sourceEntries)
      await this._context._localUtils.zip(filePath, sourceEntries.concat(result.entries));
  }
}
