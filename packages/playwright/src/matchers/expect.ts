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
  stringify,
} from 'jest-matcher-utils';

import {
  AsymmetricMatcher,
  INTERNAL_MATCHER_FLAG,
  any,
  anything,
  arrayContaining,
  arrayNotContaining,
  arrayOf,
  closeTo,
  createThrowMatcher,
  isPromise,
  matchers as builtinMatchers,
  notArrayOf,
  notCloseTo,
  objectContaining,
  objectNotContaining,
  stringContaining,
  stringMatching,
  stringNotContaining,
  stringNotMatching,
  toThrowMatchers,
  utils,
} from './expectLibrary';
import { ExpectError, isJestError } from './matcherHint';
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

import type { ExpectationResult, MatcherContext, MatchersObject, RawMatcherFn, SyncExpectationResult } from './expectLibrary';
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

type PollGenerator = () => any;

type ExpectMetaInfo = {
  message?: string;
  isNot?: boolean;
  isSoft?: boolean;
  poll?: {
    timeout?: number;
    intervals?: number[];
    generator: PollGenerator;
  };
  timeout?: number;
  allMatchers: MatchersObject;
  userMatchers: Record<string, Function>;
};

const META_INFO = Symbol('expectMetaInfo');

// Expect wraps matchers, so there is no way to pass this information to the raw Playwright matcher.
// Rely on sync call sequence to seed each matcher call with the context.
type MatcherCallContext = {
  expectInfo: ExpectMetaInfo;
  testInfo: ExpectTestInfo | null;
  step?: ExpectStepInfo;
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

const customMatchers = {
  ...customAsyncMatchers,
  toMatchSnapshot,
};

function buildCustomAsymmetricMatcher(matcherName: string, matcher: RawMatcherFn) {
  class CustomMatcher extends AsymmetricMatcher<[unknown, ...Array<unknown>]> {
    constructor(inverse: boolean = false, ...sample: [unknown, ...Array<unknown>]) {
      super(sample, inverse);
    }

    asymmetricMatch(other: unknown) {
      const { pass } = matcher.call(
          (this as any).getMatcherContext(),
          other,
          ...this.sample,
      ) as SyncExpectationResult;
      return this.inverse ? !pass : pass;
    }

    toString() {
      return `${this.inverse ? 'not.' : ''}${matcherName}`;
    }

    override getExpectedType() {
      return 'any';
    }

    override toAsymmetricMatcher() {
      return `${this.toString()}<${this.sample.map(String).join(', ')}>`;
    }
  }
  const positive = (...sample: [unknown, ...Array<unknown>]) => new CustomMatcher(false, ...sample);
  const inverse = (...sample: [unknown, ...Array<unknown>]) => new CustomMatcher(true, ...sample);
  return { positive, inverse };
}

function createExpect(info: ExpectMetaInfo): Expect<{}> {
  const expectFn: any = (actual: unknown, messageOrOptions?: ExpectMessage) => {
    const message = isString(messageOrOptions) ? messageOrOptions : messageOrOptions?.message || info.message;
    const newInfo: ExpectMetaInfo = { ...info, message };
    if (newInfo.poll) {
      if (typeof actual !== 'function')
        throw new Error('`expect.poll()` accepts only function as a first argument');
      newInfo.poll = { ...newInfo.poll, generator: actual as PollGenerator };
    }
    return createMatchers(actual, newInfo);
  };

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

  for (const [name, matcher] of Object.entries(info.allMatchers)) {
    if ((matcher as any)[INTERNAL_MATCHER_FLAG])
      continue;
    const { positive, inverse } = buildCustomAsymmetricMatcher(name, matcher);
    expectFn[name] = positive;
    notAsymmetric[name] = inverse;
  }

  expectFn.getState = () => ({});

  const configure = (configuration: { message?: string, timeout?: number, soft?: boolean, _poll?: boolean | { timeout?: number, intervals?: number[] } }) => {
    const newInfo: ExpectMetaInfo = { ...info };
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
    return createExpect(newInfo);
  };
  expectFn.configure = configure;

  expectFn.soft = (actual: unknown, messageOrOptions?: ExpectMessage) => {
    return configure({ soft: true })(actual, messageOrOptions) as any;
  };

  expectFn.poll = (actual: unknown, messageOrOptions?: ExpectMessage & { timeout?: number, intervals?: number[] }) => {
    const poll = isString(messageOrOptions) ? {} : messageOrOptions || {};
    return configure({ _poll: poll })(actual, messageOrOptions) as any;
  };

  expectFn.extend = (matchers: MatchersObject) => {
    const wrapped: MatchersObject = {};
    for (const [name, m] of Object.entries(matchers)) {
      if (typeof m !== 'function')
        throw new TypeError(`expect.extend: \`${name}\` is not a valid matcher. Must be a function, is "${typeof m}"`);
      const fn = m as RawMatcherFn;
      if (!Object.prototype.hasOwnProperty.call(fn, INTERNAL_MATCHER_FLAG))
        Object.defineProperty(fn, INTERNAL_MATCHER_FLAG, { value: false });
      wrapped[name] = fn;
    }

    // Legacy behavior: `expect.extend({...})` without capturing the return value
    // must make the new matchers available on the same expect instance.
    Object.assign(info.allMatchers, wrapped);
    Object.assign(info.userMatchers, matchers);
    for (const [name, matcher] of Object.entries(wrapped)) {
      const { positive, inverse } = buildCustomAsymmetricMatcher(name, matcher);
      expectFn[name] = positive;
      notAsymmetric[name] = inverse;
    }
    // End of legacy behavior.

    return createExpect({
      ...info,
      allMatchers: { ...info.allMatchers, ...wrapped },
      userMatchers: { ...info.userMatchers, ...matchers },
    });
  };

  return expectFn as Expect<{}>;
}

function createMatchers(actual: unknown, info: ExpectMetaInfo): any {
  const result: any = { not: {} };
  if (!info.poll) {
    result.resolves = { not: {} };
    result.rejects = { not: {} };
  } else {
    const throwUnsupported = (name: 'resolves' | 'rejects') => {
      throw new Error(`\`expect.poll()\` does not support "${name}" matcher.`);
    };
    Object.defineProperty(result, 'resolves', { get: () => throwUnsupported('resolves'), enumerable: true });
    Object.defineProperty(result, 'rejects', { get: () => throwUnsupported('rejects'), enumerable: true });
  }

  const err = new JestAssertionError();
  const notInfo: ExpectMetaInfo = { ...info, isNot: !info.isNot };

  for (const name of Object.keys(info.allMatchers)) {
    const matcher = info.allMatchers[name];
    const promiseMatcher = getPromiseMatcher(name) || matcher;

    result[name] = wrapMatcherCall(name, info, actual, makeThrowingMatcher(matcher, false, '', actual));
    result.not[name] = wrapMatcherCall(name, notInfo, actual, makeThrowingMatcher(matcher, true, '', actual));

    if (!info.poll) {
      result.resolves[name] = wrapMatcherCall(name, info, actual, makeResolveMatcher(name, promiseMatcher, false, actual as any, err));
      result.resolves.not[name] = wrapMatcherCall(name, notInfo, actual, makeResolveMatcher(name, promiseMatcher, true, actual as any, err));
      result.rejects[name] = wrapMatcherCall(name, info, actual, makeRejectMatcher(name, promiseMatcher, false, actual as any, err));
      result.rejects.not[name] = wrapMatcherCall(name, notInfo, actual, makeRejectMatcher(name, promiseMatcher, true, actual as any, err));
    }
  }

  // toThrowError is a legacy alias for toThrow.
  const aliasToThrow = (obj: any) => {
    if (obj && Object.prototype.hasOwnProperty.call(obj, 'toThrow'))
      obj.toThrowError = obj.toThrow;
  };
  aliasToThrow(result);
  aliasToThrow(result.not);
  if (!info.poll) {
    aliasToThrow(result.resolves);
    aliasToThrow(result.resolves.not);
    aliasToThrow(result.rejects);
    aliasToThrow(result.rejects.not);
  }

  result.not = wrapUnknownMatcherProxy(result.not);
  if (!info.poll) {
    result.resolves.not = wrapUnknownMatcherProxy(result.resolves.not);
    result.resolves = wrapUnknownMatcherProxy(result.resolves);
    result.rejects.not = wrapUnknownMatcherProxy(result.rejects.not);
    result.rejects = wrapUnknownMatcherProxy(result.rejects);
  }
  return wrapUnknownMatcherProxy(result);
}

// !!!
function wrapUnknownMatcherProxy(obj: any): any {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      if (typeof prop !== 'string' || prop in target)
        return Reflect.get(target, prop, receiver);
      throw new Error(`expect: Property '${prop}' not found.`);
    },
  });
}

