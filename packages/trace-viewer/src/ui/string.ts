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

const formatClockParams = (params: {
  ticksNumber?: number;
  ticksString?: string;
  timeNumber?: number;
}): string | undefined => {
  if (params.ticksNumber !== undefined) {
    // clock.fastForward/runFor
    return `${params.ticksNumber}ms`;
  } else if (params.ticksString !== undefined) {
    // clock.fastForward/runFor
    return params.ticksString;
  } else if (params.timeNumber !== undefined) {
    // clock.pauseAt/setFixedTime/setSystemTime
    try {
      return new Date(params.timeNumber).toLocaleString(undefined, {
        timeZone: 'UTC',
      });
    } catch (e) {
      return undefined;
    }
  }

  return undefined;
};

const formatLocatorParams = (
  sdkLanguage: Language,
  params: { selector?: string },
): string | undefined =>
  params.selector !== undefined
    ? asLocator(sdkLanguage, params.selector)
    : undefined;

const formatKeyboardParams = (params: {
  key?: string;
  text?: string;
}): string | undefined => {
  if (params.key !== undefined) {
    // keyboard.press/down/up
    return params.key;
  } else if (params.text !== undefined) {
    // keyboard.type/insertText
    return `"${params.text}"`;
  }

  return undefined;
};

const formatMouseParams = (params: {
  x?: number;
  y?: number;
  deltaX?: number;
  deltaY?: number;
}): string | undefined => {
  if (params.x !== undefined && params.y !== undefined) {
    // mouse.click/dblclick/move
    return `(${params.x}, ${params.y})`;
  } else if (params.deltaX !== undefined && params.deltaY !== undefined) {
    // mouse.wheel
    return `(${params.deltaX}, ${params.deltaY})`;
  }

  return undefined;
};

const formatTouchscreenParams = (params: {
  x?: number;
  y?: number;
}): string | undefined => {
  if (params.x && params.y) {
    // touchscreen.tap
    return `(${params.x}, ${params.y})`;
  }

  return undefined;
};

export const actionParameterDisplayString = (
  action: ActionTraceEvent,
  sdkLanguage: Language,
): string | undefined => {
  const params = action.params;
  const apiName = action.apiName;

  switch (true) {
    case apiName.startsWith('clock'):
      return formatClockParams(params);
    case apiName.startsWith('keyboard'):
      return formatKeyboardParams(params);
    case apiName.startsWith('locator'):
    case apiName.startsWith('expect'):
      return formatLocatorParams(sdkLanguage, params);
    case apiName.startsWith('mouse'):
      return formatMouseParams(params);
    case apiName.startsWith('touchscreen'):
      return formatTouchscreenParams(params);
    default:
      return undefined;
  }
};
