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

export type NavigateAction = {
  method: 'navigate';
  url: string;
};

export type ClickAction = {
  method: 'click';
  selector: string;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  modifiers?: ('Alt' | 'Control' | 'ControlOrMeta' | 'Meta' | 'Shift')[];
};

export type DragAction = {
  method: 'drag';
  sourceSelector: string;
  targetSelector: string;
};

export type HoverAction = {
  method: 'hover';
  selector: string;
  modifiers?: ('Alt' | 'Control' | 'ControlOrMeta' | 'Meta' | 'Shift')[];
};

export type SelectOptionAction = {
  method: 'selectOption';
  selector: string;
  labels: string[];
};

export type PressAction = {
  method: 'pressKey';
  // Includes modifiers
  key: string;
};

export type PressSequentiallyAction = {
  method: 'pressSequentially';
  selector: string;
  text: string;
  submit?: boolean;
};

export type FillAction = {
  method: 'fill';
  selector: string;
  text: string;
  submit?: boolean;
};

export type SetChecked = {
  method: 'setChecked';
  selector: string;
  checked: boolean;
};

export type ExpectVisible = {
  method: 'expectVisible';
  selector: string;
  isNot?: boolean;
};

export type ExpectValue = {
  method: 'expectValue';
  selector: string;
  type: 'textbox' | 'checkbox' | 'radio' | 'combobox' | 'slider';
  value: string;
  isNot?: boolean;
};

export type ExpectAria = {
  method: 'expectAria';
  template: string;
  isNot?: boolean;
};

export type Action =
  | NavigateAction
  | ClickAction
  | DragAction
  | HoverAction
  | SelectOptionAction
  | PressAction
  | PressSequentiallyAction
  | FillAction
  | SetChecked
  | ExpectVisible
  | ExpectValue
  | ExpectAria;

export type ActionWithCode = Action & {
  code: string;
};
