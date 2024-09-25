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
  createGuid,
  isString,
  pollAgainstDeadline } from 'playwright-core/lib/utils';
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
  toHaveAccessibleDescription,
  toHaveAccessibleName,
  toHaveAttribute,
  toHaveClass,
  toHaveCount,
  toHaveCSS,
  toHaveId,
  toHaveJSProperty,
  toHaveRole,
  toHaveText,
  toHaveTitle,
  toHaveURL,
  toHaveValue,
  toHaveValues,
  toPass
} from './matchers';
import { toMatchSnapshot, toHaveScreenshot, toHaveScreenshotStepTitle } from './toMatchSnapshot';
import type { Expect, ExpectMatcherState } from '../../types/test';
import { currentTestInfo } from '../common/globals';
import { filteredStackTrace, trimLongString } from '../util';
import {
  expect as expectLibrary,
  INVERTED_COLOR,
  RECEIVED_COLOR,
  printReceived,
} from '../common/expectBundle';
import { zones } from 'playwright-core/lib/utils';
import { TestInfoImpl } from '../worker/testInfo';
import { ExpectError, isExpectError } from './matcherHint';

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

type ExpectMessage = string | { message?: string };

function createMatchers(actual: unknown, info: ExpectMetaInfo, prefix: string[]): any {
  return new Proxy(expectLibrary(actual), new ExpectMetaInfoProxyHandler(info, prefix));
}

const getCustomMatchersSymbol = Symbol('get custom matchers');

function qualifiedMatcherName(qualifier: string[], matcherName: string) {
  return qualifier.join(':') + '$' + matcherName;
}

function createExpect(info: ExpectMetaInfo, prefix: string[], customMatchers: Record<string, Function>) {
  const expectInstance: Expect<{}> = new Proxy(expectLibrary, {
    apply: function(target: any, thisArg: any, argumentsList: [unknown, ExpectMessage?]) {
      const [actual, messageOrOptions] = argumentsList;
      const message = isString(messageOrOptions) ? messageOrOptions : messageOrOptions?.message || info.message;
      const newInfo = { ...info, message };
      if (newInfo.poll) {
        if (typeof actual !== 'function')
          throw new Error('`expect.poll()` accepts only function as a first argument');
        newInfo.poll.generator = actual as any;
      }
      return createMatchers(actual, newInfo, prefix);
    },

    get: function(target: any, property: string | typeof getCustomMatchersSymbol) {
      if (property === 'configure')
        return configure;

      if (property === 'extend') {
        return (matchers: any) => {
          const qualifier = [...prefix, createGuid()];

          const wrappedMatchers: any = {};
          const extendedMatchers: any = { ...customMatchers };
          for (const [name, matcher] of Object.entries(matchers)) {
            wrappedMatchers[name] = function(...args: any[]) {
              const { isNot, promise, utils } = this;
              const newThis: ExpectMatcherState = {
                isNot,
                promise,
                utils,
                timeout: currentExpectTimeout()
              };
              (newThis as any).equals = throwUnsupportedExpectMatcherError;
              return (matcher as any).call(newThis, ...args);
            };
            const key = qualifiedMatcherName(qualifier, name);
            wrappedMatchers[key] = wrappedMatchers[name];
            Object.defineProperty(wrappedMatchers[key], 'name', { value: name });
            extendedMatchers[name] = wrappedMatchers[key];
          }
          expectLibrary.extend(wrappedMatchers);

          return createExpect(info, qualifier, extendedMatchers);
        };
      }

      if (property === 'soft') {
        return (actual: unknown, messageOrOptions?: ExpectMessage) => {
          return configure({ soft: true })(actual, messageOrOptions) as any;
        };
      }

      if (property === getCustomMatchersSymbol)
        return customMatchers;

      if (property === 'poll') {
        return (actual: unknown, messageOrOptions?: ExpectMessage & { timeout?: number, intervals?: number[] }) => {
          const poll = isString(messageOrOptions) ? {} : messageOrOptions || {};
          return configure({ _poll: poll })(actual, messageOrOptions) as any;
        };
      }
      return (expectLibrary as any)[property];
    },
  });

  const configure = (configuration: { message?: string, timeout?: number, soft?: boolean, _poll?: boolean | { timeout?: number, intervals?: number[] } }) => {
    const newInfo = { ...info };
    if ('message' in configuration)
      newInfo.message = configuration.message;
    if ('timeout' in configuration)
      newInfo.timeout = configuration.timeout;
    if ('soft' in configuration)
      newInfo.isSoft = configuration.soft;
    if ('_poll' in configuration) {
      newInfo.poll = configuration._poll ? { ...info.poll, generator: () => {} } : undefined;
      if (typeof configuration._poll === 'object') {
        newInfo.poll!.timeout = configuration._poll.timeout ?? newInfo.poll!.timeout;
        newInfo.poll!.intervals = configuration._poll.intervals ?? newInfo.poll!.intervals;
      }
    }
    return createExpect(newInfo, prefix, customMatchers);
  };

  return expectInstance;
}

