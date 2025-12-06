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

import type * as actions from './actions';
import type { Page } from '../page';
import type { Progress } from '../progress';

export async function runAction(progress: Progress, page: Page, action: actions.Action) {
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
      await frame.selectOption(progress, action.selector, [], action.values.map(a => ({ value: a })), { ...strictTrue });
      break;
    case 'pressKey':
      await page.keyboard.press(progress, action.key);
      break;
    case 'pressSequentially':
      await frame.type(progress, action.selector, action.text, { ...strictTrue });
      if (action.submit)
        await page.keyboard.press(progress, 'Enter');
      break;
    case 'fill':
      await frame.fill(progress, action.selector, action.text, { ...strictTrue });
      if (action.submit)
        await page.keyboard.press(progress, 'Enter');
      break;
  }
}

const strictTrue =  { strict: true };
