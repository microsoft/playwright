/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

// -------------- Playwright -------------
// - Matcher types are relaxed in the overrides.
//
// import type { Config } from '@jest/types';
// import type * as jestMatcherUtils from 'jest-matcher-utils';
// import { INTERNAL_MATCHER_FLAG } from './jestMatchersObject';
//
// export declare type SyncExpectationResult = {
//     pass: boolean;
//     message: () => string;
// };
// export declare type AsyncExpectationResult = Promise<SyncExpectationResult>;
// export declare type ExpectationResult = SyncExpectationResult | AsyncExpectationResult;
// export declare type RawMatcherFn<T extends MatcherState = MatcherState> = {
//     (this: T, received: any, expected: any, options?: any): ExpectationResult;
//     [INTERNAL_MATCHER_FLAG]?: boolean;
// };
// export declare type ThrowingMatcherFn = (actual: any) => void;
// export declare type PromiseMatcherFn = (actual: any) => Promise<void>;
// ---------------------------------------

export declare type Tester = (a: any, b: any) => boolean | undefined;
export declare type MatcherState = {
    assertionCalls: number;
    currentTestName?: string;
    dontThrow?: () => void;
    error?: Error;
    equals: (a: unknown, b: unknown, customTesters?: Array<Tester>, strictCheck?: boolean) => boolean;
    expand?: boolean;
    expectedAssertionsNumber?: number | null;
    expectedAssertionsNumberError?: Error;
    isExpectingAssertions?: boolean;
    isExpectingAssertionsError?: Error;
    isNot: boolean;
    promise: string;
    suppressedErrors: Array<Error>;

    // -------------- Playwright -------------
    // - Inline type
    // testPath?: Config.Path;
    testPath?: string;
    // ---------------------------------------

    // -------------- Playwright -------------
    // - Further relax type in order to not drag the dependencies.
    // utils: typeof jestMatcherUtils & {
    //     iterableEquality: Tester;
    //     subsetEquality: Tester;
    // };
    utils: any;
    // ---------------------------------------
};

// -------------- Playwright -------------
// - Matcher types are relaxed in the override.
//
// export interface AsymmetricMatcher {
//     asymmetricMatch(other: unknown): boolean;
//     toString(): string;
//     getExpectedType?(): string;
//     toAsymmetricMatcher?(): string;
// }
//
// export declare type MatchersObject<T extends MatcherState = MatcherState> = {
//     [id: string]: RawMatcherFn<T>;
// };
// export declare type ExpectedAssertionsErrors = Array<{
//     actual: string | number;
//     error: Error;
//     expected: string;
// }>;
// ---------------------------------------

// -------------- Playwright -------------
// Following are inlined in the expect override.
// interface InverseAsymmetricMatchers {
//     arrayContaining(sample: Array<unknown>): AsymmetricMatcher;
//     objectContaining(sample: Record<string, unknown>): AsymmetricMatcher;
//     stringContaining(expected: string): AsymmetricMatcher;
//     stringMatching(expected: string | RegExp): AsymmetricMatcher;
// }
// interface AsymmetricMatchers extends InverseAsymmetricMatchers {
//     any(expectedObject: unknown): AsymmetricMatcher;
//     anything(): AsymmetricMatcher;
// }
// interface ExtraAsymmetricMatchers {
//     [id: string]: (...sample: [unknown, ...Array<unknown>]) => AsymmetricMatcher;
// }
// export declare type Expect<State extends MatcherState = MatcherState> = {
//     <T = unknown>(actual: T): Matchers<void>;
//     addSnapshotSerializer(serializer: unknown): void;
//     assertions(numberOfAssertions: number): void;
//     extend<T extends MatcherState = State>(matchers: MatchersObject<T>): void;
//     extractExpectedAssertionsErrors: () => ExpectedAssertionsErrors;
//     getState(): State;
//     hasAssertions(): void;
//     setState(state: Partial<State>): void;
// } & AsymmetricMatchers & ExtraAsymmetricMatchers & {
//     not: InverseAsymmetricMatchers & ExtraAsymmetricMatchers;
// };
// ---------------------------------------

export {};
