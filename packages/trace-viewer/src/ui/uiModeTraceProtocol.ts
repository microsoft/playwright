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

import type { SourceLocation } from '@isomorphic/trace/traceModel';
import type { TestAnnotation } from '@playwright/test';
import type { AriaModeInfo } from './ariaModeView';
import type { UITestStatus } from './testUtils';

// UI mode shows the trace viewer in a frame. The trace viewer shows content from the pages under test,
// so it has a different origin than UI mode, and they only exchange messages.

export type UIModeTraceParams = {
  // The result of the selected test, if it has one and the test is not scheduled.
  result?: {
    startTime: number,
    duration: number,
    workerIndex: number,
    tracePath?: string,
    errors: string[],
  },
  testId?: string,
  outputDir?: string,
  rootDir?: string,
  testFile?: SourceLocation,
  status?: UITestStatus,
  annotations: TestAnnotation[],
  revealSource: boolean,
  pathSeparator: string,
};

// The values are strings from the local storage.
export type SerializedSettings = Record<string, string>;

export type UIModeTraceRequest = {
  // UI mode sends this before the first update, and again when a setting changes.
  method: 'settings',
  settings: SerializedSettings,
} | {
  method: 'update',
  params: UIModeTraceParams,
};

export type UIModeTraceEvent = {
  method: 'ready',
} | {
  method: 'traceInfo',
  info: AriaModeInfo | undefined,
} | {
  method: 'openExternally',
  location: { file: string, line: number, column: number },
} | {
  // The trace viewer has its own local storage, and UI mode keeps a copy of it between the runs.
  method: 'saveSettings',
  settings: SerializedSettings,
} | {
  // A key that the trace viewer did not handle. It bubbles to the page that has the frame.
  method: 'keydown',
  event: { key: string, code: string, ctrlKey: boolean, shiftKey: boolean, altKey: boolean, metaKey: boolean },
};
