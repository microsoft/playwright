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

import { asLocator } from '../../utils/isomorphic/locatorGenerators';
import { escapeTemplateString, escapeWithQuotes, formatObjectOrVoid } from '../../utils/isomorphic/stringUtils';

import type * as actions from './actions';
import type { Language } from '../../utils/isomorphic/locatorGenerators';

export async function generateCode(sdkLanguage: Language, action: actions.Action) {
  switch (action.method) {
    case 'click': {
      const locator = asLocator(sdkLanguage, action.selector);
      return `await page.${locator}.click(${formatObjectOrVoid(action.options)});`;
    }
    case 'drag': {
      const sourceLocator = asLocator(sdkLanguage, action.sourceSelector);
      const targetLocator = asLocator(sdkLanguage, action.targetSelector);
      return `await page.${sourceLocator}.dragAndDrop(${targetLocator});`;
    }
    case 'hover': {
      const locator = asLocator(sdkLanguage, action.selector);
      return `await page.${locator}.hover(${formatObjectOrVoid(action.options)});`;
    }
    case 'pressKey': {
      return `await page.keyboard.press(${escapeWithQuotes(action.key, '\'')});`;
    }
    case 'selectOption': {
      const locator = asLocator(sdkLanguage, action.selector);
      return `await page.${locator}.selectOption(${action.labels.length === 1 ? escapeWithQuotes(action.labels[0]) : '[' + action.labels.map(label => escapeWithQuotes(label)).join(', ') + ']'});`;
    }
    case 'pressSequentially': {
      const locator = asLocator(sdkLanguage, action.selector);
      const code = [`await page.${locator}.pressSequentially(${escapeWithQuotes(action.text)});`];
      if (action.submit)
        code.push(`await page.keyboard.press('Enter');`);
      return code.join('\n');
    }
    case 'fill': {
      const locator = asLocator(sdkLanguage, action.selector);
      const code = [`await page.${locator}.fill(${escapeWithQuotes(action.text)});`];
      if (action.submit)
        code.push(`await page.keyboard.press('Enter');`);
      return code.join('\n');
    }
    case 'setChecked': {
      const locator = asLocator(sdkLanguage, action.selector);
      if (action.checked)
        return `await page.${locator}.check();`;
      else
        return `await page.${locator}.uncheck();`;
    }
    case 'expectVisible': {
      const locator = asLocator(sdkLanguage, action.selector);
      return `await expect(page.${locator}).toBeVisible();`;
    }
    case 'expectValue': {
      const locator = asLocator(sdkLanguage, action.selector);
      if (action.type === 'checkbox' || action.type === 'radio')
        return `await expect(page.${locator}).toBeChecked({ checked: ${action.value === 'true'} });`;
      return `await expect(page.${locator}).toHaveValue(${escapeWithQuotes(action.value)});`;
    }
    case 'expectAria': {
      return `await expect(page.locator('body')).toMatchAria(\`\n${escapeTemplateString(action.template)}\n\`);`;
    }
  }
  // @ts-expect-error
  throw new Error('Unknown action ' + action.method);
}
