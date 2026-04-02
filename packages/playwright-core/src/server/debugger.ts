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
import { getMetainfo } from '../utils/isomorphic/protocolMetainfo';

import type { CallMetadata, InstrumentationListener } from './instrumentation';
import type { Progress } from '@protocol/progress';

const symbol = Symbol('Debugger');

type PauseAt = { next?: boolean, location?: { file: string, line?: number, column?: number } };

export class Debugger extends SdkObject implements InstrumentationListener {
  private _pauseAt: PauseAt = {};
  private _pausedCall: { metadata: CallMetadata, sdkObject: SdkObject, resolve: () => void } | undefined;
  private _enabled = false;
  private _pauseBeforeWaitingActions = false;  // instead of inside input actions
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

  requestPause(progress: Progress) {
    if (this.isPaused())
      throw new Error('Debugger is already paused');
    this.setPauseBeforeWaitingActions();
    this.setPauseAt({ next: true });
  }

  doResume(progress: Progress) {
    if (!this.isPaused())
      throw new Error('Debugger is not paused');
    this.resume();
  }

  next(progress: Progress) {
    if (!this.isPaused())
      throw new Error('Debugger is not paused');
    this.setPauseBeforeWaitingActions();
    this.setPauseAt({ next: true });
    this.resume();
  }

  runTo(progress: Progress, location: { file: string, line?: number, column?: number }) {
    if (!this.isPaused())
      throw new Error('Debugger is not paused');
    this.setPauseBeforeWaitingActions();
    this.setPauseAt({ location });
    this.resume();
  }

  async setMuted(muted: boolean) {
    this._muted = muted;
  }

  async onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (this._muted || metadata.internal)
      return;
    const metainfo = getMetainfo(metadata);
    const pauseOnPauseCall = this._enabled && metadata.type === 'BrowserContext' && metadata.method === 'pause';
    const pauseBeforeAction = !!this._pauseAt.next && !!metainfo?.pause && (this._pauseBeforeWaitingActions || !metainfo?.isAutoWaiting);
    const pauseOnLocation = !!this._pauseAt.location && matchesLocation(metadata, this._pauseAt.location);
    if (pauseOnPauseCall || pauseBeforeAction || pauseOnLocation)
      await this._pause(sdkObject, metadata);
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (this._muted || metadata.internal)
      return;
    const metainfo = getMetainfo(metadata);
    const pauseBeforeInput = !!this._pauseAt.next && !!metainfo?.pause && !!metainfo?.isAutoWaiting && !this._pauseBeforeWaitingActions;
    if (pauseBeforeInput)
      await this._pause(sdkObject, metadata);
  }

  private async _pause(sdkObject: SdkObject, metadata: CallMetadata) {
    if (this._muted || metadata.internal)
      return;
    if (this._pausedCall)
      return;
    this._pauseAt = {};
    metadata.pauseStartTime = monotonicTime();
    const result = new Promise<void>(resolve => {
      this._pausedCall = { metadata, sdkObject, resolve };
    });
    this.emit(Debugger.Events.PausedStateChanged);
    return result;
  }

  resume() {
    if (!this._pausedCall)
      return;

    this._pausedCall.metadata.pauseEndTime = monotonicTime();
    this._pausedCall.resolve();
    this._pausedCall = undefined;
    this.emit(Debugger.Events.PausedStateChanged);
  }

  setPauseBeforeWaitingActions() {
    this._pauseBeforeWaitingActions = true;
  }

  setPauseAt(at: { next?: boolean, location?: { file: string, line?: number, column?: number } } = {}) {
    this._enabled = true;
    this._pauseAt = at;
  }

  isPaused(metadata?: CallMetadata): boolean {
    if (metadata)
      return this._pausedCall?.metadata === metadata;
    return !!this._pausedCall;
  }

  pausedDetails(): { metadata: CallMetadata, sdkObject: SdkObject } | undefined {
    return this._pausedCall;
  }
}

function matchesLocation(metadata: CallMetadata, location: { file: string, line?: number, column?: number }): boolean {
  return !!metadata.location?.file.includes(location.file) &&
      (location.line === undefined || metadata.location.line === location.line) &&
      (location.column === undefined || metadata.location.column === location.column);
}
