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

import { constructURLBasedOnBaseURL, isRegExp, isString, isTextualMimeType, pollAgainstDeadline, serializeExpectedTextValues } from 'playwright-core/lib/utils';
import { colors } from 'playwright-core/lib/utils';

import { callLogText, expectTypes } from '../util';
import { toBeTruthy } from './toBeTruthy';
import { toEqual } from './toEqual';
import { toHaveURLWithPredicate } from './toHaveURL';
import { toMatchText } from './toMatchText';
import { takeFirst } from '../common/config';
import { currentTestInfo } from '../common/globals';
import { TestInfoImpl } from '../worker/testInfo';

import type { ExpectMatcherState } from '../../types/test';
import type { TestStepInfoImpl } from '../worker/testInfo';
import type { APIResponse, Locator, Frame, Page } from 'playwright-core';
import type { FrameExpectParams } from 'playwright-core/lib/client/types';

export type ExpectMatcherStateInternal = ExpectMatcherState & { _stepInfo?: TestStepInfoImpl };

export interface LocatorEx extends Locator {
  _expect(expression: string, options: FrameExpectParams): Promise<{ matches: boolean, received?: any, log?: string[], timedOut?: boolean }>;
}

export interface FrameEx extends Frame {
  _expect(expression: string, options: FrameExpectParams): Promise<{ matches: boolean, received?: any, log?: string[], timedOut?: boolean }>;
}

interface APIResponseEx extends APIResponse {
  _fetchLog(): Promise<string[]>;
}

export function toBeAttached(
  this: ExpectMatcherState,
  locator: LocatorEx,
  options?: { attached?: boolean, timeout?: number },
) {
  const attached = !options || options.attached === undefined || options.attached;
  const expected = attached ? 'attached' : 'detached';
  const arg = attached ? '' : '{ attached: false }';
  return toBeTruthy.call(this, 'toBeAttached', locator, 'Locator', expected, arg, async (isNot, timeout) => {
    return await locator._expect(attached ? 'to.be.attached' : 'to.be.detached', { isNot, timeout });
  }, options);
}

export function toBeChecked(
  this: ExpectMatcherState,
  locator: LocatorEx,
  options?: { checked?: boolean, indeterminate?: boolean, timeout?: number },
) {
  const checked = options?.checked;
  const indeterminate = options?.indeterminate;
  const expectedValue = {
    checked,
    indeterminate,
  };
  let expected: string;
  let arg: string;
  if (options?.indeterminate) {
    expected = 'indeterminate';
    arg = `{ indeterminate: true }`;
  } else {
    expected = options?.checked === false ? 'unchecked' : 'checked';
    arg = options?.checked === false ? `{ checked: false }` : '';
  }
  return toBeTruthy.call(this, 'toBeChecked', locator, 'Locator', expected, arg, async (isNot, timeout) => {
    return await locator._expect('to.be.checked', { isNot, timeout, expectedValue });
  }, options);
}

export function toBeDisabled(
  this: ExpectMatcherState,
  locator: LocatorEx,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeDisabled', locator, 'Locator', 'disabled', '', async (isNot, timeout) => {
    return await locator._expect('to.be.disabled', { isNot, timeout });
  }, options);
}

export function toBeEditable(
  this: ExpectMatcherState,
  locator: LocatorEx,
  options?: { editable?: boolean, timeout?: number },
) {
  const editable = !options || options.editable === undefined || options.editable;
  const expected = editable ? 'editable' : 'readOnly';
  const arg = editable ? '' : '{ editable: false }';
  return toBeTruthy.call(this, 'toBeEditable', locator, 'Locator', expected, arg, async (isNot, timeout) => {
    return await locator._expect(editable ? 'to.be.editable' : 'to.be.readonly', { isNot, timeout });
  }, options);
}

export function toBeEmpty(
  this: ExpectMatcherState,
  locator: LocatorEx,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeEmpty', locator, 'Locator', 'empty', '', async (isNot, timeout) => {
    return await locator._expect('to.be.empty', { isNot, timeout });
  }, options);
}

export function toBeEnabled(
  this: ExpectMatcherState,
  locator: LocatorEx,
  options?: { enabled?: boolean, timeout?: number },
) {
  const enabled = !options || options.enabled === undefined || options.enabled;
  const expected = enabled ? 'enabled' : 'disabled';
  const arg = enabled ? '' : '{ enabled: false }';
  return toBeTruthy.call(this, 'toBeEnabled', locator, 'Locator', expected, arg, async (isNot, timeout) => {
    return await locator._expect(enabled ? 'to.be.enabled' : 'to.be.disabled', { isNot, timeout });
  }, options);
}

