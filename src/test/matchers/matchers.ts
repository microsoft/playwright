/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Locator, Page } from '../../..';
import type { Expect } from '../types';
import { toBeTruthy } from './toBeTruthy';
import { toEqual } from './toEqual';
import { toMatchText } from './toMatchText';

export function toBeChecked(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeChecked', locator, 'Locator', async timeout => {
    return await locator.isChecked({ timeout });
  }, options);
}

export function toBeDisabled(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeDisabled', locator, 'Locator', async timeout => {
    return await locator.isDisabled({ timeout });
  }, options);
}

export function toBeEditable(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeEditable', locator, 'Locator', async timeout => {
    return await locator.isEditable({ timeout });
  }, options);
}

export function toBeEmpty(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeEmpty', locator, 'Locator', async timeout => {
    return await locator.evaluate(element => {
      if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA')
        return !(element as HTMLInputElement).value;
      return !element.textContent?.trim();
    }, { timeout });
  }, options);
}

export function toBeEnabled(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeEnabled', locator, 'Locator', async timeout => {
    return await locator.isEnabled({ timeout });
  }, options);
}

export function toBeFocused(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeFocused', locator, 'Locator', async timeout => {
    return await locator.evaluate(element => {
      return document.activeElement === element;
    }, { timeout });
  }, options);
}

export function toBeHidden(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeHidden', locator, 'Locator', async timeout => {
    return await locator.isHidden({ timeout });
  }, options);
}

export function toBeVisible(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeVisible', locator, 'Locator', async timeout => {
    return await locator.isVisible({ timeout });
  }, options);
}

export function toContainText(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string,
  options?: { timeout?: number, useInnerText?: boolean },
) {
  return toMatchText.call(this, 'toContainText', locator, 'Locator', async timeout => {
    if (options?.useInnerText)
      return await locator.innerText({ timeout });
    return await locator.textContent() || '';
  }, expected, { ...options, matchSubstring: true });
}

export function toHaveAttribute(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  name: string,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveAttribute', locator, 'Locator', async timeout => {
    return await locator.getAttribute(name, { timeout }) || '';
  }, expected, options);
}

export function toHaveClass(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string | RegExp | string[],
  options?: { timeout?: number },
) {
  if (Array.isArray(expected)) {
    return toEqual.call(this, 'toHaveClass', locator, 'Locator', async () => {
      return await locator.evaluateAll(ee => ee.map(e => e.className));
    }, expected, options);
  } else {
    return toMatchText.call(this, 'toHaveClass', locator, 'Locator', async timeout => {
      return await locator.evaluate(element => element.className, { timeout });
    }, expected, options);
  }
}

export function toHaveCount(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: number,
  options?: { timeout?: number },
) {
  return toEqual.call(this, 'toHaveCount', locator, 'Locator', async timeout => {
    return await locator.count();
  }, expected, options);
}

export function toHaveCSS(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  name: string,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveCSS', locator, 'Locator', async timeout => {
    return await locator.evaluate(async (element, name) => {
      return (window.getComputedStyle(element) as any)[name];
    }, name, { timeout });
  }, expected, options);
}

export function toHaveId(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveId', locator, 'Locator', async timeout => {
    return await locator.getAttribute('id', { timeout }) || '';
  }, expected, options);
}

export function toHaveJSProperty(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  name: string,
  expected: any,
  options?: { timeout?: number },
) {
  return toEqual.call(this, 'toHaveJSProperty', locator, 'Locator', async timeout => {
    return await locator.evaluate((element, name) => (element as any)[name], name, { timeout });
  }, expected, options);
}

export function toHaveText(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string | RegExp | string[],
  options?: { timeout?: number, useInnerText?: boolean },
) {
  if (Array.isArray(expected)) {
    return toEqual.call(this, 'toHaveText', locator, 'Locator', async () => {
      return locator.evaluateAll((ee, useInnerText) => {
        return ee.map(e => useInnerText ? (e as HTMLElement).innerText : e.textContent || '');
      }, options?.useInnerText);
    }, expected, options);
  } else {
    return toMatchText.call(this, 'toHaveText', locator, 'Locator', async timeout => {
      if (options?.useInnerText)
        return await locator.innerText({ timeout });
      return await locator.textContent() || '';
    }, expected, options);
  }
}

export function toHaveTitle(
  this: ReturnType<Expect['getState']>,
  page: Page,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveTitle', page, 'Page', async () => {
    return await page.title();
  }, expected, options);
}

export function toHaveURL(
  this: ReturnType<Expect['getState']>,
  page: Page,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveURL', page, 'Page', async () => {
    return page.url();
  }, expected, options);
}

export function toHaveValue(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveValue', locator, 'Locator', async timeout => {
    return await locator.inputValue({ timeout });
  }, expected, options);
}
