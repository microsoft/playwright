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

import { pollAgainstDeadline } from '@isomorphic/timeoutRunner';
import { kCallbackReturnValuesSymbol } from '@isomorphic/utilityScriptSerializers';

import { expectConfig } from './expect';
import { equals, isPromise, utils } from './expectLibrary';
import { deadlineForMatcher, timeoutFailureMessage } from './matchers';

import type { CallbackReturnValues } from '@isomorphic/utilityScriptSerializers';
import type { SyncExpectationResult } from './expectLibrary';
import type { ExpectMatcherState } from '../../types/test';

type MockResult = { type: 'return' | 'throw', value: any };
type MockSettledResult = { type: 'incomplete' | 'fulfilled' | 'rejected', value: any };

// Plain values are distinguished from implementations so that they can be
// serialized and consumed synchronously by the page, see kCallbackReturnValuesSymbol.
type MockBehavior = { impl: (...args: any[]) => any } | { value: any };

const kMockState = Symbol('mockFunctionState');

class MockFunctionState {
  calls: any[][] = [];
  results: MockResult[] = [];
  settledResults: MockSettledResult[] = [];
  defaultBehavior: MockBehavior | undefined;
  onceBehaviors: MockBehavior[] = [];
  name = 'expect.fn()';
  private _originalBehavior: MockBehavior | undefined;

  constructor(implementation?: (...args: any[]) => any) {
    this.defaultBehavior = implementation ? { impl: implementation } : undefined;
    this._originalBehavior = this.defaultBehavior;
  }

  clear() {
    this.calls = [];
    this.results = [];
    this.settledResults = [];
  }

  reset() {
    this.clear();
    // Following vitest, reset to the implementation originally passed to expect.fn().
    this.defaultBehavior = this._originalBehavior;
    this.onceBehaviors = [];
  }

  // Values that can be shipped to the page for synchronous consumption, with
  // the last value repeating for all remaining calls. Only available when the
  // entire behavior is made of values - any implementation in the mix makes
  // all page-side calls go through the asynchronous roundtrip instead.
  callbackReturnValues(): CallbackReturnValues | undefined {
    if (!this.defaultBehavior && !this.onceBehaviors.length)
      return undefined;
    if (this.defaultBehavior && !('value' in this.defaultBehavior))
      return undefined;
    if (this.onceBehaviors.some(behavior => !('value' in behavior)))
      return undefined;
    const values = this.onceBehaviors.map(behavior => (behavior as { value: any }).value);
    values.push(this.defaultBehavior ? (this.defaultBehavior as { value: any }).value : undefined);
    return values;
  }
}

export function createMockFunction(implementation?: (...args: any[]) => any): any {
  const state = new MockFunctionState(implementation);
  const fn: any = function(this: any, ...args: any[]) {
    state.calls.push(args);
    const behavior = state.onceBehaviors.shift() ?? state.defaultBehavior;
    const settled: MockSettledResult = { type: 'incomplete', value: undefined };
    state.settledResults.push(settled);
    try {
      const value = !behavior ? undefined : 'value' in behavior ? behavior.value : behavior.impl.apply(this, args);
      state.results.push({ type: 'return', value });
      if (isPromise(value)) {
        value.then(
            (resolved: any) => { settled.type = 'fulfilled'; settled.value = resolved; },
            (error: any) => { settled.type = 'rejected'; settled.value = error; });
      } else {
        settled.type = 'fulfilled';
        settled.value = value;
      }
      return value;
    } catch (error) {
      state.results.push({ type: 'throw', value: error });
      settled.type = 'rejected';
      settled.value = error;
      throw error;
    }
  };
  fn[kMockState] = state;
  fn[kCallbackReturnValuesSymbol] = () => state.callbackReturnValues();
  fn.mock = {
    get calls() { return state.calls; },
    get results() { return state.results; },
    get settledResults() { return state.settledResults; },
    get lastCall() { return state.calls.length ? state.calls[state.calls.length - 1] : undefined; },
  };
  fn.mockClear = () => { state.clear(); return fn; };
  fn.mockReset = () => { state.reset(); return fn; };
  fn.mockImplementation = (impl: (...args: any[]) => any) => { state.defaultBehavior = { impl }; return fn; };
  fn.mockImplementationOnce = (impl: (...args: any[]) => any) => { state.onceBehaviors.push({ impl }); return fn; };
  fn.mockReturnValue = (value: any) => { state.defaultBehavior = { value }; return fn; };
  fn.mockReturnValueOnce = (value: any) => { state.onceBehaviors.push({ value }); return fn; };
  fn.mockResolvedValue = (value: any) => { state.defaultBehavior = { impl: () => Promise.resolve(value) }; return fn; };
  fn.mockResolvedValueOnce = (value: any) => { state.onceBehaviors.push({ impl: () => Promise.resolve(value) }); return fn; };
  fn.mockRejectedValue = (error: any) => { state.defaultBehavior = { impl: () => Promise.reject(error) }; return fn; };
  fn.mockRejectedValueOnce = (error: any) => { state.onceBehaviors.push({ impl: () => Promise.reject(error) }); return fn; };
  fn.mockName = (name: string) => { state.name = name; return fn; };
  fn.getMockName = () => state.name;
  return fn;
}

