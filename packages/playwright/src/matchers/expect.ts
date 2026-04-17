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

import path from 'path';

import { parseStackFrame, captureRawStack } from '@isomorphic/stackTrace';
import { escapeWithQuotes, isString } from '@isomorphic/stringUtils';
import { pollAgainstDeadline } from '@isomorphic/timeoutRunner';
import { currentZone } from '@utils/zones';
import {
  RECEIVED_COLOR,
  matcherErrorMessage,
  matcherHint,
  printReceived,
  printWithType,
} from 'jest-matcher-utils';

import {
  any,
  anything,
  arrayContaining,
  arrayNotContaining,
  arrayOf,
  buildCustomAsymmetricMatcher,
  closeTo,
  createThrowMatcher,
  getMessage,
  validateMatcherResult,
  isPromise,
  matchers as expectMatchers,
  notArrayOf,
  notCloseTo,
  objectContaining,
  objectNotContaining,
  stringContaining,
  stringMatching,
  stringNotContaining,
  stringNotMatching,
  utils,
} from './expectLibrary';
import { ExpectError } from './matcherHint';
import {
  computeMatcherTitleSuffix,
  deadlineForMatcher,
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
import { toHaveScreenshot, toMatchSnapshot } from './toMatchSnapshot';

import type { MatcherContext, MatchersObject, RawMatcherFn, SyncExpectationResult } from './expectLibrary';
import type { ExpectMatcherStateInternal } from './matchers';
import type { Expect } from '../../types/test';
import type { StackFrame } from '@protocol/channels';

export interface ExpectStepInfo {
  _attachToStep(attachment: { name: string; contentType: string; path?: string; body?: string | Buffer }): void;
}

export interface ExpectStep {
  complete(result: { error?: Error | unknown, suggestedRebaseline?: string }): void;
  info: ExpectStepInfo;
}

export interface ExpectTestInfo {
  _addStep(data: {
    category: 'expect';
    apiName: string;
    title: string;
    shortTitle: string;
    params?: Record<string, any>;
    infectParentStepsWithError?: boolean;
  }): ExpectStep;
  _deadline(): { deadline: number; timeout: number };
  _failWithError(error: Error | unknown, shouldNotRetry?: 'shouldNotRetry'): void;
  _resolveSnapshotPaths(kind: 'snapshot' | 'screenshot' | 'aria', name: string | string[] | undefined, updateSnapshotIndex: 'updateSnapshotIndex' | 'dontUpdateSnapshotIndex', anonymousExtension?: string): { absoluteSnapshotPath: string; relativeOutputPath: string };
  _getOutputPath(...pathSegments: string[]): string;
}

export type ExpectConfig = {
  testInfo: ExpectTestInfo | null;
  filteredStackTrace: (rawStack: string[]) => StackFrame[];
  ignoreSnapshots: boolean;
  updateSnapshots: 'all' | 'changed' | 'missing' | 'none';
  timeout?: number;
  toHaveScreenshot?: {
    threshold?: number;
    maxDiffPixels?: number;
    maxDiffPixelRatio?: number;
    animations?: 'allow' | 'disabled';
    caret?: 'hide' | 'initial';
    scale?: 'css' | 'device';
    stylePath?: string | string[];
    pathTemplate?: string;
    _comparator?: string;
  };
  toMatchSnapshot?: {
    threshold?: number;
    maxDiffPixels?: number;
    maxDiffPixelRatio?: number;
  };
  toMatchAriaSnapshot?: {
    pathTemplate?: string;
    children?: 'contain' | 'equal' | 'deep-equal';
  };
  toPass?: { timeout?: number; intervals?: number[] };
};

function unfilteredStackTrace(rawStack: string[]): StackFrame[] {
  return rawStack.map(frame => parseStackFrame(frame, path.sep, !!process.env.PWDEBUGIMPL)).filter(f => !!f);
}

let _expectConfig: ExpectConfig = { testInfo: null, filteredStackTrace: unfilteredStackTrace, ignoreSnapshots: false, updateSnapshots: 'missing' };

export function setExpectConfig(config: ExpectConfig) {
  _expectConfig = config;
}

export function expectConfig(): ExpectConfig {
  return _expectConfig;
}

type ExpectMessage = string | { message?: string };

type ExpectMetaInfo = {
  message?: string;
  isNot?: boolean;
  isSoft?: boolean;
  poll?: {
    timeout?: number;
    intervals?: number[];
  };
  timeout?: number;
  userMatchers: MatchersObject;
};

const META_INFO = Symbol('expectMetaInfo');

const defaultExpectTimeout = 5000;

function throwUnsupportedExpectMatcherError() {
  throw new Error('It looks like you are using custom expect matchers that are not compatible with Playwright. See https://aka.ms/playwright/expect-compatibility');
}

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

const allBuiltinMatchers: MatchersObject = {
  ...expectMatchers,
  toThrow: createThrowMatcher('toThrow'),
  toThrowError: createThrowMatcher('toThrowError'),
  ...customAsyncMatchers,
  toMatchSnapshot,
} as any;

const promiseThrowMatchers: MatchersObject = {
  toThrow: createThrowMatcher('toThrow', true),
  toThrowError: createThrowMatcher('toThrowError', true),
};

function createExpect(info: ExpectMetaInfo): Expect<{}> {
  const expectFn: any = (actual: unknown, messageOrOptions?: ExpectMessage) => createMatchers(actual, info, messageOrOptions);
  Object.defineProperty(expectFn, META_INFO, { value: info });

  expectFn.any = any;
  expectFn.anything = anything;
  expectFn.arrayContaining = arrayContaining;
  expectFn.arrayOf = arrayOf;
  expectFn.closeTo = closeTo;
  expectFn.objectContaining = objectContaining;
  expectFn.stringContaining = stringContaining;
  expectFn.stringMatching = stringMatching;

  const notAsymmetric: any = {
    arrayContaining: arrayNotContaining,
    arrayOf: notArrayOf,
    closeTo: notCloseTo,
    objectContaining: objectNotContaining,
    stringContaining: stringNotContaining,
    stringMatching: stringNotMatching,
  };
  expectFn.not = notAsymmetric;

  for (const [name, matcher] of Object.entries(info.userMatchers)) {
    const { positive, inverse } = buildCustomAsymmetricMatcher(name, matcher);
    expectFn[name] = positive;
    notAsymmetric[name] = inverse;
  }

  expectFn.getState = () => ({});

  expectFn.configure = (configuration: { message?: string, timeout?: number, soft?: boolean }) => {
    const newInfo: ExpectMetaInfo = { ...info };
    if ('message' in configuration)
      newInfo.message = configuration.message;
    if ('timeout' in configuration)
      newInfo.timeout = configuration.timeout;
    if ('soft' in configuration)
      newInfo.isSoft = configuration.soft;
    return createExpect(newInfo);
  };

  expectFn.soft = (actual: unknown, messageOrOptions?: ExpectMessage) => {
    return createMatchers(actual, { ... info, isSoft: true }, messageOrOptions);
  };

  expectFn.poll = (actual: unknown, messageOrOptions?: ExpectMessage & { timeout?: number, intervals?: number[] }) => {
    const poll = isString(messageOrOptions) ? {} : messageOrOptions || {};
    return createMatchers(actual, { ...info, poll: { timeout: poll.timeout, intervals: poll.intervals } }, messageOrOptions);
  };

  expectFn.extend = (matchers: MatchersObject) => {
    for (const [name, m] of Object.entries(matchers)) {
      if (typeof m !== 'function')
        throw new TypeError(`expect.extend: \`${name}\` is not a valid matcher. Must be a function, is "${typeof m}"`);
    }

    // Legacy behavior: `expect.extend({...})` without capturing the return value
    // must make the new matchers available on the same expect instance.
    Object.assign(info.userMatchers, matchers);
    for (const [name, matcher] of Object.entries(matchers)) {
      const { positive, inverse } = buildCustomAsymmetricMatcher(name, matcher);
      expectFn[name] = positive;
      notAsymmetric[name] = inverse;
    }
    // End of legacy behavior.

    return createExpect({
      ...info,
      userMatchers: { ...info.userMatchers, ...matchers },
    });
  };

  return expectFn as Expect<{}>;
}

function createMatchers(actual: unknown, originalInfo: ExpectMetaInfo, messageOrOptions?: ExpectMessage): any {
  const message = isString(messageOrOptions) ? messageOrOptions : messageOrOptions?.message || originalInfo.message;
  const info = { ...originalInfo, message };
  const result: any = { not: {}, resolves: { not: {} }, rejects: { not: {} } };
  const notInfo: ExpectMetaInfo = { ...info, isNot: !info.isNot };
  for (const [name, matcher] of Object.entries({ ...allBuiltinMatchers, ...info.userMatchers })) {
    result[name] = wrapMatcher(name, info, actual, matcher);
    result.not[name] = wrapMatcher(name, notInfo, actual, matcher);
    const promiseMatcher = promiseThrowMatchers[name] ?? matcher;
    result.resolves[name] = wrapMatcher(name, info, actual, promiseMatcher, 'resolves');
    result.resolves.not[name] = wrapMatcher(name, notInfo, actual, promiseMatcher, 'resolves');
    result.rejects[name] = wrapMatcher(name, info, actual, promiseMatcher, 'rejects');
    result.rejects.not[name] = wrapMatcher(name, notInfo, actual, promiseMatcher, 'rejects');
  }
  return result;
}

function wrapMatcher(matcherName: string, info: ExpectMetaInfo, actual: unknown, matcher: RawMatcherFn, promise?: 'resolves' | 'rejects') {
  return (...args: any[]) => {
    const testInfo = expectConfig().testInfo;
    const customMessage = info.message || '';
    const suffixes = computeMatcherTitleSuffix(matcherName, actual, args);
    const defaultTitle = `${info.poll ? 'poll ' : ''}${info.isSoft ? 'soft ' : ''}${info.isNot ? 'not ' : ''}${matcherName}${suffixes.short || ''}`;
    const shortTitle = customMessage || `Expect ${escapeWithQuotes(defaultTitle, '"')}`;
    const longTitle = shortTitle + (suffixes.long || '');
    const apiName = `expect${info.poll ? '.poll ' : ''}${info.isSoft ? '.soft ' : ''}${info.isNot ? '.not' : ''}.${matcherName}${suffixes.short || ''}`;

    // This looks like it is unnecessary, but it isn't - we need to filter
    // out all the frames that belong to the test runner from caught runtime errors.
    const stackFrames = expectConfig().filteredStackTrace(captureRawStack());
    const stepData = {
      category: 'expect' as const,
      apiName,
      title: longTitle,
      shortTitle,
      params: args[0] ? { expected: args[0] } : undefined,
      infectParentStepsWithError: info.isSoft,
    };
    const step = testInfo?._addStep(stepData);

    const reportStepError = (error: Error | unknown) => {
      step?.complete({ error });
      if (info.isSoft && testInfo)
        testInfo._failWithError(error);
      else
        throw error;
    };

    const finalizer = (result: SyncExpectationResult & { suggestedRebaseline?: string }) => {
      validateMatcherResult(result);
      if (result.pass === !!info.isNot) {
        const withMessage = { ...result, name: matcherName, message: getMessage(result.message) };
        reportStepError(new ExpectError(withMessage, customMessage, stackFrames));
      } else {
        step?.complete({ suggestedRebaseline: result.suggestedRebaseline });
      }
    };

    try {
      const invoke = () => info.poll
        ? pollMatcher(matcherName, info, matcher, actual, args, promise, step?.info)
        : invokeMatcher(matcherName, info, matcher, actual, args, promise, step?.info);
      const result = step ? currentZone().with('stepZone', step).run(invoke) : invoke();
      if (result instanceof Promise)
        return result.then(finalizer).catch(reportStepError);
      finalizer(result);
    } catch (e) {
      void reportStepError(e);
    }
  };
}

function invokeMatcher(
  matcherName: string,
  info: ExpectMetaInfo,
  matcher: RawMatcherFn,
  actual: unknown,
  args: any[],
  promise: 'resolves' | 'rejects' | undefined,
  stepInfo: ExpectStepInfo | undefined,
): SyncExpectationResult | Promise<SyncExpectationResult> {
  const isNot = !!info.isNot;
  const matcherHintOptions = { isNot, promise: promise ?? '' };
  const timeout = info.timeout ?? expectConfig().timeout ?? defaultExpectTimeout;
  const matcherContext: MatcherContext & ExpectMatcherStateInternal = {
    customTesters: [],
    isNot,
    promise: promise ?? '',
    utils,
    timeout,
    _stepInfo: stepInfo,
    equals: throwUnsupportedExpectMatcherError as any,
  };

  if (promise) {
    if (typeof actual === 'function')
      actual = actual();

    if (!isPromise(actual)) {
      return {
        pass: false,
        message: () => matcherErrorMessage(
            matcherHint(matcherName, undefined, '', matcherHintOptions),
            `${RECEIVED_COLOR('received')} value must be a promise or a function returning a promise`,
            printWithType('Received', actual, printReceived),
        ),
      };
    }

    if (promise === 'resolves') {
      return actual.then(
          result => matcher.call(matcherContext, result, ...args),
          error => ({
            pass: false,
            message: () => `${matcherHint(matcherName, undefined, '', matcherHintOptions)}\n\n` +
              'Received promise rejected instead of resolved\n' +
              `Rejected to value: ${printReceived(error)}`,
          }),
      );
    }

    return actual.then(
        result => ({
          pass: false,
          message: () => `${matcherHint(matcherName, undefined, '', matcherHintOptions)}\n\n` +
            'Received promise resolved instead of rejected\n' +
            `Resolved to value: ${printReceived(result)}`,
        }),
        error => matcher.call(matcherContext, error, ...args),
    );
  }

  return matcher.call(matcherContext, actual, ...args);
}

async function pollMatcher(
  matcherName: string,
  info: ExpectMetaInfo,
  matcher: RawMatcherFn,
  actual: unknown,
  args: any[],
  promise: 'resolves' | 'rejects' | undefined,
  stepInfo: ExpectStepInfo | undefined,
): Promise<SyncExpectationResult> {
  if (typeof actual !== 'function')
    throw new Error('`expect.poll()` accepts only function as a first argument');
  if (promise || (customAsyncMatchers as any)[matcherName])
    throw new Error(`\`expect.poll()\` does not support "${promise ?? matcherName}" matcher.`);

  const testInfo = expectConfig().testInfo;
  const poll = info.poll!;
  const timeout = poll.timeout ?? info.timeout ?? expectConfig().timeout ?? defaultExpectTimeout;
  const { deadline, timeoutMessage } = deadlineForMatcher(testInfo, timeout);

  const polled = await pollAgainstDeadline<SyncExpectationResult | undefined>(async () => {
    if (testInfo && expectConfig().testInfo !== testInfo)
      return { continuePolling: false, result: undefined };

    const value = await actual();
    const result = await invokeMatcher(matcherName, { ...info, poll: undefined }, matcher, value, args, undefined, stepInfo);
    if (result.pass === !info.isNot)
      return { continuePolling: false, result };
    return { continuePolling: true, result };
  }, deadline, poll.intervals ?? [100, 250, 500, 1000]);

  const result = polled.result ?? { pass: !!info.isNot, message: () => '' };
  if (polled.timedOut) {
    const message = polled.result ? [
      getMessage(polled.result.message),
      '',
      `Call Log:`,
      `- ${timeoutMessage}`,
    ].join('\n') : timeoutMessage;
    result.message = () => message;
  }
  return result;
}

export const expect: Expect<{}> = createExpect({ userMatchers: {} });

export function mergeExpects(...expects: any[]) {
  let merged = expect;
  for (const e of expects) {
    const info: ExpectMetaInfo | undefined = e[META_INFO];
    if (!info) // non-playwright expects mutate the global expect, so we don't need to do anything special
      continue;
    merged = merged.extend(info.userMatchers as any) as typeof merged;
  }
  return merged;
}