function throwUnsupportedExpectMatcherError() {
  throw new Error('It looks like you are using custom expect matchers that are not compatible with Playwright. See https://aka.ms/playwright/expect-compatibility');
}

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
  toHaveAccessibleDescription,
  toHaveAccessibleName,
  toHaveAttribute,
  toHaveClass,
  toHaveCount,
  toHaveCSS,
  toHaveId,
  toHaveJSProperty,
  toHaveRole,
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
  poll?: {
    timeout?: number;
    intervals?: number[];
    generator: Generator;
  };
  timeout?: number;
};

class ExpectMetaInfoProxyHandler implements ProxyHandler<any> {
  private _info: ExpectMetaInfo;
  private _prefix: string[];

  constructor(info: ExpectMetaInfo, prefix: string[]) {
    this._info = { ...info };
    this._prefix = prefix;
  }

  get(target: Object, matcherName: string | symbol, receiver: any): any {
    let matcher = Reflect.get(target, matcherName, receiver);
    if (typeof matcherName !== 'string')
      return matcher;

    let resolvedMatcherName = matcherName;
    for (let i = this._prefix.length; i > 0; i--) {
      const qualifiedName = qualifiedMatcherName(this._prefix.slice(0, i), matcherName);
      if (Reflect.has(target, qualifiedName)) {
        matcher = Reflect.get(target, qualifiedName, receiver);
        resolvedMatcherName = qualifiedName;
        break;
      }
    }

    if (matcher === undefined)
      throw new Error(`expect: Property '${matcherName}' not found.`);
    if (typeof matcher !== 'function') {
      if (matcherName === 'not')
        this._info.isNot = !this._info.isNot;
      return new Proxy(matcher, this);
    }
    if (this._info.poll) {
      if ((customAsyncMatchers as any)[matcherName] || matcherName === 'resolves' || matcherName === 'rejects')
        throw new Error(`\`expect.poll()\` does not support "${matcherName}" matcher.`);
      matcher = (...args: any[]) => pollMatcher(resolvedMatcherName, this._info, this._prefix, ...args);
    }
    return (...args: any[]) => {
      const testInfo = currentTestInfo();
      // We assume that the matcher will read the current expect timeout the first thing.
      setCurrentExpectConfigureTimeout(this._info.timeout);
      if (!testInfo)
        return matcher.call(target, ...args);

      const customMessage = this._info.message || '';
      const argsSuffix = computeArgsSuffix(matcherName, args);

      const defaultTitle = `expect${this._info.poll ? '.poll' : ''}${this._info.isSoft ? '.soft' : ''}${this._info.isNot ? '.not' : ''}.${matcherName}${argsSuffix}`;
      const title = customMessage || defaultTitle;

      // This looks like it is unnecessary, but it isn't - we need to filter
      // out all the frames that belong to the test runner from caught runtime errors.
      const stackFrames = filteredStackTrace(captureRawStack());

      // Enclose toPass in a step to maintain async stacks, toPass matcher is always async.
      const stepInfo = {
        category: 'expect',
        title: trimLongString(title, 1024),
        params: args[0] ? { expected: args[0] } : undefined,
        infectParentStepsWithError: this._info.isSoft,
      };

      const step = testInfo._addStep(stepInfo);

      const reportStepError = (jestError: Error | unknown) => {
        const error = isExpectError(jestError) ? new ExpectError(jestError, customMessage, stackFrames) : jestError;
        step.complete({ error });
        if (this._info.isSoft)
          testInfo._failWithError(error);
        else
          throw error;
      };

      const finalizer = () => {
        step.complete({});
      };

      try {
        const callback = () => matcher.call(target, ...args);
        // toPass and poll matchers can contain other steps, expects and API calls,
        // so they behave like a retriable step.
        const result = (matcherName === 'toPass' || this._info.poll) ?
          zones.run('stepZone', step, callback) :
          zones.run<ExpectZone, any>('expectZone', { title, stepId: step.stepId }, callback);
        if (result instanceof Promise)
          return result.then(finalizer).catch(reportStepError);
        finalizer();
        return result;
      } catch (e) {
        reportStepError(e);
      }
    };
  }
}

