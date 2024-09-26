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
import type { Frame } from '../frames';
import type * as actions from '@recorder/actions';
import type * as channels from '@protocol/channels';
import { toKeyboardModifiers } from '../codegen/language';
import { serializeExpectedTextValues } from '../../utils/expectUtils';
import { createGuid } from '../../utils';
import { serializeValue } from '../../protocol/serializers';

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

export function mainFrameForAction(pageAliases: Map<Page, string>, actionInContext: actions.ActionInContext): Frame {
  const pageAlias = actionInContext.frame.pageAlias;
  const page = [...pageAliases.entries()].find(([, alias]) => pageAlias === alias)?.[0];
  if (!page)
    throw new Error(`Internal error: page ${pageAlias} not found in [${[...pageAliases.values()]}]`);
  return page.mainFrame();
}

export async function frameForAction(pageAliases: Map<Page, string>, actionInContext: actions.ActionInContext, action: actions.ActionWithSelector): Promise<Frame> {
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

export function traceParamsForAction(actionInContext: actions.ActionInContext): { method: string, params: any } {
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
        expectedText: serializeExpectedTextValues([action.text], { matchSubstring: action.substring, normalizeWhiteSpace: true }),
        isNot: false,
      };
      return { method: 'expect', params };
    }
    case 'assertValue': {
      const params: channels.FrameExpectParams = {
        selector,
        expression: 'to.have.value',
        expectedValue: { value: serializeValue(action.value, value => ({ fallThrough: value })), handles: [] },
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

export function callMetadataForAction(pageAliases: Map<Page, string>, actionInContext: actions.ActionInContext): { callMetadata: CallMetadata, mainFrame: Frame } {
  const mainFrame = mainFrameForAction(pageAliases, actionInContext);
  const { method, params } = traceParamsForAction(actionInContext);

  const callMetadata: CallMetadata = {
    id: `call@${createGuid()}`,
    stepId: `recorder@${createGuid()}`,
    apiName: 'page.' + method,
    objectId: mainFrame.guid,
    pageId: mainFrame._page.guid,
    frameId: mainFrame.guid,
    startTime: actionInContext.timestamp,
    endTime: 0,
    type: 'Frame',
    method,
    params,
    log: [],
  };
  return { callMetadata, mainFrame };
}

export function collapseActions(actions: actions.ActionInContext[]): actions.ActionInContext[] {
  const result: actions.ActionInContext[] = [];
  for (const action of actions) {
    const lastAction = result[result.length - 1];
    const isSameAction = lastAction && lastAction.action.name === action.action.name && lastAction.frame.pageAlias === action.frame.pageAlias && lastAction.frame.framePath.join('|') === action.frame.framePath.join('|');
    const isSameSelector = lastAction && 'selector' in lastAction.action && 'selector' in action.action && action.action.selector === lastAction.action.selector;
    const shouldMerge = isSameAction && (action.action.name === 'navigate' || (action.action.name === 'fill' && isSameSelector));
    if (!shouldMerge) {
      result.push(action);
      continue;
    }
    result[result.length - 1] = action;
  }
  return result;
}
