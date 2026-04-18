/**
 * Copyright (c) Meta Platforms, Inc. and affiliates. All Rights Reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * This source code is licensed under the MIT license found here
 * https://github.com/jestjs/jest/blob/v30.2.0/LICENSE
 */

// Adapted from jest/packages/expect/src/__tests__/matchers.test.js,
// asymmetricMatchers.test.ts and toThrowMatchers.test.ts.

import { test, expect } from './pageTest';

test.describe('.toBe()', () => {
  test('does not throw', () => {
    expect('a').not.toBe('b');
    expect('a').toBe('a');
    expect(1).not.toBe(2);
    expect(1).toBe(1);
    expect(null).not.toBe(undefined);
    expect(null).toBe(null);
    expect(undefined).toBe(undefined);
    expect(NaN).toBe(NaN);
    expect(BigInt(1)).not.toBe(BigInt(2));
    expect(BigInt(1)).not.toBe(1);
    expect(BigInt(1)).toBe(BigInt(1));
  });

  for (const [i, [a, b]] of [
    [1, 2],
    [true, false],
    [{}, {}],
    [{ a: 1 }, { a: 1 }],
    [{ a: 1 }, { a: 5 }],
    [{ a: undefined, b: 2 }, { b: 2 }],
    [new Date('2020-02-20'), new Date('2020-02-20')],
    [/received/, /expected/],
    [['abc'], ['cde']],
    [[], []],
    [null, undefined],
    [-0, +0],
  ].entries()) {
    test(`fails for: ${JSON.stringify(a)} and ${JSON.stringify(b)} #${i}`, () => {
      expect(() => expect(a).toBe(b)).toThrow();
    });
  }

  for (const v of [false, 1, 'a', undefined, null, {}, []]) {
    test(`fails for '${JSON.stringify(v)}' with '.not'`, () => {
      expect(() => expect(v).not.toBe(v)).toThrow();
    });
  }

  test('does not crash on circular references', () => {
    const obj: any = {};
    obj.circular = obj;
    expect(() => expect(obj).toBe({})).toThrow();
  });

  test('matcherResult property contains matcher name, expected and actual values', () => {
    const actual = { a: 1 };
    const expected = { a: 2 };
    try {
      expect(actual).toBe(expected);
    } catch (error) {
      expect(error.matcherResult).toEqual(expect.objectContaining({
        actual,
        expected,
        name: 'toBe',
      }));
    }
  });
});

test.describe('.toStrictEqual()', () => {
  class TestClassA {
    a: number;
    b: number;
    constructor(a: number, b: number) {
      this.a = a;
      this.b = b;
    }
  }

  class TestClassB {
    a: number;
    b: number;
    constructor(a: number, b: number) {
      this.a = a;
      this.b = b;
    }
  }

  test('does not ignore keys with undefined values', () => {
    expect({ a: undefined, b: 2 }).not.toStrictEqual({ b: 2 });
  });

  test('does not ignore keys with undefined values inside an array', () => {
    expect([{ a: undefined }]).not.toStrictEqual([{}]);
  });

  test('passes when comparing same type', () => {
    expect({ test: new TestClassA(1, 2) }).toStrictEqual({ test: new TestClassA(1, 2) });
  });

  test('does not pass for different types', () => {
    expect({ test: new TestClassA(1, 2) }).not.toStrictEqual({ test: new TestClassB(1, 2) });
  });

  test('passes for matching buffers', () => {
    expect(Uint8Array.from([1]).buffer).toStrictEqual(Uint8Array.from([1]).buffer);
    expect(Uint8Array.from([]).buffer).toStrictEqual(Uint8Array.from([]).buffer);
    expect(Uint8Array.from([9, 3]).buffer).toStrictEqual(Uint8Array.from([9, 3]).buffer);
  });

  test('does not pass when ArrayBuffers are not equal', () => {
    expect(Uint8Array.from([1, 2]).buffer).not.toStrictEqual(Uint8Array.from([0, 0]).buffer);
  });
});

