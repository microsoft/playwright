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
import {
  expect as expectLibrary,
} from './expectBundle';

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

function createMatchers(actual: unknown, info: ExpectMetaInfo, prefix: string[]): any {
  return new Proxy(expectLibrary(actual), new ExpectMetaInfoProxyHandler(actual, info, prefix));
}

const userMatchersSymbol = Symbol('userMatchers');

function qualifiedMatcherName(qualifier: string[], matcherName: string) {
  return qualifier.join(':') + '$' + matcherName;
}

let lastExtendId = 0;

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
          const qualifier = [...prefix, String(++lastExtendId)];

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

function wrapPlaywrightMatcherToPassNiceThis(matcher: any) {
  return function(this: any, ...args: any[]) {
    const { isNot, promise, utils } = this;
    const context = takeMatcherCallContext();
    const timeout = context?.expectInfo.timeout ?? expectConfig().timeout ?? defaultExpectTimeout;
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
  private _actual: any;
  private _info: ExpectMetaInfo;
  private _prefix: string[];

  constructor(actual: any, info: ExpectMetaInfo, prefix: string[]) {
    this._actual = actual;
    this._info = { ...info };
    this._prefix = prefix;
  }

  get(target: Object, matcherName: string | symbol, receiver: any): any {
    if (matcherName === 'toThrowError')
      matcherName = 'toThrow';
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
      const testInfo = expectConfig().testInfo;
      setMatcherCallContext({ expectInfo: this._info, testInfo });
      if (!testInfo)
        return matcher.call(target, ...args);

      const customMessage = this._info.message || '';
      const suffixes = computeMatcherTitleSuffix(matcherName, this._actual, args);
      const defaultTitle = `${this._info.poll ? 'poll ' : ''}${this._info.isSoft ? 'soft ' : ''}${this._info.isNot ? 'not ' : ''}${matcherName}${suffixes.short || ''}`;
      const shortTitle = customMessage || `Expect ${escapeWithQuotes(defaultTitle, '"')}`;
      const longTitle = shortTitle + (suffixes.long || '');
      const apiName = `expect${this._info.poll ? '.poll ' : ''}${this._info.isSoft ? '.soft ' : ''}${this._info.isNot ? '.not' : ''}.${matcherName}${suffixes.short || ''}`;

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
        infectParentStepsWithError: this._info.isSoft,
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
        void reportStepError(e);
      }
    };
  }
}

async function pollMatcher(qualifiedMatcherName: string, info: ExpectMetaInfo, prefix: string[], ...args: any[]) {
  const testInfo = expectConfig().testInfo;
  const poll = info.poll!;
  const timeout = poll.timeout ?? info.timeout ?? expectConfig().timeout ?? defaultExpectTimeout;
  const { deadline, timeoutMessage } = deadlineForMatcher(testInfo, timeout);

  const result = await pollAgainstDeadline<Error|undefined>(async () => {
    if (testInfo && expectConfig().testInfo !== testInfo)
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

export const expect: Expect<{}> = createExpect({}, [], {}).extend(customMatchers as any);

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
