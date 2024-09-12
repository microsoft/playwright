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

import type { CallMetadata } from '../instrumentation';
import type { CallLog, CallLogStatus } from '@recorder/recorderTypes';
import type { Page } from '../page';
import type { ActionInContext } from '../codegen/types';
import type { Frame } from '../frames';
import type * as actions from './recorderActions';
import { toKeyboardModifiers } from '../codegen/language';
import { serializeExpectedTextValues } from '../../utils/expectUtils';

export function metadataToCallLog(metadata: CallMetadata, status: CallLogStatus): CallLog {
  let title = metadata.apiName || metadata.method;
  if (metadata.method === 'waitForEventInfo')
    title += `(${metadata.params.info.event})`;
  title = title.replace('object.expect', 'expect');
  if (metadata.error)
    status = 'error';
  const params = {
    url: metadata.params?.url,
    selector: metadata.params?.selector,
  };
  let duration = metadata.endTime ? metadata.endTime - metadata.startTime : undefined;
  if (typeof duration === 'number' && metadata.pauseStartTime && metadata.pauseEndTime) {
    duration -= (metadata.pauseEndTime - metadata.pauseStartTime);
    duration = Math.max(duration, 0);
  }
  const callLog: CallLog = {
    id: metadata.id,
    messages: metadata.log,
    title,
    status,
    error: metadata.error?.error?.message,
    params,
    duration,
  };
  return callLog;
}

export function buildFullSelector(framePath: string[], selector: string) {
  return [...framePath, selector].join(' >> internal:control=enter-frame >> ');
}

export function mainFrameForAction(pageAliases: Map<Page, string>, actionInContext: ActionInContext): Frame {
  const pageAlias = actionInContext.frame.pageAlias;
  const page = [...pageAliases.entries()].find(([, alias]) => pageAlias === alias)?.[0];
  if (!page)
    throw new Error('Internal error: page not found');
  return page.mainFrame();
}

export async function frameForAction(pageAliases: Map<Page, string>, actionInContext: ActionInContext, action: actions.ActionWithSelector): Promise<Frame> {
  const pageAlias = actionInContext.frame.pageAlias;
  const page = [...pageAliases.entries()].find(([, alias]) => pageAlias === alias)?.[0];
  if (!page)
    throw new Error('Internal error: page not found');
  const fullSelector = buildFullSelector(actionInContext.frame.framePath, action.selector);
  const result = await page.mainFrame().selectors.resolveFrameForSelector(fullSelector);
  if (!result)
    throw new Error('Internal error: frame not found');
  return result.frame;
}

export function traceParamsForAction(actionInContext: ActionInContext) {
  const { action } = actionInContext;

  switch (action.name) {
    case 'navigate': return { url: action.url };
    case 'openPage': return {};
    case 'closePage': return {};
  }

  const selector = buildFullSelector(actionInContext.frame.framePath, action.selector);
  switch (action.name) {
    case 'click': return { selector, clickCount: action.clickCount };
    case 'press': {
      const modifiers = toKeyboardModifiers(action.modifiers);
      const shortcut = [...modifiers, action.key].join('+');
      return { selector, key: shortcut };
    }
    case 'fill': return { selector, text: action.text };
    case 'setInputFiles': return { selector, files: action.files };
    case 'check': return { selector };
    case 'uncheck': return { selector };
    case 'select': return { selector, values: action.options.map(value => ({ value })) };
    case 'assertChecked': {
      return {
        selector,
        expression: 'to.be.checked',
        isNot: !action.checked,
      };
    }
    case 'assertText': {
      return {
        selector,
        expression: 'to.have.text',
        expectedText: serializeExpectedTextValues([action.text], { matchSubstring: true, normalizeWhiteSpace: true }),
        isNot: false,
      };
    }
    case 'assertValue': {
      return {
        selector,
        expression: 'to.have.value',
        expectedValue: action.value,
        isNot: false,
      };
    }
    case 'assertVisible': {
      return {
        selector,
        expression: 'to.be.visible',
        isNot: false,
      };
    }
  }
}
