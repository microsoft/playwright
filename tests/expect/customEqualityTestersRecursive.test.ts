/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { test, expect } from './fixtures';
import { expect as expectUnderTest, mock } from '../../packages/playwright/bundles/expect/src/expectBundleImpl';

// Test test file demonstrates and tests the capability of recursive custom
// testers that call `equals` within their tester logic. These testers should
// receive the array of custom testers and be able to pass it into equals

const CONNECTION_PROP = '__connection';
type DbConnection = number;
let DbConnectionId = 0;

class Author {
  public name: string;
  public [CONNECTION_PROP]: DbConnection;

  constructor(name: string) {
    this.name = name;
    this[CONNECTION_PROP] = DbConnectionId++;
  }
}

class Book {
  public name: string;
  public authors: Array<Author>;
  public [CONNECTION_PROP]: DbConnection;

  constructor(name: string, authors: Array<Author>) {
    this.name = name;
    this.authors = authors;
    this[CONNECTION_PROP] = DbConnectionId++;
  }
}

const areAuthorsEqual = (a: unknown, b: unknown) => {
  const isAAuthor = a instanceof Author;
  const isBAuthor = b instanceof Author;

  if (isAAuthor && isBAuthor)
    return a.name === b.name;
  else if (isAAuthor !== isBAuthor)
    return false;
  else
    return undefined;

};

const areBooksEqual = function(
  a: unknown,
  b: unknown,
  customTesters: [],
) {
  const isABook = a instanceof Book;
  const isBBook = b instanceof Book;

  if (isABook && isBBook) {
    return (
      a.name === b.name && this.equals(a.authors, b.authors, customTesters)
    );
  } else if (isABook !== isBBook) {
    return false;
  } else {
    return undefined;
  }
};

function* toIterator<T>(array: Array<T>): Iterator<T> {
  for (const obj of array)
    yield obj;

}

expectUnderTest.extend({
  toEqualBook(expected: Book, actual: Book) {
    const result = this.equals(expected, actual, this.customTesters);

    return {
      message: () =>
        `Expected Book object: ${expected.name}. Actual Book object: ${actual.name}`,
      pass: result,
    };
  },
});

// Create books with the same name and authors for use in tests. Without the
// custom tester, these books would not be equal because their DbConnections
// would have different values. However, with our custom tester they are equal.
const book1 = new Book('Book 1', [
  new Author('Author 1'),
  new Author('Author 2'),
]);
const book1b = new Book('Book 1', [
  new Author('Author 1'),
  new Author('Author 2'),
]);

const bookArg1a = new Book('Book Arg 1', [
  new Author('Author Arg 1'),
  new Author('Author Arg 2'),
]);
const bookArg1b = new Book('Book Arg 1', [
  new Author('Author Arg 1'),
  new Author('Author Arg 2'),
]);
const bookArg2a = new Book('Book Arg 2', [
  new Author('Author Arg 3'),
  new Author('Author Arg 4'),
]);
const bookArg2b = new Book('Book Arg 2', [
  new Author('Author Arg 3'),
  new Author('Author Arg 4'),
]);

const bookReturn1a = new Book('Book Return 1', [
  new Author('Author Return 1'),
  new Author('Author Return 2'),
]);
const bookReturn1b = new Book('Book Return 1', [
  new Author('Author Return 1'),
  new Author('Author Return 2'),
]);

const testArgs = [bookArg1a, bookArg1b, [bookArg2a, bookArg2b]];
// Swap the order of args to assert custom tester works correctly and ignores
// DbConnection differences
const expectedArgs = [bookArg1b, bookArg1a, [bookArg2b, bookArg2a]];

expectUnderTest.addEqualityTesters([areAuthorsEqual, areBooksEqual]);

