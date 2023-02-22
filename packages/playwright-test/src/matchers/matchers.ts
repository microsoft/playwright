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

import type { Locator, Page, APIResponse } from 'playwright-core';
import type { FrameExpectOptions } from 'playwright-core/lib/client/types';
import { colors } from 'playwright-core/lib/utilsBundle';
import type { Expect } from '../common/types';
import { expectTypes, callLogText } from '../util';
import { currentTestInfo } from '../common/globals';
import type { TestInfoErrorState } from '../worker/testInfo';
import { toBeTruthy } from './toBeTruthy';
import { toEqual } from './toEqual';
import { toExpectedTextValues, toMatchText } from './toMatchText';
import { constructURLBasedOnBaseURL, isTextualMimeType, pollAgainstTimeout } from 'playwright-core/lib/utils';

interface LocatorEx extends Locator {
  _expect(expression: string, options: Omit<FrameExpectOptions, 'expectedValue'> & { expectedValue?: any }): Promise<{ matches: boolean, received?: any, log?: string[], timedOut?: boolean }>;
}

interface APIResponseEx extends APIResponse {
  _fetchLog(): Promise<string[]>;
}

export function toBeChecked(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  options?: { checked?: boolean, timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeChecked', locator, 'Locator', async (isNot, timeout) => {
    const checked = !options || options.checked === undefined || options.checked === true;
    return await locator._expect(checked ? 'to.be.checked' : 'to.be.unchecked', { isNot, timeout });
  }, options);
}

export function toBeDisabled(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeDisabled', locator, 'Locator', async (isNot, timeout) => {
    return await locator._expect('to.be.disabled', { isNot, timeout });
  }, options);
}

export function toBeEditable(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  options?: { editable?: boolean, timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeEditable', locator, 'Locator', async (isNot, timeout) => {
    const editable = !options || options.editable === undefined || options.editable === true;
    return await locator._expect(editable ? 'to.be.editable' : 'to.be.readonly', { isNot, timeout });
  }, options);
}

export function toBeEmpty(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeEmpty', locator, 'Locator', async (isNot, timeout) => {
    return await locator._expect('to.be.empty', { isNot, timeout });
  }, options);
}

export function toBeEnabled(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  options?: { enabled?: boolean, timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeEnabled', locator, 'Locator', async (isNot, timeout) => {
    const enabled = !options || options.enabled === undefined || options.enabled === true;
    return await locator._expect(enabled ? 'to.be.enabled' : 'to.be.disabled', { isNot, timeout });
  }, options);
}

export function toBeFocused(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeFocused', locator, 'Locator', async (isNot, timeout) => {
    return await locator._expect('to.be.focused', { isNot, timeout });
  }, options);
}

export function toBeHidden(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeHidden', locator, 'Locator', async (isNot, timeout) => {
    return await locator._expect('to.be.hidden', { isNot, timeout });
  }, options);
}

export function toBeVisible(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  options?: { visible?: boolean, timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeVisible', locator, 'Locator', async (isNot, timeout) => {
    const visible = !options || options.visible === undefined || options.visible === true;
    return await locator._expect(visible ? 'to.be.visible' : 'to.be.hidden', { isNot, timeout });
  }, options);
}

export function toBeInViewport(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  options?: { timeout?: number, ratio?: number },
) {
  return toBeTruthy.call(this, 'toBeInViewport', locator, 'Locator', async (isNot, timeout) => {
    return await locator._expect('to.be.in.viewport', { isNot, expectedNumber: options?.ratio, timeout });
  }, options);
}

export function toContainText(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  expected: string | RegExp | (string | RegExp)[],
  options: { timeout?: number, useInnerText?: boolean, ignoreCase?: boolean } = {},
) {
  if (Array.isArray(expected)) {
    return toEqual.call(this, 'toContainText', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = toExpectedTextValues(expected, { matchSubstring: true, normalizeWhiteSpace: true, ignoreCase: options.ignoreCase });
      return await locator._expect('to.contain.text.array', { expectedText, isNot, useInnerText: options.useInnerText, timeout });
    }, expected, { ...options, contains: true });
  } else {
    return toMatchText.call(this, 'toContainText', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = toExpectedTextValues([expected], { matchSubstring: true, normalizeWhiteSpace: true, ignoreCase: options.ignoreCase });
      return await locator._expect('to.have.text', { expectedText, isNot, useInnerText: options.useInnerText, timeout });
    }, expected, options);
  }
}

export function toHaveAttribute(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  name: string,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveAttribute', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = toExpectedTextValues([expected]);
    return await locator._expect('to.have.attribute', { expressionArg: name, expectedText, isNot, timeout });
  }, expected, options);
}

export function toHaveClass(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  expected: string | RegExp | (string | RegExp)[],
  options?: { timeout?: number },
) {
  if (Array.isArray(expected)) {
    return toEqual.call(this, 'toHaveClass', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = toExpectedTextValues(expected);
      return await locator._expect('to.have.class.array', { expectedText, isNot, timeout });
    }, expected, options);
  } else {
    return toMatchText.call(this, 'toHaveClass', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = toExpectedTextValues([expected]);
      return await locator._expect('to.have.class', { expectedText, isNot, timeout });
    }, expected, options);
  }
}

export function toHaveCount(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  expected: number,
  options?: { timeout?: number },
) {
  return toEqual.call(this, 'toHaveCount', locator, 'Locator', async (isNot, timeout) => {
    return await locator._expect('to.have.count', { expectedNumber: expected, isNot, timeout });
  }, expected, options);
}

