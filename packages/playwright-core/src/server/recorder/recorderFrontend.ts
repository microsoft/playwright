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

import type { CallLog, Mode, Source } from '@recorder/recorderTypes';
import type { EventEmitter } from 'events';

export interface IRecorder {
  setMode(mode: Mode): void;
  mode(): Mode;
}

export interface IRecorderApp extends EventEmitter {
  readonly wsEndpointForTest: string | undefined;
  close(): Promise<void>;
  setPaused(paused: boolean): Promise<void>;
  setMode(mode: Mode): Promise<void>;
  setFile(file: string): Promise<void>;
  setSelector(selector: string, userGesture?: boolean): Promise<void>;
  updateCallLogs(callLogs: CallLog[]): Promise<void>;
  setSources(sources: Source[]): Promise<void>;
}

export type IRecorderAppFactory = (recorder: IRecorder) => Promise<IRecorderApp>;
