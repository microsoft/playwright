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

import type { Language } from '../../../playwright-core/src/utils/isomorphic/locatorGenerators';
import type { ResourceSnapshot } from '@trace/snapshot';
import type * as trace from '@trace/trace';

// *Entry structures are used to pass the trace between the sw and the page.

export type ContextEntry = {
  origin: 'testRunner'|'library';
  traceUrl: string;
  startTime: number;
  endTime: number;
  browserName: string;
  channel?: string;
  platform?: string;
  wallTime: number;
  sdkLanguage?: Language;
  testIdAttributeName?: string;
  title?: string;
  options: trace.BrowserContextEventOptions;
  pages: PageEntry[];
  resources: ResourceSnapshot[];
  actions: ActionEntry[];
  events: (trace.EventTraceEvent | trace.ConsoleMessageTraceEvent)[];
  stdio: trace.StdioTraceEvent[];
  errors: trace.ErrorTraceEvent[];
  hasSource: boolean;
  contextId: string;
};

export type PageEntry = {
  pageId: string,
  screencastFrames: {
    sha1: string,
    timestamp: number,
    frameSwapWallTime?: number,
    width: number,
    height: number,
  }[];
};

export type ActionEntry = trace.ActionTraceEvent & {
  log: { time: number, message: string }[];
};