type MockCheckResult = SyncExpectationResult & {
  // Set when the outcome can never change with more calls, e.g. the call count
  // already exceeded the expectation. Stops polling early.
  terminal?: boolean;
};

function mockStateFor(matcherName: string, receiver: any): MockFunctionState {
  const state = receiver?.[kMockState] as MockFunctionState | undefined;
  if (!state)
    throw new Error(`${matcherName}() can only be used with a mock function created by expect.fn()`);
  return state;
}

function createMockMatcher(matcherName: string, check: (state: MockFunctionState, context: ExpectMatcherState, args: any[]) => MockCheckResult) {
  return async function(this: ExpectMatcherState, receiver: any, ...args: any[]): Promise<SyncExpectationResult> {
    const state = mockStateFor(matcherName, receiver);
    const isNot = !!this.isNot;
    const first = check(state, this, args);
    if (first.pass !== isNot || first.terminal)
      return first;
    const { deadline, timeoutMessage } = deadlineForMatcher(expectConfig().testInfo, this.timeout);
    const result = await pollAgainstDeadline<MockCheckResult>(async () => {
      const checkResult = check(state, this, args);
      return { continuePolling: checkResult.pass === isNot && !checkResult.terminal, result: checkResult };
    }, deadline);
    const last = result.result ?? first;
    if (result.timedOut)
      return { pass: last.pass, message: () => timeoutFailureMessage(last.message(), timeoutMessage) };
    return last;
  };
}

function matchesExpected(actual: any, expected: any): boolean {
  return equals(actual, expected, [utils.iterableEquality]);
}

function printArgs(args: any[], print: (value: unknown) => string): string {
  return args.length ? args.map(arg => print(arg)).join(', ') : 'called with 0 arguments';
}

function ensureInteger(matcherName: string, argName: string, value: any, min: 0 | 1) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min)
    throw new Error(`${matcherName}: ${argName} must be a ${min === 1 ? 'positive' : 'non-negative'} integer, received ${utils.stringify(value)}`);
}

// Each matcher family observes one list of per-call items: the arguments for
// toHaveBeenCalled*, the returned values for toHaveReturned*, and the settled
// results for toHaveResolved*. The five matcher shapes below are shared
// between the families.
type MockItemFamily<Item> = {
  items(state: MockFunctionState): Item[];
  // Whether the item counts towards the family total, e.g. a call that threw
  // is not a "return".
  counts(item: Item): boolean;
  // `expected` are the matcher arguments, without the `n` for the nth shape.
  matches(item: Item, expected: any[]): boolean;
  printExpected(expected: any[]): string;
  printItem(item: Item): string;
  // Rendering of the item for the "Received:" line; undefined omits the line.
  printItemInline(item: Item): string | undefined;
  // Whether the item can still change, e.g. a pending promise can settle later.
  isFinal(item: Item): boolean;
  countNoun: string;
  itemNoun: string;
  receivedLabel: string;
  expectedHint: string;
};

const calledFamily: MockItemFamily<any[]> = {
  items: state => state.calls,
  counts: () => true,
  matches: (call, expected) => matchesExpected(call, expected),
  printExpected: expected => printArgs(expected, utils.printExpected),
  printItem: call => printArgs(call, utils.printReceived),
  printItemInline: call => printArgs(call, utils.printReceived),
  isFinal: () => true,
  countNoun: 'calls',
  itemNoun: 'call',
  receivedLabel: 'Received calls:',
  expectedHint: '...expected',
};

