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

import { createGuid, monotonicTime, serializeExpectedTextValues } from '../../utils';
import { toClickOptions, toKeyboardModifiers } from '../codegen/language';
import type { ActionInContext } from '../codegen/types';
import type { Frame } from '../frames';
import type { CallMetadata } from '../instrumentation';
import type { Page } from '../page';
import { buildFullSelector } from './recorderUtils';

async function innerPerformAction(mainFrame: Frame, action: string, params: any, cb: (callMetadata: CallMetadata) => Promise<any>): Promise<boolean> {
  const callMetadata: CallMetadata = {
    id: `call@${createGuid()}`,
    apiName: 'frame.' + action,
    objectId: mainFrame.guid,
    pageId: mainFrame._page.guid,
    frameId: mainFrame.guid,
    startTime: monotonicTime(),
    endTime: 0,
    type: 'Frame',
    method: action,
    params,
    log: [],
  };

  try {
    await mainFrame.instrumentation.onBeforeCall(mainFrame, callMetadata);
    await cb(callMetadata);
  } catch (e) {
    callMetadata.endTime = monotonicTime();
    await mainFrame.instrumentation.onAfterCall(mainFrame, callMetadata);
    return false;
  }

  callMetadata.endTime = monotonicTime();
  await mainFrame.instrumentation.onAfterCall(mainFrame, callMetadata);
  return true;
}

export async function performAction(pageAliases: Map<Page, string>, actionInContext: ActionInContext): Promise<boolean> {
  const pageAlias = actionInContext.frame.pageAlias;
  const page = [...pageAliases.entries()].find(([, alias]) => pageAlias === alias)?.[0];
  if (!page)
    throw new Error('Internal error: page not found');
  const mainFrame = page.mainFrame();
  const { action } = actionInContext;
  const kActionTimeout = 5000;

  if (action.name === 'navigate')
    return await innerPerformAction(mainFrame, 'goto', { url: action.url }, callMetadata => mainFrame.goto(callMetadata, action.url, { timeout: kActionTimeout }));
  if (action.name === 'openPage')
    throw Error('Not reached');
  if (action.name === 'closePage')
    return await innerPerformAction(mainFrame, 'close', {}, callMetadata => mainFrame._page.close(callMetadata));

  const selector = buildFullSelector(actionInContext.frame.framePath, action.selector);

  if (action.name === 'click') {
    const options = toClickOptions(action);
    return await innerPerformAction(mainFrame, 'click', { selector }, callMetadata => mainFrame.click(callMetadata, selector, { ...options, timeout: kActionTimeout, strict: true }));
  }
  if (action.name === 'press') {
    const modifiers = toKeyboardModifiers(action.modifiers);
    const shortcut = [...modifiers, action.key].join('+');
    return await innerPerformAction(mainFrame, 'press', { selector, key: shortcut }, callMetadata => mainFrame.press(callMetadata, selector, shortcut, { timeout: kActionTimeout, strict: true }));
  }
  if (action.name === 'fill')
    return await innerPerformAction(mainFrame, 'fill', { selector, text: action.text }, callMetadata => mainFrame.fill(callMetadata, selector, action.text, { timeout: kActionTimeout, strict: true }));
  if (action.name === 'setInputFiles')
    return await innerPerformAction(mainFrame, 'setInputFiles', { selector, files: action.files }, callMetadata => mainFrame.setInputFiles(callMetadata, selector, { selector, payloads: [], timeout: kActionTimeout, strict: true }));
  if (action.name === 'check')
    return await innerPerformAction(mainFrame, 'check', { selector }, callMetadata => mainFrame.check(callMetadata, selector, { timeout: kActionTimeout, strict: true }));
  if (action.name === 'uncheck')
    return await innerPerformAction(mainFrame, 'uncheck', { selector }, callMetadata => mainFrame.uncheck(callMetadata, selector, { timeout: kActionTimeout, strict: true }));
  if (action.name === 'select') {
    const values = action.options.map(value => ({ value }));
    return await innerPerformAction(mainFrame, 'selectOption', { selector, values }, callMetadata => mainFrame.selectOption(callMetadata, selector, [], values, { timeout: kActionTimeout, strict: true }));
  }
  if (action.name === 'assertChecked') {
    return await innerPerformAction(mainFrame, 'expect', { selector }, callMetadata => mainFrame.expect(callMetadata, selector, {
      selector,
      expression: 'to.be.checked',
      isNot: !action.checked,
      timeout: kActionTimeout,
    }));
  }
  if (action.name === 'assertText') {
    return await innerPerformAction(mainFrame, 'expect', { selector }, callMetadata => mainFrame.expect(callMetadata, selector, {
      selector,
      expression: 'to.have.text',
      expectedText: serializeExpectedTextValues([action.text], { matchSubstring: true, normalizeWhiteSpace: true }),
      isNot: false,
      timeout: kActionTimeout,
    }));
  }
  if (action.name === 'assertValue') {
    return await innerPerformAction(mainFrame, 'expect', { selector }, callMetadata => mainFrame.expect(callMetadata, selector, {
      selector,
      expression: 'to.have.value',
      expectedValue: action.value,
      isNot: false,
      timeout: kActionTimeout,
    }));
  }
  if (action.name === 'assertVisible') {
    return await innerPerformAction(mainFrame, 'expect', { selector }, callMetadata => mainFrame.expect(callMetadata, selector, {
      selector,
      expression: 'to.be.visible',
      isNot: false,
      timeout: kActionTimeout,
    }));
  }
  throw new Error('Internal error: unexpected action ' + (action as any).name);
}
