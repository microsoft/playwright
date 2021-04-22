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
import { debugMode, isUnderTest, monotonicTime } from '../../utils/utils';
import { BrowserContext } from '../browserContext';
import { CallMetadata, InstrumentationListener, SdkObject } from '../instrumentation';
import * as consoleApiSource from '../../generated/consoleApiSource';

export class Debugger implements InstrumentationListener {
  async onContextCreated(context: BrowserContext): Promise<void> {
    ContextDebugger.getOrCreate(context);
    if (debugMode() === 'console')
      await context.extendInjectedScript(consoleApiSource.source);
  }

  async onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    await ContextDebugger.lookup(sdkObject.attribution.context!)?.onBeforeCall(sdkObject, metadata);
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    await ContextDebugger.lookup(sdkObject.attribution.context!)?.onBeforeInputAction(sdkObject, metadata);
  }
}

const symbol = Symbol('ContextDebugger');

export class ContextDebugger extends EventEmitter {
  private _pauseOnNextStatement = false;
  private _pausedCallsMetadata = new Map<CallMetadata, { resolve: () => void, sdkObject: SdkObject }>();
  private _enabled: boolean;

  static Events = {
    PausedStateChanged: 'pausedstatechanged'
  };

  static getOrCreate(context: BrowserContext): ContextDebugger {
    let contextDebugger = (context as any)[symbol] as ContextDebugger;
    if (!contextDebugger) {
      contextDebugger = new ContextDebugger();
      (context as any)[symbol] = contextDebugger;
    }
    return contextDebugger;
  }

  constructor() {
    super();
    this._enabled = debugMode() === 'inspector';
    if (this._enabled)
      this.pauseOnNextStatement();
  }

  static lookup(context?: BrowserContext): ContextDebugger | undefined {
    if (!context)
      return;
    return (context as any)[symbol] as ContextDebugger | undefined;
  }

  async onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (shouldPauseOnCall(sdkObject, metadata) || (this._pauseOnNextStatement && shouldPauseOnStep(sdkObject, metadata)))
      await this.pause(sdkObject, metadata);
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (this._enabled && this._pauseOnNextStatement)
      await this.pause(sdkObject, metadata);
  }

  async pause(sdkObject: SdkObject, metadata: CallMetadata) {
    this._enabled = true;
    metadata.pauseStartTime = monotonicTime();
    const result = new Promise<void>(resolve => {
      this._pausedCallsMetadata.set(metadata, { resolve, sdkObject });
    });
    this.emit(ContextDebugger.Events.PausedStateChanged);
    return result;
  }

  resume(step: boolean) {
    this._pauseOnNextStatement = step;
    const endTime = monotonicTime();
    for (const [metadata, { resolve }] of this._pausedCallsMetadata) {
      metadata.pauseEndTime = endTime;
      resolve();
    }
    this._pausedCallsMetadata.clear();
    this.emit(ContextDebugger.Events.PausedStateChanged);
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
  if (!sdkObject.attribution.browser?.options.headful && !isUnderTest())
    return false;
  return metadata.method === 'pause';
}

function shouldPauseOnStep(sdkObject: SdkObject, metadata: CallMetadata): boolean {
  return metadata.method === 'goto' || metadata.method === 'close';
}
