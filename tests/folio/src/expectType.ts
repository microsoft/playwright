/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

export declare type AsymmetricMatcher = Record<string, any>;
export declare type Expect = {
    <T = unknown>(actual: T): Matchers<T>;
    [id: string]: AsymmetricMatcher;
    not: {
        [id: string]: AsymmetricMatcher;
    };
};

export interface Matchers<R> {
    /**
     * If you know how to test something, `.not` lets you test its opposite.
     */
    not: Matchers<R>;
    /**
     * Use resolves to unwrap the value of a fulfilled promise so any other
     * matcher can be chained. If the promise is rejected the assertion fails.
     */
    resolves: Matchers<Promise<R>>;
    /**
     * Unwraps the reason of a rejected promise so any other matcher can be chained.
     * If the promise is fulfilled the assertion fails.
     */
    rejects: Matchers<Promise<R>>;
    /**
     * Checks that a value is what you expect. It uses `===` to check strict equality.
     * Don't use `toBe` with floating-point numbers.
     */
    toBe(expected: unknown): R;
    /**
     * Using exact equality with floating point numbers is a bad idea.
     * Rounding means that intuitive things fail.
     * The default for numDigits is 2.
     */
    toBeCloseTo(expected: number, numDigits?: number): R;
    /**
     * Ensure that a variable is not undefined.
     */
    toBeDefined(): R;
    /**
     * When you don't care what a value is, you just want to
     * ensure a value is false in a boolean context.
     */
    toBeFalsy(): R;
    /**
     * For comparing floating point numbers.
     */
    toBeGreaterThan(expected: number | bigint): R;
    /**
     * For comparing floating point numbers.
     */
    toBeGreaterThanOrEqual(expected: number | bigint): R;
    /**
     * Ensure that an object is an instance of a class.
     * This matcher uses `instanceof` underneath.
     */
    toBeInstanceOf(expected: Function): R;
    /**
     * For comparing floating point numbers.
     */
    toBeLessThan(expected: number | bigint): R;
    /**
     * For comparing floating point numbers.
     */
    toBeLessThanOrEqual(expected: number | bigint): R;
    /**
     * This is the same as `.toBe(null)` but the error messages are a bit nicer.
     * So use `.toBeNull()` when you want to check that something is null.
     */
    toBeNull(): R;
    /**
     * Use when you don't care what a value is, you just want to ensure a value
     * is true in a boolean context. In JavaScript, there are six falsy values:
     * `false`, `0`, `''`, `null`, `undefined`, and `NaN`. Everything else is truthy.
     */
    toBeTruthy(): R;
    /**
     * Used to check that a variable is undefined.
     */
    toBeUndefined(): R;
    /**
     * Used to check that a variable is NaN.
     */
    toBeNaN(): R;
    /**
     * Used when you want to check that an item is in a list.
     * For testing the items in the list, this uses `===`, a strict equality check.
     */
    toContain(expected: unknown): R;
    /**
     * Used when you want to check that an item is in a list.
     * For testing the items in the list, this  matcher recursively checks the
     * equality of all fields, rather than checking for object identity.
     */
    toContainEqual(expected: unknown): R;
    /**
     * Used when you want to check that two objects have the same value.
     * This matcher recursively checks the equality of all fields, rather than checking for object identity.
     */
    toEqual(expected: unknown): R;
    /**
     * Use to check if property at provided reference keyPath exists for an object.
     * For checking deeply nested properties in an object you may use dot notation or an array containing
     * the keyPath for deep references.
     *
     * Optionally, you can provide a value to check if it's equal to the value present at keyPath
     * on the target object. This matcher uses 'deep equality' (like `toEqual()`) and recursively checks
     * the equality of all fields.
     *
     * @example
     *
     * expect(houseForSale).toHaveProperty('kitchen.area', 20);
     */
    toHaveProperty(keyPath: string | Array<string>, value?: unknown): R;
    /**
     * Check that a string matches a regular expression.
     */
    toMatch(expected: string | RegExp): R;
    /**
     * Used to check that a JavaScript object matches a subset of the properties of an object
     */
    toMatchObject(expected: Record<string, unknown> | Array<unknown>): R;
    /**
     * Use to test that objects have the same types as well as structure.
     */
    toStrictEqual(expected: unknown): R;
    /**
     * Match snapshot
     */
    toMatchSnapshot(options?: {
      name?: string,
      threshold?: number
    }): R;
    /**
     * Match snapshot
     */
    toMatchSnapshot(name: string, options?: {
      threshold?: number
    }): R;
}
export {};
