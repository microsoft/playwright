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

import type { Point, SerializedError, StackFrame } from '@protocol/channels';
import type { Language } from '../../playwright-core/src/utils/isomorphic/locatorGenerators';
import type { FrameSnapshot, ResourceSnapshot } from './snapshot';

export type Size = { width: number, height: number };

// Make sure you add _modernize_N_to_N1(event: any) to traceModel.ts.
export type VERSION = 7;

export type BrowserContextEventOptions = {
  baseURL?: string,
  viewport?: Size,
  deviceScaleFactor?: number,
  isMobile?: boolean,
  userAgent?: string,
};

export type ContextCreatedTraceEvent = {
  version: number,
  type: 'context-options',
  origin: 'testRunner' | 'library',
  browserName: string,
  channel?: string,
  platform: string,
  wallTime: number,
  monotonicTime: number,
  title?: string,
  options: BrowserContextEventOptions,
  sdkLanguage?: Language,
  testIdAttributeName?: string,
};

export type ScreencastFrameTraceEvent = {
  type: 'screencast-frame',
  pageId: string,
  sha1: string,
  width: number,
  height: number,
  timestamp: number,
};

export type BeforeActionTraceEvent = {
  type: 'before',
  callId: string;
  startTime: number;
  apiName: string;
  class: string;
  method: string;
  params: Record<string, any>;
  stepId?: string;
  beforeSnapshot?: string;
  stack?: StackFrame[];
  pageId?: string;
  parentId?: string;
};

export type InputActionTraceEvent = {
  type: 'input',
  callId: string;
  inputSnapshot?: string;
  point?: Point;
};

export type AfterActionTraceEventAttachment = {
  name: string;
  contentType: string;
  path?: string;
  sha1?: string;
  base64?: string;
};

export type AfterActionTraceEvent = {
  type: 'after',
  callId: string;
  endTime: number;
  afterSnapshot?: string;
  error?: SerializedError['error'];
  attachments?: AfterActionTraceEventAttachment[];
  result?: any;
  point?: Point;
};

export type LogTraceEvent = {
  type: 'log',
  callId: string;
  time: number;
  message: string;
};

export type EventTraceEvent = {
  type: 'event',
  time: number;
  class: string;
  method: string;
  params: any;
  pageId?: string;
};

export type ConsoleMessageTraceEvent = {
  type: 'console';
  time: number;
  pageId?: string;
  messageType: string,
  text: string,
  args?: { preview: string, value: any }[],
  location: {
    url: string,
    lineNumber: number,
    columnNumber: number,
  },
};

export type ResourceSnapshotTraceEvent = {
  type: 'resource-snapshot',
  snapshot: ResourceSnapshot,
};

export type FrameSnapshotTraceEvent = {
  type: 'frame-snapshot',
  snapshot: FrameSnapshot,
};

export type ActionTraceEvent = {
  type: 'action',
} & Omit<BeforeActionTraceEvent, 'type'>
  & Omit<AfterActionTraceEvent, 'type'>
  & Omit<InputActionTraceEvent, 'type'>;

export type StdioTraceEvent = {
  type: 'stdout' | 'stderr';
  timestamp: number;
  text?: string;
  base64?: string;
};

export type ErrorTraceEvent = {
  type: 'error';
  message: string;
  stack?: StackFrame[];
};

export type TraceEvent =
    ContextCreatedTraceEvent |
    ScreencastFrameTraceEvent |
    ActionTraceEvent |
    BeforeActionTraceEvent |
    InputActionTraceEvent |
    AfterActionTraceEvent |
    EventTraceEvent |
    LogTraceEvent |
    ConsoleMessageTraceEvent |
    ResourceSnapshotTraceEvent |
    FrameSnapshotTraceEvent |
    StdioTraceEvent |
    ErrorTraceEvent;