test.describe('with custom equality testers', () => {
  test('exposes an equality function to custom testers', () => {
    const runTestSymbol = Symbol('run this test');

    expectUnderTest.addEqualityTesters([
      function dummyTester() {
        return undefined;
      },
    ]);

    expectUnderTest(() =>
      expectUnderTest(runTestSymbol).toEqual(runTestSymbol),
    ).not.toThrow();
  });

  test('basic matchers customTesters do not apply to still do not pass different Book objects', () => {
    expectUnderTest(book1).not.toBe(book1b);
    expectUnderTest([book1]).not.toContain(book1b);
  });

  test('basic matchers pass different Book objects', () => {
    expectUnderTest(book1).toEqual(book1);
    expectUnderTest(book1).toEqual(book1b);
    expectUnderTest([book1, book1b]).toEqual([book1b, book1]);
    expectUnderTest(new Map([['key', book1]])).toEqual(new Map([['key', book1b]]));
    expectUnderTest(new Set([book1])).toEqual(new Set([book1b]));
    expectUnderTest(toIterator([book1, book1b])).toEqual(toIterator([book1b, book1]));
    expectUnderTest([book1]).toContainEqual(book1b);
    expectUnderTest({ a: book1 }).toHaveProperty('a', book1b);
    expectUnderTest({ a: book1, b: undefined }).toStrictEqual({
      a: book1b,
      b: undefined,
    });
    expectUnderTest({ a: 1, b: { c: book1 } }).toMatchObject({
      a: 1,
      b: { c: book1b },
    });
  });

  test('asymmetric matchers pass different Book objects', () => {
    expectUnderTest([book1]).toEqual(expect.arrayContaining([book1b]));
    expectUnderTest({ a: 1, b: { c: book1 } }).toEqual(
        expect.objectContaining({ b: { c: book1b } }),
    );
  });

  test('spy matchers pass different Book objects', () => {
    const mockFn = mock.fn<(...args: Array<unknown>) => unknown>(
        () => bookReturn1a,
    );
    mockFn(...testArgs);

    expectUnderTest(mockFn).toHaveBeenCalledWith(...expectedArgs);
    expectUnderTest(mockFn).toHaveBeenLastCalledWith(...expectedArgs);
    expectUnderTest(mockFn).toHaveBeenNthCalledWith(1, ...expectedArgs);

    expectUnderTest(mockFn).toHaveReturnedWith(bookReturn1b);
    expectUnderTest(mockFn).toHaveLastReturnedWith(bookReturn1b);
    expectUnderTest(mockFn).toHaveNthReturnedWith(1, bookReturn1b);
  });

  test('custom matchers pass different Book objects', () => {
    (expectUnderTest as any)(book1).toEqualBook(book1b);
  });

  test('toBe recommends toStrictEqual even with different Book objects', () => {
    expectUnderTest(() => expectUnderTest(book1).toBe(book1b)).toThrow('toStrictEqual');
  });

  test('toBe recommends toEqual even with different Book objects', () => {
    expectUnderTest(() => expectUnderTest({ a: undefined, b: book1 }).toBe({ b: book1b })).toThrow(
        'toEqual',
    );
  });

  test('toContains recommends toContainEquals even with different Book objects', () => {
    expectUnderTest(() => expectUnderTest([book1]).toContain(book1b)).toThrow('toContainEqual');
  });

  test('toMatchObject error shows Book objects as equal', () => {
    expect(() =>
      expectUnderTest({ a: 1, b: book1 }).toMatchObject({ a: 2, b: book1b })
    ).toThrowErrorMatchingSnapshot(`<d>expect(</><r>received</><d>).</>toMatchObject<d>(</><g>expected</><d>)</>

<g>- Expected  - 1</>
<r>+ Received  + 1</>

<y>@@ -1,7 +1,7 @@</>
<d>  Object {</>
<g>-   "a": 2,</>
<r>+   "a": 1,</>
<d>    "b": Book {</>
<d>      "__connection": 5,</>
<d>      "authors": Array [</>
<d>        Author {</>
<d>          "__connection": 3,</>`);
  });

  test('iterableEquality still properly detects cycles', () => {
    const a = new Set();
    a.add(book1);
    a.add(a);

    const b = new Set();
    b.add(book1b);
    b.add(b);

    expectUnderTest(a).toEqual(b);
  });
});