const returnedFamily: MockItemFamily<MockResult> = {
  items: state => state.results,
  counts: result => result.type === 'return',
  matches: (result, [expected]) => result.type === 'return' && matchesExpected(result.value, expected),
  printExpected: ([expected]) => utils.printExpected(expected),
  printItem: result => `${result.type === 'throw' ? 'threw ' : ''}${utils.printReceived(result.value)}`,
  printItemInline: result => `${result.type === 'throw' ? 'threw ' : ''}${utils.printReceived(result.value)}`,
  isFinal: () => true,
  countNoun: 'returns',
  itemNoun: 'result',
  receivedLabel: 'Received returns:',
  expectedHint: 'expected',
};

const resolvedFamily: MockItemFamily<MockSettledResult> = {
  items: state => state.settledResults,
  counts: result => result.type === 'fulfilled',
  matches: (result, [expected]) => result.type === 'fulfilled' && matchesExpected(result.value, expected),
  printExpected: ([expected]) => utils.printExpected(expected),
  printItem: result => result.type === 'incomplete' ? 'incomplete' : `${result.type === 'rejected' ? 'rejected ' : ''}${utils.printReceived(result.value)}`,
  printItemInline: result => result.type === 'incomplete' ? undefined : `${result.type === 'rejected' ? 'rejected ' : ''}${utils.printReceived(result.value)}`,
  isFinal: result => result.type !== 'incomplete',
  countNoun: 'resolved values',
  itemNoun: 'result',
  receivedLabel: 'Received results:',
  expectedHint: 'expected',
};

function matcherHintFor(matcherName: string, state: MockFunctionState, context: ExpectMatcherState, expectedArg: string): string {
  return utils.matcherHint(matcherName, state.name, expectedArg, { isNot: context.isNot, promise: context.promise });
}

function printItemsList<Item>(items: Item[], family: MockItemFamily<Item>): string[] {
  const limit = 5;
  const lines: string[] = [];
  const start = Math.max(0, items.length - limit);
  if (start > 0)
    lines.push(`  ... ${start} earlier ${family.itemNoun}${start === 1 ? '' : 's'} ...`);
  for (let i = start; i < items.length; i++)
    lines.push(`  ${i + 1}: ${family.printItem(items[i])}`);
  return lines;
}

function countItems<Item>(items: Item[], family: MockItemFamily<Item>): number {
  let count = 0;
  for (const item of items) {
    if (family.counts(item))
      count++;
  }
  return count;
}

function atLeastOnceMatcher<Item>(matcherName: string, family: MockItemFamily<Item>) {
  return createMockMatcher(matcherName, (state, context) => {
    const items = family.items(state);
    const count = countItems(items, family);
    const pass = count > 0;
    const message = () => [
      matcherHintFor(matcherName, state, context, ''),
      '',
      `Expected number of ${family.countNoun}: ${context.isNot ? utils.printExpected(0) : `>= ${utils.printExpected(1)}`}`,
      `Received number of ${family.countNoun}: ${utils.printReceived(count)}`,
      ...(items.length ? ['', ...printItemsList(items, family)] : []),
    ].join('\n');
    // The count only grows, so a failing `.not` can never recover.
    return { pass, message, terminal: pass && !!context.isNot };
  });
}

function exactTimesMatcher<Item>(matcherName: string, family: MockItemFamily<Item>) {
  return createMockMatcher(matcherName, (state, context, [expected]) => {
    ensureInteger(matcherName, 'expected', expected, 0);
    const count = countItems(family.items(state), family);
    const pass = count === expected;
    const message = () => [
      matcherHintFor(matcherName, state, context, 'expected'),
      '',
      `Expected number of ${family.countNoun}: ${context.isNot ? 'not ' : ''}${utils.printExpected(expected)}`,
      ...(pass ? [] : [`Received number of ${family.countNoun}: ${utils.printReceived(count)}`]),
    ].join('\n');
    // The count only grows, so once it exceeds the expectation it can never match again.
    return { pass, message, terminal: !context.isNot && count > expected };
  });
}