export function toBeFocused(
  this: ExpectMatcherState,
  locator: LocatorEx,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeFocused', locator, 'Locator', 'focused', '', async (isNot, timeout) => {
    return await locator._expect('to.be.focused', { isNot, timeout });
  }, options);
}

export function toBeHidden(
  this: ExpectMatcherState,
  locator: LocatorEx,
  options?: { timeout?: number },
) {
  return toBeTruthy.call(this, 'toBeHidden', locator, 'Locator', 'hidden', '', async (isNot, timeout) => {
    return await locator._expect('to.be.hidden', { isNot, timeout });
  }, options);
}

export function toBeVisible(
  this: ExpectMatcherState,
  locator: LocatorEx,
  options?: { visible?: boolean, timeout?: number },
) {
  const visible = !options || options.visible === undefined || options.visible;
  const expected = visible ? 'visible' : 'hidden';
  const arg = visible ? '' : '{ visible: false }';
  return toBeTruthy.call(this, 'toBeVisible', locator, 'Locator', expected, arg, async (isNot, timeout) => {
    return await locator._expect(visible ? 'to.be.visible' : 'to.be.hidden', { isNot, timeout });
  }, options);
}

export function toBeInViewport(
  this: ExpectMatcherState,
  locator: LocatorEx,
  options?: { timeout?: number, ratio?: number },
) {
  return toBeTruthy.call(this, 'toBeInViewport', locator, 'Locator', 'in viewport', '', async (isNot, timeout) => {
    return await locator._expect('to.be.in.viewport', { isNot, expectedNumber: options?.ratio, timeout });
  }, options);
}

export function toContainText(
  this: ExpectMatcherState,
  locator: LocatorEx,
  expected: string | RegExp | (string | RegExp)[],
  options: { timeout?: number, useInnerText?: boolean, ignoreCase?: boolean } = {},
) {
  if (Array.isArray(expected)) {
    return toEqual.call(this, 'toContainText', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = serializeExpectedTextValues(expected, { matchSubstring: true, normalizeWhiteSpace: true, ignoreCase: options.ignoreCase });
      return await locator._expect('to.contain.text.array', { expectedText, isNot, useInnerText: options.useInnerText, timeout });
    }, expected, { ...options, contains: true });
  } else {
    return toMatchText.call(this, 'toContainText', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = serializeExpectedTextValues([expected], { matchSubstring: true, normalizeWhiteSpace: true, ignoreCase: options.ignoreCase });
      return await locator._expect('to.have.text', { expectedText, isNot, useInnerText: options.useInnerText, timeout });
    }, expected, options);
  }
}

export function toHaveAccessibleDescription(
  this: ExpectMatcherState,
  locator: LocatorEx,
  expected: string | RegExp,
  options?: { timeout?: number, ignoreCase?: boolean },
) {
  return toMatchText.call(this, 'toHaveAccessibleDescription', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = serializeExpectedTextValues([expected], { ignoreCase: options?.ignoreCase, normalizeWhiteSpace: true });
    return await locator._expect('to.have.accessible.description', { expectedText, isNot, timeout });
  }, expected, options);
}

export function toHaveAccessibleName(
  this: ExpectMatcherState,
  locator: LocatorEx,
  expected: string | RegExp,
  options?: { timeout?: number, ignoreCase?: boolean },
) {
  return toMatchText.call(this, 'toHaveAccessibleName', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = serializeExpectedTextValues([expected], { ignoreCase: options?.ignoreCase, normalizeWhiteSpace: true });
    return await locator._expect('to.have.accessible.name', { expectedText, isNot, timeout });
  }, expected, options);
}

export function toHaveAccessibleErrorMessage(
  this: ExpectMatcherState,
  locator: LocatorEx,
  expected: string | RegExp,
  options?: { timeout?: number; ignoreCase?: boolean },
) {
  return toMatchText.call(this, 'toHaveAccessibleErrorMessage', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = serializeExpectedTextValues([expected], { ignoreCase: options?.ignoreCase, normalizeWhiteSpace: true });
    return await locator._expect('to.have.accessible.error.message', { expectedText: expectedText, isNot, timeout });
  }, expected, options);
}