function wrapMatcherCall(matcherName: string, info: ExpectMetaInfo, actual: unknown, matcherImpl: (...args: any[]) => any) {
  return (...args: any[]) => {
    if (info.poll) {
      if ((customAsyncMatchers as any)[matcherName] || matcherName === 'resolves' || matcherName === 'rejects')
        throw new Error(`\`expect.poll()\` does not support "${matcherName}" matcher.`);
      matcherImpl = (...args: any[]) => pollMatcher(matcherName, info, ...args);
    }

    const testInfo = expectConfig().testInfo;
    setMatcherCallContext({ expectInfo: info, testInfo });
    if (!testInfo)
      return matcherImpl(...args);

    const customMessage = info.message || '';
    const suffixes = computeMatcherTitleSuffix(matcherName, actual, args);
    const defaultTitle = `${info.poll ? 'poll ' : ''}${info.isSoft ? 'soft ' : ''}${info.isNot ? 'not ' : ''}${matcherName}${suffixes.short || ''}`;
    const shortTitle = customMessage || `Expect ${escapeWithQuotes(defaultTitle, '"')}`;
    const longTitle = shortTitle + (suffixes.long || '');
    const apiName = `expect${info.poll ? '.poll ' : ''}${info.isSoft ? '.soft ' : ''}${info.isNot ? '.not' : ''}.${matcherName}${suffixes.short || ''}`;

    // This looks like it is unnecessary, but it isn't - we need to filter
    // out all the frames that belong to the test runner from caught runtime errors.
    const stackFrames = expectConfig().filteredStackTrace(captureRawStack());

    // toPass and poll matchers can contain other steps, expects and API calls,
    // so they behave like a retriable step.
    const stepInfo = {
      category: 'expect' as const,
      apiName,
      title: longTitle,
      shortTitle,
      params: args[0] ? { expected: args[0] } : undefined,
      infectParentStepsWithError: info.isSoft,
    };

    const step = testInfo._addStep(stepInfo);

    const reportStepError = (e: Error | unknown) => {
      const jestError = isJestError(e) ? e : null;
      const expectError = jestError ? new ExpectError(jestError, customMessage, stackFrames) : undefined;
      if (jestError?.matcherResult.suggestedRebaseline) {
        // NOTE: this is a workaround for the fact that we can't pass the suggested rebaseline
        // for passing matchers. See toMatchAriaSnapshot for a counterpart.
        step.complete({ suggestedRebaseline: jestError?.matcherResult.suggestedRebaseline });
        return;
      }

      const error = expectError ?? e;
      step.complete({ error });

      if (info.isSoft)
        testInfo._failWithError(error);
      else
        throw error;
    };

    const finalizer = () => {
      step.complete({});
    };

    try {
      setMatcherCallContext({ expectInfo: info, testInfo, step: step.info });
      const callback = () => matcherImpl(...args);
      const result = currentZone().with('stepZone', step).run(callback);
      if (result instanceof Promise)
        return result.then(finalizer).catch(reportStepError);
      finalizer();
      return result;
    } catch (e) {
      void reportStepError(e);
    }
  };
}

