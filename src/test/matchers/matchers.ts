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

import matchers from 'expect/build/matchers';
import { Locator } from '../../..';
import type { Expect } from '../types';
import { toBeTruthy } from './toBeTruthy';
import { toEqual } from './toEqual';
import { toMatchText } from './toMatchText';

export async function toBeChecked(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeChecked', locator, async timeout => {
    return await locator.isChecked({ timeout });
  }, options);
}

export async function toBeDisabled(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeDisabled', locator, async timeout => {
    return await locator.isDisabled({ timeout });
  }, options);
}

export async function toBeEditable(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeEditable', locator, async timeout => {
    return await locator.isEditable({ timeout });
  }, options);
}

export async function toBeEmpty(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeEmpty', locator, async timeout => {
    return await locator.evaluate(element => {
      if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA')
        return !(element as HTMLInputElement).value;
      return !element.textContent?.trim();
    }, { timeout });
  }, options);
}

export async function toBeEnabled(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeEnabled', locator, async timeout => {
    return await locator.isEnabled({ timeout });
  }, options);
}

export async function toBeFocused(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeFocused', locator, async timeout => {
    return await locator.evaluate(element => {
      return document.activeElement === element;
    }, { timeout });
  }, options);
}

export async function toBeHidden(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeHidden', locator, async timeout => {
    return await locator.isHidden({ timeout });
  }, options);
}

export async function toBeSelected(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeSelected', locator, async timeout => {
    return await locator.evaluate(element => {
      return (element as HTMLOptionElement).selected;
    }, { timeout });
  }, options);
}

export async function toBeVisible(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeVisible', locator, async timeout => {
    return await locator.isVisible({ timeout });
  }, options);
}

export async function toContainText(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string,
  options?: { timeout?: number, useInnerText?: boolean },
) {
  return toMatchText.call(this, 'toContainText', locator, async timeout => {
    if (options?.useInnerText)
      return await locator.innerText({ timeout });
    return await locator.textContent() || '';
  }, expected, { ...options, matchSubstring: true });
}

export async function toHaveAttr(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  name: string,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveAttr', locator, async timeout => {
    return await locator.getAttribute(name, { timeout }) || '';
  }, expected, options);
}

export async function toHaveClass(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveClass', locator, async timeout => {
    return await locator.evaluate(element => element.className, { timeout });
  }, expected, { ...options, matchSubstring: true });
}

export async function toHaveCSS(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  name: string,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveCSS', locator, async timeout => {
    return await locator.evaluate(async (element, name) => {
      return (window.getComputedStyle(element) as any)[name];
    }, name, { timeout });
  }, expected, options);
}

export async function toHaveData(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  name: string,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveData', locator, async timeout => {
    return await locator.getAttribute('data-' + name, { timeout }) || '';
  }, expected, options);
}

export async function toHaveId(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveId', locator, async timeout => {
    return await locator.getAttribute('id', { timeout }) || '';
  }, expected, options);
}

export async function toHaveLength(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: number,
  options?: { timeout?: number },
) {
  if (typeof locator !== 'object' || locator.constructor.name !== 'Locator')
    return matchers.toHaveLength.call(this, locator, expected);
  return toEqual.call(this, 'toHaveLength', locator, async timeout => {
    return await locator.count();
  }, expected, { expectedType: 'number', ...options });
}

export async function toHaveProp(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  name: string,
  expected: number,
  options?: { timeout?: number },
) {
  return toEqual.call(this, 'toHaveProp', locator, async timeout => {
    return await locator.evaluate((element, name) => (element as any)[name], name, { timeout });
  }, expected, { expectedType: 'number', ...options });
}

export async function toHaveText(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string | RegExp,
  options?: { timeout?: number, useInnerText?: boolean },
) {
  return toMatchText.call(this, 'toHaveText', locator, async timeout => {
    if (options?.useInnerText)
      return await locator.innerText({ timeout });
    return await locator.textContent() || '';
  }, expected, options);
}

export async function toHaveValue(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveValue', locator, async timeout => {
    return await locator.inputValue({ timeout });
  }, expected, options);
}