async function pollMatcher(qualifiedMatcherName: string, info: ExpectMetaInfo, prefix: string[], ...args: any[]) {
  const testInfo = currentTestInfo();
  const poll = info.poll!;
  const timeout = poll.timeout ?? currentExpectTimeout();
  const { deadline, timeoutMessage } = testInfo ? testInfo._deadlineForMatcher(timeout) : TestInfoImpl._defaultDeadlineForMatcher(timeout);

  const result = await pollAgainstDeadline<Error|undefined>(async () => {
    if (testInfo && currentTestInfo() !== testInfo)
      return { continuePolling: false, result: undefined };

    const innerInfo: ExpectMetaInfo = {
      ...info,
      isSoft: false, // soft is outside of poll, not inside
      poll: undefined,
    };
    const value = await poll.generator();
    try {
      let matchers = createMatchers(value, innerInfo, prefix);
      if (info.isNot)
        matchers = matchers.not;
      matchers[qualifiedMatcherName](...args);
      return { continuePolling: false, result: undefined };
    } catch (error) {
      return { continuePolling: true, result: error };
    }
  }, deadline, poll.intervals ?? [100, 250, 500, 1000]);

  if (result.timedOut) {
    const message = result.result ? [
      result.result.message,
      '',
      `Call Log:`,
      `- ${timeoutMessage}`,
    ].join('\n') : timeoutMessage;

    throw new Error(message);
  }
}

let currentExpectConfigureTimeout: number | undefined;

function setCurrentExpectConfigureTimeout(timeout: number | undefined) {
  currentExpectConfigureTimeout = timeout;
}

function currentExpectTimeout() {
  if (currentExpectConfigureTimeout !== undefined)
    return currentExpectConfigureTimeout;
  const testInfo = currentTestInfo();
  let defaultExpectTimeout = testInfo?._projectInternal?.expect?.timeout;
  if (typeof defaultExpectTimeout === 'undefined')
    defaultExpectTimeout = 5000;
  return defaultExpectTimeout;
}

function computeArgsSuffix(matcherName: string, args: any[]) {
  let value = '';
  if (matcherName === 'toHaveScreenshot')
    value = toHaveScreenshotStepTitle(...args);
  return value ? `(${value})` : '';
}

export const expect: Expect<{}> = createExpect({}, [], {}).extend(customMatchers);

export function mergeExpects(...expects: any[]) {
  let merged = expect;
  for (const e of expects) {
    const internals = e[getCustomMatchersSymbol];
    if (!internals) // non-playwright expects mutate the global expect, so we don't need to do anything special
      continue;
    merged = merged.extend(internals);
  }
  return merged;
}