async function pollMatcher(matcherName: string, info: ExpectMetaInfo, ...args: any[]) {
  const testInfo = expectConfig().testInfo;
  const poll = info.poll!;
  const timeout = poll.timeout ?? info.timeout ?? expectConfig().timeout ?? defaultExpectTimeout;
  const { deadline, timeoutMessage } = deadlineForMatcher(testInfo, timeout);

  const result = await pollAgainstDeadline<Error|undefined>(async () => {
    if (testInfo && expectConfig().testInfo !== testInfo)
      return { continuePolling: false, result: undefined };

    // !!!
    // Inner matchers run without poll and without soft (soft is outside of poll, not inside).
    // Strip isNot here and route to the .not branch below so step title matches.
    const effectiveIsNot = !!info.isNot;
    const innerInfo: ExpectMetaInfo = {
      ...info,
      isNot: false,
      isSoft: false,
      poll: undefined,
    };
    const value = await poll.generator();
    try {
      const matchers = createMatchers(value, innerInfo);
      if (effectiveIsNot)
        matchers.not[matcherName](...args);
      else
        matchers[matcherName](...args);
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

// #region
// Based on https://github.com/jestjs/jest/tree/v30.2.0/packages/expect
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found here
 * https://github.com/jestjs/jest/blob/v30.2.0/LICENSE
 */

type ThrowingMatcherFn = (...args: Array<any>) => any;
type PromiseMatcherFn = (...args: Array<any>) => Promise<any>;

class JestAssertionError extends Error {
  matcherResult?: Omit<SyncExpectationResult, 'message'> & { message: string };
}

const getPromiseMatcher = (name: string) => {
  if (name === 'toThrow')
    return createThrowMatcher(name, true);
  return null;
};

const getMessage = (message?: () => string) =>
  (message && message()) ||
  RECEIVED_COLOR('No message was specified for this matcher.');

const makeResolveMatcher = (
  matcherName: string,
  matcher: RawMatcherFn,
  isNot: boolean,
  actual: Promise<any> | (() => Promise<any>),
  outerErr: JestAssertionError,
): PromiseMatcherFn =>
  (...args: Array<any>) => {
    const options = { isNot, promise: 'resolves' };

    const actualWrapper: Promise<any> =
      typeof actual === 'function' ? actual() : actual;

    if (!isPromise(actualWrapper)) {
      throw new JestAssertionError(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, '', options),
              `${RECEIVED_COLOR('received')} value must be a promise or a function returning a promise`,
              printWithType('Received', actual, printReceived),
          ),
      );
    }

    const innerErr = new JestAssertionError();

    return actualWrapper.then(
        result => makeThrowingMatcher(matcher, isNot, 'resolves', result, innerErr).apply(null, args),
        error => {
          outerErr.message =
            `${matcherHint(matcherName, undefined, '', options)}\n\n` +
            'Received promise rejected instead of resolved\n' +
            `Rejected to value: ${printReceived(error)}`;
          throw outerErr;
        },
    );
  };

const makeRejectMatcher = (
  matcherName: string,
  matcher: RawMatcherFn,
  isNot: boolean,
  actual: Promise<any> | (() => Promise<any>),
  outerErr: JestAssertionError,
): PromiseMatcherFn =>
  (...args: Array<any>) => {
    const options = { isNot, promise: 'rejects' };

    const actualWrapper: Promise<any> =
      typeof actual === 'function' ? actual() : actual;

    if (!isPromise(actualWrapper)) {
      throw new JestAssertionError(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, '', options),
              `${RECEIVED_COLOR('received')} value must be a promise or a function returning a promise`,
              printWithType('Received', actual, printReceived),
          ),
      );
    }

    const innerErr = new JestAssertionError();

    return actualWrapper.then(
        result => {
          outerErr.message =
            `${matcherHint(matcherName, undefined, '', options)}\n\n` +
            'Received promise resolved instead of rejected\n' +
            `Resolved to value: ${printReceived(result)}`;
          throw outerErr;
        },
        error => makeThrowingMatcher(matcher, isNot, 'rejects', error, innerErr).apply(null, args),
    );
  };

