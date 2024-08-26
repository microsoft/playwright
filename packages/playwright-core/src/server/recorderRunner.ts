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

import { createGuid, monotonicTime, serializeExpectedTextValues } from '../utils';
import { toClickOptions, toKeyboardModifiers } from './codegen/language';
import type { Frame } from './frames';
import type { CallMetadata } from './instrumentation';
import type * as actions from './recorder/recorderActions';

async function innerPerformAction(frame: Frame, action: string, params: any, cb: (callMetadata: CallMetadata) => Promise<any>): Promise<boolean> {
  const callMetadata: CallMetadata = {
    id: `call@${createGuid()}`,
    apiName: 'frame.' + action,
    objectId: frame.guid,
    pageId: frame._page.guid,
    frameId: frame.guid,
    startTime: monotonicTime(),
    endTime: 0,
    type: 'Frame',
    method: action,
    params,
    log: [],
  };

  try {
    await frame.instrumentation.onBeforeCall(frame, callMetadata);
    await cb(callMetadata);
  } catch (e) {
    callMetadata.endTime = monotonicTime();
    await frame.instrumentation.onAfterCall(frame, callMetadata);
    return false;
  }

  callMetadata.endTime = monotonicTime();
  await frame.instrumentation.onAfterCall(frame, callMetadata);
  return true;
}

export async function performAction(frame: Frame, action: actions.Action): Promise<boolean> {
  const kActionTimeout = 5000;
  if (action.name === 'click') {
    const options = toClickOptions(action);
    return await innerPerformAction(frame, 'click', { selector: action.selector }, callMetadata => frame.click(callMetadata, action.selector, { ...options, timeout: kActionTimeout, strict: true }));
  }
  if (action.name === 'press') {
    const modifiers = toKeyboardModifiers(action.modifiers);
    const shortcut = [...modifiers, action.key].join('+');
    return await innerPerformAction(frame, 'press', { selector: action.selector, key: shortcut }, callMetadata => frame.press(callMetadata, action.selector, shortcut, { timeout: kActionTimeout, strict: true }));
  }
  if (action.name === 'fill')
    return await innerPerformAction(frame, 'fill', { selector: action.selector, text: action.text }, callMetadata => frame.fill(callMetadata, action.selector, action.text, { timeout: kActionTimeout, strict: true }));
  if (action.name === 'setInputFiles')
    return await innerPerformAction(frame, 'setInputFiles', { selector: action.selector, files: action.files }, callMetadata => frame.setInputFiles(callMetadata, action.selector, { selector: action.selector, payloads: [], timeout: kActionTimeout, strict: true }));
  if (action.name === 'check')
    return await innerPerformAction(frame, 'check', { selector: action.selector }, callMetadata => frame.check(callMetadata, action.selector, { timeout: kActionTimeout, strict: true }));
  if (action.name === 'uncheck')
    return await innerPerformAction(frame, 'uncheck', { selector: action.selector }, callMetadata => frame.uncheck(callMetadata, action.selector, { timeout: kActionTimeout, strict: true }));
  if (action.name === 'select') {
    const values = action.options.map(value => ({ value }));
    return await innerPerformAction(frame, 'selectOption', { selector: action.selector, values }, callMetadata => frame.selectOption(callMetadata, action.selector, [], values, { timeout: kActionTimeout, strict: true }));
  }
  if (action.name === 'navigate')
    return await innerPerformAction(frame, 'goto', { url: action.url }, callMetadata => frame.goto(callMetadata, action.url, { timeout: kActionTimeout }));
  if (action.name === 'closePage')
    return await innerPerformAction(frame, 'close', {}, callMetadata => frame._page.close(callMetadata));
  if (action.name === 'openPage')
    throw Error('Not reached');
  if (action.name === 'assertChecked') {
    return await innerPerformAction(frame, 'expect', { selector: action.selector }, callMetadata => frame.expect(callMetadata, action.selector, {
      selector: action.selector,
      expression: 'to.be.checked',
      isNot: !action.checked,
      timeout: kActionTimeout,
    }));
  }
  if (action.name === 'assertText') {
    return await innerPerformAction(frame, 'expect', { selector: action.selector }, callMetadata => frame.expect(callMetadata, action.selector, {
      selector: action.selector,
      expression: 'to.have.text',
      expectedText: serializeExpectedTextValues([action.text], { matchSubstring: true, normalizeWhiteSpace: true }),
      isNot: false,
      timeout: kActionTimeout,
    }));
  }
  if (action.name === 'assertValue') {
    return await innerPerformAction(frame, 'expect', { selector: action.selector }, callMetadata => frame.expect(callMetadata, action.selector, {
      selector: action.selector,
      expression: 'to.have.value',
      expectedValue: action.value,
      isNot: false,
      timeout: kActionTimeout,
    }));
  }
  if (action.name === 'assertVisible') {
    return await innerPerformAction(frame, 'expect', { selector: action.selector }, callMetadata => frame.expect(callMetadata, action.selector, {
      selector: action.selector,
      expression: 'to.be.visible',
      isNot: false,
      timeout: kActionTimeout,
    }));
  }
  throw new Error('Internal error: unexpected action ' + (action as any).name);
}
