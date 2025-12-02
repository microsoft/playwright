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

import type { Entry as ResourceSnapshot } from '@trace/har';

type SerializedValue = {
  n?: number,
  b?: boolean,
  s?: string,
  v?: 'null' | 'undefined' | 'NaN' | 'Infinity' | '-Infinity' | '-0',
  d?: string,
  u?: string,
  r?: {
    p: string,
    f: string,
  },
  a?: SerializedValue[],
  o?: {
    k: string,
    v: SerializedValue,
  }[],
  h?: number,
  id?: number,
  ref?: number,
};

type Point = {
  x: number,
  y: number,
};

type StackFrame = {
  file: string,
  line: number,
  column: number,
  function?: string,
};

type SerializedError = {
  error?: {
    message: string,
    name: string,
    stack?: string,
  },
  value?: SerializedValue,
};

type CallMetadata = {
  id: string;
  startTime: number;
  endTime: number;
  pauseStartTime?: number;
  pauseEndTime?: number;
  type: string;
  method: string;
  params: any;
  apiName?: string;
  internal?: boolean;
  isServerSide?: boolean;
  wallTime?: number;
  location?: { file: string, line?: number, column?: number };
  log: string[];
  afterSnapshot?: string;
  snapshots: { title: string, snapshotName: string }[];
  error?: SerializedError;
  result?: any;
  point?: Point;
  objectId?: string;
  pageId?: string;
  frameId?: string;
};

export type NodeSnapshot =
  string |
  [ [number, number] ] |
  [ string ] |
  [ string, { [attr: string]: string }, ...any ];


export type ResourceOverride = {
  url: string,
  sha1?: string,
  ref?: number
};

export type FrameSnapshot = {
  // There was no callId in the original, we are intentionally regressing it.
  callId: string;
  snapshotName?: string,
  pageId: string,
  frameId: string,
  frameUrl: string,
  timestamp: number,
  collectionTime: number,
  doctype?: string,
  html: NodeSnapshot,
  resourceOverrides: ResourceOverride[],
  viewport: { width: number, height: number },
  isMainFrame: boolean,
};


export type BrowserContextEventOptions = {
  viewport?: { width: number, height: number },
  deviceScaleFactor?: number,
  isMobile?: boolean,
  userAgent?: string,
};

export type ContextCreatedTraceEvent = {
  version: number,
  type: 'context-options',
  browserName: string,
  platform: string,
  wallTime: number,
  title?: string,
  options: BrowserContextEventOptions,
  sdkLanguage?: 'javascript' | 'python' | 'java' | 'csharp',
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

export type ActionTraceEvent = {
  type: 'action' | 'event',
  metadata: CallMetadata & { stack?: StackFrame[] },
};

export type ResourceSnapshotTraceEvent = {
  type: 'resource-snapshot',
  snapshot: ResourceSnapshot,
};

export type FrameSnapshotTraceEvent = {
  type: 'frame-snapshot',
  snapshot: FrameSnapshot,
};

export type TraceEvent =
    ContextCreatedTraceEvent |
    ScreencastFrameTraceEvent |
    ActionTraceEvent |
    ResourceSnapshotTraceEvent |
    FrameSnapshotTraceEvent;