test.describe('.toEqual()', () => {
  for (const [a, b] of [
    [true, false],
    [1, 2],
    [0, Number.MIN_VALUE],
    [{ a: 1 }, { a: 2 }],
    ['banana', 'apple'],
    [null, undefined],
    [[1], [2]],
    [new Set([1, 2]), new Set()],
    [new Set([1, 2]), new Set([1, 2, 3])],
    [new Map([['a', 0]]), new Map([['b', 0]])],
    [new Uint8Array([97, 98, 99]), new Uint8Array([97, 98, 100])],
    [{ a: 1, b: 2 }, expect.objectContaining({ a: 2 })],
    [[1, 3], expect.arrayContaining([1, 2])],
    ['abd', expect.stringContaining('bc')],
    ['abd', expect.stringMatching(/bc/i)],
    [undefined, expect.anything()],
    [undefined, expect.any(Function)],
  ].entries()) {
    test(`{pass: false} expect().toEqual() #${a}`, () => {
      expect(() => expect(b[0]).toEqual(b[1])).toThrow();
      expect(b[0]).not.toEqual(b[1]);
    });
  }

  for (const [a, b] of [
    [true, true],
    [1, 1],
    [NaN, NaN],
    ['abc', 'abc'],
    [[1], [1]],
    [{}, {}],
    [{ a: 99 }, { a: 99 }],
    [new Set(), new Set()],
    [new Set([1, 2]), new Set([1, 2])],
    [new Set([1, 2]), new Set([2, 1])],
    [new Map(), new Map()],
    [new Uint8Array([97, 98, 99]), new Uint8Array([97, 98, 99])],
    [{ a: 1, b: 2 }, expect.objectContaining({ a: 1 })],
    [[1, 2, 3], expect.arrayContaining([2, 3])],
    ['abcd', expect.stringContaining('bc')],
    ['abcd', expect.stringMatching('bc')],
    [true, expect.anything()],
    [() => {}, expect.any(Function)],
  ].entries()) {
    test(`{pass: true} expect().toEqual() #${a}`, () => {
      expect(b[0]).toEqual(b[1]);
      expect(() => expect(b[0]).not.toEqual(b[1])).toThrow();
    });
  }

  test('assertion error matcherResult property contains matcher name, expected and actual values', () => {
    const actual = { a: 1 };
    const expected = { a: 2 };
    try {
      expect(actual).toEqual(expected);
    } catch (error) {
      expect(error.matcherResult).toEqual(expect.objectContaining({
        actual,
        expected,
        name: 'toEqual',
      }));
    }
  });

  test('symbol based keys in arrays are processed correctly', () => {
    const mySymbol = Symbol('test');
    const actual1: any[] = [];
    actual1[mySymbol as any] = 3;
    const actual2: any[] = [];
    actual2[mySymbol as any] = 4;
    const expected: any[] = [];
    expected[mySymbol as any] = 3;

    expect(actual1).toEqual(expected);
    expect(actual2).not.toEqual(expected);
  });

  test('non-enumerable members should be skipped during equal', () => {
    const actual: any = { x: 3 };
    Object.defineProperty(actual, 'test', { enumerable: false, value: 5 });
    expect(actual).toEqual({ x: 3 });
  });

  test('objectContaining sample can be used multiple times', () => {
    const expected = expect.objectContaining({ b: 7 });
    expect({ a: 1, b: 2 }).not.toEqual(expected);
    expect({ a: 3, b: 7 }).toEqual(expected);
  });

  test.describe('cyclic object equality', () => {
    test('properties with the same circularity are equal', () => {
      const a: any = {};
      a.x = a;
      const b: any = {};
      b.x = b;
      expect(a).toEqual(b);
      expect(b).toEqual(a);
    });

    test('properties with different circularity are not equal', () => {
      const a: any = {};
      a.x = { y: a };
      const b: any = {};
      const bx: any = {};
      b.x = bx;
      bx.y = bx;
      expect(a).not.toEqual(b);
      expect(b).not.toEqual(a);
    });
  });
});

