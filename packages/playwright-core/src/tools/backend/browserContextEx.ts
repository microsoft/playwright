/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type * as actions from '@isomorphic/codegen/actions';
import type * as playwrightTypes from '../../..';

export type RecorderEventSink = {
  actionAdded?(page: playwrightTypes.Page, action: actions.Action, code: string): void;
  actionUpdated?(page: playwrightTypes.Page, action: actions.Action, code: string): void;
  signalAdded?(page: playwrightTypes.Page, signal: actions.Signal, code: string): void;
};

export type BrowserContextInternalApi = {
  _enableRecorder(params: {
    language?: string,
    mode?: 'inspecting' | 'recording',
    recorderMode?: 'default' | 'api',
    omitCallTracking?: boolean,
  }, eventSink?: RecorderEventSink): Promise<void>;
  _disableRecorder(): Promise<void>;
};

export type BrowserContextEx = playwrightTypes.BrowserContext & BrowserContextInternalApi;
