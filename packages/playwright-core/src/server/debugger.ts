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

import { SdkObject } from './instrumentation';
import { monotonicTime } from '../utils';
import { BrowserContext } from './browserContext';
import { getMetainfo } from '../utils/isomorphic/protocolFormatter';

import type { CallMetadata, InstrumentationListener } from './instrumentation';

const symbol = Symbol('Debugger');

type PauseAt = { next?: boolean, location?: { file: string, line?: number, column?: number } };

export class Debugger extends SdkObject implements InstrumentationListener {
  private _pauseAt: PauseAt = {};
  private _pausedCallsMetadata = new Map<CallMetadata, { resolve: () => void, sdkObject: SdkObject }>();
  private _enabled = false;
  private _pauseBeforeInputActions = false;  // instead of inside input actions
  private _context: BrowserContext;

  static Events = {
    PausedStateChanged: 'pausedstatechanged'
  };
  private _muted = false;

  constructor(context: BrowserContext) {
    super(context, 'debugger');
    this._context = context;
    (this._context as any)[symbol] = this;
    context.instrumentation.addListener(this, context);
    this._context.once(BrowserContext.Events.Close, () => {
      this._context.instrumentation.removeListener(this);
    });
  }

  async setMuted(muted: boolean) {
    this._muted = muted;
  }

  async onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (this._muted)
      return;
    const pauseOnPauseCall = this._enabled && metadata.type === 'BrowserContext' && metadata.method === 'pause';
    const pauseOnNextStep = !!this._pauseAt.next && shouldPauseBeforeStep(metadata, this._pauseBeforeInputActions);
    const pauseOnLocation = !!this._pauseAt.location && matchesLocation(metadata, this._pauseAt.location);
    if (pauseOnPauseCall || pauseOnNextStep || pauseOnLocation)
      await this._pause(sdkObject, metadata);
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (this._muted)
      return;
    if (!!this._pauseAt.next && !this._pauseBeforeInputActions)
      await this._pause(sdkObject, metadata);
  }

  private async _pause(sdkObject: SdkObject, metadata: CallMetadata) {
    if (this._muted)
      return;
    this._pauseAt = {};
    metadata.pauseStartTime = monotonicTime();
    const result = new Promise<void>(resolve => {
      this._pausedCallsMetadata.set(metadata, { resolve, sdkObject });
    });
    this.emit(Debugger.Events.PausedStateChanged);
    return result;
  }

  resume() {
    if (!this.isPaused())
      return;

    const endTime = monotonicTime();
    for (const [metadata, { resolve }] of this._pausedCallsMetadata) {
      metadata.pauseEndTime = endTime;
      resolve();
    }
    this._pausedCallsMetadata.clear();
    this.emit(Debugger.Events.PausedStateChanged);
  }

  setPauseBeforeInputActions() {
    this._pauseBeforeInputActions = true;
  }

  setPauseAt(at: { next?: boolean, location?: { file: string, line?: number, column?: number } } = {}) {
    this._enabled = true;
    this._pauseAt = at;
  }

  isPaused(metadata?: CallMetadata): boolean {
    if (metadata)
      return this._pausedCallsMetadata.has(metadata);
    return !!this._pausedCallsMetadata.size;
  }

  pausedDetails(): { metadata: CallMetadata, sdkObject: SdkObject }[] {
    const result: { metadata: CallMetadata, sdkObject: SdkObject }[] = [];
    for (const [metadata, { sdkObject }] of this._pausedCallsMetadata)
      result.push({ metadata, sdkObject });
    return result;
  }
}

function matchesLocation(metadata: CallMetadata, location: { file: string, line?: number, column?: number }): boolean {
  return !!metadata.location?.file.includes(location.file) &&
      (location.line === undefined || metadata.location.line === location.line) &&
      (location.column === undefined || metadata.location.column === location.column);
}

function shouldPauseBeforeStep(metadata: CallMetadata, includeInputActions: boolean): boolean {
  if (metadata.internal)
    return false;
  const metainfo = getMetainfo(metadata);
  return !!metainfo?.pausesBeforeAction || (includeInputActions && !!metainfo?.pausesBeforeInput);
}
