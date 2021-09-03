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
  toHaveValue
} from './matchers/matchers';
import { toMatchSnapshot } from './matchers/toMatchSnapshot';
import type { Expect, TestError } from './types';
import matchers from 'expect/build/matchers';
import { currentTestInfo } from './globals';
import { serializeError } from './util';
import StackUtils from 'stack-utils';
import path from 'path';

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
  toMatchSnapshot,
};

function wrap(matcherName: string, matcher: any) {
  return function(this: any, ...args: any[]) {
    const testInfo = currentTestInfo();
    if (!testInfo)
      return matcher.call(this, ...args);

    const INTERNAL_STACK_LENGTH = 3;
    const stackLines = new Error().stack!.split('\n').slice(INTERNAL_STACK_LENGTH + 1);
    const step = testInfo._addStep('expect', `expect${this.isNot ? '.not' : ''}.${matcherName}`, prepareExpectStepData(stackLines));

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
}

const stackUtils = new StackUtils();

function prepareExpectStepData(lines: string[]) {
  const frames = lines.map(line => {
    const parsed = stackUtils.parseLine(line);
    if (!parsed)
      return;
    return {
      file: parsed.file ? path.resolve(process.cwd(), parsed.file) : undefined,
      line: parsed.line,
      column: parsed.column
    };
  }).filter(frame => !!frame);
  return { stack: frames, log: [] };
}

const wrappedMatchers: any = {};
for (const matcherName in matchers)
  wrappedMatchers[matcherName] = wrap(matcherName, matchers[matcherName]);
for (const matcherName in customMatchers)
  wrappedMatchers[matcherName] = wrap(matcherName, (customMatchers as any)[matcherName]);

expectLibrary.extend(wrappedMatchers);