export function toHaveCSS(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  name: string,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveCSS', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = toExpectedTextValues([expected]);
    return await locator._expect('to.have.css', { expressionArg: name, expectedText, isNot, timeout });
  }, expected, options);
}

export function toHaveId(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveId', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = toExpectedTextValues([expected]);
    return await locator._expect('to.have.id', { expectedText, isNot, timeout });
  }, expected, options);
}

export function toHaveJSProperty(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  name: string,
  expected: any,
  options?: { timeout?: number },
) {
  return toEqual.call(this, 'toHaveJSProperty', locator, 'Locator', async (isNot, timeout) => {
    return await locator._expect('to.have.property', { expressionArg: name, expectedValue: expected, isNot, timeout });
  }, expected, options);
}

export function toHaveText(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  expected: string | RegExp | (string | RegExp)[],
  options: { timeout?: number, useInnerText?: boolean, ignoreCase?: boolean } = {},
) {
  if (Array.isArray(expected)) {
    return toEqual.call(this, 'toHaveText', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = toExpectedTextValues(expected, { normalizeWhiteSpace: true, ignoreCase: options.ignoreCase });
      return await locator._expect('to.have.text.array', { expectedText, isNot, useInnerText: options?.useInnerText, timeout });
    }, expected, options);
  } else {
    return toMatchText.call(this, 'toHaveText', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = toExpectedTextValues([expected], { normalizeWhiteSpace: true, ignoreCase: options.ignoreCase });
      return await locator._expect('to.have.text', { expectedText, isNot, useInnerText: options?.useInnerText, timeout });
    }, expected, options);
  }
}

export function toHaveValue(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveValue', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = toExpectedTextValues([expected]);
    return await locator._expect('to.have.value', { expectedText, isNot, timeout });
  }, expected, options);
}

export function toHaveValues(
  this: ReturnType<Expect['getState']>,
  locator: LocatorEx,
  expected: (string | RegExp)[],
  options?: { timeout?: number },
) {
  return toEqual.call(this, 'toHaveValues', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = toExpectedTextValues(expected);
    return await locator._expect('to.have.values', { expectedText, isNot, timeout });
  }, expected, options);
}

export function toHaveTitle(
  this: ReturnType<Expect['getState']>,
  page: Page,
  expected: string | RegExp,
  options: { timeout?: number } = {},
) {
  const locator = page.locator(':root') as LocatorEx;
  return toMatchText.call(this, 'toHaveTitle', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = toExpectedTextValues([expected], { normalizeWhiteSpace: true });
    return await locator._expect('to.have.title', { expectedText, isNot, timeout });
  }, expected, options);
}

export function toHaveURL(
  this: ReturnType<Expect['getState']>,
  page: Page,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  const baseURL = (page.context() as any)._options.baseURL;
  expected = typeof expected === 'string' ? constructURLBasedOnBaseURL(baseURL, expected) : expected;
  const locator = page.locator(':root') as LocatorEx;
  return toMatchText.call(this, 'toHaveURL', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = toExpectedTextValues([expected]);
    return await locator._expect('to.have.url', { expectedText, isNot, timeout });
  }, expected, options);
}

export async function toBeOK(
  this: ReturnType<Expect['getState']>,
  response: APIResponseEx
) {
  const matcherName = 'toBeOK';
  expectTypes(response, ['APIResponse'], matcherName);

  const contentType = response.headers()['content-type'];
  const isTextEncoding = contentType && isTextualMimeType(contentType);
  const [log, text] = (this.isNot === response.ok()) ? await Promise.all([
    response._fetchLog(),
    isTextEncoding ? response.text() : null
  ]) : [];

  const message = () => this.utils.matcherHint(matcherName, undefined, '', { isNot: this.isNot }) +
    callLogText(log) +
    (text === null ? '' : `\nResponse text:\n${colors.dim(text?.substring(0, 1000) || '')}`);

  const pass = response.ok();
  return { message, pass };
}

export async function toPass(
  this: ReturnType<Expect['getState']>,
  callback: () => any,
  options: {
    intervals?: number[];
    timeout?: number,
  } = {},
) {
  const testInfo = currentTestInfo();

  const timeout = options.timeout !== undefined ? options.timeout : 0;

  // Soft expects might mark test as failing.
  // We want to revert this later if the matcher is actually passing.
  // See https://github.com/microsoft/playwright/issues/20437
  let testStateBeforeToPassMatcher: undefined|TestInfoErrorState;
  const result = await pollAgainstTimeout<Error|undefined>(async () => {
    try {
      if (testStateBeforeToPassMatcher && testInfo)
        testInfo._restoreErrorState(testStateBeforeToPassMatcher);
      testStateBeforeToPassMatcher = testInfo?._saveErrorState();
      await callback();
      if (testInfo && testStateBeforeToPassMatcher && testInfo.errors.length > testStateBeforeToPassMatcher.errors.length)
        return { continuePolling: !this.isNot, result: testInfo.errors[testInfo.errors.length - 1] };
      return { continuePolling: this.isNot, result: undefined };
    } catch (e) {
      return { continuePolling: !this.isNot, result: e };
    }
  }, timeout, options.intervals || [100, 250, 500, 1000]);

  if (result.timedOut) {
    const timeoutMessage = `Timeout ${timeout}ms exceeded while waiting on the predicate`;
    const message = () => result.result ? [
      result.result.message,
      '',
      `Call Log:`,
      `- ${timeoutMessage}`,
    ].join('\n') : timeoutMessage;

    return { message, pass: this.isNot };
  }
  if (testStateBeforeToPassMatcher && testInfo)
    testInfo._restoreErrorState(testStateBeforeToPassMatcher);
  return { pass: !this.isNot, message: () => '' };
}
