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

import type * as recorderActions from '@recorder/actions';
import type * as channels from '@protocol/channels';
import type * as types from '../../server/types';

export function buildFullSelector(framePath: string[], selector: string) {
  return [...framePath, selector].join(' >> internal:control=enter-frame >> ');
}

export function traceParamsForAction(actionInContext: recorderActions.ActionInContext): { method: string, params: any } {
  const { action } = actionInContext;

  switch (action.name) {
    case 'navigate': {
      const params: channels.FrameGotoParams = {
        url: action.url,
      };
      return { method: 'goto', params };
    }
    case 'openPage':
    case 'closePage':
      throw new Error('Not reached');
  }

  const selector = buildFullSelector(actionInContext.frame.framePath, action.selector);
  switch (action.name) {
    case 'click': {
      const params: channels.FrameClickParams = {
        selector,
        strict: true,
        modifiers: toKeyboardModifiers(action.modifiers),
        button: action.button,
        clickCount: action.clickCount,
        position: action.position,
      };
      return { method: 'click', params };
    }
    case 'press': {
      const params: channels.FramePressParams = {
        selector,
        strict: true,
        key: [...toKeyboardModifiers(action.modifiers), action.key].join('+'),
      };
      return { method: 'press', params };
    }
    case 'fill': {
      const params: channels.FrameFillParams = {
        selector,
        strict: true,
        value: action.text,
      };
      return { method: 'fill', params };
    }
    case 'setInputFiles': {
      const params: channels.FrameSetInputFilesParams = {
        selector,
        strict: true,
        localPaths: action.files,
      };
      return { method: 'setInputFiles', params };
    }
    case 'check': {
      const params: channels.FrameCheckParams = {
        selector,
        strict: true,
      };
      return { method: 'check', params };
    }
    case 'uncheck': {
      const params: channels.FrameUncheckParams = {
        selector,
        strict: true,
      };
      return { method: 'uncheck', params };
    }
    case 'select': {
      const params: channels.FrameSelectOptionParams = {
        selector,
        strict: true,
        options: action.options.map(option => ({ value: option })),
      };
      return { method: 'selectOption', params };
    }
    case 'assertChecked': {
      const params: channels.FrameExpectParams = {
        selector: action.selector,
        expression: 'to.be.checked',
        isNot: !action.checked,
      };
      return { method: 'expect', params };
    }
    case 'assertText': {
      const params: channels.FrameExpectParams = {
        selector,
        expression: 'to.have.text',
        expectedText: [],
        isNot: false,
      };
      return { method: 'expect', params };
    }
    case 'assertValue': {
      const params: channels.FrameExpectParams = {
        selector,
        expression: 'to.have.value',
        expectedValue: undefined,
        isNot: false,
      };
      return { method: 'expect', params };
    }
    case 'assertVisible': {
      const params: channels.FrameExpectParams = {
        selector,
        expression: 'to.be.visible',
        isNot: false,
      };
      return { method: 'expect', params };
    }
  }
}

export function toKeyboardModifiers(modifiers: number): types.SmartKeyboardModifier[] {
  const result: types.SmartKeyboardModifier[] = [];
  if (modifiers & 1)
    result.push('Alt');
  if (modifiers & 2)
    result.push('ControlOrMeta');
  if (modifiers & 4)
    result.push('ControlOrMeta');
  if (modifiers & 8)
    result.push('Shift');
  return result;
}
