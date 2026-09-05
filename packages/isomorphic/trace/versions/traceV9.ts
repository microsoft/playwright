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

import type { Entry as HAREntry } from './har';
import type { Language } from '../../locatorGenerators';
import type { Point, Rect } from '../../types';

export type Size = { width: number, height: number };

export type StackFrame = {
  file: string,
  line: number,
  column: number,
  function?: string,
};

export type SerializedValue = {
  n?: number,
  b?: boolean,
  s?: string,
  v?: 'null' | 'undefined' | 'NaN' | 'Infinity' | '-Infinity' | '-0',
  d?: string,
  u?: string,
  bi?: string,
  ta?: {
    b: Buffer,
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

export type SerializedError = {
  error?: {
    message: string,
    name: string,
    stack?: string,
  },
  value?: SerializedValue,
};

// Make sure you add _modernize_N_to_N1(event: any) to traceModernizer.ts.
// 6 => released in ~1.40
// 7 => released in ~1.45
// 8 => released in 1.53
// 9 => released in 1.63
export type VERSION = 9;

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
  playwrightVersion?: string,
  wallTime: number,
  monotonicTime: number,
  title?: string,
  options: BrowserContextEventOptions,
  sdkLanguage?: Language,
  testIdAttributeName?: string,
  testTimeout?: number,
  annotations?: TraceEventAnnotation[],
};

export type ScreencastFrameTraceEvent = {
  type: 'screencast-frame',
  pageId: string,
  file: string,
  width: number,
  height: number,
  timestamp: number,
  frameSwapWallTime?: number,
};

export type VideoTraceEvent = {
  type: 'video',
  pageId: string,
  file: string,
  width: number,
  height: number,
  timestamp: number,
};

export type ActionPhase = 'before' | 'action' | 'after';

export type ScreenshotTraceEvent = {
  type: 'screenshot',
  callId: string,
  phase: ActionPhase,
  pageId: string,
  timestamp: number,
  file: string,
};

export type AriaSnapshotTraceEvent = {
  type: 'aria-snapshot',
  callId: string,
  phase: ActionPhase,
  pageId: string,
  timestamp: number,
  file: string,
};

export type BeforeActionTraceEvent = {
  type: 'before',
  callId: string;
  startTime: number;
  title?: string;
  subtitle?: string;
  class: string;
  method: string;
  params: Record<string, any>;
  stack?: StackFrame[];
  parentId?: string;
  group?: string;
};

export type InputActionTraceEvent = {
  type: 'input',
  callId: string;
  point?: Point;
  box?: Rect;
};

export type AfterActionTraceEventAttachment = {
  name: string;
  contentType: string;
  path?: string;
  file?: string;
  base64?: string;
};

export type TraceEventAnnotation = {
  type: string,
  description?: string
};

export type AfterActionTraceEvent = {
  type: 'after',
  callId: string;
  endTime: number;
  error?: SerializedError['error'];
  attachments?: AfterActionTraceEventAttachment[];
  annotations?: TraceEventAnnotation[];
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

export type ResourceSnapshot = HAREntry;

// Text node.
export type TextNodeSnapshot = string;
// Subtree reference, "x snapshots ago, node #y". Could point to a text node.
// Only nodes that are not references are counted, starting from zero, using post-order traversal.
export type SubtreeReferenceSnapshot = [ [number, number] ];
// Node name, and optional attributes and child nodes.
export type NodeNameAttributesChildNodesSnapshot = [ string ] | [ string, Record<string, string>, ...NodeSnapshot[] ];

export type NodeSnapshot =
  TextNodeSnapshot |
  SubtreeReferenceSnapshot |
  NodeNameAttributesChildNodesSnapshot;

export type ResourceOverride = {
  url: string,
  file?: string,
  ref?: number
};

export type FrameSnapshot = {
  phase?: ActionPhase,
  snapshotName?: string, // Legacy, only present in traces recorded before phase was introduced.
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
    VideoTraceEvent |
    ScreenshotTraceEvent |
    AriaSnapshotTraceEvent |
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
