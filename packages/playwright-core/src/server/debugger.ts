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

import { getMetainfo } from '@isomorphic/protocolMetainfo';
import { renderTitleForCall } from '@isomorphic/protocolFormatter';
import { monotonicTime } from '@isomorphic/time';
import { SdkObject } from './instrumentation';
import { BrowserContext } from './browserContext';

import type { CallMetadata, InstrumentationListener } from './instrumentation';
import type { Progress } from './progress';
import type { Point } from './types';

const symbol = Symbol('Debugger');
const kApiCallsFlushDelay = 500;

const DebuggerEvent = {
  PausedStateChanged: 'pausedstatechanged',
  ApiCallsUpdated: 'apicallsupdated',
} as const;

type PauseAt = { next?: boolean, location?: { file: string, line?: number, column?: number } };

export type ApiCallUpdate = {
  id: string;
  title: string;
  location?: { file: string, line?: number, column?: number };
  newLogEntries: string[];
  actionPoint?: Point;
  status: 'running' | 'success' | 'error';
  error?: string;
};

type OngoingCall = {
  metadata: CallMetadata;
  actionPoint?: Point;
  sentLogCount: number;
  status: 'running' | 'success' | 'error';
};

type DebuggerEventMap = {
  [DebuggerEvent.PausedStateChanged]: [];
  [DebuggerEvent.ApiCallsUpdated]: [apiCalls: ApiCallUpdate[]];
};

export class Debugger extends SdkObject<DebuggerEventMap> implements InstrumentationListener {
  static Events = DebuggerEvent;

  private _pauseAt: PauseAt = {};
  private _pausedCall: { metadata: CallMetadata, sdkObject: SdkObject, resolve: () => void } | undefined;
  private _enabled = false;
  private _pauseBeforeWaitingActions = false;  // instead of inside input actions
  private _context: BrowserContext;
  private _apiCallsEnabled = false;
  private _ongoingCalls = new Map<string, OngoingCall>();
  private _apiCallsWithPendingUpdates = new Set<string>();
  private _apiCallsFlushTimer: NodeJS.Timeout | undefined;
  private _muted = false;

  constructor(context: BrowserContext) {
    super(context, 'debugger');
    this._context = context;
    (this._context as any)[symbol] = this;
    // Register as a last listener so the debugger pause runs after other listeners
    // (e.g. recorder action-point capture) have recorded their state.
    context.instrumentation.addListener(this, context, { order: 'last' });
    this._context.once(BrowserContext.Events.Close, () => {
      this._context.instrumentation.removeListener(this);
      if (this._apiCallsFlushTimer)
        clearTimeout(this._apiCallsFlushTimer);
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
    if (!metadata.internal && metadata.method)
      this._ongoingCalls.set(metadata.id, { metadata, sentLogCount: 0, status: 'running' });
    if (this._apiCallsEnabled) {
      this._apiCallsWithPendingUpdates.add(metadata.id);
      this._flushApiCalls();
    }
    if (this._muted || metadata.internal)
      return;
    const metainfo = getMetainfo(metadata);
    const pauseOnPauseCall = this._enabled && metadata.type === 'BrowserContext' && metadata.method === 'pause';
    const pauseBeforeAction = !!this._pauseAt.next && !!metainfo?.pause && (this._pauseBeforeWaitingActions || !metainfo?.isAutoWaiting);
    const pauseOnLocation = !!this._pauseAt.location && matchesLocation(metadata, this._pauseAt.location);
    if (pauseOnPauseCall || pauseBeforeAction || pauseOnLocation)
      await this._pause(sdkObject, metadata);
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata, point?: Point): Promise<void> {
    const call = this._ongoingCalls.get(metadata.id);
    if (call) {
      call.actionPoint = point;
      if (this._apiCallsEnabled) {
        this._apiCallsWithPendingUpdates.add(metadata.id);
        this._flushApiCalls();
      }
    }
    if (this._muted || metadata.internal)
      return;
    const metainfo = getMetainfo(metadata);
    const pauseBeforeInput = !!this._pauseAt.next && !!metainfo?.pause && !!metainfo?.isAutoWaiting && !this._pauseBeforeWaitingActions;
    if (pauseBeforeInput)
      await this._pause(sdkObject, metadata);
  }

  async onAfterCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    const call = this._ongoingCalls.get(metadata.id);
    if (!call)
      return;
    call.status = metadata.error ? 'error' : 'success';
    if (this._apiCallsEnabled) {
      this._apiCallsWithPendingUpdates.add(metadata.id);
      this._flushApiCalls();
    }
    this._ongoingCalls.delete(metadata.id);
  }

  onCallLog(sdkObject: SdkObject, metadata: CallMetadata, logName: string, message: string): void {
    if (this._apiCallsEnabled && this._ongoingCalls.has(metadata.id)) {
      this._apiCallsWithPendingUpdates.add(metadata.id);
      this._scheduleApiCallsFlush();
    }
  }

  enableApiCalls() {
    if (this._apiCallsEnabled)
      return;
    this._apiCallsEnabled = true;
    this._pauseBeforeWaitingActions = false;
    for (const id of this._ongoingCalls.keys())
      this._apiCallsWithPendingUpdates.add(id);
    this._flushApiCalls();
  }

  private _scheduleApiCallsFlush() {
    if (this._apiCallsFlushTimer || !this._apiCallsWithPendingUpdates.size)
      return;
    this._apiCallsFlushTimer = setTimeout(() => this._flushApiCalls(), kApiCallsFlushDelay);
  }

  private _flushApiCalls() {
    if (this._apiCallsFlushTimer) {
      clearTimeout(this._apiCallsFlushTimer);
      this._apiCallsFlushTimer = undefined;
    }
    const updates: ApiCallUpdate[] = [];
    for (const id of this._apiCallsWithPendingUpdates) {
      const call = this._ongoingCalls.get(id);
      if (!call)
        continue;
      updates.push({
        id: call.metadata.id,
        title: renderTitleForCall(call.metadata) ?? '',
        location: call.metadata.location,
        newLogEntries: call.metadata.log.slice(call.sentLogCount),
        actionPoint: call.actionPoint,
        status: call.metadata.error ? 'error' : call.status,
        error: call.metadata.error?.error?.message,
      });
      call.sentLogCount = call.metadata.log.length;
    }
    this._apiCallsWithPendingUpdates.clear();
    if (updates.length)
      this.emit(Debugger.Events.ApiCallsUpdated, updates);
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
    if (this._apiCallsEnabled)
      return;
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
