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

import type { ActionTraceEvent } from '@trace/trace';
import { asLocator, type Language } from '@isomorphic/locatorGenerators';

export interface ActionParameterDisplayString {
  type: 'generic' | 'locator';
  value: string;
}

const formatClockParams = (params: {
  ticksNumber?: number;
  ticksString?: string;
  timeNumber?: number;
}): ActionParameterDisplayString | undefined => {
  let value: string | undefined = undefined;

  if (params.ticksNumber !== undefined) {
    // clock.fastForward/runFor
    value = `${params.ticksNumber}ms`;
  } else if (params.ticksString !== undefined) {
    // clock.fastForward/runFor
    value = params.ticksString;
  } else if (params.timeNumber !== undefined) {
    // clock.pauseAt/setFixedTime/setSystemTime
    try {
      value = new Date(params.timeNumber).toLocaleString(undefined, {
        timeZone: 'UTC',
      });
    } catch (e) {
      return undefined;
    }
  }

  if (value === undefined)
    return undefined;

  return {
    type: 'generic',
    value,
  };
};

const formatLocatorParams = (
  sdkLanguage: Language,
  params: { selector?: string },
): ActionParameterDisplayString | undefined =>
  params.selector !== undefined
    ? { type: 'locator', value: asLocator(sdkLanguage, params.selector) }
    : undefined;

const formatKeyboardParams = (params: {
  key?: string;
  text?: string;
}): ActionParameterDisplayString | undefined => {
  let value: string | undefined = undefined;

  if (params.key !== undefined) {
    // keyboard.press/down/up
    value = params.key;
  } else if (params.text !== undefined) {
    // keyboard.type/insertText
    value = `"${params.text}"`;
  }

  if (value === undefined)
    return undefined;

  return {
    type: 'generic',
    value,
  };
};

const formatMouseParams = (params: {
  x?: number;
  y?: number;
  deltaX?: number;
  deltaY?: number;
}): ActionParameterDisplayString | undefined => {
  let value: string | undefined = undefined;

  if (params.x !== undefined && params.y !== undefined) {
    // mouse.click/dblclick/move
    value = `(${params.x}, ${params.y})`;
  } else if (params.deltaX !== undefined && params.deltaY !== undefined) {
    // mouse.wheel
    value = `(${params.deltaX}, ${params.deltaY})`;
  }

  if (value === undefined)
    return undefined;

  return {
    type: 'generic',
    value,
  };
};

const formatTouchscreenParams = (params: {
  x?: number;
  y?: number;
}): ActionParameterDisplayString | undefined => {
  let value: string | undefined = undefined;

  if (params.x && params.y) {
    // touchscreen.tap
    value = `(${params.x}, ${params.y})`;
  }

  if (value === undefined)
    return undefined;

  return {
    type: 'generic',
    value,
  };
};

export const actionParameterDisplayString = (
  action: ActionTraceEvent,
  sdkLanguage: Language,
): ActionParameterDisplayString | undefined => {
  const params = action.params;
  const apiName = action.apiName.toLowerCase();

  switch (true) {
    case apiName.startsWith('clock'):
      return formatClockParams(params);
    case apiName.startsWith('keyboard'):
      return formatKeyboardParams(params);
    case apiName.startsWith('locator'):
    case apiName.startsWith('expect'):
    case apiName.startsWith('frame'):
      return formatLocatorParams(sdkLanguage, params);
    case apiName.startsWith('mouse'):
      return formatMouseParams(params);
    case apiName.startsWith('touchscreen'):
      return formatTouchscreenParams(params);
    default:
      return undefined;
  }
};
