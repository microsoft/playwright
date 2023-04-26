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
  captureRawStack,
  createAfterActionTraceEventForExpect,
  createBeforeActionTraceEventForExpect,
  isString,
  pollAgainstTimeout } from 'playwright-core/lib/utils';
import type { ExpectZone } from 'playwright-core/lib/utils';
import {
  toBeAttached,
  toBeChecked,
  toBeDisabled,
  toBeEditable,
  toBeEmpty,
  toBeEnabled,
  toBeFocused,
  toBeHidden,
  toBeInViewport,
  toBeOK,
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
  toHaveValues,
  toPass
} from './matchers';
import { toMatchSnapshot, toHaveScreenshot, toHaveScreenshotStepTitle } from './toMatchSnapshot';
import type { Expect, TestInfo } from '../../types/test';
import { currentTestInfo, currentExpectTimeout, setCurrentExpectConfigureTimeout } from '../common/globals';
import { filteredStackTrace, serializeError, stringifyStackFrames, trimLongString } from '../util';
import {
  expect as expectLibrary,
  INVERTED_COLOR,
  RECEIVED_COLOR,
  printReceived,
} from '../common/expectBundle';
import { zones } from 'playwright-core/lib/utils';
import type { AfterActionTraceEvent } from '../../../trace/src/trace';

// from expect/build/types
export type SyncExpectationResult = {
  pass: boolean;
  message: () => string;
};

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

let lastCallId = 0;

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

type ExpectMessage = string | { message?: string };

function createMatchers(actual: unknown, info: ExpectMetaInfo): any {
  return new Proxy(expectLibrary(actual), new ExpectMetaInfoProxyHandler(info));
}

function createExpect(info: ExpectMetaInfo) {
  const expectInstance: Expect = new Proxy(expectLibrary, {
    apply: function(target: any, thisArg: any, argumentsList: [unknown, ExpectMessage?]) {
      const [actual, messageOrOptions] = argumentsList;
      const message = isString(messageOrOptions) ? messageOrOptions : messageOrOptions?.message || info.message;
      const newInfo = { ...info, message };
      if (newInfo.isPoll) {
        if (typeof actual !== 'function')
          throw new Error('`expect.poll()` accepts only function as a first argument');
        newInfo.generator = actual as any;
      }
      return createMatchers(actual, newInfo);
    },

    get: function(target: any, property: string) {
      if (property === 'configure')
        return configure;

      if (property === 'soft') {
        return (actual: unknown, messageOrOptions?: ExpectMessage) => {
          return configure({ soft: true })(actual, messageOrOptions) as any;
        };
      }

      if (property === 'poll') {
        return (actual: unknown, messageOrOptions?: ExpectMessage & { timeout?: number, intervals?: number[] }) => {
          const poll = isString(messageOrOptions) ? {} : messageOrOptions || {};
          return configure({ poll })(actual, messageOrOptions) as any;
        };
      }
      return expectLibrary[property];
    },
  });

  const configure = (configuration: { message?: string, timeout?: number, soft?: boolean, poll?: boolean | { timeout?: number, intervals?: number[] } }) => {
    const newInfo = { ...info };
    if ('message' in configuration)
      newInfo.message = configuration.message;
    if ('timeout' in configuration)
      newInfo.timeout = configuration.timeout;
    if ('soft' in configuration)
      newInfo.isSoft = configuration.soft;
    if ('poll' in configuration) {
      newInfo.isPoll = !!configuration.poll;
      if (typeof configuration.poll === 'object') {
        newInfo.pollTimeout = configuration.poll.timeout;
        newInfo.pollIntervals = configuration.poll.intervals;
      }
    }
    return createExpect(newInfo);
  };

  return expectInstance;
}

export const expect: Expect = createExpect({});

expectLibrary.setState({ expand: false });

const customAsyncMatchers = {
  toBeAttached,
  toBeChecked,
  toBeDisabled,
  toBeEditable,
  toBeEmpty,
  toBeEnabled,
  toBeFocused,
  toBeHidden,
  toBeInViewport,
  toBeOK,
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
  toHaveValues,
  toHaveScreenshot,
  toPass,
};

const customMatchers = {
  ...customAsyncMatchers,
  toMatchSnapshot,
};

type Generator = () => any;

type ExpectMetaInfo = {
  message?: string;
  isNot?: boolean;
  isSoft?: boolean;
  isPoll?: boolean;
  timeout?: number;
  pollTimeout?: number;
  pollIntervals?: number[];
  generator?: Generator;
};

class ExpectMetaInfoProxyHandler implements ProxyHandler<any> {
  private _info: ExpectMetaInfo;

  constructor(info: ExpectMetaInfo) {
    this._info = { ...info };
  }

