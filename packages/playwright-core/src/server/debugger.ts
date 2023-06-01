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

import { EventEmitter } from 'events';
import { debugMode, isUnderTest, monotonicTime } from '../utils';
import { BrowserContext } from './browserContext';
import type { CallMetadata, InstrumentationListener, SdkObject } from './instrumentation';
import { commandsWithTracingSnapshots, pausesBeforeInputActions, slowMoActions } from '../protocol/debug';

const symbol = Symbol('Debugger');

export class Debugger extends EventEmitter implements InstrumentationListener {
  private _pauseOnNextStatement = false;
  private _pausedCallsMetadata = new Map<CallMetadata, { resolve: () => void, sdkObject: SdkObject }>();
  private _enabled: boolean;
  private _context: BrowserContext;

  static Events = {
    PausedStateChanged: 'pausedstatechanged'
  };
  private _muted = false;
  private _slowMo: number | undefined;

  constructor(context: BrowserContext) {
    super();
    this._context = context;
    (this._context as any)[symbol] = this;
    this._enabled = debugMode() === 'inspector';
    if (this._enabled)
      this.pauseOnNextStatement();
    context.instrumentation.addListener(this, context);
    this._context.once(BrowserContext.Events.Close, () => {
      this._context.instrumentation.removeListener(this);
    });
    this._slowMo = this._context._browser.options.slowMo;
  }

  async setMuted(muted: boolean) {
    this._muted = muted;
  }

  async onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (this._muted)
      return;
    if (shouldPauseOnCall(sdkObject, metadata) || (this._pauseOnNextStatement && shouldPauseBeforeStep(metadata)))
      await this.pause(sdkObject, metadata);
  }

  async _doSlowMo() {
    await new Promise(f => setTimeout(f, this._slowMo));
  }

  async onAfterCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (this._slowMo && shouldSlowMo(metadata))
      await this._doSlowMo();
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (this._muted)
      return;
    if (this._enabled && this._pauseOnNextStatement)
      await this.pause(sdkObject, metadata);
  }

  async pause(sdkObject: SdkObject, metadata: CallMetadata) {
    if (this._muted)
      return;
    this._enabled = true;
    metadata.pauseStartTime = monotonicTime();
    const result = new Promise<void>(resolve => {
      this._pausedCallsMetadata.set(metadata, { resolve, sdkObject });
    });
    this.emit(Debugger.Events.PausedStateChanged);
    return result;
  }

  resume(step: boolean) {
    if (!this.isPaused())
      return;

    this._pauseOnNextStatement = step;
    const endTime = monotonicTime();
    for (const [metadata, { resolve }] of this._pausedCallsMetadata) {
      metadata.pauseEndTime = endTime;
      resolve();
    }
    this._pausedCallsMetadata.clear();
    this.emit(Debugger.Events.PausedStateChanged);
  }

  pauseOnNextStatement() {
    this._pauseOnNextStatement = true;
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

function shouldPauseOnCall(sdkObject: SdkObject, metadata: CallMetadata): boolean {
  if (sdkObject.attribution.playwright.options.isServer)
    return false;
  if (!sdkObject.attribution.browser?.options.headful && !isUnderTest())
    return false;
  return metadata.method === 'pause';
}

function shouldPauseBeforeStep(metadata: CallMetadata): boolean {
  // Don't stop on internal.
  if (!metadata.apiName)
    return false;
  // Always stop on 'close'
  if (metadata.method === 'close')
    return true;
  if (metadata.method === 'waitForSelector' || metadata.method === 'waitForEventInfo')
    return false;  // Never stop on those, primarily for the test harness.
  const step = metadata.type + '.' + metadata.method;
  // Stop before everything that generates snapshot. But don't stop before those marked as pausesBeforeInputActions
  // since we stop in them on a separate instrumentation signal.
  return commandsWithTracingSnapshots.has(step) && !pausesBeforeInputActions.has(metadata.type + '.' + metadata.method);
}

export function shouldSlowMo(metadata: CallMetadata): boolean {
  return slowMoActions.has(metadata.type + '.' + metadata.method);
}
