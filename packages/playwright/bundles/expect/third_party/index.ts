/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { equals, iterableEquality, subsetEquality } from '@jest/expect-utils';
import * as matcherUtils from 'jest-matcher-utils';
import { isPromise } from 'jest-util';

import {
  any,
  anything,
  arrayContaining,
  arrayNotContaining,
  closeTo,
  notCloseTo,
  objectContaining,
  objectNotContaining,
  stringContaining,
  stringMatching,
  stringNotContaining,
  stringNotMatching,
} from './asymmetricMatchers';
import extractExpectedAssertionsErrors from './extractExpectedAssertionsErrors';
import {
  INTERNAL_MATCHER_FLAG,
  addCustomEqualityTesters,
  getCustomEqualityTesters,
  getMatchers,
  getState,
  setMatchers,
  setState,
} from './jestMatchersObject';
import matchers from './matchers';
import spyMatchers from './spyMatchers';
import toThrowMatchers, {
  createMatcher as createThrowMatcher,
} from './toThrowMatchers';

import type {
  Expect,
  ExpectationResult,
  MatcherContext,
  MatcherState,
  MatcherUtils,
  MatchersObject,
  PromiseMatcherFn,
  RawMatcherFn,
  SyncExpectationResult,
  ThrowingMatcherFn,
} from './types';

export type { Tester, TesterContext } from '@jest/expect-utils';
export { AsymmetricMatcher } from './asymmetricMatchers';
export type {
  AsymmetricMatchers,
  AsyncExpectationResult,
  BaseExpect,
  Expect,
  ExpectationResult,
  MatcherContext,
  MatcherFunction,
  MatcherFunctionWithContext,
  MatcherState,
  MatcherUtils,
  Matchers,
  SyncExpectationResult,
} from './types';

export class JestAssertionError extends Error {
  matcherResult?: Omit<SyncExpectationResult, 'message'> & { message: string };
}

const createToThrowErrorMatchingSnapshotMatcher = function(
  matcher: RawMatcherFn,
) {
  return function(
    this: MatcherContext,
    received: any,
    testNameOrInlineSnapshot?: string,
  ) {
    return matcher.apply(this, [received, testNameOrInlineSnapshot, true]);
  };
};

const getPromiseMatcher = (name: string, matcher: RawMatcherFn) => {
  if (name === 'toThrow' || name === 'toThrowError')
    return createThrowMatcher(name, true);
  else if (
    name === 'toThrowErrorMatchingSnapshot' ||
    name === 'toThrowErrorMatchingInlineSnapshot'
  )
    return createToThrowErrorMatchingSnapshotMatcher(matcher);


  return null;
};

export const expect: Expect = (actual: any, ...rest: Array<any>) => {
  if (rest.length !== 0)
    throw new Error('Expect takes at most one argument.');


  const allMatchers = getMatchers();
  const expectation: any = {
    not: {},
    rejects: { not: {} },
    resolves: { not: {} },
  };

  const err = new JestAssertionError();

  Object.keys(allMatchers).forEach(name => {
    const matcher = allMatchers[name];
    const promiseMatcher = getPromiseMatcher(name, matcher) || matcher;
    expectation[name] = makeThrowingMatcher(matcher, false, '', actual);
    expectation.not[name] = makeThrowingMatcher(matcher, true, '', actual);

    expectation.resolves[name] = makeResolveMatcher(
        name,
        promiseMatcher,
        false,
        actual,
        err,
    );
    expectation.resolves.not[name] = makeResolveMatcher(
        name,
        promiseMatcher,
        true,
        actual,
        err,
    );

    expectation.rejects[name] = makeRejectMatcher(
        name,
        promiseMatcher,
        false,
        actual,
        err,
    );
    expectation.rejects.not[name] = makeRejectMatcher(
        name,
        promiseMatcher,
        true,
        actual,
        err,
    );
  });

  return expectation;
};