const makeThrowingMatcher = (
  matcher: RawMatcherFn,
  isNot: boolean,
  promise: string,
  actual: any,
  err?: JestAssertionError,
): ThrowingMatcherFn =>
  function throwingMatcher(this: void, ...args: Array<any>): any {
    const isInternal = matcher[INTERNAL_MATCHER_FLAG] === true;
    const callContext = takeMatcherCallContext();
    const timeout = callContext?.expectInfo.timeout ?? expectConfig().timeout ?? defaultExpectTimeout;
    const matcherContext: MatcherContext & ExpectMatcherStateInternal = {
      customTesters: [],
      isNot,
      promise: promise as any,
      utils,
      error: err,
      timeout,
      _stepInfo: callContext?.step,
      equals: throwUnsupportedExpectMatcherError as any,
    };

    const processResult = (
      result: SyncExpectationResult,
      asyncError?: JestAssertionError,
    ) => {
      _validateResult(result);

      if ((result.pass && isNot) || (!result.pass && !isNot)) {
        const message = getMessage(result.message);
        let error;

        if (err) {
          error = err;
          error.message = message;
        } else if (asyncError) {
          error = asyncError;
          error.message = message;
        } else {
          error = new JestAssertionError(message);

          if (Error.captureStackTrace)
            Error.captureStackTrace(error, throwingMatcher);
        }
        error.matcherResult = { ...result, message };
        throw error;
      }
    };

    const handleError = (error: Error) => {
      if (
        isInternal &&
        !(error instanceof JestAssertionError) &&
        error.name !== 'PrettyFormatPluginError' &&
        Error.captureStackTrace
      )
        Error.captureStackTrace(error, throwingMatcher);
      throw error;
    };

    let potentialResult: ExpectationResult;

    try {
      potentialResult = isInternal
        ? matcher.call(matcherContext, actual, ...args)
        : (function __EXTERNAL_MATCHER_TRAP__() {
          return matcher.call(matcherContext, actual, ...args);
        })();

      if (isPromise(potentialResult)) {
        const asyncError = new JestAssertionError();
        if (Error.captureStackTrace)
          Error.captureStackTrace(asyncError, throwingMatcher);

        return potentialResult
            .then(aResult => processResult(aResult, asyncError))
            .catch(handleError);
      }
      return processResult(potentialResult);
    } catch (error: any) {
      return handleError(error);
    }
  };

const _validateResult = (result: any) => {
  if (
    typeof result !== 'object' ||
    typeof result.pass !== 'boolean' ||
    (result.message &&
      typeof result.message !== 'string' &&
      typeof result.message !== 'function')
  ) {
    throw new Error(
        'Unexpected return from a matcher function.\n' +
        'Matcher functions should ' +
        'return an object in the following format:\n' +
        '  {message?: string | function, pass: boolean}\n' +
        `'${stringify(result)}' was returned`,
    );
  }
};

// #endregion

// Stamp the vendored jest matchers as internal so makeThrowingMatcher handles them as built-ins.
for (const m of Object.values(builtinMatchers))
  Object.defineProperty(m, INTERNAL_MATCHER_FLAG, { value: true });
for (const m of Object.values(toThrowMatchers))
  Object.defineProperty(m, INTERNAL_MATCHER_FLAG, { value: true });

const BASE_MATCHERS: MatchersObject = { ...builtinMatchers, ...toThrowMatchers };

export const expect: Expect<{}> = createExpect({
  allMatchers: { ...BASE_MATCHERS },
  userMatchers: {},
}).extend(customMatchers as any);

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
