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

type Language = 'javascript' | 'python' | 'java' | 'csharp' | 'jsonl';
type Point = { x: number, y: number };
export type Size = { width: number, height: number };

type StackFrame = {
  file: string,
  line: number,
  column: number,
  function?: string,
};

type Binary = Buffer;

type SerializedValue = {
  n?: number,
  b?: boolean,
  s?: string,
  v?: 'null' | 'undefined' | 'NaN' | 'Infinity' | '-Infinity' | '-0',
  d?: string,
  u?: string,
  bi?: string,
  ta?: {
    b: Binary,
    k: 'i8' | 'ui8' | 'ui8c' | 'i16' | 'ui16' | 'i32' | 'ui32' | 'f32' | 'f64' | 'bi64' | 'bui64',
  },
  e?: {
    m: string,
    n: string,
    s: string,
  },
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

type SerializedError = {
  error?: {
    message: string,
    name: string,
    stack?: string,
  },
  value?: SerializedValue,
};

// Text node.
type TextNodeSnapshot = string;
// Subtree reference, "x snapshots ago, node #y". Could point to a text node.
// Only nodes that are not references are counted, starting from zero, using post-order traversal.
type SubtreeReferenceSnapshot = [ [number, number] ];
// Node name, and optional attributes and child nodes.
type NodeNameAttributesChildNodesSnapshot = [ string ] | [ string, Record<string, string>, ...NodeSnapshot[] ];

type NodeSnapshot =
  TextNodeSnapshot |
  SubtreeReferenceSnapshot |
  NodeNameAttributesChildNodesSnapshot;

type ResourceOverride = {
  url: string,
  sha1?: string,
  ref?: number
};

type FrameSnapshot = {
  snapshotName?: string,
  callId: string,
  pageId: string,
  frameId: string,
  frameUrl: string,
  timestamp: number,
  wallTime?: number,
  collectionTime: number,
  doctype?: string,
  html: NodeSnapshot,
  resourceOverrides: ResourceOverride[],
  viewport: { width: number, height: number },
  isMainFrame: boolean,
};

type BrowserContextEventOptions = {
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
  contextId?: string,
};

export type ScreencastFrameTraceEvent = {
  type: 'screencast-frame',
  pageId: string,
  sha1: string,
  width: number,
  height: number,
  timestamp: number,
  frameSwapWallTime?: number,
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

export type AfterActionTraceEventAnnotation = {
  type: string,
  description?: string
};

export type AfterActionTraceEvent = {
  type: 'after',
  callId: string;
  endTime: number;
  afterSnapshot?: string;
  error?: SerializedError['error'];
  attachments?: AfterActionTraceEventAttachment[];
  annotations?: AfterActionTraceEventAnnotation[];
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