const getMessage = (message?: () => string) =>
  (message && message()) ||
  matcherUtils.RECEIVED_COLOR('No message was specified for this matcher.');

const makeResolveMatcher =
  (
    matcherName: string,
    matcher: RawMatcherFn,
    isNot: boolean,
    actual: Promise<any>,
    outerErr: JestAssertionError,
  ): PromiseMatcherFn =>
    (...args) => {
      const options = {
        isNot,
        promise: 'resolves',
      };

      if (!isPromise(actual)) {
        throw new JestAssertionError(
            matcherUtils.matcherErrorMessage(
                matcherUtils.matcherHint(matcherName, undefined, '', options),
                `${matcherUtils.RECEIVED_COLOR('received')} value must be a promise`,
                matcherUtils.printWithType(
                    'Received',
                    actual,
                    matcherUtils.printReceived,
                ),
            ),
        );
      }

      const innerErr = new JestAssertionError();

      return actual.then(
          result =>
            makeThrowingMatcher(matcher, isNot, 'resolves', result, innerErr).apply(
                null,
                args,
            ),
          reason => {
            outerErr.message =
            `${matcherUtils.matcherHint(
                matcherName,
                undefined,
                '',
                options,
            )}\n\n` +
            'Received promise rejected instead of resolved\n' +
            `Rejected to value: ${matcherUtils.printReceived(reason)}`;
            return Promise.reject(outerErr);
          },
      );
    };

const makeRejectMatcher =
  (
    matcherName: string,
    matcher: RawMatcherFn,
    isNot: boolean,
    actual: Promise<any> | (() => Promise<any>),
    outerErr: JestAssertionError,
  ): PromiseMatcherFn =>
    (...args) => {
      const options = {
        isNot,
        promise: 'rejects',
      };

      const actualWrapper: Promise<any> =
        typeof actual === 'function' ? actual() : actual;

      if (!isPromise(actualWrapper)) {
        throw new JestAssertionError(
            matcherUtils.matcherErrorMessage(
                matcherUtils.matcherHint(matcherName, undefined, '', options),
                `${matcherUtils.RECEIVED_COLOR(
                    'received',
                )} value must be a promise or a function returning a promise`,
                matcherUtils.printWithType(
                    'Received',
                    actual,
                    matcherUtils.printReceived,
                ),
            ),
        );
      }

      const innerErr = new JestAssertionError();

      return actualWrapper.then(
          result => {
            outerErr.message =
            `${matcherUtils.matcherHint(
                matcherName,
                undefined,
                '',
                options,
            )}\n\n` +
            'Received promise resolved instead of rejected\n' +
            `Resolved to value: ${matcherUtils.printReceived(result)}`;
            return Promise.reject(outerErr);
          },
          reason =>
            makeThrowingMatcher(matcher, isNot, 'rejects', reason, innerErr).apply(
                null,
                args,
            ),
      );
    };

