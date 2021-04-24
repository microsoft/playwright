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

import { CallMetadata } from '../../instrumentation';
import { FrameSnapshot, ResourceSnapshot } from '../../snapshot/snapshotTypes';

export type ContextCreatedTraceEvent = {
  timestamp: number,
  type: 'context-metadata',
  browserName: string,
  deviceScaleFactor: number,
  isMobile: boolean,
  viewportSize?: { width: number, height: number },
  debugName?: string,
};

export type PageCreatedTraceEvent = {
  timestamp: number,
  type: 'page-created',
  pageId: string,
};

export type PageDestroyedTraceEvent = {
  timestamp: number,
  type: 'page-destroyed',
  pageId: string,
};

export type ScreencastFrameTraceEvent = {
  timestamp: number,
  type: 'page-screencast-frame',
  pageId: string,
  pageTimestamp: number,
  sha1: string,
  width: number,
  height: number,
};

export type ActionTraceEvent = {
  timestamp: number,
  type: 'action' | 'event',
  metadata: CallMetadata,
};

export type ResourceSnapshotTraceEvent = {
  timestamp: number,
  type: 'resource-snapshot',
  snapshot: ResourceSnapshot,
};

export type FrameSnapshotTraceEvent = {
  timestamp: number,
  type: 'frame-snapshot',
  snapshot: FrameSnapshot,
};

export type DialogOpenedEvent = {
  timestamp: number,
  type: 'dialog-opened',
  pageId: string,
  dialogType: string,
  message?: string,
};

export type DialogClosedEvent = {
  timestamp: number,
  type: 'dialog-closed',
  pageId: string,
  dialogType: string,
};

export type NavigationEvent = {
  timestamp: number,
  type: 'navigation',
  pageId: string,
  url: string,
  sameDocument: boolean,
};

export type LoadEvent = {
  timestamp: number,
  type: 'load',
  pageId: string,
};

export type TraceEvent =
    ContextCreatedTraceEvent |
    PageCreatedTraceEvent |
    PageDestroyedTraceEvent |
    ScreencastFrameTraceEvent |
    ActionTraceEvent |
    ResourceSnapshotTraceEvent |
    FrameSnapshotTraceEvent |
    DialogOpenedEvent |
    DialogClosedEvent |
    NavigationEvent |
    LoadEvent;
