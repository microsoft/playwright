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

import { test, expect } from '@playwright/test';
import { TraceModel } from '../../packages/isomorphic/trace/traceModel';
import type { ActionEntry, ContextEntry } from '../../packages/isomorphic/trace/entries';

function createContext(overrides: Partial<ContextEntry>): ContextEntry {
  return {
    origin: 'testRunner',
    startTime: 0,
    endTime: 0,
    browserName: '',
    wallTime: 0,
    options: {
      deviceScaleFactor: 1,
      isMobile: false,
      viewport: { width: 1280, height: 800 },
    },
    pages: [],
    resources: [],
    actions: [],
    events: [],
    errors: [],
    stdio: [],
    hasSource: false,
    contextId: '',
    ...overrides,
  };
}

function createAction(overrides: Partial<ActionEntry>): ActionEntry {
  return {
    type: 'action',
    callId: 'call',
    startTime: 0,
    endTime: 0,
    class: 'APIRequestContext',
    method: 'get',
    params: {},
    log: [],
    ...overrides,
  };
}

test('should align library and test runner clocks by wall time', () => {
  const wallTimeRunner = 1_700_000_000_000;
  const wallTimeLibrary = wallTimeRunner + 100;

  const runnerContext = createContext({
    origin: 'testRunner',
    startTime: 5000,
    endTime: 6000,
    wallTime: wallTimeRunner,
    contextId: 'runner',
    actions: [
      createAction({
        callId: 'runner-action',
        startTime: 5100,
        endTime: 5200,
        stepId: 'runner-step',
      }),
    ],
  });

  const libraryContext = createContext({
    origin: 'library',
    startTime: 5_000_000,
    endTime: 5_001_000,
    wallTime: wallTimeLibrary,
    contextId: 'library',
    actions: [
      createAction({
        callId: 'library-action',
        startTime: 5_000_100,
        endTime: 5_000_200,
      }),
    ],
  });

  const model = new TraceModel('trace', [runnerContext, libraryContext]);

  expect(model.startTime).toBe(5000);
  expect(model.endTime).toBe(6100);
  expect(model.endTime - model.startTime).toBe(1100);
});
