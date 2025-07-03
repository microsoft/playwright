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

import type * as actions from '@recorder/actions';
import type { CallLog, ElementInfo, Mode, Source } from '@recorder/recorderTypes';
import type { EventEmitter } from 'events';
import type * as channels from '@protocol/channels';
import type { Language } from '../codegen/types';

export interface IRecorder {
  setMode(mode: Mode): void;
  mode(): Mode;
}

export interface IRecorderApp extends EventEmitter {
  readonly wsEndpointForTest: string | undefined;
  close(): Promise<void>;
  setPaused(paused: boolean): Promise<void>;
  setMode(mode: Mode): Promise<void>;
  elementPicked(elementInfo: ElementInfo, userGesture?: boolean): Promise<void>;
  updateCallLogs(callLogs: CallLog[]): Promise<void>;
  userSourcesChanged(sources: Source[]): Promise<void>;
  start(): void;
  actionAdded(action: actions.ActionInContext): Promise<void>;
  signalAdded(signal: actions.Signal): Promise<void>;
  pageNavigated(url: string): Promise<void>;
  flushOutput(): Promise<void>;
}

export type RecorderAppParams = channels.BrowserContextEnableRecorderParams & {
  browserName: string;
  sdkLanguage: Language;
};

export type IRecorderAppFactory = (recorder: IRecorder) => Promise<IRecorderApp>;