test.describe('.toBeInstanceOf()', () => {
  class A {}
  class B {}
  class C extends B {}
  class E extends C {}

  for (const [i, [a, b]] of ([
    [new Map(), Map],
    [[], Array],
    [new A(), A],
    [new C(), B],
    [new E(), B],
  ] as const).entries()) {
    test(`passing instanceof #${i}`, () => {
      expect(() => expect(a).not.toBeInstanceOf(b)).toThrow();
      expect(a).toBeInstanceOf(b);
    });
  }

  for (const [i, [a, b]] of ([
    ['a', String],
    [1, Number],
    [true, Boolean],
    [new A(), B],
  ] as const).entries()) {
    test(`failing instanceof #${i}`, () => {
      expect(() => expect(a).toBeInstanceOf(b)).toThrow();
      expect(a).not.toBeInstanceOf(b);
    });
  }

  test('throws if constructor is not a function', () => {
    expect(() => expect({}).toBeInstanceOf(4 as any)).toThrow();
  });
});

test.describe('.toBeTruthy(), .toBeFalsy()', () => {
  for (const v of [{}, [], true, 1, 'a', 0.5, new Map(), () => {}, Infinity]) {
    test(`'${String(v)}' is truthy`, () => {
      expect(v).toBeTruthy();
      expect(v).not.toBeFalsy();
      expect(() => expect(v).not.toBeTruthy()).toThrow();
      expect(() => expect(v).toBeFalsy()).toThrow();
    });
  }

  for (const v of [false, null, NaN, 0, '', undefined]) {
    test(`'${String(v)}' is falsy`, () => {
      expect(v).toBeFalsy();
      expect(v).not.toBeTruthy();
      expect(() => expect(v).toBeTruthy()).toThrow();
      expect(() => expect(v).not.toBeFalsy()).toThrow();
    });
  }
});

test.describe('.toBeNaN()', () => {
  test('{pass: true}', () => {
    for (const v of [NaN, Math.sqrt(-1), Infinity - Infinity, 0 / 0]) {
      expect(v).toBeNaN();
      expect(() => expect(v).not.toBeNaN()).toThrow();
    }
  });

  test('throws', () => {
    for (const v of [1, '', null, undefined, {}, [], 0.2, 0, Infinity, -Infinity]) {
      expect(() => expect(v).toBeNaN()).toThrow();
      expect(v).not.toBeNaN();
    }
  });
});

test.describe('.toBeNull()', () => {
  for (const v of [{}, [], true, 1, 'a', 0.5, new Map(), () => {}, Infinity]) {
    test(`fails for '${String(v)}'`, () => {
      expect(v).not.toBeNull();
      expect(() => expect(v).toBeNull()).toThrow();
    });
  }

  test('fails for null with .not', () => {
    expect(() => expect(null).not.toBeNull()).toThrow();
  });

  test('pass for null', () => {
    expect(null).toBeNull();
  });
});

test.describe('.toBeDefined(), .toBeUndefined()', () => {
  for (const v of [{}, [], true, 1, 'a', 0.5, new Map(), () => {}, Infinity]) {
    test(`'${String(v)}' is defined`, () => {
      expect(v).toBeDefined();
      expect(v).not.toBeUndefined();
      expect(() => expect(v).not.toBeDefined()).toThrow();
      expect(() => expect(v).toBeUndefined()).toThrow();
    });
  }

  test('undefined is undefined', () => {
    expect(undefined).toBeUndefined();
    expect(undefined).not.toBeDefined();
    expect(() => expect(undefined).toBeDefined()).toThrow();
    expect(() => expect(undefined).not.toBeUndefined()).toThrow();
  });
});

