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

import { serializeExpectedTextValues } from '../utils/expectUtils';
import { serializePlainValue } from '../../protocol/serializers';

import type * as actions from './actions';
import type * as channels from '@protocol/channels';
import type { Page } from '../page';
import type { Progress } from '../progress';
import type { NameValue } from '@protocol/channels';
import type { ExpectResult } from '../frames';

export async function runAction(progress: Progress, page: Page, action: actions.Action, secrets: NameValue[]) {
  const frame = page.mainFrame();
  switch (action.method) {
    case 'click':
      await frame.click(progress, action.selector, { ...action.options, ...strictTrue });
      break;
    case 'drag':
      await frame.dragAndDrop(progress, action.sourceSelector, action.targetSelector, { ...strictTrue });
      break;
    case 'hover':
      await frame.hover(progress, action.selector, { ...action.options, ...strictTrue });
      break;
    case 'selectOption':
      await frame.selectOption(progress, action.selector, [], action.labels.map(a => ({ label: a })), { ...strictTrue });
      break;
    case 'pressKey':
      await page.keyboard.press(progress, action.key);
      break;
    case 'pressSequentially': {
      const secret = secrets?.find(s => s.name === action.text)?.value ?? action.text;
      await frame.type(progress, action.selector, secret, { ...strictTrue });
      if (action.submit)
        await page.keyboard.press(progress, 'Enter');
      break;
    }
    case 'fill': {
      const secret = secrets?.find(s => s.name === action.text)?.value ?? action.text;
      await frame.fill(progress, action.selector, secret, { ...strictTrue });
      if (action.submit)
        await page.keyboard.press(progress, 'Enter');
      break;
    }
    case 'setChecked':
      if (action.checked)
        await frame.check(progress, action.selector, { ...strictTrue });
      else
        await frame.uncheck(progress, action.selector, { ...strictTrue });
      break;
    case 'expectVisible': {
      const result = await frame.expect(progress, action.selector, { expression: 'to.be.visible', isNot: false }, 5000);
      if (result.errorMessage)
        throw new Error(result.errorMessage);
      break;
    }
    case 'expectValue': {
      let result: ExpectResult;
      if (action.type === 'textbox' || action.type === 'combobox' || action.type === 'slider') {
        const expectedText = serializeExpectedTextValues([action.value]);
        result = await frame.expect(progress, action.selector, { expression: 'to.have.value', expectedText, isNot: false }, 5000);
      } else if (action.type === 'checkbox' || action.type === 'radio') {
        const expectedValue = serializeArgument({ checked: true });
        result = await frame.expect(progress, action.selector, { expression: 'to.be.checked', expectedValue, isNot: false }, 5000);
      } else {
        throw new Error(`Unsupported element type: ${action.type}`);
      }
      if (result.errorMessage)
        throw new Error(result.errorMessage);
      break;
    }
  }
}

export function serializeArgument(arg: any): channels.SerializedArgument {
  return {
    value: serializePlainValue(arg),
    handles: []
  };
}

const strictTrue =  { strict: true };
