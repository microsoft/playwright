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
import { monotonicTime } from '../../utils/isomorphic/time';
import { parseAriaSnapshotUnsafe } from '../../utils/isomorphic/ariaSnapshot';
import { ProgressController } from '../progress';
import { yaml } from '../../utilsBundle';

import type * as actions from './actions';
import type { Page } from '../page';
import type { Progress } from '../progress';
import type { NameValue } from '@protocol/channels';
import type { ExpectResult } from '../frames';

export async function runAction(parentProgress: Progress, mode: 'generate' | 'run', page: Page, action: actions.Action, secrets: NameValue[]) {
  const timeout = mode === 'generate' ? generateActionTimeout(action) : performActionTimeout(action);
  const mt = monotonicTime();
  const deadline = mt + timeout;
  const minDeadline = parentProgress.deadline ? Math.min(parentProgress.deadline, deadline) : deadline;
  const pc = new ProgressController();
  return await pc.run(async progress => {
    return await innerRunAction(progress, page, action, secrets);
  }, minDeadline - mt);
}

async function innerRunAction(progress: Progress, page: Page, action: actions.Action, secrets: NameValue[]) {
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
      const result = await frame.expect(progress, action.selector, { expression: 'to.be.visible', isNot: !!action.isNot });
      if (!result.matches)
        throw new Error(result.errorMessage);
      break;
    }
    case 'expectValue': {
      let result: ExpectResult;
      if (action.type === 'textbox' || action.type === 'combobox' || action.type === 'slider') {
        const expectedText = serializeExpectedTextValues([action.value]);
        result = await frame.expect(progress, action.selector, { expression: 'to.have.value', expectedText, isNot: !!action.isNot });
      } else if (action.type === 'checkbox' || action.type === 'radio') {
        const expectedValue = { checked: action.value === 'true' };
        result = await frame.expect(progress, action.selector, { selector: action.selector, expression: 'to.be.checked', expectedValue, isNot: !!action.isNot });
      } else {
        throw new Error(`Unsupported element type: ${action.type}`);
      }
      if (!result.matches)
        throw new Error(result.errorMessage);
      break;
    }
    case 'expectAria': {
      const expectedValue = parseAriaSnapshotUnsafe(yaml, action.template);
      const result = await frame.expect(progress, 'body', { expression: 'to.match.aria', expectedValue, isNot: !!action.isNot });
      if (!result.matches)
        throw new Error(result.errorMessage);
      break;
    }
  }
}

export function generateActionTimeout(action: actions.Action): number {
  switch (action.method) {
    case 'click':
    case 'drag':
    case 'hover':
    case 'selectOption':
    case 'pressKey':
    case 'pressSequentially':
    case 'fill':
    case 'setChecked':
      return 5000;
    case 'expectVisible':
    case 'expectValue':
    case 'expectAria':
      return 1;  // one shot
  }
}

export function performActionTimeout(action: actions.Action): number {
  switch (action.method) {
    case 'click':
    case 'drag':
    case 'hover':
    case 'selectOption':
    case 'pressKey':
    case 'pressSequentially':
    case 'fill':
    case 'setChecked':
      return 0;  // no timeout
    case 'expectVisible':
    case 'expectValue':
    case 'expectAria':
      return 5000;  // default expect timeout.
  }
}

const strictTrue =  { strict: true };