const makeThrowingMatcher = (
  matcher: RawMatcherFn,
  isNot: boolean,
  promise: string,
  actual: any,
  err?: JestAssertionError,
): ThrowingMatcherFn =>
  function throwingMatcher(...args): any {
    let throws = true;
    const utils: MatcherUtils['utils'] = {
      ...matcherUtils,
      iterableEquality,
      subsetEquality,
    };

    const matcherUtilsThing: MatcherUtils = {
      customTesters: getCustomEqualityTesters(),
      // When throws is disabled, the matcher will not throw errors during test
      // execution but instead add them to the global matcher state. If a
      // matcher throws, test execution is normally stopped immediately. The
      // snapshot matcher uses it because we want to log all snapshot
      // failures in a test.
      dontThrow: () => (throws = false),
      equals,
      utils,
    };

    const matcherContext: MatcherContext = {
      ...getState<MatcherState>(),
      ...matcherUtilsThing,
      error: err,
      isNot,
      promise,
    };

    const processResult = (
      result: SyncExpectationResult,
      asyncError?: JestAssertionError,
    ) => {
      _validateResult(result);

      getState().assertionCalls++;

      if ((result.pass && isNot) || (!result.pass && !isNot)) {
        // XOR
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

          // Try to remove this function from the stack trace frame.
          // Guard for some environments (browsers) that do not support this feature.
          if (Error.captureStackTrace)
            Error.captureStackTrace(error, throwingMatcher);

        }
        // Passing the result of the matcher with the error so that a custom
        // reporter could access the actual and expected objects of the result
        // for example in order to display a custom visual diff
        error.matcherResult = { ...result, message };

        if (throws)
          throw error;
        else
          getState().suppressedErrors.push(error);

      } else {
        getState().numPassingAsserts++;
      }
    };

    const handleError = (error: Error) => {
      if (
        matcher[INTERNAL_MATCHER_FLAG] === true &&
        !(error instanceof JestAssertionError) &&
        error.name !== 'PrettyFormatPluginError' &&
        // Guard for some environments (browsers) that do not support this feature.
        Error.captureStackTrace
      ) {
        // Try to remove this and deeper functions from the stack trace frame.
        Error.captureStackTrace(error, throwingMatcher);
      }
      throw error;
    };

    let potentialResult: ExpectationResult;

    try {
      potentialResult =
        matcher[INTERNAL_MATCHER_FLAG] === true
          ? matcher.call(matcherContext, actual, ...args)
          : // It's a trap specifically for inline snapshot to capture this name
          // in the stack trace, so that it can correctly get the custom matcher
          // function call.
          (function __EXTERNAL_MATCHER_TRAP__() {
            return matcher.call(matcherContext, actual, ...args);
          })();

      if (isPromise(potentialResult)) {
        const asyncError = new JestAssertionError();
        if (Error.captureStackTrace)
          Error.captureStackTrace(asyncError, throwingMatcher);


        return potentialResult
            .then(aResult => processResult(aResult, asyncError))
            .catch(handleError);
      } else {
        return processResult(potentialResult);
      }
    } catch (error: any) {
      return handleError(error);
    }
  };

expect.extend = (matchers: MatchersObject) =>
  setMatchers(matchers, false, expect);

expect.addEqualityTesters = customTesters =>
  addCustomEqualityTesters(customTesters);

expect.anything = anything;
expect.any = any;

expect.not = {
  arrayContaining: arrayNotContaining,
  closeTo: notCloseTo,
  objectContaining: objectNotContaining,
  stringContaining: stringNotContaining,
  stringMatching: stringNotMatching,
};

expect.arrayContaining = arrayContaining;
expect.closeTo = closeTo;
expect.objectContaining = objectContaining;
expect.stringContaining = stringContaining;
expect.stringMatching = stringMatching;

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
      `'${matcherUtils.stringify(result)}' was returned`,
    );
  }
};

function assertions(expected: number): void {
  const error = new Error();
  if (Error.captureStackTrace)
    Error.captureStackTrace(error, assertions);


  setState({
    expectedAssertionsNumber: expected,
    expectedAssertionsNumberError: error,
  });
}
function hasAssertions(...args: Array<unknown>): void {
  const error = new Error();
  if (Error.captureStackTrace)
    Error.captureStackTrace(error, hasAssertions);


  matcherUtils.ensureNoExpected(args[0], '.hasAssertions');
  setState({
    isExpectingAssertions: true,
    isExpectingAssertionsError: error,
  });
}

// add default jest matchers
setMatchers(matchers, true, expect);
setMatchers(spyMatchers, true, expect);
setMatchers(toThrowMatchers, true, expect);

expect.assertions = assertions;
expect.hasAssertions = hasAssertions;
expect.getState = getState;
expect.setState = setState;
expect.extractExpectedAssertionsErrors = extractExpectedAssertionsErrors;

export default expect;