test.describe('.toBeGreaterThan(), .toBeLessThan(), .toBeGreaterThanOrEqual(), .toBeLessThanOrEqual()', () => {
  for (const [small, big] of [
    [1, 2],
    [-Infinity, Infinity],
    [Number.MIN_VALUE, Number.MAX_VALUE],
    [0.1, 0.2],
  ] as const) {
    test(`comparing ${small} and ${big}`, () => {
      expect(small).toBeLessThan(big);
      expect(big).not.toBeLessThan(small);
      expect(big).toBeGreaterThan(small);
      expect(small).not.toBeGreaterThan(big);
      expect(small).toBeLessThanOrEqual(big);
      expect(big).not.toBeLessThanOrEqual(small);
      expect(big).toBeGreaterThanOrEqual(small);
      expect(small).not.toBeGreaterThanOrEqual(big);

      expect(() => expect(small).toBeGreaterThan(big)).toThrow();
      expect(() => expect(small).not.toBeLessThan(big)).toThrow();
      expect(() => expect(big).not.toBeGreaterThan(small)).toThrow();
      expect(() => expect(big).toBeLessThan(small)).toThrow();
      expect(() => expect(small).toBeGreaterThanOrEqual(big)).toThrow();
      expect(() => expect(small).not.toBeLessThanOrEqual(big)).toThrow();
      expect(() => expect(big).not.toBeGreaterThanOrEqual(small)).toThrow();
      expect(() => expect(big).toBeLessThanOrEqual(small)).toThrow();
    });
  }

  test('can compare BigInt to Numbers', () => {
    const a = BigInt(2);
    expect(a).toBeGreaterThan(1);
    expect(a).toBeGreaterThanOrEqual(2);
    expect(2).toBeLessThanOrEqual(a);
    expect(a).toBeLessThan(3);
    expect(a).toBeLessThanOrEqual(2);
  });

  for (const [n1, n2] of [
    [1, 1],
    [Number.MIN_VALUE, Number.MIN_VALUE],
    [Infinity, Infinity],
    [-Infinity, -Infinity],
  ]) {
    test(`equal numbers: [${n1}, ${n2}]`, () => {
      expect(n1).toBeGreaterThanOrEqual(n2);
      expect(n1).toBeLessThanOrEqual(n2);
      expect(() => expect(n1).not.toBeGreaterThanOrEqual(n2)).toThrow();
      expect(() => expect(n1).not.toBeLessThanOrEqual(n2)).toThrow();
    });
  }
});

test.describe('.toContain(), .toContainEqual()', () => {
  const typedArray = new Int8Array(2);
  typedArray[0] = 0;
  typedArray[1] = 1;

  test('iterable', () => {
    const iterable = {
      *[Symbol.iterator]() {
        yield 1;
        yield 2;
        yield 3;
      },
    };
    expect(iterable).toContain(2);
    expect(iterable).toContainEqual(2);
    expect(() => expect(iterable).not.toContain(1)).toThrow();
    expect(() => expect(iterable).not.toContainEqual(1)).toThrow();
  });

  for (const [i, [list, v]] of ([
    [[1, 2, 3, 4], 1],
    [['a', 'b', 'c', 'd'], 'a'],
    [[undefined, null], null],
    [[undefined, null], undefined],
    ['abcdef', 'abc'],
    ['11112111', '2'],
    [new Set(['abc', 'def']), 'abc'],
    [typedArray, 1],
  ] as const).entries()) {
    test(`contains #${i}`, () => {
      expect(list).toContain(v);
      expect(() => expect(list).not.toContain(v)).toThrow();
    });
  }

  for (const [i, [list, v]] of ([
    [[1, 2, 3], 4],
    [[null, undefined], 1],
    [[{}, []], []],
    [[{}, []], {}],
  ] as const).entries()) {
    test(`does not contain #${i}`, () => {
      expect(list).not.toContain(v);
      expect(() => expect(list).toContain(v)).toThrow();
    });
  }

  test('error cases', () => {
    expect(() => expect(null).toContain(1)).toThrow();
  });

  for (const [i, [list, v]] of ([
    [[1, 2, 3, 4], 1],
    [['a', 'b', 'c', 'd'], 'a'],
    [[undefined, null], null],
    [[{ a: 'b' }, { a: 'c' }], { a: 'b' }],
    [new Set([1, 2, 3, 4]), 1],
  ] as const).entries()) {
    test(`contains a value equal #${i}`, () => {
      expect(list).toContainEqual(v);
      expect(() => expect(list).not.toContainEqual(v)).toThrow();
    });
  }

  test('error cases for toContainEqual', () => {
    expect(() => expect(null).toContainEqual(1)).toThrow();
  });
});

