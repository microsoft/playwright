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

import util from 'util';

import { stringifyStackFrames } from '@isomorphic/stackTrace';

import type { StackFrame } from '@protocol/channels';

export type MatcherAttachment = { name: string; contentType: string; path?: string; body?: string | Buffer };

export type MatcherResult<E = unknown, A = unknown> = {
  name?: string;
  expected?: E;
  message: () => string;
  pass: boolean;
  actual?: A;
  diff?: string;
  log?: string[];
  timeout?: number;
  suggestedRebaseline?: string;
  attachments?: MatcherAttachment[];
  softError?: Error | unknown;
  shouldNotRetryTest?: boolean;
};

export type MatcherResultProperty = Omit<MatcherResult, 'message' | 'name' | 'shouldNotRetryTest'> & {
  name: string;
  message: string;
};

export class ExpectError extends Error {
  matcherResult: MatcherResultProperty;

  constructor(matcherResult: MatcherResultProperty, customMessage: string, stackFrames: StackFrame[]) {
    super('');
    this.message = matcherResult.message;
    this.matcherResult = matcherResult;
    if (customMessage)
      this.message = customMessage + '\n\n' + this.message;
    this.stack = this.name + ': ' + this.message + '\n' + stringifyStackFrames(stackFrames).join('\n');
  }
}

export function expectTypes(receiver: any, types: ('APIResponse' | 'Page' | 'Locator')[], matcherName: string) {
  if (typeof receiver !== 'object' || !types.includes(receiver._apiName)) {
    const receiverString = typeof receiver === 'object' && receiver !== null ? `${receiver.constructor.name} ${util.inspect(receiver)}` : String(receiver);
    const commaSeparated = types.slice();
    const lastType = commaSeparated.pop();
    const typesString = commaSeparated.length ? commaSeparated.join(', ') + ' or ' + lastType : lastType;
    throw new Error(`${matcherName} can be only used with ${typesString} object${types.length > 1 ? 's' : ''}, was called with ${receiverString}`);
  }
}

export interface InternalMatcherUtils {
  printDiffOrStringify(expected: unknown, received: unknown, expectedLabel: string, receivedLabel: string, expand: boolean): string;
  printExpected(value: unknown): string;
  printReceived(object: unknown): string;
  DIM_COLOR(text: string): string;
  RECEIVED_COLOR(text: string): string;
  INVERTED_COLOR(text: string): string;
  EXPECTED_COLOR(text: string): string;
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
  ariaSnapshot?: string;
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
  if (details.ariaSnapshot)
    message += `\nAria snapshot:\n${utils.DIM_COLOR(details.ariaSnapshot)}\n`;
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
