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

import type { ParsedStackTrace } from '../utils/stackTrace';

export interface ClientInstrumentation {
  addListener(listener: ClientInstrumentationListener): void;
  removeListener(listener: ClientInstrumentationListener): void;
  removeAllListeners(): void;
  onApiCallBegin(apiCall: string, stackTrace: ParsedStackTrace | null, userData: any): void;
  onApiCallEnd(userData: any, error?: Error): any;
}

export interface ClientInstrumentationListener {
  onApiCallBegin?(apiCall: string, stackTrace: ParsedStackTrace | null, userData: any): any;
  onApiCallEnd?(userData: any, error?: Error): any;
}

export function createInstrumentation(): ClientInstrumentation {
  const listeners: ClientInstrumentationListener[] = [];
  return new Proxy({}, {
    get: (obj: any, prop: string) => {
      if (prop === 'addListener')
        return (listener: ClientInstrumentationListener) => listeners.push(listener);
      if (prop === 'removeListener')
        return (listener: ClientInstrumentationListener) => listeners.splice(listeners.indexOf(listener), 1);
      if (prop === 'removeAllListeners')
        return () => listeners.splice(0, listeners.length);
      if (!prop.startsWith('on'))
        return obj[prop];
      return async (...params: any[]) => {
        for (const listener of listeners)
          await (listener as any)[prop]?.(...params);
      };
    },
  });
}
