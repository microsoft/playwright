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

import {
  printReceivedStringContainExpectedResult,
  printReceivedStringContainExpectedSubstring
} from 'expect/build/print';

import {
  EXPECTED_COLOR,
  getLabelPrinter,
  matcherErrorMessage,
  matcherHint, MatcherHintOptions,
  printExpected,
  printReceived,
  printWithType,
} from 'jest-matcher-utils';
import { Locator } from '../../..';
import { currentTestInfo } from '../globals';
import type { Expect } from '../types';
import { expectLocator, monotonicTime, pollUntilDeadline } from '../util';

async function toMatchTextImpl(
  this: ReturnType<Expect['getState']>,
  matcherName: string,
  locator: Locator,
  query: (timeout: number) => Promise<string>,
  expected: string | RegExp,
  options: { timeout?: number, matchSubstring?: boolean } = {},
) {
  const testInfo = currentTestInfo();
  if (!testInfo)
    throw new Error(`${matcherName} must be called during the test`);
  expectLocator(locator, matcherName);

  const matcherOptions: MatcherHintOptions = {
    isNot: this.isNot,
    promise: this.promise,
  };

  if (
    !(typeof expected === 'string') &&
    !(expected && typeof expected.test === 'function')
  ) {
    throw new Error(
        matcherErrorMessage(
            matcherHint(matcherName, undefined, undefined, matcherOptions),
            `${EXPECTED_COLOR(
                'expected',
            )} value must be a string or regular expression`,
            printWithType('Expected', expected, printExpected),
        ),
    );
  }

  let received: string;
  let pass = false;
  const timeout = options.timeout === 0 ? 0 : options.timeout || testInfo.timeout;
  const deadline = timeout ? monotonicTime() + timeout : 0;

  // TODO: interrupt on timeout for nice message.
  await pollUntilDeadline(async () => {
    const remainingTime = deadline ? deadline - monotonicTime() : 0;
    received = await query(remainingTime);
    if (options.matchSubstring)
      pass = received.includes(expected as string);
    else if (typeof expected === 'string')
      pass = received === expected;
    else
      pass = expected.test(received);

    return pass === !matcherOptions.isNot;
  }, deadline, 100);

  const stringSubstring = options.matchSubstring ? 'substring' : 'string';
  const message = pass
    ? () =>
      typeof expected === 'string'
        ? matcherHint(matcherName, undefined, undefined, matcherOptions) +
        '\n\n' +
        `Expected ${stringSubstring}: not ${printExpected(expected)}\n` +
        `Received string:        ${printReceivedStringContainExpectedSubstring(
            received,
            received.indexOf(expected),
            expected.length,
        )}`
        : matcherHint(matcherName, undefined, undefined, matcherOptions) +
        '\n\n' +
        `Expected pattern: not ${printExpected(expected)}\n` +
        `Received string:      ${printReceivedStringContainExpectedResult(
            received,
            typeof expected.exec === 'function'
              ? expected.exec(received)
              : null,
        )}`
    : () => {
      const labelExpected = `Expected ${typeof expected === 'string' ? stringSubstring : 'pattern'
      }`;
      const labelReceived = 'Received string';
      const printLabel = getLabelPrinter(labelExpected, labelReceived);

      return (
        matcherHint(matcherName, undefined, undefined, matcherOptions) +
        '\n\n' +
        `${printLabel(labelExpected)}${printExpected(expected)}\n` +
        `${printLabel(labelReceived)}${printReceived(received)}`
      );
    };

  return { message, pass };
}

export async function toHaveText(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string | RegExp,
  options?: { timeout?: number, useInnerText?: boolean },
) {
  return toMatchTextImpl.call(this, 'toHaveText', locator, async timeout => {
    if (options?.useInnerText)
      return await locator.innerText({ timeout });
    return await locator.textContent() || '';
  }, expected, options);
}

export async function toContainText(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string,
  options?: { timeout?: number, useInnerText?: boolean },
) {
  return toMatchTextImpl.call(this, 'toContainText', locator, async timeout => {
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
  return toMatchTextImpl.call(this, 'toHaveAttr', locator, async timeout => {
    return await locator.getAttribute(name, { timeout }) || '';
  }, expected, options);
}

export async function toHaveData(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  name: string,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchTextImpl.call(this, 'toHaveData', locator, async timeout => {
    return await locator.getAttribute('data-' + name, { timeout }) || '';
  }, expected, options);
}

export async function toHaveCSS(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  name: string,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchTextImpl.call(this, 'toHaveCSS', locator, async timeout => {
    return await locator.evaluate(async (element, name) => {
      return (window.getComputedStyle(element) as any)[name];
    }, name, { timeout });
  }, expected, options);
}

export async function toHaveId(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchTextImpl.call(this, 'toHaveId', locator, async timeout => {
    return await locator.getAttribute('id', { timeout }) || '';
  }, expected, options);
}

export async function toHaveValue(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string | RegExp,
  options?: { timeout?: number },
) {
  return toMatchTextImpl.call(this, 'toHaveValue', locator, async timeout => {
    return await locator.inputValue({ timeout });
  }, expected, options);
}
export async function toHaveClass(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string,
  options?: { timeout?: number },
) {
  return toMatchTextImpl.call(this, 'toHaveClass', locator, async timeout => {
    return await locator.evaluate(element => element.className, { timeout });
  }, expected, { ...options, matchSubstring: true });
}
