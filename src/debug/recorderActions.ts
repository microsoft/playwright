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

export type ActionName =
  'goto' |
  'fill' |
  'press' |
  'select';

export type ActionBase = {
  signals: Signal[],
  frameUrl?: string,
  committed?: boolean,
}

export type ClickAction = ActionBase & {
  name: 'click',
  selector: string,
  button: 'left' | 'middle' | 'right',
  modifiers: number,
  clickCount: number,
};

export type CheckAction = ActionBase & {
  name: 'check',
  selector: string,
};

export type UncheckAction = ActionBase & {
  name: 'uncheck',
  selector: string,
};

export type FillAction = ActionBase & {
  name: 'fill',
  selector: string,
  text: string,
};

export type NavigateAction = ActionBase & {
  name: 'navigate',
  url: string,
};

export type PressAction = ActionBase & {
  name: 'press',
  selector: string,
  key: string,
  modifiers: number,
};

export type SelectAction = ActionBase & {
  name: 'select',
  selector: string,
  options: string[],
};

export type Action = ClickAction | CheckAction | UncheckAction | FillAction | NavigateAction | PressAction | SelectAction;

// Signals.

export type NavigationSignal = {
  name: 'navigation',
  url: string,
  type: 'assert' | 'await',
};

export type Signal = NavigationSignal;

export function actionTitle(action: Action): string {
  switch (action.name) {
    case 'check':
      return 'Check';
    case 'uncheck':
      return 'Uncheck';
    case 'click': {
      if (action.clickCount === 1)
        return 'Click';
      if (action.clickCount === 2)
        return 'Double click';
      if (action.clickCount === 3)
        return 'Triple click';
      return `${action.clickCount}× click`;
    }
    case 'fill':
      return 'Fill';
    case 'navigate':
      return 'Go to';
    case 'press':
      return 'Press';
    case 'select':
      return 'Select';
  }
}
