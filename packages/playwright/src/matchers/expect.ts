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
  currentZone,
  isString,
  pollAgainstDeadline } from 'playwright-core/lib/utils';

import { ExpectError, isJestError } from './matcherHint';
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
  toContainClass,
  toContainText,
  toHaveAccessibleDescription,
  toHaveAccessibleErrorMessage,
  toHaveAccessibleName,
  toHaveAttribute,
  toHaveCSS,
  toHaveClass,
  toHaveCount,
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
import { toMatchAriaSnapshot } from './toMatchAriaSnapshot';
import { toHaveScreenshot, toHaveScreenshotStepTitle, toMatchSnapshot } from './toMatchSnapshot';
import {
  INVERTED_COLOR,
  RECEIVED_COLOR,
  expect as expectLibrary,
  printReceived,
} from '../common/expectBundle';
import { currentTestInfo } from '../common/globals';
import { filteredStackTrace } from '../util';
import { TestInfoImpl } from '../worker/testInfo';

import type { ExpectMatcherStateInternal } from './matchers';
import type { Expect } from '../../types/test';
import type { TestStepInfoImpl } from '../worker/testInfo';
import type { TestStepCategory } from '../util';


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

const userMatchersSymbol = Symbol('userMatchers');

function qualifiedMatcherName(qualifier: string[], matcherName: string) {
  return qualifier.join(':') + '$' + matcherName;
}

function createExpect(info: ExpectMetaInfo, prefix: string[], userMatchers: Record<string, Function>) {
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

    get: function(target: any, property: string | typeof userMatchersSymbol) {
      if (property === 'configure')
        return configure;

      if (property === 'extend') {
        return (matchers: any) => {
          const qualifier = [...prefix, createGuid()];

          const wrappedMatchers: any = {};
          for (const [name, matcher] of Object.entries(matchers)) {
            wrappedMatchers[name] = wrapPlaywrightMatcherToPassNiceThis(matcher);
            const key = qualifiedMatcherName(qualifier, name);
            wrappedMatchers[key] = wrappedMatchers[name];
            Object.defineProperty(wrappedMatchers[key], 'name', { value: name });
          }
          expectLibrary.extend(wrappedMatchers);
          return createExpect(info, qualifier, { ...userMatchers, ...matchers });
        };
      }

      if (property === 'soft') {
        return (actual: unknown, messageOrOptions?: ExpectMessage) => {
          return configure({ soft: true })(actual, messageOrOptions) as any;
        };
      }

      if (property === userMatchersSymbol)
        return userMatchers;

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
    return createExpect(newInfo, prefix, userMatchers);
  };

  return expectInstance;
}

// Expect wraps matchers, so there is no way to pass this information to the raw Playwright matcher.
// Rely on sync call sequence to seed each matcher call with the context.
type MatcherCallContext = {
  expectInfo: ExpectMetaInfo;
  testInfo: TestInfoImpl | null;
  step?: TestStepInfoImpl;
};

let matcherCallContext: MatcherCallContext | undefined;

function setMatcherCallContext(context: MatcherCallContext) {
  matcherCallContext = context;
}

function takeMatcherCallContext(): MatcherCallContext | undefined {
  try {
    return matcherCallContext;
  } finally {
    // Any subsequent matcher following the first is assumed to be an unsupported legacy asymmetric matcher.
    // Lacking call context in these scenarios is not particularly important.
    matcherCallContext = undefined;
  }
}

const defaultExpectTimeout = 5000;

function wrapPlaywrightMatcherToPassNiceThis(matcher: any) {
  return function(this: any, ...args: any[]) {
    const { isNot, promise, utils } = this;
    const context = takeMatcherCallContext();
    const timeout = context?.expectInfo.timeout ?? context?.testInfo?._projectInternal?.expect?.timeout ?? defaultExpectTimeout;
    const newThis: ExpectMatcherStateInternal = {
      isNot,
      promise,
      utils,
      timeout,
      _stepInfo: context?.step,
    };
    (newThis as any).equals = throwUnsupportedExpectMatcherError;
    return matcher.call(newThis, ...args);
  };
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
  toContainClass,
  toHaveAccessibleDescription,
  toHaveAccessibleName,
  toHaveAccessibleErrorMessage,
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
  toMatchAriaSnapshot,
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
      setMatcherCallContext({ expectInfo: this._info, testInfo });
      if (!testInfo)
        return matcher.call(target, ...args);

      const customMessage = this._info.message || '';
      const argsSuffix = computeArgsSuffix(matcherName, args);

      const defaultTitle = `${this._info.poll ? 'poll ' : ''}${this._info.isSoft ? 'soft ' : ''}${this._info.isNot ? 'not ' : ''}${matcherName}${argsSuffix}`;
      const title = customMessage || defaultTitle;
      const apiName = `expect${this._info.poll ? '.poll ' : ''}${this._info.isSoft ? '.soft ' : ''}${this._info.isNot ? '.not' : ''}.${matcherName}${argsSuffix}`;

      // This looks like it is unnecessary, but it isn't - we need to filter
      // out all the frames that belong to the test runner from caught runtime errors.
      const stackFrames = filteredStackTrace(captureRawStack());
      const category = matcherName === 'toPass' || this._info.poll ? 'test.step' : 'expect' as TestStepCategory;
      const formattedTitle = category === 'expect' ? title : `Expect "${title}"`;

      // toPass and poll matchers can contain other steps, expects and API calls,
      // so they behave like a retriable step.
      const stepInfo = {
        category,
        apiName,
        title: formattedTitle,
        params: args[0] ? { expected: args[0] } : undefined,
        infectParentStepsWithError: this._info.isSoft,
      };

      const step = testInfo._addStep(stepInfo);

      const reportStepError = (e: Error | unknown) => {
        const jestError = isJestError(e) ? e : null;
        const error = jestError ? new ExpectError(jestError, customMessage, stackFrames) : e;
        if (jestError?.matcherResult.suggestedRebaseline) {
          // NOTE: this is a workaround for the fact that we can't pass the suggested rebaseline
          // for passing matchers. See toMatchAriaSnapshot for a counterpart.
          step.complete({ suggestedRebaseline: jestError?.matcherResult.suggestedRebaseline });
          return;
        }
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
        setMatcherCallContext({ expectInfo: this._info, testInfo, step: step.info });
        const callback = () => matcher.call(target, ...args);
        const result = currentZone().with('stepZone', step).run(callback);
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
  const timeout = poll.timeout ?? info.timeout ?? testInfo?._projectInternal?.expect?.timeout ?? defaultExpectTimeout;
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
    const internals = e[userMatchersSymbol];
    if (!internals) // non-playwright expects mutate the global expect, so we don't need to do anything special
      continue;
    merged = merged.extend(internals);
  }
  return merged;
}
