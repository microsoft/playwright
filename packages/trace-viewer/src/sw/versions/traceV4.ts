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
type Size = { width: number, height: number };

type StackFrame = {
  file: string,
  line: number,
  column: number,
  function?: string,
};

type SerializedValue = {
  n?: number,
  b?: boolean,
  s?: string,
  v?: 'null' | 'undefined' | 'NaN' | 'Infinity' | '-Infinity' | '-0',
  d?: string,
  u?: string,
  bi?: string,
  m?: SerializedValue,
  se?: SerializedValue,
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

type NodeSnapshot =
  // Text node.
  string |
  // Subtree reference, "x snapshots ago, node #y". Could point to a text node.
  // Only nodes that are not references are counted, starting from zero, using post-order traversal.
  [ [number, number] ] |
  // Just node name.
  [ string ] |
  // Node name, attributes, child nodes.
  // Unfortunately, we cannot make this type definition recursive, therefore "any".
  [ string, { [attr: string]: string }, ...any ];


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
  collectionTime: number,
  doctype?: string,
  html: NodeSnapshot,
  resourceOverrides: ResourceOverride[],
  viewport: { width: number, height: number },
  isMainFrame: boolean,
};

type BrowserContextEventOptions = {
  viewport?: Size,
  deviceScaleFactor?: number,
  isMobile?: boolean,
  userAgent?: string,
};

type ContextCreatedTraceEvent = {
  version: number,
  type: 'context-options',
  browserName: string,
  channel?: string,
  platform: string,
  wallTime: number,
  title?: string,
  options: BrowserContextEventOptions,
  sdkLanguage?: Language,
  testIdAttributeName?: string,
};

type ScreencastFrameTraceEvent = {
  type: 'screencast-frame',
  pageId: string,
  sha1: string,
  width: number,
  height: number,
  timestamp: number,
};

type BeforeActionTraceEvent = {
  type: 'before',
  callId: string;
  startTime: number;
  apiName: string;
  class: string;
  method: string;
  params: Record<string, any>;
  wallTime: number;
  beforeSnapshot?: string;
  stack?: StackFrame[];
  pageId?: string;
  parentId?: string;
};

type InputActionTraceEvent = {
  type: 'input',
  callId: string;
  inputSnapshot?: string;
  point?: Point;
};

type AfterActionTraceEventAttachment = {
  name: string;
  contentType: string;
  path?: string;
  sha1?: string;
  base64?: string;
};

type AfterActionTraceEvent = {
  type: 'after',
  callId: string;
  endTime: number;
  afterSnapshot?: string;
  log: string[];
  error?: SerializedError['error'];
  attachments?: AfterActionTraceEventAttachment[];
  result?: any;
};

type EventTraceEvent = {
  type: 'event',
  time: number;
  class: string;
  method: string;
  params: any;
  pageId?: string;
};

type ConsoleMessageTraceEvent = {
  type: 'object';
  class: string;
  initializer: {
    type: string,
    text: string,
    location: {
      url: string,
      lineNumber: number,
      columnNumber: number,
    },
  };
  guid: string;
};

type ResourceSnapshotTraceEvent = {
  type: 'resource-snapshot',
  snapshot: ResourceSnapshot,
};

type FrameSnapshotTraceEvent = {
  type: 'frame-snapshot',
  snapshot: FrameSnapshot,
};

type ActionTraceEvent = {
  type: 'action',
} & Omit<BeforeActionTraceEvent, 'type'>
  & Omit<AfterActionTraceEvent, 'type'>
  & Omit<InputActionTraceEvent, 'type'>;

type StdioTraceEvent = {
  type: 'stdout' | 'stderr';
  timestamp: number;
  text?: string;
  base64?: string;
};

export type TraceEvent =
    ContextCreatedTraceEvent |
    ScreencastFrameTraceEvent |
    ActionTraceEvent |
    BeforeActionTraceEvent |
    InputActionTraceEvent |
    AfterActionTraceEvent |
    EventTraceEvent |
    ConsoleMessageTraceEvent |
    ResourceSnapshotTraceEvent |
    FrameSnapshotTraceEvent |
    StdioTraceEvent;