test.describe('.toBeCloseTo', () => {
  for (const [n1, n2] of [
    [0, 0],
    [0, 0.001],
    [1.23, 1.229],
    [1.23, 1.226],
    [1.23, 1.234],
    [Infinity, Infinity],
    [-Infinity, -Infinity],
  ]) {
    test(`{pass: true} expect(${n1}).toBeCloseTo(${n2})`, () => {
      expect(n1).toBeCloseTo(n2);
      expect(() => expect(n1).not.toBeCloseTo(n2)).toThrow();
    });
  }

  for (const [n1, n2] of [
    [0, 0.01],
    [1, 1.23],
    [Infinity, -Infinity],
    [Infinity, 1.23],
    [-Infinity, -1.23],
  ]) {
    test(`{pass: false} expect(${n1}).toBeCloseTo(${n2})`, () => {
      expect(n1).not.toBeCloseTo(n2);
      expect(() => expect(n1).toBeCloseTo(n2)).toThrow();
    });
  }

  for (const [n1, n2, p] of [
    [0, 0.1, 0],
    [0, 0.0001, 3],
    [0, 0.000_004, 5],
    [2.000_000_2, 2, 5],
  ]) {
    test(`{pass: true} expect(${n1}).toBeCloseTo(${n2}, ${p})`, () => {
      expect(n1).toBeCloseTo(n2, p);
      expect(() => expect(n1).not.toBeCloseTo(n2, p)).toThrow();
    });
  }
});

test.describe('.toMatch()', () => {
  for (const [n1, n2] of [
    ['foo', 'foo'],
    ['Foo bar', /^foo/i],
  ] as const) {
    test(`{pass: true} expect(${n1}).toMatch(${n2})`, () => {
      expect(n1).toMatch(n2);
      expect(() => expect(n1).not.toMatch(n2)).toThrow();
    });
  }

  for (const [n1, n2] of [
    ['bar', 'foo'],
    ['bar', /foo/],
  ] as const) {
    test(`throws: [${n1}, ${n2}]`, () => {
      expect(() => expect(n1).toMatch(n2)).toThrow();
    });
  }

  for (const [i, [n1, n2]] of ([
    [1, 'foo'],
    [{}, 'foo'],
    [[], 'foo'],
    [true, 'foo'],
    [/foo/i, 'foo'],
    [() => {}, 'foo'],
    [undefined, 'foo'],
  ] as const).entries()) {
    test(`throws if non String actual value passed #${i}`, () => {
      expect(() => expect(n1).toMatch(n2)).toThrow();
    });
  }

  for (const [i, [n1, n2]] of ([
    ['foo', 1],
    ['foo', {}],
    ['foo', []],
    ['foo', true],
    ['foo', () => {}],
    ['foo', undefined],
  ] as const).entries()) {
    test(`throws if non String/RegExp expected value passed #${i}`, () => {
      expect(() => expect(n1).toMatch(n2 as any)).toThrow();
    });
  }

  test('escapes strings properly', () => {
    expect('this?: throws').toMatch('this?: throws');
  });

  test('does not maintain RegExp state between calls', () => {
    const regex = /f\d+/gi;
    expect('f123').toMatch(regex);
    expect('F456').toMatch(regex);
    expect(regex.lastIndex).toBe(0);
  });
});

test.describe('.toHaveLength', () => {
  for (const [i, [received, length]] of ([
    [[1, 2], 2],
    [[], 0],
    [['a', 'b'], 2],
    ['abc', 3],
    ['', 0],
    [() => {}, 0],
  ] as const).entries()) {
    test(`{pass: true} toHaveLength(${length}) #${i}`, () => {
      expect(received).toHaveLength(length);
      expect(() => expect(received).not.toHaveLength(length)).toThrow();
    });
  }

  for (const [i, [received, length]] of ([
    [[1, 2], 3],
    [[], 1],
    [['a', 'b'], 99],
    ['abc', 66],
    ['', 1],
  ] as const).entries()) {
    test(`{pass: false} toHaveLength(${length}) #${i}`, () => {
      expect(received).not.toHaveLength(length);
      expect(() => expect(received).toHaveLength(length)).toThrow();
    });
  }

  test('error cases', () => {
    expect(() => expect({ a: 9 }).toHaveLength(1)).toThrow();
    expect(() => expect(0).toHaveLength(1)).toThrow();
    expect(() => expect(undefined).not.toHaveLength(1)).toThrow();
  });
});

