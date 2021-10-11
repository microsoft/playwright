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
import { createGuid } from '../utils/utils';
import type { Browser } from './browser';
import type { BrowserContext } from './browserContext';
import type { BrowserType } from './browserType';
import { ElementHandle } from './dom';
import type { Frame } from './frames';
import type { Page } from './page';

export type Attribution = {
  isInternal: boolean,
  browserType?: BrowserType;
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  frame?: Frame;
};

import { CallMetadata } from '../protocol/callMetadata';
export { CallMetadata } from '../protocol/callMetadata';

export class SdkObject extends EventEmitter {
  guid: string;
  attribution: Attribution;
  instrumentation: Instrumentation;

  protected constructor(parent: SdkObject, guidPrefix?: string, guid?: string) {
    super();
    this.guid = guid || `${guidPrefix || ''}@${createGuid()}`;
    this.setMaxListeners(0);
    this.attribution = { ...parent.attribution };
    this.instrumentation = parent.instrumentation;
  }
}

export interface Instrumentation {
  addListener(listener: InstrumentationListener): void;
  removeListener(listener: InstrumentationListener): void;
  onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void>;
  onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata, element: ElementHandle): Promise<void>;
  onCallLog(logName: string, message: string, sdkObject: SdkObject, metadata: CallMetadata): void;
  onAfterCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void>;
  onEvent(sdkObject: SdkObject, metadata: CallMetadata): void;
}

export interface InstrumentationListener {
  onBeforeCall?(sdkObject: SdkObject, metadata: CallMetadata): Promise<void>;
  onBeforeInputAction?(sdkObject: SdkObject, metadata: CallMetadata, element: ElementHandle): Promise<void>;
  onCallLog?(logName: string, message: string, sdkObject: SdkObject, metadata: CallMetadata): void;
  onAfterCall?(sdkObject: SdkObject, metadata: CallMetadata): Promise<void>;
  onEvent?(sdkObject: SdkObject, metadata: CallMetadata): void;
}

export function createInstrumentation(): Instrumentation {
  const listeners: InstrumentationListener[] = [];
  return new Proxy({}, {
    get: (obj: any, prop: string) => {
      if (prop === 'addListener')
        return (listener: InstrumentationListener) => listeners.push(listener);
      if (prop === 'removeListener')
        return (listener: InstrumentationListener) => listeners.splice(listeners.indexOf(listener), 1);
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
    id: '',
    startTime: 0,
    endTime: 0,
    type: 'Internal',
    method: '',
    params: {},
    log: [],
    snapshots: []
  };
}