function withMatcher<Item>(matcherName: string, family: MockItemFamily<Item>) {
  return createMockMatcher(matcherName, (state, context, expected) => {
    const items = family.items(state);
    const pass = items.some(item => family.matches(item, expected));
    const message = () => [
      matcherHintFor(matcherName, state, context, family.expectedHint),
      '',
      `Expected: ${context.isNot ? 'not ' : ''}${family.printExpected(expected)}`,
      ...(items.length ? [family.receivedLabel, ...printItemsList(items, family)] : []),
      '',
      `Number of calls: ${utils.printReceived(state.calls.length)}`,
    ].join('\n');
    // A matching item cannot be undone, so a failing `.not` can never recover.
    return { pass, message, terminal: pass && !!context.isNot };
  });
}

function lastWithMatcher<Item>(matcherName: string, family: MockItemFamily<Item>) {
  return createMockMatcher(matcherName, (state, context, expected) => {
    const items = family.items(state);
    const last = items.length ? items[items.length - 1] : undefined;
    const pass = !!last && family.matches(last, expected);
    const message = () => {
      const received = last === undefined ? undefined : family.printItemInline(last);
      return [
        matcherHintFor(matcherName, state, context, family.expectedHint),
        '',
        `Expected: ${context.isNot ? 'not ' : ''}${family.printExpected(expected)}`,
        ...(received === undefined ? [] : [`Received: ${received}`]),
        '',
        `Number of calls: ${utils.printReceived(state.calls.length)}`,
      ].join('\n');
    };
    // Not terminal - a later call becomes the new last item.
    return { pass, message };
  });
}

function nthWithMatcher<Item>(matcherName: string, family: MockItemFamily<Item>) {
  return createMockMatcher(matcherName, (state, context, [n, ...expected]) => {
    ensureInteger(matcherName, 'n', n, 1);
    const item = family.items(state)[n - 1];
    const pass = !!item && family.matches(item, expected);
    const message = () => {
      const received = item === undefined ? undefined : family.printItemInline(item);
      return [
        matcherHintFor(matcherName, state, context, `n, ${family.expectedHint}`),
        '',
        `n: ${n}`,
        `Expected: ${context.isNot ? 'not ' : ''}${family.printExpected(expected)}`,
        ...(received === undefined ? [] : [`Received: ${received}`]),
        '',
        `Number of calls: ${utils.printReceived(state.calls.length)}`,
      ].join('\n');
    };
    // Once made and settled, the n-th item never changes.
    return { pass, message, terminal: !!item && family.isFinal(item) && pass === !!context.isNot };
  });
}

export const mockMatchers = {
  toHaveBeenCalled: atLeastOnceMatcher('toHaveBeenCalled', calledFamily),
  toHaveBeenCalledTimes: exactTimesMatcher('toHaveBeenCalledTimes', calledFamily),
  toHaveBeenCalledWith: withMatcher('toHaveBeenCalledWith', calledFamily),
  toHaveBeenLastCalledWith: lastWithMatcher('toHaveBeenLastCalledWith', calledFamily),
  toHaveBeenNthCalledWith: nthWithMatcher('toHaveBeenNthCalledWith', calledFamily),
  toHaveReturned: atLeastOnceMatcher('toHaveReturned', returnedFamily),
  toHaveReturnedTimes: exactTimesMatcher('toHaveReturnedTimes', returnedFamily),
  toHaveReturnedWith: withMatcher('toHaveReturnedWith', returnedFamily),
  toHaveLastReturnedWith: lastWithMatcher('toHaveLastReturnedWith', returnedFamily),
  toHaveNthReturnedWith: nthWithMatcher('toHaveNthReturnedWith', returnedFamily),
  toHaveResolved: atLeastOnceMatcher('toHaveResolved', resolvedFamily),
  toHaveResolvedTimes: exactTimesMatcher('toHaveResolvedTimes', resolvedFamily),
  toHaveResolvedWith: withMatcher('toHaveResolvedWith', resolvedFamily),
  toHaveLastResolvedWith: lastWithMatcher('toHaveLastResolvedWith', resolvedFamily),
  toHaveNthResolvedWith: nthWithMatcher('toHaveNthResolvedWith', resolvedFamily),
};