test.describe('.toHaveProperty()', () => {
  for (const [i, [obj, keyPath, value]] of ([
    [{ a: { b: { c: { d: 1 } } } }, 'a.b.c.d', 1],
    [{ a: { b: { c: { d: 1 } } } }, ['a', 'b', 'c', 'd'], 1],
    [{ 'a.b.c.d': 1 }, ['a.b.c.d'], 1],
    [{ a: { b: [1, 2, 3] } }, ['a', 'b', 1], 2],
    [{ a: { b: [1, 2, 3] } }, ['a', 'b', 1], expect.any(Number)],
    [{ a: 0 }, 'a', 0],
    [{ a: { b: undefined } }, 'a.b', undefined],
    [{ a: { b: { c: 5 } } }, 'a.b', { c: 5 }],
    [{ a: { b: [{ c: [{ d: 1 }] }] } }, 'a.b[0].c[0].d', 1],
    [{ '': 1 }, '', 1],
  ] as const).entries()) {
    test(`{pass: true} toHaveProperty with value #${i}`, () => {
      expect(obj).toHaveProperty(keyPath as any, value);
      expect(() => expect(obj).not.toHaveProperty(keyPath as any, value)).toThrow();
    });
  }

  for (const [i, [obj, keyPath, value]] of ([
    [{ a: { b: { c: { d: 1 } } } }, 'a.b.ttt.d', 1],
    [{ a: { b: { c: { d: 1 } } } }, 'a.b.c.d', 2],
    [{ 'a.b.c.d': 1 }, 'a.b.c.d', 2],
    [{ a: { b: { c: {} } } }, 'a.b.c.d', 1],
    [{ a: 1 }, 'a.b.c.d', 5],
    [{}, 'a', 'test'],
    [{ a: { b: 3 } }, 'a.b', undefined],
  ] as const).entries()) {
    test(`{pass: false} toHaveProperty with value #${i}`, () => {
      expect(() => expect(obj).toHaveProperty(keyPath, value)).toThrow();
      expect(obj).not.toHaveProperty(keyPath, value);
    });
  }

  for (const [i, [obj, keyPath]] of ([
    [{ a: { b: { c: { d: 1 } } } }, 'a.b.c.d'],
    [{ a: { b: { c: { d: 1 } } } }, ['a', 'b', 'c', 'd']],
    [{ 'a.b.c.d': 1 }, ['a.b.c.d']],
    [{ a: 0 }, 'a'],
    [{ a: { b: undefined } }, 'a.b'],
  ] as const).entries()) {
    test(`{pass: true} toHaveProperty without value #${i}`, () => {
      expect(obj).toHaveProperty(keyPath as any);
      expect(() => expect(obj).not.toHaveProperty(keyPath as any)).toThrow();
    });
  }

  for (const [i, [obj, keyPath]] of ([
    [{ a: { b: { c: {} } } }, 'a.b.c.d'],
    [{ a: 1 }, 'a.b.c.d'],
    [{}, 'a'],
  ] as const).entries()) {
    test(`{pass: false} toHaveProperty without value #${i}`, () => {
      expect(() => expect(obj).toHaveProperty(keyPath)).toThrow();
      expect(obj).not.toHaveProperty(keyPath);
    });
  }

  for (const [i, [obj, keyPath]] of ([
    [null, 'a.b'],
    [undefined, 'a'],
    [{ a: { b: {} } }, undefined],
    [{ a: { b: {} } }, null],
    [{ a: { b: {} } }, 1],
  ] as const).entries()) {
    test(`{error} toHaveProperty #${i}`, () => {
      expect(() => expect(obj).toHaveProperty(keyPath as any)).toThrow();
    });
  }
});

