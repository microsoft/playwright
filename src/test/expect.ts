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
  toBeSelected,
  toBeVisible,
  toContainText,
  toHaveAttr,
  toHaveClass,
  toHaveCount,
  toHaveCSS,
  toHaveData,
  toHaveId,
  toHaveProp,
  toHaveText,
  toHaveTitle,
  toHaveURL,
  toHaveValue
} from './matchers/matchers';
import { toMatchSnapshot } from './matchers/toMatchSnapshot';
import type { Expect } from './types';
import matchers from 'expect/build/matchers';
import { currentTestInfo } from './globals';

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
  toBeSelected,
  toBeVisible,
  toContainText,
  toHaveAttr,
  toHaveClass,
  toHaveCount,
  toHaveCSS,
  toHaveData,
  toHaveId,
  toHaveProp,
  toHaveText,
  toHaveTitle,
  toHaveURL,
  toHaveValue,
  toMatchSnapshot,
};

let lastExpectSeq = 0;

function wrap(matcherName: string, matcher: any) {
  return function(this: any, ...args: any[]) {
    const testInfo = currentTestInfo();
    if (!testInfo)
      return matcher.call(this, ...args);

    const seq = ++lastExpectSeq;
    testInfo._progress('expect', { phase: 'begin', seq, matcherName });
    const endPayload: any = { phase: 'end', seq };
    let isAsync = false;
    try {
      const result = matcher.call(this, ...args);
      endPayload.pass = result.pass;
      if (this.isNot)
        endPayload.isNot = this.isNot;
      if (result.pass === this.isNot && result.message)
        endPayload.message = result.message();
      if (result instanceof Promise) {
        isAsync = true;
        return result.catch(e => {
          endPayload.error = e.stack;
          throw e;
        }).finally(() => {
          testInfo._progress('expect', endPayload);
        });
      }
      return result;
    } catch (e) {
      endPayload.error = e.stack;
      throw e;
    } finally {
      if (!isAsync)
        testInfo._progress('expect', endPayload);
    }
  };
}

const wrappedMatchers: any = {};
for (const matcherName in matchers)
  wrappedMatchers[matcherName] = wrap(matcherName, matchers[matcherName]);
for (const matcherName in customMatchers)
  wrappedMatchers[matcherName] = wrap(matcherName, (customMatchers as any)[matcherName]);

expectLibrary.extend(wrappedMatchers);
