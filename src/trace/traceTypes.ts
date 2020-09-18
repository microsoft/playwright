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

export type ContextCreatedTraceEvent = {
  type: 'context-created',
  browserName: string,
  contextId: string,
  deviceScaleFactor: number,
  isMobile: boolean,
  viewportSize?: { width: number, height: number },
};

export type ContextDestroyedTraceEvent = {
  type: 'context-destroyed',
  contextId: string,
};

export type NetworkResourceTraceEvent = {
  type: 'resource',
  contextId: string,
  pageId: string,
  frameId: string,
  url: string,
  contentType: string,
  responseHeaders: { name: string, value: string }[],
  sha1: string,
};

export type PageCreatedTraceEvent = {
  type: 'page-created',
  contextId: string,
  pageId: string,
};

export type PageDestroyedTraceEvent = {
  type: 'page-destroyed',
  contextId: string,
  pageId: string,
};

export type PageVideoTraceEvent = {
  type: 'page-video',
  contextId: string,
  pageId: string,
  fileName: string,
};

export type ActionTraceEvent = {
  type: 'action',
  contextId: string,
  action: string,
  pageId?: string,
  selector?: string,
  label?: string,
  value?: string,
  startTime?: number,
  endTime?: number,
  logs?: string[],
  snapshot?: {
    sha1: string,
    duration: number,
  },
  stack?: string,
  error?: string,
};

export type TraceEvent =
    ContextCreatedTraceEvent |
    ContextDestroyedTraceEvent |
    PageCreatedTraceEvent |
    PageDestroyedTraceEvent |
    PageVideoTraceEvent |
    NetworkResourceTraceEvent |
    ActionTraceEvent;


export type FrameSnapshot = {
  frameId: string,
  url: string,
  html: string,
  resourceOverrides: { url: string, sha1: string }[],
};

export type PageSnapshot = {
  viewportSize?: { width: number, height: number },
  // First frame is the main frame.
  frames: FrameSnapshot[],
};