test.describe('.toMatchObject()', () => {
  for (const [i, [a, b]] of ([
    [{ a: 'b', c: 'd' }, { a: 'b' }],
    [{ a: 'b', c: 'd' }, { a: 'b', c: 'd' }],
    [{ a: 'b', t: { x: { r: 'r' }, z: 'z' } }, { a: 'b', t: { z: 'z' } }],
    [{ a: [3, 4, 5], b: 'b' }, { a: [3, 4, 5] }],
    [{ a: 1, c: 2 }, { a: expect.any(Number) }],
    [new Set([1, 2]), new Set([1, 2])],
    [new Date('2015-11-30'), new Date('2015-11-30')],
    [{ a: null, b: 'b' }, { a: null }],
    [{ a: undefined, b: 'b' }, { a: undefined }],
    [[1, 2], [1, 2]],
    [new Error('foo'), new Error('foo')],
    [new Error('bar'), { message: 'bar' }],
  ] as const).entries()) {
    test(`{pass: true} toMatchObject #${i}`, () => {
      expect(a).toMatchObject(b as any);
      expect(() => expect(a).not.toMatchObject(b as any)).toThrow();
    });
  }

  for (const [i, [a, b]] of ([
    [{ a: 'b', c: 'd' }, { e: 'b' }],
    [{ a: 'b', c: 'd' }, { a: 'b!', c: 'd' }],
    [{ a: 'a', c: 'd' }, { a: expect.any(Number) }],
    [{ a: [3, 4, 5], b: 'b' }, { a: [3, 4, 5, 6] }],
    [[1, 2], [1, 3]],
    [new Set([1, 2]), new Set([2])],
    [new Error('foo'), new Error('bar')],
  ] as const).entries()) {
    test(`{pass: false} toMatchObject #${i}`, () => {
      expect(a).not.toMatchObject(b as any);
      expect(() => expect(a).toMatchObject(b as any)).toThrow();
    });
  }

  for (const [i, [a, b]] of ([
    [null, {}],
    [4, {}],
    ['44', {}],
    [true, {}],
    [undefined, {}],
    [{}, null],
    [{}, 4],
  ] as const).entries()) {
    test(`throws toMatchObject #${i}`, () => {
      expect(() => expect(a).toMatchObject(b as any)).toThrow();
    });
  }

  test('does not match properties up in the prototype chain', () => {
    const a: any = {};
    a.ref = a;
    const b = Object.create(a);
    b.other = 'child';
    const matcher: any = { other: 'child' };
    matcher.ref = matcher;
    expect(b).not.toMatchObject(matcher);
    expect(() => expect(b).toMatchObject(matcher)).toThrow();
  });
});

test.describe('.toThrow()', () => {
  class CustomError extends Error {}

  test('to throw or not to throw', () => {
    expect(() => {
      throw new CustomError('apple');
    }).toThrow();
    expect(() => {}).not.toThrow();
  });

  test('substring passes', () => {
    expect(() => {
      throw new CustomError('apple');
    }).toThrow('apple');
    expect(() => {
      throw new CustomError('banana');
    }).not.toThrow('apple');
    expect(() => {}).not.toThrow('apple');
  });

  test('substring fails when did not throw', () => {
    expect(() => expect(() => {}).toThrow('apple')).toThrow();
  });

  test('substring fails when message did not match', () => {
    expect(() => expect(() => {
      throw new CustomError('apple');
    }).toThrow('banana')).toThrow();
  });

  test('regexp passes', () => {
    expect(() => {
      throw new CustomError('apple');
    }).toThrow(/apple/);
    expect(() => {
      throw new CustomError('banana');
    }).not.toThrow(/apple/);
    expect(() => {}).not.toThrow(/apple/);
  });

  test('regexp fails when did not throw', () => {
    expect(() => expect(() => {}).toThrow(/apple/)).toThrow();
  });

  test('error class passes', () => {
    class Err extends CustomError {}
    class Err2 extends CustomError {}

    expect(() => {
      throw new Err('apple');
    }).toThrow(Err);
    expect(() => {
      throw new Err('apple');
    }).toThrow(CustomError);

    expect(() => {
      throw new Err('apple');
    }).not.toThrow(Err2);
  });

  test('object with message passes', () => {
    expect(() => {
      throw new CustomError('apple');
    }).toThrow({ message: 'apple' });
    expect(() => {
      throw new CustomError('banana');
    }).not.toThrow({ message: 'apple' });
  });

  test('properly escapes strings when matching against errors', () => {
    expect(() => {
      throw new TypeError('"this"? throws.');
    }).toThrow('"this"? throws.');
  });

  test('error message and cause properties', () => {
    const errorCause = new Error('cause');
    const error = new Error('message', { cause: errorCause });
    expect(() => {
      throw error;
    }).toThrow({ message: 'message', cause: errorCause });
  });
});

