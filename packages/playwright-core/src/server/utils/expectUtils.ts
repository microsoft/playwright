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

import { isRegExp, isString } from '../../utils/isomorphic/rtti';
import { colors } from '../../utilsBundle';

import type { ExpectedTextValue } from '@protocol/channels';

export interface InternalMatcherUtils {
  printDiffOrStringify(expected: unknown, received: unknown, expectedLabel: string, receivedLabel: string, expand: boolean): string;
  printExpected(value: unknown): string;
  printReceived(object: unknown): string;
  DIM_COLOR(text: string): string;
  RECEIVED_COLOR(text: string): string;
  INVERTED_COLOR(text: string): string;
  EXPECTED_COLOR(text: string): string;
}

export function serializeExpectedTextValues(items: (string | RegExp)[], options: { matchSubstring?: boolean, normalizeWhiteSpace?: boolean, ignoreCase?: boolean } = {}): ExpectedTextValue[] {
  return items.map(i => ({
    string: isString(i) ? i : undefined,
    regexSource: isRegExp(i) ? i.source : undefined,
    regexFlags: isRegExp(i) ? i.flags : undefined,
    matchSubstring: options.matchSubstring,
    ignoreCase: options.ignoreCase,
    normalizeWhiteSpace: options.normalizeWhiteSpace,
  }));
}

// #region
// Mirrored from https://github.com/facebook/jest/blob/f13abff8df9a0e1148baf3584bcde6d1b479edc7/packages/expect/src/print.ts with minor modifications.
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found here
 * https://github.com/facebook/jest/blob/1547740bbc26400d69f4576bf35645163e942829/LICENSE
 */

// Format substring but do not enclose in double quote marks.
// The replacement is compatible with pretty-format package.
const printSubstring = (val: string): string => val.replace(/"|\\/g, '\\$&');

export const printReceivedStringContainExpectedSubstring = (
  utils: InternalMatcherUtils,
  received: string,
  start: number,
  length: number, // not end
): string =>
  utils.RECEIVED_COLOR(
      '"' +
      printSubstring(received.slice(0, start)) +
      utils.INVERTED_COLOR(printSubstring(received.slice(start, start + length))) +
      printSubstring(received.slice(start + length)) +
      '"',
  );

export const printReceivedStringContainExpectedResult = (
  utils: InternalMatcherUtils,
  received: string,
  result: RegExpExecArray | null,
): string =>
  result === null
    ? utils.printReceived(received)
    : printReceivedStringContainExpectedSubstring(
        utils,
        received,
        result.index,
        result[0].length,
    );

// #endregion

type MatcherMessageDetails = {
  promise?: '' | 'rejects' | 'resolves';
  isNot?: boolean;
  receiver?: string; // Assuming 'locator' when locator is provided, 'page' otherwise.
  matcherName: string;
  expectation: string;
  locator?: string;
  printedExpected?: string;
  printedReceived?: string;
  printedDiff?: string;
  timedOut?: boolean;
  timeout?: number;
  errorMessage?: string;
  log?: string[];
};

export function formatMatcherMessage(utils: InternalMatcherUtils, details: MatcherMessageDetails) {
  const receiver = details.receiver ?? (details.locator ? 'locator' : 'page');
  let message = utils.DIM_COLOR('expect(') + utils.RECEIVED_COLOR(receiver)
      + utils.DIM_COLOR(')' + (details.promise ? '.' + details.promise : '') + (details.isNot ? '.not' : '') + '.')
      + details.matcherName
      + utils.DIM_COLOR('(') + utils.EXPECTED_COLOR(details.expectation) + utils.DIM_COLOR(')')
      + ' failed\n\n';

  // Sometimes diff is actually expected + received. Turn it into two lines to
  // simplify alignment logic.
  const diffLines = details.printedDiff?.split('\n');
  if (diffLines?.length === 2) {
    details.printedExpected = diffLines[0];
    details.printedReceived = diffLines[1];
    details.printedDiff = undefined;
  }

  const align = !details.errorMessage && details.printedExpected?.startsWith('Expected:')
      && (!details.printedReceived || details.printedReceived.startsWith('Received:'));
  if (details.locator)
    message += `Locator: ${align ? ' ' : ''}${details.locator}\n`;
  if (details.printedExpected)
    message += details.printedExpected + '\n';
  if (details.printedReceived)
    message += details.printedReceived + '\n';
  if (details.timedOut && details.timeout)
    message += `Timeout: ${align ? ' ' : ''}${details.timeout}ms\n`;
  if (details.printedDiff)
    message += details.printedDiff + '\n';
  if (details.errorMessage) {
    message += details.errorMessage;
    if (!details.errorMessage.endsWith('\n'))
      message += '\n';
  }
  message += callLogText(utils, details.log);
  return message;
}

export const callLogText = (utils: InternalMatcherUtils, log: string[] | undefined) => {
  if (!log || !log.some(l => !!l))
    return '';
  return `
Call log:
${utils.DIM_COLOR(log.join('\n'))}
`;
};


function printValue(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function printReceived(value: unknown): string {
  return colors.red(printValue(value));
}

function printExpected(value: unknown): string {
  return colors.green(printValue(value));
}

export const simpleMatcherUtils: InternalMatcherUtils = {
  DIM_COLOR: colors.dim,
  RECEIVED_COLOR: colors.red,
  EXPECTED_COLOR: colors.green,
  INVERTED_COLOR: colors.inverse,
  printReceived,
  printExpected,
  printDiffOrStringify: (expected: unknown, received: unknown, expectedLabel: string, receivedLabel: string) => {
    const maxLength = Math.max(expectedLabel.length, receivedLabel.length) + 2;
    return `${expectedLabel}: `.padEnd(maxLength) + printExpected(expected) + `\n` +
           `${receivedLabel}: `.padEnd(maxLength) + printReceived(received);
  },
};
