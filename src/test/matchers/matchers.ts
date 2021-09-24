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
import { constructURLBasedOnBaseURL, isString } from '../../utils/utils';
import type { Expect } from '../types';
import { toBeTruthy } from './toBeTruthy';
import { toEqual } from './toEqual';
import { normalizeWhiteSpace, toMatchText } from './toMatchText';

export function toBeChecked(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeChecked', locator, 'Locator', async (isNot, timeout) => {
    return await (locator as any)._expect('to.be.checked', { isNot, timeout });
  }, options);
}

export function toBeDisabled(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeDisabled', locator, 'Locator', async (isNot, timeout) => {
    return await (locator as any)._expect('to.be.disabled', { isNot, timeout });
  }, options);
}

export function toBeEditable(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeEditable', locator, 'Locator', async (isNot, timeout) => {
    return await (locator as any)._expect('to.be.editable', { isNot, timeout });
  }, options);
}

export function toBeEmpty(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeEmpty', locator, 'Locator', async (isNot, timeout) => {
    return await (locator as any)._expect('to.be.empty', { isNot, timeout });
  }, options);
}

export function toBeEnabled(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeEnabled', locator, 'Locator', async (isNot, timeout) => {
    return await (locator as any)._expect('to.be.enabled', { isNot, timeout });
  }, options);
}

export function toBeFocused(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeFocused', locator, 'Locator', async (isNot, timeout) => {
    return await (locator as any)._expect('to.be.focused', { isNot, timeout });
  }, options);
}

export function toBeHidden(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeHidden', locator, 'Locator', async (isNot, timeout) => {
    return await (locator as any)._expect('to.be.hidden', { isNot, timeout });
  }, options);
}

export function toBeVisible(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeVisible', locator, 'Locator', async (isNot, timeout) => {
    return await (locator as any)._expect('to.be.visible', { isNot, timeout });
  }, options);
}

export function toContainText(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string,
  options?: { timeout?: number, useInnerText?: boolean },
) {
  return toMatchText.call(this, 'toContainText', locator, 'Locator', async (expected, isNot, timeout) => {
    return await (locator as any)._expect('to.have.text', { expected, isNot, timeout });
  }, expected, { ...options, matchSubstring: true, normalizeWhiteSpace: true, useInnerText: options?.useInnerText });
}

export function toHaveAttribute(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  name: string,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveAttribute', locator, 'Locator', async (expected, isNot, timeout) => {
    return await (locator as any)._expect('to.have.attribute', { expected, isNot, timeout, data: { name } });
  }, expected, options);
}

export function toHaveClass(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string | RegExp | (string | RegExp)[],
  options?: { timeout?: number },
) {
  if (Array.isArray(expected)) {
    return toEqual.call(this, 'toHaveClass', locator, 'Locator', async () => {
      return await locator.evaluateAll(ee => ee.map(e => e.className));
    }, expected, options);
  } else {
    return toMatchText.call(this, 'toHaveClass', locator, 'Locator', async (expected, isNot, timeout) => {
      return await (locator as any)._expect('to.have.class', { expected, isNot, timeout });
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
  return toMatchText.call(this, 'toHaveCSS', locator, 'Locator', async (expected, isNot, timeout) => {
    return await (locator as any)._expect('to.have.css', { expected, isNot, timeout, data: { name } });
  }, expected, options);
}

export function toHaveId(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveId', locator, 'Locator', async (expected, isNot, timeout) => {
    return await (locator as any)._expect('to.have.id', { expected, isNot, timeout });
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
  expected: string | RegExp | (string | RegExp)[],
  options: { timeout?: number, useInnerText?: boolean } = {},
) {
  if (Array.isArray(expected)) {
    const expectedArray = expected.map(e => isString(e) ? normalizeWhiteSpace(e) : e);
    return toEqual.call(this, 'toHaveText', locator, 'Locator', async () => {
      const texts = await locator.evaluateAll((ee, useInnerText) => {
        return ee.map(e => useInnerText ? (e as HTMLElement).innerText : e.textContent || '');
      }, options?.useInnerText);
      // Normalize those values that have string expectations.
      return texts.map((s, index) => isString(expectedArray[index]) ? normalizeWhiteSpace(s) : s);
    }, expectedArray, options);
  } else {
    return toMatchText.call(this, 'toHaveText', locator, 'Locator', async (expected, isNot, timeout) => {
      return await (locator as any)._expect('to.have.text', { expected, isNot, timeout });
    }, expected, { ...options, normalizeWhiteSpace: true, useInnerText: options?.useInnerText });
  }
}

export function toHaveTitle(
  this: ReturnType<Expect['getState']>,
  page: Page,
  expected: string | RegExp,
  options: { timeout?: number } = {},
) {
  const locator = page.locator(':root');
  return toMatchText.call(this, 'toHaveTitle', locator, 'Locator', async (expected, isNot, timeout) => {
    return await (locator as any)._expect('to.have.title', { expected, isNot, timeout });
  }, expected, { ...options, normalizeWhiteSpace: true });
}

export function toHaveURL(
  this: ReturnType<Expect['getState']>,
  page: Page,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  const baseURL = (page.context() as any)._options.baseURL;
  expected = typeof expected === 'string' ? constructURLBasedOnBaseURL(baseURL, expected) : expected;
  const locator = page.locator(':root');
  return toMatchText.call(this, 'toHaveURL', locator, 'Locator', async (expected, isNot, timeout) => {
    return await (locator as any)._expect('to.have.url', { expected, isNot, timeout });
  }, expected, options);
}

export function toHaveValue(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveValue', locator, 'Locator', async (expected, isNot, timeout) => {
    return await (locator as any)._expect('to.have.value', { expected, isNot, timeout });
  }, expected, options);
}
