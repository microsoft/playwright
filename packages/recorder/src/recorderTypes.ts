/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import type { Language } from '../../playwright-core/src/utils/isomorphic/locatorGenerators';

export type Point = { x: number; y: number };

export type Mode =
  | 'inspecting'
  | 'recording'
  | 'none'
  | 'assertingText'
  | 'recording-inspecting'
  | 'standby'
  | 'assertingVisibility'
  | 'assertingValue';

export type EventData = {
  event:
    | 'clear'
    | 'resume'
    | 'step'
    | 'pause'
    | 'setMode'
    | 'selectorUpdated'
    | 'fileChanged';
  params: any;
};

export type OverlayState = {
  offsetX: number;
};

export type UIState = {
  mode: Mode;
  actionPoint?: Point;
  actionSelector?: string;
  language: Language;
  testIdAttributeName: string;
  overlay: OverlayState;
};

export type CallLogStatus = 'in-progress' | 'done' | 'error' | 'paused';

export type CallLog = {
  id: string;
  title: string;
  messages: string[];
  status: CallLogStatus;
  error?: string;
  reveal?: boolean;
  duration?: number;
  params: {
    url?: string;
    selector?: string;
  };
};

export type SourceHighlight = {
  line: number;
  type: 'running' | 'paused' | 'error';
};

export type Source = {
  isRecorded: boolean;
  id: string;
  label: string;
  text: string;
  language: Language;
  highlight: SourceHighlight[];
  revealLine?: number;
  // used to group the language generators
  group?: string;
  header?: string;
  footer?: string;
  actions?: string[];
};

declare global {
  interface Window {
    playwrightSetMode: (mode: Mode) => void;
    playwrightSetPaused: (paused: boolean) => void;
    playwrightSetSources: (sources: Source[]) => void;
    playwrightSetOverlayVisible: (visible: boolean) => void;
    playwrightUpdateLogs: (callLogs: CallLog[]) => void;
    playwrightSetFile: (file: string) => void;
    playwrightSetSelector: (selector: string, focus?: boolean) => void;
    playwrightSourcesEchoForTest: Source[];
    dispatch(data: any): Promise<void>;
  }
}
