/**
 * Copyright (c) Microsoft Corporation.
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

import type { Language } from '../../playwright-core/src/server/isomorphic/locatorGenerators';
import type { ResourceSnapshot } from '@trace/snapshot';
import type * as trace from '@trace/trace';

export type ContextEntry = {
  traceUrl: string;
  startTime: number;
  endTime: number;
  browserName: string;
  platform?: string;
  wallTime?: number;
  sdkLanguage?: Language;
  testIdAttributeName?: string;
  title?: string;
  options: trace.BrowserContextEventOptions;
  pages: PageEntry[];
  resources: ResourceSnapshot[];
  actions: trace.ActionTraceEvent[];
  events: trace.ActionTraceEvent[];
  objects: { [key: string]: any };
  hasSource: boolean;
};

export type PageEntry = {
  screencastFrames: {
    sha1: string,
    timestamp: number,
    width: number,
    height: number,
  }[];
};
export function createEmptyContext(): ContextEntry {
  return {
    traceUrl: '',
    startTime: Number.MAX_SAFE_INTEGER,
    endTime: 0,
    browserName: '',
    options: {
      deviceScaleFactor: 1,
      isMobile: false,
      viewport: { width: 1280, height: 800 },
    },
    pages: [],
    resources: [],
    actions: [],
    events: [],
    objects: {},
    hasSource: false
  };
}
