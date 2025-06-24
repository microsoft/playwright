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

import { serializeExpectedTextValues } from '../../utils';
import { toKeyboardModifiers } from '../codegen/language';
import { serverSideCallMetadata } from '../instrumentation';
import { buildFullSelector, mainFrameForAction } from './recorderUtils';
import { Progress, ProgressController } from '../progress';

import type { Page } from '../page';
import type * as types from '../types';
import type * as actions from '@recorder/actions';
import type { Frame } from '../frames';

export async function performAction(pageAliases: Map<Page, string>, actionInContext: actions.ActionInContext) {
  const callMetadata = serverSideCallMetadata();
  const mainFrame = mainFrameForAction(pageAliases, actionInContext);
  const controller = new ProgressController(callMetadata, mainFrame);
  const kActionTimeout = 5000;
  return await controller.run(progress => performActionImpl(progress, mainFrame, actionInContext), kActionTimeout);
}

async function performActionImpl(progress: Progress, mainFrame: Frame, actionInContext: actions.ActionInContext) {
  const { action } = actionInContext;

  if (action.name === 'navigate') {
    await mainFrame.goto(progress, action.url);
    return;
  }

  if (action.name === 'openPage')
    throw Error('Not reached');

  if (action.name === 'closePage') {
    await mainFrame._page.close();
    return;
  }

  const selector = buildFullSelector(actionInContext.frame.framePath, action.selector);

  if (action.name === 'click') {
    const options = toClickOptions(action);
    await mainFrame.click(progress, selector, { ...options, strict: true });
    return;
  }

  if (action.name === 'press') {
    const modifiers = toKeyboardModifiers(action.modifiers);
    const shortcut = [...modifiers, action.key].join('+');
    await mainFrame.press(progress, selector, shortcut, { strict: true });
    return;
  }

  if (action.name === 'fill') {
    await mainFrame.fill(progress, selector, action.text, { strict: true });
    return;
  }

  if (action.name === 'setInputFiles') {
    await mainFrame.setInputFiles(progress, selector, { selector, payloads: [], strict: true });
    return;
  }

  if (action.name === 'check') {
    await mainFrame.check(progress, selector, { strict: true });
    return;
  }

  if (action.name === 'uncheck') {
    await mainFrame.uncheck(progress, selector, { strict: true });
    return;
  }

  if (action.name === 'select') {
    const values = action.options.map(value => ({ value }));
    await mainFrame.selectOption(progress, selector, [], values, { strict: true });
    return;
  }

  if (action.name === 'assertChecked') {
    await mainFrame.expect(progress, selector, {
      selector,
      expression: 'to.be.checked',
      expectedValue: { checked: action.checked },
      isNot: !action.checked,
    });
    return;
  }

  if (action.name === 'assertText') {
    await mainFrame.expect(progress, selector, {
      selector,
      expression: 'to.have.text',
      expectedText: serializeExpectedTextValues([action.text], { matchSubstring: true, normalizeWhiteSpace: true }),
      isNot: false,
    });
    return;
  }

  if (action.name === 'assertValue') {
    await mainFrame.expect(progress, selector, {
      selector,
      expression: 'to.have.value',
      expectedValue: action.value,
      isNot: false,
    });
    return;
  }

  if (action.name === 'assertVisible') {
    await mainFrame.expect(progress, selector, {
      selector,
      expression: 'to.be.visible',
      isNot: false,
    });
    return;
  }

  throw new Error('Internal error: unexpected action ' + (action as any).name);
}

export function toClickOptions(action: actions.ClickAction): types.MouseClickOptions {
  const modifiers = toKeyboardModifiers(action.modifiers);
  const options: types.MouseClickOptions = {};
  if (action.button !== 'left')
    options.button = action.button;
  if (modifiers.length)
    options.modifiers = modifiers;
  if (action.clickCount > 1)
    options.clickCount = action.clickCount;
  if (action.position)
    options.position = action.position;
  return options;
}