  get(target: Object, matcherName: string | symbol, receiver: any): any {
    let matcher = Reflect.get(target, matcherName, receiver);
    if (typeof matcherName !== 'string')
      return matcher;
    if (matcher === undefined)
      throw new Error(`expect: Property '${matcherName}' not found.`);
    if (typeof matcher !== 'function') {
      if (matcherName === 'not')
        this._info.isNot = !this._info.isNot;
      return new Proxy(matcher, this);
    }
    if (this._info.isPoll) {
      if ((customAsyncMatchers as any)[matcherName] || matcherName === 'resolves' || matcherName === 'rejects')
        throw new Error(`\`expect.poll()\` does not support "${matcherName}" matcher.`);
      matcher = (...args: any[]) => pollMatcher(matcherName, !!this._info.isNot, this._info.pollIntervals, currentExpectTimeout({ timeout: this._info.pollTimeout }), this._info.generator!, ...args);
    }
    return (...args: any[]) => {
      const testInfo = currentTestInfo();
      if (!testInfo)
        return matcher.call(target, ...args);

      const rawStack = captureRawStack();
      const stackFrames = filteredStackTrace(rawStack);
      const customMessage = this._info.message || '';
      const argsSuffix = computeArgsSuffix(matcherName, args);

      const defaultTitle = `expect${this._info.isPoll ? '.poll' : ''}${this._info.isSoft ? '.soft' : ''}${this._info.isNot ? '.not' : ''}.${matcherName}${argsSuffix}`;
      const wallTime = Date.now();
      const initialAttachments = new Set(testInfo.attachments.slice());
      const step = testInfo._addStep({
        location: stackFrames[0],
        category: 'expect',
        title: trimLongString(customMessage || defaultTitle, 1024),
        wallTime
      });

      const generateTraceEvent = matcherName !== 'poll' && matcherName !== 'toPass';
      const callId = ++lastCallId;
      if (generateTraceEvent)
        testInfo._traceEvents.push(createBeforeActionTraceEventForExpect(`expect@${callId}`, defaultTitle, wallTime, args[0], stackFrames));

      const reportStepError = (jestError: Error) => {
        const message = jestError.message;
        if (customMessage) {
          const messageLines = message.split('\n');
          // Jest adds something like the following error to all errors:
          //    expect(received).toBe(expected); // Object.is equality
          const uselessMatcherLineIndex = messageLines.findIndex((line: string) => /expect.*\(.*received.*\)/.test(line));
          if (uselessMatcherLineIndex !== -1) {
            // if there's a newline after the matcher text, then remove it as well.
            if (uselessMatcherLineIndex + 1 < messageLines.length && messageLines[uselessMatcherLineIndex + 1].trim() === '')
              messageLines.splice(uselessMatcherLineIndex, 2);
            else
              messageLines.splice(uselessMatcherLineIndex, 1);
          }
          const newMessage = [
            customMessage,
            '',
            ...messageLines,
          ].join('\n');
          jestError.message = newMessage;
          jestError.stack = jestError.name + ': ' + newMessage + '\n' + stringifyStackFrames(stackFrames).join('\n');
        }

        const serializerError = serializeError(jestError);
        if (generateTraceEvent) {
          const error = { name: jestError.name, message: jestError.message, stack: jestError.stack };
          testInfo._traceEvents.push(createAfterActionTraceEventForExpect(`expect@${callId}`, serializeAttachments(testInfo.attachments, initialAttachments), error));
        }
        step.complete({ error: serializerError });
        if (this._info.isSoft)
          testInfo._failWithError(serializerError, false /* isHardError */);
        else
          throw jestError;
      };

      const finalizer = () => {
        if (generateTraceEvent)
          testInfo._traceEvents.push(createAfterActionTraceEventForExpect(`expect@${callId}`, serializeAttachments(testInfo.attachments, initialAttachments)));
        step.complete({});
      };

      // Process the async matchers separately to preserve the zones in the stacks.
      if (this._info.isPoll || matcherName in customAsyncMatchers) {
        return (async () => {
          try {
            const expectZone: ExpectZone = { title: defaultTitle, wallTime };
            await zones.run<ExpectZone, any>('expectZone', expectZone, async () => {
              // We assume that the matcher will read the current expect timeout the first thing.
              setCurrentExpectConfigureTimeout(this._info.timeout);
              await matcher.call(target, ...args);
            });
            finalizer();
          } catch (e) {
            reportStepError(e);
          }
        })();
      } else {
        try {
          const result = matcher.call(target, ...args);
          finalizer();
          return result;
        } catch (e) {
          reportStepError(e);
        }
      }
    };
  }
}

async function pollMatcher(matcherName: any, isNot: boolean, pollIntervals: number[] | undefined, timeout: number, generator: () => any, ...args: any[]) {
  const testInfo = currentTestInfo();

  const result = await pollAgainstTimeout<Error|undefined>(async () => {
    if (testInfo && currentTestInfo() !== testInfo)
      return { continuePolling: false, result: undefined };

    const value = await generator();
    let expectInstance = expectLibrary(value) as any;
    if (isNot)
      expectInstance = expectInstance.not;
    try {
      expectInstance[matcherName].call(expectInstance, ...args);
      return { continuePolling: false, result: undefined };
    } catch (error) {
      return { continuePolling: true, result: error };
    }
  }, timeout, pollIntervals ?? [100, 250, 500, 1000]);

  if (result.timedOut) {
    const timeoutMessage = `Timeout ${timeout}ms exceeded while waiting on the predicate`;
    const message = result.result ? [
      result.result.message,
      '',
      `Call Log:`,
      `- ${timeoutMessage}`,
    ].join('\n') : timeoutMessage;

    throw new Error(message);
  }
}

function computeArgsSuffix(matcherName: string, args: any[]) {
  let value = '';
  if (matcherName === 'toHaveScreenshot')
    value = toHaveScreenshotStepTitle(...args);
  return value ? `(${value})` : '';
}

function serializeAttachments(attachments: TestInfo['attachments'], initialAttachments: Set<TestInfo['attachments'][0]>): AfterActionTraceEvent['attachments'] {
  return attachments.filter(a => !initialAttachments.has(a)).map(a => {
    return {
      name: a.name,
      contentType: a.contentType,
      path: a.path,
      body: a.body?.toString('base64'),
    };
  });
}

expectLibrary.extend(customMatchers);
