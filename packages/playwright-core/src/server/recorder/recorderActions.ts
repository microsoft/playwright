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

import type { Point } from '../../common/types';

export type ActionName =
  'check' |
  'click' |
  'closePage' |
  'fill' |
  'navigate' |
  'openPage' |
  'press' |
  'select' |
  'uncheck' |
  'setInputFiles' |
  'assertText' |
  'assertValue' |
  'assertChecked' |
  'assertVisible';

export type ActionBase = {
  name: ActionName,
  signals: Signal[],
};

export type ActionWithSelector = ActionBase & {
  selector: string,
};

export type ClickAction = ActionWithSelector & {
  name: 'click',
  button: 'left' | 'middle' | 'right',
  modifiers: number,
  clickCount: number,
  position?: Point,
};

export type CheckAction = ActionWithSelector & {
  name: 'check',
};

export type UncheckAction = ActionWithSelector & {
  name: 'uncheck',
};

export type FillAction = ActionWithSelector & {
  name: 'fill',
  text: string,
};

export type NavigateAction = ActionBase & {
  name: 'navigate',
  url: string,
};

export type OpenPageAction = ActionBase & {
  name: 'openPage',
  url: string,
};

export type ClosesPageAction = ActionBase & {
  name: 'closePage',
};

export type PressAction = ActionBase & {
  name: 'press',
  selector: string,
  key: string,
  modifiers: number,
};

export type SelectAction = ActionWithSelector & {
  name: 'select',
  options: string[],
};

export type SetInputFilesAction = ActionWithSelector & {
  name: 'setInputFiles',
  files: string[],
};

export type AssertTextAction = ActionWithSelector & {
  name: 'assertText',
  text: string,
  substring: boolean,
};

export type AssertValueAction = ActionWithSelector & {
  name: 'assertValue',
  value: string,
};

export type AssertCheckedAction = ActionWithSelector & {
  name: 'assertChecked',
  checked: boolean,
};

export type AssertVisibleAction = ActionWithSelector & {
  name: 'assertVisible',
};

export type Action = ClickAction | CheckAction | ClosesPageAction | OpenPageAction | UncheckAction | FillAction | NavigateAction | PressAction | SelectAction | SetInputFilesAction | AssertTextAction | AssertValueAction | AssertCheckedAction | AssertVisibleAction;
export type AssertAction = AssertCheckedAction | AssertValueAction | AssertTextAction | AssertVisibleAction;
export type PerformOnRecordAction = ClickAction | CheckAction | UncheckAction | PressAction | SelectAction;

// Signals.

export type BaseSignal = {
};

export type NavigationSignal = BaseSignal & {
  name: 'navigation',
  url: string,
};

export type PopupSignal = BaseSignal & {
  name: 'popup',
  popupAlias: string,
};

export type DownloadSignal = BaseSignal & {
  name: 'download',
  downloadAlias: string,
};

export type DialogSignal = BaseSignal & {
  name: 'dialog',
  dialogAlias: string,
};

export type Signal = NavigationSignal | PopupSignal | DownloadSignal | DialogSignal;
