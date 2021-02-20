/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EventEmitter } from 'events';
import { Point, StackFrame } from '../common/types';
import type { Browser } from './browser';
import type { BrowserContext } from './browserContext';
import type { BrowserType } from './browserType';
import type { Frame } from './frames';
import type { Page } from './page';

export type Attribution = {
  browserType?: BrowserType;
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  frame?: Frame;
};

export type CallMetadata = {
  id: number;
  startTime: number;
  endTime: number;
  pauseStartTime?: number;
  pauseEndTime?: number;
  type: string;
  method: string;
  params: any;
  apiName?: string;
  stack?: StackFrame[];
  log: string[];
  error?: string;
  point?: Point;
};

export class SdkObject extends EventEmitter {
  attribution: Attribution;
  instrumentation: Instrumentation;

  protected constructor(parent: SdkObject) {
    super();
    this.setMaxListeners(0);
    this.attribution = { ...parent.attribution };
    this.instrumentation = parent.instrumentation;
  }
}

export interface Instrumentation {
  onContextCreated(context: BrowserContext): Promise<void>;
  onContextWillDestroy(context: BrowserContext): Promise<void>;
  onContextDidDestroy(context: BrowserContext): Promise<void>;

  onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void>;
  onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata): Promise<void>;
  onAfterInputAction(sdkObject: SdkObject, metadata: CallMetadata): Promise<void>;
  onCallLog(logName: string, message: string, sdkObject: SdkObject, metadata: CallMetadata): void;
  onAfterCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void>;
}

export interface InstrumentationListener {
  onContextCreated?(context: BrowserContext): Promise<void>;
  onContextWillDestroy?(context: BrowserContext): Promise<void>;
  onContextDidDestroy?(context: BrowserContext): Promise<void>;

  onBeforeCall?(sdkObject: SdkObject, metadata: CallMetadata): Promise<void>;
  onBeforeInputAction?(sdkObject: SdkObject, metadata: CallMetadata): Promise<void>;
  onAfterInputAction?(sdkObject: SdkObject, metadata: CallMetadata): Promise<void>;
  onCallLog?(logName: string, message: string, sdkObject: SdkObject, metadata: CallMetadata): void;
  onAfterCall?(sdkObject: SdkObject, metadata: CallMetadata): Promise<void>;
}

export function multiplexInstrumentation(listeners: InstrumentationListener[]): Instrumentation {
  return new Proxy({}, {
    get: (obj: any, prop: string) => {
      if (!prop.startsWith('on'))
        return obj[prop];
      return async (...params: any[]) => {
        for (const listener of listeners)
          await (listener as any)[prop]?.(...params);
      };
    },
  });
}

export function internalCallMetadata(): CallMetadata {
  return {
    id: 0,
    startTime: 0,
    endTime: 0,
    type: 'Internal',
    method: '',
    params: {},
    log: [],
  };
}