export function toHaveAttribute(
  this: ExpectMatcherState,
  locator: LocatorEx,
  name: string,
  expected: string | RegExp | undefined | { timeout?: number },
  options?: { timeout?: number, ignoreCase?: boolean },
) {
  if (!options) {
    // Update params for the case toHaveAttribute(name, options);
    if (typeof expected === 'object' && !isRegExp(expected)) {
      options = expected;
      expected = undefined;
    }
  }
  if (expected === undefined) {
    return toBeTruthy.call(this, 'toHaveAttribute', locator, 'Locator', 'have attribute', '', async (isNot, timeout) => {
      return await locator._expect('to.have.attribute', { expressionArg: name, isNot, timeout });
    }, options);
  }
  return toMatchText.call(this, 'toHaveAttribute', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = serializeExpectedTextValues([expected as (string | RegExp)], { ignoreCase: options?.ignoreCase });
    return await locator._expect('to.have.attribute.value', { expressionArg: name, expectedText, isNot, timeout });
  }, expected as (string | RegExp), options);
}

export function toHaveClass(
  this: ExpectMatcherState,
  locator: LocatorEx,
  expected: string | RegExp | (string | RegExp)[],
  options?: { timeout?: number },
) {
  if (Array.isArray(expected)) {
    return toEqual.call(this, 'toHaveClass', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = serializeExpectedTextValues(expected);
      return await locator._expect('to.have.class.array', { expectedText, isNot, timeout });
    }, expected, options, true);
  } else {
    return toMatchText.call(this, 'toHaveClass', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = serializeExpectedTextValues([expected]);
      return await locator._expect('to.have.class', { expectedText, isNot, timeout });
    }, expected, options);
  }
}

export function toContainClass(
  this: ExpectMatcherState,
  locator: LocatorEx,
  expected: string | string[],
  options?: { timeout?: number },
) {
  if (Array.isArray(expected)) {
    if (expected.some(e => isRegExp(e)))
      throw new Error(`"expected" argument in toContainClass cannot contain RegExp values`);
    return toEqual.call(this, 'toContainClass', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = serializeExpectedTextValues(expected);
      return await locator._expect('to.contain.class.array', { expectedText, isNot, timeout });
    }, expected, options, true);
  } else {
    if (isRegExp(expected))
      throw new Error(`"expected" argument in toContainClass cannot be a RegExp value`);
    return toMatchText.call(this, 'toContainClass', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = serializeExpectedTextValues([expected]);
      return await locator._expect('to.contain.class', { expectedText, isNot, timeout });
    }, expected, options);
  }
}

export function toHaveCount(
  this: ExpectMatcherState,
  locator: LocatorEx,
  expected: number,
  options?: { timeout?: number },
) {
  return toEqual.call(this, 'toHaveCount', locator, 'Locator', async (isNot, timeout) => {
    return await locator._expect('to.have.count', { expectedNumber: expected, isNot, timeout });
  }, expected, options);
}

export function toHaveCSS(
  this: ExpectMatcherState,
  locator: LocatorEx,
  name: string,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveCSS', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = serializeExpectedTextValues([expected]);
    return await locator._expect('to.have.css', { expressionArg: name, expectedText, isNot, timeout });
  }, expected, options);
}

export function toHaveId(
  this: ExpectMatcherState,
  locator: LocatorEx,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveId', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = serializeExpectedTextValues([expected]);
    return await locator._expect('to.have.id', { expectedText, isNot, timeout });
  }, expected, options);
}

export function toHaveJSProperty(
  this: ExpectMatcherState,
  locator: LocatorEx,
  name: string,
  expected: any,
  options?: { timeout?: number },
) {
  return toEqual.call(this, 'toHaveJSProperty', locator, 'Locator', async (isNot, timeout) => {
    return await locator._expect('to.have.property', { expressionArg: name, expectedValue: expected, isNot, timeout });
  }, expected, options);
}

export function toHaveRole(
  this: ExpectMatcherState,
  locator: LocatorEx,
  expected: string,
  options?: { timeout?: number, ignoreCase?: boolean },
) {
  if (!isString(expected))
    throw new Error(`"role" argument in toHaveRole must be a string`);
  return toMatchText.call(this, 'toHaveRole', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = serializeExpectedTextValues([expected]);
    return await locator._expect('to.have.role', { expectedText, isNot, timeout });
  }, expected, options);
}

