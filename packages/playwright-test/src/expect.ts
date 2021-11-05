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

import expectLibrary from 'expect';
import path from 'path';
import {
  INVERTED_COLOR,
  RECEIVED_COLOR,
  printReceived,
} from 'jest-matcher-utils';
import {
  toBeChecked,
  toBeDisabled,
  toBeEditable,
  toBeEmpty,
  toBeEnabled,
  toBeFocused,
  toBeHidden,
  toBeVisible,
  toContainText,
  toHaveAttribute,
  toHaveClass,
  toHaveCount,
  toHaveCSS,
  toHaveId,
  toHaveJSProperty,
  toHaveText,
  toHaveTitle,
  toHaveURL,
  toHaveValue,
  toHaveScreenshot,
} from './matchers/matchers';
import { toMatchSnapshot } from './matchers/toMatchSnapshot';
import type { Expect, TestError } from './types';
import matchers from 'expect/build/matchers';
import { currentTestInfo } from './globals';
import { serializeError } from './util';
import StackUtils from 'stack-utils';

const stackUtils = new StackUtils();

// #region
// Mirrored from https://github.com/facebook/jest/blob/f13abff8df9a0e1148baf3584bcde6d1b479edc7/packages/expect/src/print.ts
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
  received: string,
  start: number,
  length: number, // not end
): string =>
  RECEIVED_COLOR(
      '"' +
      printSubstring(received.slice(0, start)) +
      INVERTED_COLOR(printSubstring(received.slice(start, start + length))) +
      printSubstring(received.slice(start + length)) +
      '"',
  );

export const printReceivedStringContainExpectedResult = (
  received: string,
  result: RegExpExecArray | null,
): string =>
  result === null
    ? printReceived(received)
    : printReceivedStringContainExpectedSubstring(
        received,
        result.index,
        result[0].length,
    );

// #endregion

export const expect: Expect = expectLibrary as any;
expectLibrary.setState({ expand: false });
const customMatchers = {
  toBeChecked,
  toBeDisabled,
  toBeEditable,
  toBeEmpty,
  toBeEnabled,
  toBeFocused,
  toBeHidden,
  toBeVisible,
  toContainText,
  toHaveAttribute,
  toHaveClass,
  toHaveCount,
  toHaveCSS,
  toHaveId,
  toHaveJSProperty,
  toHaveText,
  toHaveTitle,
  toHaveURL,
  toHaveValue,
  toHaveScreenshot,
  toMatchSnapshot,
};

function wrap(matcherName: string, matcher: any) {
  const result = function(this: any, ...args: any[]) {
    const testInfo = currentTestInfo();
    if (!testInfo)
      return matcher.call(this, ...args);

    const INTERNAL_STACK_LENGTH = 3;
    // at Object.__PWTRAP__[expect.toHaveText] (...)
    // at __EXTERNAL_MATCHER_TRAP__ (...)
    // at Object.throwingMatcher [as toHaveText] (...)
    // at <test function> (...)
    const stackLines = new Error().stack!.split('\n').slice(INTERNAL_STACK_LENGTH + 1);
    const frame = stackLines[0] ? stackUtils.parseLine(stackLines[0]) : undefined;
    const step = testInfo._addStep({
      location: frame && frame.file ? { file: path.resolve(process.cwd(), frame.file), line: frame.line || 0, column: frame.column || 0 } : undefined,
      category: 'expect',
      title: `expect${this.isNot ? '.not' : ''}.${matcherName}`,
      canHaveChildren: true,
      forceNoParent: false
    });

    const reportStepEnd = (result: any) => {
      const success = result.pass !== this.isNot;
      let error: TestError | undefined;
      if (!success) {
        const message = result.message();
        error = { message, stack: message + '\n' + stackLines.join('\n') };
      }
      step.complete(error);
      return result;
    };

    const reportStepError = (error: Error) => {
      step.complete(serializeError(error));
      throw error;
    };

    try {
      const result = matcher.call(this, ...args);
      if (result instanceof Promise)
        return result.then(reportStepEnd).catch(reportStepError);
      return reportStepEnd(result);
    } catch (e) {
      reportStepError(e);
    }
  };
  Object.defineProperty(result, 'name', { value: '__PWTRAP__[expect.' + matcherName + ']' });
  return result;
}

const wrappedMatchers: any = {};
for (const matcherName in matchers)
  wrappedMatchers[matcherName] = wrap(matcherName, matchers[matcherName]);
for (const matcherName in customMatchers)
  wrappedMatchers[matcherName] = wrap(matcherName, (customMatchers as any)[matcherName]);

expectLibrary.extend(wrappedMatchers);
