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

import type { Page } from 'playwright-core';
import type { ExpectMatcherState } from '../../types/test';
import { EXPECTED_COLOR, printReceived } from '../common/expectBundle';
import { matcherHint, type MatcherResult } from './matcherHint';
import { constructURLBasedOnBaseURL, urlMatches } from 'playwright-core/lib/utils';
import { colors } from 'playwright-core/lib/utilsBundle';
import { printReceivedStringContainExpectedResult, printReceivedStringContainExpectedSubstring } from './expect';

export async function toHaveURL(
  this: ExpectMatcherState,
  page: Page,
  expected: string | RegExp | ((url: URL) => boolean),
  options?: { ignoreCase?: boolean; timeout?: number },
): Promise<MatcherResult<string | RegExp, string>> {
  const matcherName = 'toHaveURL';
  const expression = 'page';
  const matcherOptions = {
    isNot: this.isNot,
    promise: this.promise,
  };

  if (
    !(typeof expected === 'string') &&
    !(expected && 'test' in expected && typeof expected.test === 'function') &&
    !(typeof expected === 'function')
  ) {
    throw new Error(
        [
          // Always display `expected` in expectation place
          matcherHint(this, undefined, matcherName, expression, undefined, matcherOptions),
          `${colors.bold('Matcher error')}: ${EXPECTED_COLOR('expected')} value must be a string, regular expression, or predicate`,
          this.utils.printWithType('Expected', expected, this.utils.printExpected,),
        ].join('\n\n'),
    );
  }

  const timeout = options?.timeout ?? this.timeout;
  const baseURL: string | undefined = (page.context() as any)._options.baseURL;
  let conditionSucceeded = false;
  let lastCheckedURLString: string | undefined = undefined;
  try {
    await page.mainFrame().waitForURL(
        url => {
          lastCheckedURLString = url.toString();

          if (options?.ignoreCase) {
            return (
              !this.isNot ===
              urlMatches(
                  baseURL?.toLocaleLowerCase(),
                  lastCheckedURLString.toLocaleLowerCase(),
                  typeof expected === 'string'
                    ? expected.toLocaleLowerCase()
                    : expected,
              )
            );
          }

          return (
            !this.isNot === urlMatches(baseURL, lastCheckedURLString, expected)
          );
        },
        { timeout },
    );

    conditionSucceeded = true;
  } catch (e) {
    conditionSucceeded = false;
  }

  if (conditionSucceeded)
    return { name: matcherName, pass: !this.isNot, message: () => '' };

  return {
    name: matcherName,
    pass: this.isNot,
    message: () =>
      toHaveURLMessage(
          this,
          matcherName,
          expression,
          typeof expected === 'string'
            ? constructURLBasedOnBaseURL(baseURL, expected)
            : expected,
          lastCheckedURLString,
          this.isNot,
          true,
          timeout,
      ),
    actual: lastCheckedURLString,
    timeout,
  };
}

function toHaveURLMessage(
  state: ExpectMatcherState,
  matcherName: string,
  expression: string,
  expected: string | RegExp | Function,
  received: string | undefined,
  pass: boolean,
  didTimeout: boolean,
  timeout: number,
): string {
  const matcherOptions = {
    isNot: state.isNot,
    promise: state.promise,
  };
  const receivedString = received || '';
  const messagePrefix = matcherHint(state, undefined, matcherName, expression, undefined, matcherOptions, didTimeout ? timeout : undefined);

  let printedReceived: string | undefined;
  let printedExpected: string | undefined;
  let printedDiff: string | undefined;
  if (typeof expected === 'function') {
    printedExpected = `Expected predicate to ${!state.isNot ? 'succeed' : 'fail'}`;
    printedReceived = `Received string: ${printReceived(receivedString)}`;
  } else {
    if (pass) {
      if (typeof expected === 'string') {
        printedExpected = `Expected string: not ${state.utils.printExpected(expected)}`;
        const formattedReceived = printReceivedStringContainExpectedSubstring(receivedString, receivedString.indexOf(expected), expected.length);
        printedReceived = `Received string: ${formattedReceived}`;
      } else {
        printedExpected = `Expected pattern: not ${state.utils.printExpected(expected)}`;
        const formattedReceived = printReceivedStringContainExpectedResult(receivedString, typeof expected.exec === 'function' ? expected.exec(receivedString) : null);
        printedReceived = `Received string: ${formattedReceived}`;
      }
    } else {
      const labelExpected = `Expected ${typeof expected === 'string' ? 'string' : 'pattern'}`;
      printedDiff = state.utils.printDiffOrStringify(expected, receivedString, labelExpected, 'Received string', false);
    }
  }

  const resultDetails = printedDiff ? printedDiff : printedExpected + '\n' + printedReceived;
  return messagePrefix + resultDetails;
}