export function toHaveText(
  this: ExpectMatcherState,
  locator: LocatorEx,
  expected: string | RegExp | (string | RegExp)[],
  options: { timeout?: number, useInnerText?: boolean, ignoreCase?: boolean } = {},
) {
  if (Array.isArray(expected)) {
    return toEqual.call(this, 'toHaveText', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = serializeExpectedTextValues(expected, { normalizeWhiteSpace: true, ignoreCase: options.ignoreCase });
      return await locator._expect('to.have.text.array', { expectedText, isNot, useInnerText: options?.useInnerText, timeout });
    }, expected, options);
  } else {
    return toMatchText.call(this, 'toHaveText', locator, 'Locator', async (isNot, timeout) => {
      const expectedText = serializeExpectedTextValues([expected], { normalizeWhiteSpace: true, ignoreCase: options.ignoreCase });
      return await locator._expect('to.have.text', { expectedText, isNot, useInnerText: options?.useInnerText, timeout });
    }, expected, options);
  }
}

export function toHaveValue(
  this: ExpectMatcherState,
  locator: LocatorEx,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchText.call(this, 'toHaveValue', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = serializeExpectedTextValues([expected]);
    return await locator._expect('to.have.value', { expectedText, isNot, timeout });
  }, expected, options);
}

export function toHaveValues(
  this: ExpectMatcherState,
  locator: LocatorEx,
  expected: (string | RegExp)[],
  options?: { timeout?: number },
) {
  return toEqual.call(this, 'toHaveValues', locator, 'Locator', async (isNot, timeout) => {
    const expectedText = serializeExpectedTextValues(expected);
    return await locator._expect('to.have.values', { expectedText, isNot, timeout });
  }, expected, options);
}

export function toHaveTitle(
  this: ExpectMatcherState,
  page: Page,
  expected: string | RegExp,
  options: { timeout?: number } = {},
) {
  return toMatchText.call(this, 'toHaveTitle', page, 'Page', async (isNot, timeout) => {
    const expectedText = serializeExpectedTextValues([expected], { normalizeWhiteSpace: true });
    return await (page.mainFrame() as FrameEx)._expect('to.have.title', { expectedText, isNot, timeout });
  }, expected, { receiverLabel: 'page', ...options });
}

export function toHaveURL(
  this: ExpectMatcherState,
  page: Page,
  expected: string | RegExp | ((url: URL) => boolean),
  options?: { ignoreCase?: boolean; timeout?: number },
) {
  // Ports don't support predicates. Keep separate server and client codepaths
  if (typeof expected === 'function')
    return toHaveURLWithPredicate.call(this, page, expected, options);

  const baseURL = (page.context() as any)._options.baseURL;
  expected = typeof expected === 'string' ? constructURLBasedOnBaseURL(baseURL, expected) : expected;
  return toMatchText.call(this, 'toHaveURL', page, 'Page', async (isNot, timeout) => {
    const expectedText = serializeExpectedTextValues([expected], { ignoreCase: options?.ignoreCase });
    return await (page.mainFrame() as FrameEx)._expect('to.have.url', { expectedText, isNot, timeout });
  }, expected, { receiverLabel: 'page', ...options });
}

export async function toBeOK(
  this: ExpectMatcherState,
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
  this: ExpectMatcherState,
  callback: () => any,
  options: {
    intervals?: number[];
    timeout?: number,
  } = {},
) {
  const testInfo = currentTestInfo();
  const timeout = takeFirst(options.timeout, testInfo?._projectInternal.expect?.toPass?.timeout, 0);
  const intervals = takeFirst(options.intervals, testInfo?._projectInternal.expect?.toPass?.intervals, [100, 250, 500, 1000]);

  const { deadline, timeoutMessage } = testInfo ? testInfo._deadlineForMatcher(timeout) : TestInfoImpl._defaultDeadlineForMatcher(timeout);
  const result = await pollAgainstDeadline<Error|undefined>(async () => {
    if (testInfo && currentTestInfo() !== testInfo)
      return { continuePolling: false, result: undefined };
    try {
      await callback();
      return { continuePolling: !!this.isNot, result: undefined };
    } catch (e) {
      return { continuePolling: !this.isNot, result: e };
    }
  }, deadline, intervals);

  if (result.timedOut) {
    const message = result.result ? [
      result.result.message,
      '',
      `Call Log:`,
      `- ${timeoutMessage}`,
    ].join('\n') : timeoutMessage;
    return { message: () => message, pass: !!this.isNot };
  }
  return { pass: !this.isNot, message: () => '' };
}
