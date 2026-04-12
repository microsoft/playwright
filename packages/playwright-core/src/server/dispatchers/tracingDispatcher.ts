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

import { ArtifactDispatcher } from './artifactDispatcher';
import { Dispatcher } from './dispatcher';
import { nullProgress } from '../progress';

import type { BrowserContextDispatcher } from './browserContextDispatcher';
import type { APIRequestContextDispatcher } from './networkDispatchers';
import type { Tracing } from '../trace/recorder/tracing';
import type * as channels from '@protocol/channels';
import type { Progress } from '@protocol/progress';

export class TracingDispatcher extends Dispatcher<Tracing, channels.TracingChannel, BrowserContextDispatcher | APIRequestContextDispatcher> implements channels.TracingChannel {
  _type_Tracing = true;
  private _started = false;

  static from(scope: BrowserContextDispatcher | APIRequestContextDispatcher, tracing: Tracing): TracingDispatcher {
    const result = scope.connection.existingDispatcher<TracingDispatcher>(tracing);
    return result || new TracingDispatcher(scope, tracing);
  }

  constructor(scope: BrowserContextDispatcher | APIRequestContextDispatcher, tracing: Tracing) {
    super(scope, tracing, 'Tracing', {});
  }

  async tracingStart(params: channels.TracingTracingStartParams, progress: Progress): Promise<channels.TracingTracingStartResult> {
    this._object.start(progress, params);
    this._started = true;
  }

  async tracingStartChunk(params: channels.TracingTracingStartChunkParams, progress: Progress): Promise<channels.TracingTracingStartChunkResult> {
    return await this._object.startChunk(progress, params);
  }

  async tracingGroup(params: channels.TracingTracingGroupParams, progress: Progress): Promise<channels.TracingTracingGroupResult> {
    const { name, location } = params;
    this._object.group(progress, name, location);
  }

  async tracingGroupEnd(params: channels.TracingTracingGroupEndParams, progress: Progress): Promise<channels.TracingTracingGroupEndResult> {
    this._object.groupEnd(progress);
  }

  async tracingStopChunk(params: channels.TracingTracingStopChunkParams, progress: Progress): Promise<channels.TracingTracingStopChunkResult> {
    const { artifact, entries } = await this._object.stopChunk(progress, params);
    return { artifact: artifact ? ArtifactDispatcher.from(this, artifact) : undefined, entries };
  }

  async tracingStop(params: channels.TracingTracingStopParams, progress: Progress): Promise<channels.TracingTracingStopResult> {
    await this._object.stop(progress);
  }

  override _onDispose() {
    // Avoid protocol calls for the closed context.
    if (this._started)
      this._object.stopChunk(nullProgress, { mode: 'discard' }).then(() => this._object.stop(nullProgress)).catch(() => {});
    this._started = false;
  }
}