test.describe('asymmetric matchers', () => {
  test('Any matches primitives', () => {
    expect('jest').toEqual(expect.any(String));
    expect(1).toEqual(expect.any(Number));
    expect(() => {}).toEqual(expect.any(Function));
    expect(true).toEqual(expect.any(Boolean));
    expect({}).toEqual(expect.any(Object));
    expect([]).toEqual(expect.any(Array));
  });

  test('Any throws when called with empty constructor', () => {
    expect(() => (expect.any as any)()).toThrow(
        'any() expects to be passed a constructor function. Please pass one or use anything() to match any object.');
  });

  test('Anything matches any type', () => {
    expect('jest').toEqual(expect.anything());
    expect(1).toEqual(expect.anything());
    expect(() => {}).toEqual(expect.anything());
    expect(true).toEqual(expect.anything());
    expect({}).toEqual(expect.anything());
    expect([]).toEqual(expect.anything());
  });

  test('Anything does not match null and undefined', () => {
    expect(null).not.toEqual(expect.anything());
    expect(undefined).not.toEqual(expect.anything());
  });

  test('ArrayContaining matches', () => {
    expect(['foo']).toEqual(expect.arrayContaining(['foo']));
    expect(['foo', 'bar']).toEqual(expect.arrayContaining(['foo']));
  });

  test('ArrayContaining does not match', () => {
    expect(['bar']).not.toEqual(expect.arrayContaining(['foo']));
  });

  test('ObjectContaining matches', () => {
    expect({ foo: 'foo', jest: 'jest' }).toEqual(expect.objectContaining({ foo: 'foo' }));
    expect({ foo: undefined }).toEqual(expect.objectContaining({ foo: undefined }));
  });

  test('ObjectContaining does not match', () => {
    expect({ bar: 'bar' }).not.toEqual(expect.objectContaining({ foo: 'foo' }));
    expect({ foo: 'foox' }).not.toEqual(expect.objectContaining({ foo: 'foo' }));
    expect({}).not.toEqual(expect.objectContaining({ foo: undefined }));
  });

  test('ObjectContaining throws for non-objects', () => {
    expect(() => expect({}).toEqual(expect.objectContaining(1337 as any))).toThrow(
        "You must provide an object to ObjectContaining, not 'number'.");
  });

  test('StringContaining matches string against string', () => {
    expect('queen*').toEqual(expect.stringContaining('en*'));
    expect('queue').not.toEqual(expect.stringContaining('en*'));
  });

  test('StringMatching matches string against regexp', () => {
    expect('queen').toEqual(expect.stringMatching(/en/));
    expect('queue').not.toEqual(expect.stringMatching(/en/));
  });

  test('StringMatching matches string against string', () => {
    expect('queen').toEqual(expect.stringMatching('en'));
    expect('queue').not.toEqual(expect.stringMatching('en'));
  });

  test('closeTo matches', () => {
    expect(0).toEqual(expect.closeTo(0));
    expect(0.001).toEqual(expect.closeTo(0));
    expect(1.229).toEqual(expect.closeTo(1.23));
    expect(Infinity).toEqual(expect.closeTo(Infinity));
  });

  test('closeTo does not match', () => {
    expect(0.01).not.toEqual(expect.closeTo(0));
    expect(1.23).not.toEqual(expect.closeTo(1));
    expect(Infinity).not.toEqual(expect.closeTo(-Infinity));
  });

  test('closeTo with precision', () => {
    expect(0.1).toEqual(expect.closeTo(0, 0));
    expect(0.0001).toEqual(expect.closeTo(0, 3));
    expect(0.000_004).toEqual(expect.closeTo(0, 5));
  });

  test('closeTo throws if expected is not number', () => {
    expect(() => (expect.closeTo as any)('a')).toThrow('Expected is not a Number');
  });

  test('arrayOf matches', () => {
    expect([1]).toEqual(expect.arrayOf(1));
    expect([1, 1, 1]).toEqual(expect.arrayOf(1));
    expect([{ a: 1 }, { a: 1 }]).toEqual(expect.arrayOf({ a: 1 }));
    expect(['a', 'b', 'c']).toEqual(expect.arrayOf(expect.any(String)));
  });

  test('arrayOf does not match', () => {
    expect([2]).not.toEqual(expect.arrayOf(1));
    expect([1, 2]).not.toEqual(expect.arrayOf(1));
    expect('not an array').not.toEqual(expect.arrayOf(1));
    expect({}).not.toEqual(expect.arrayOf(1));
    expect([1, 2]).not.toEqual(expect.arrayOf(expect.any(String)));
  });
});
