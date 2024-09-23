/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { test, expect } from './fixtures';
import { expect as expectUnderTest, matcherUtils } from '../../packages/playwright/bundles/expect/src/expectBundleImpl';
import Immutable from 'immutable';

const { stringify } = matcherUtils;

const expectUnderTestAsAny = expectUnderTest as any;

expectUnderTest.extend({
  optionalFn(fn) {
    const pass = fn === undefined || typeof fn === 'function';
    return { message: () => 'expect either a function or undefined', pass };
  },
});

test('should throw if passed two arguments', () => {
  expect(() => expectUnderTestAsAny('foo', 'bar')).toThrow(
      new Error('Expect takes at most one argument.'),
  );
});

test.describe('.rejects', () => {
  test('should reject', async () => {
    await expectUnderTest(Promise.reject(4)).rejects.toBe(4);
    await expectUnderTest(Promise.reject(4)).rejects.not.toBe(5);
    await expectUnderTest(Promise.reject(4.2)).rejects.toBeCloseTo(4.2, 5);
    await expectUnderTest(Promise.reject(3)).rejects.not.toBeCloseTo(4.2, 5);
    await expectUnderTest(Promise.reject({ a: 1, b: 2 })).rejects.toMatchObject({
      a: 1,
    });
    await expectUnderTest(Promise.reject({ a: 1, b: 2 })).rejects.not.toMatchObject({
      c: 1,
    });
    await expectUnderTest(
        Promise.reject(new Error('rejectMessage')),
    ).rejects.toMatchObject({ message: 'rejectMessage' });
    await expectUnderTest(Promise.reject(new Error())).rejects.toThrow();
  });

  test('should reject with toThrow', async () => {
    async function fn() {
      throw new Error('some error');
    }
    await expectUnderTest(fn()).rejects.toThrow('some error');
  });

  test('should reject async function to toThrow', async () => {
    await expectUnderTest(async () => {
      throw new Error('Test');
    }).rejects.toThrow('Test');
  });

  ['a', [1], () => { }, { a: 1 }].forEach(value => {
    test(`fails non-promise value ${stringify(value)} synchronously`, () => {
      let error;
      try {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        expectUnderTest(value).rejects.toBe(111);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
    });

    test(`fails non-promise value ${stringify(value)}`, async () => {
      let error;
      try {
        await expectUnderTest(value).rejects.toBeDefined();
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toMatchSnapshot();
    });
  });

  [4, null, true, undefined].forEach(value => {
    test(`fails non-promise value ${stringify(value)} synchronously`, () => {
      let error;
      try {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        expectUnderTest(value).rejects.not.toBe(111);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
    });

    test(`fails non-promise value ${stringify(value)}`, async () => {
      let error;
      try {
        await expectUnderTest(value).rejects.not.toBeDefined();
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toMatchSnapshot();
    });
  });

  test('fails for promise that resolves', async () => {
    let error;
    try {
      await expectUnderTest(Promise.resolve(4)).rejects.toBe(4);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toMatchSnapshot();
  });
});

test.describe('.resolves', () => {
  test('should resolve', async () => {
    await expectUnderTest(Promise.resolve(4)).resolves.toBe(4);
    await expectUnderTest(Promise.resolve(4)).resolves.not.toBe(5);
    await expectUnderTest(Promise.resolve(4.2)).resolves.toBeCloseTo(4.2, 5);
    await expectUnderTest(Promise.resolve(3)).resolves.not.toBeCloseTo(4.2, 5);
    await expectUnderTest(Promise.resolve({ a: 1, b: 2 })).resolves.toMatchObject({
      a: 1,
    });
    await expectUnderTest(Promise.resolve({ a: 1, b: 2 })).resolves.not.toMatchObject({
      c: 1,
    });
    await expectUnderTest(
        Promise.resolve(() => {
          throw new Error();
        }),
    ).resolves.toThrow();
  });

  ['a', [1], () => { }, { a: 1 }].forEach(value => {
    test(`fails non-promise value ${stringify(value)} synchronously`, () => {
      let error;
      try {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        expectUnderTest(value).resolves.toBeDefined();
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toMatchSnapshot();
    });

    test(`fails non-promise value ${stringify(value)}`, async () => {
      let error;
      try {
        await expectUnderTest(value).resolves.toBeDefined();
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toMatchSnapshot();
    });
  });

  [4, null, true, undefined].forEach(value => {
    test(`fails non-promise value ${stringify(value)} synchronously`, () => {
      let error;
      try {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        expectUnderTest(value).resolves.not.toBeDefined();
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toMatchSnapshot();
    });

    test(`fails non-promise value ${stringify(value)}`, async () => {
      let error;
      try {
        await expectUnderTest(value).resolves.not.toBeDefined();
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toMatchSnapshot();
    });
  });

  test('fails for promise that rejects', async () => {
    let error;
    try {
      await expectUnderTest(Promise.reject(4)).resolves.toBe(4);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toMatchSnapshot();
  });
});

test.describe('.toBe()', () => {
  test('does not throw', () => {
    expectUnderTest('a').not.toBe('b');
    expectUnderTest('a').toBe('a');
    expectUnderTest(1).not.toBe(2);
    expectUnderTest(1).toBe(1);
    expectUnderTest(null).not.toBe(undefined);
    expectUnderTest(null).toBe(null);
    expectUnderTest(undefined).toBe(undefined);
    expectUnderTest(NaN).toBe(NaN);
    expectUnderTest(BigInt(1)).not.toBe(BigInt(2));
    expectUnderTest(BigInt(1)).not.toBe(1);
    expectUnderTest(BigInt(1)).toBe(BigInt(1));
  });

  [
    [1, 2],
    [true, false],
    [() => { }, () => { }],
    [{}, {}],
    [{ a: 1 }, { a: 1 }],
    [{ a: 1 }, { a: 5 }],
    [
      { a: () => { }, b: 2 },
      { a: expect.any(Function), b: 2 },
    ],
    [{ a: undefined, b: 2 }, { b: 2 }],
    [new Date('2020-02-20'), new Date('2020-02-20')],
    [new Date('2020-02-21'), new Date('2020-02-20')],
    [/received/, /expected/],
    [Symbol('received'), Symbol('expected')],
    [new Error('received'), new Error('expected')],
    ['abc', 'cde'],
    ['painless JavaScript testing', 'delightful JavaScript testing'],
    ['', 'compare one-line string to empty string'],
    ['with \ntrailing space', 'without trailing space'],
    ['four\n4\nline\nstring', '3\nline\nstring'],
    [[], []],
    [null, undefined],
    [-0, +0],
  ].forEach(([a, b]: [a: any, b: any], index) => {
    test(`fails for: ${stringify(a)} and ${stringify(b)} (${index})`, () => {
      expect(() => expectUnderTest(a).toBe(b)).toThrowErrorMatchingSnapshot();
    });
  });

  [
    [BigInt(1), BigInt(2)],
    [{ a: BigInt(1) }, { a: BigInt(1) }],
  ].forEach(([a, b]) => {
    test(`fails for: ${stringify(a)} and ${stringify(b)}`, () => {
      expect(() => expectUnderTest(a).toBe(b)).toThrow('toBe');
    });
  });

  [false, 1, 'a', undefined, null, {}, []].forEach(v => {
    test(`fails for '${stringify(v)}' with '.not'`, () => {
      expect(() => expectUnderTest(v).not.toBe(v)).toThrowErrorMatchingSnapshot();
    });
  });

  [BigInt(1), BigInt('1')].forEach((v, index) => {
    test(`fails for '${stringify(v)}' with '.not' (${index})}`, () => {
      expect(() => expectUnderTest(v).not.toBe(v)).toThrow('toBe');
    });
  });

  test('does not crash on circular references', () => {
    const obj: any = {};
    obj.circular = obj;

    expect(() => expectUnderTest(obj).toBe({})).toThrowErrorMatchingSnapshot();
  });

  test('assertion error matcherResult property contains matcher name, expected and actual values', () => {
    const actual = { a: 1 };
    const expected = { a: 2 };
    try {
      expectUnderTest(actual).toBe(expected);
    } catch (error) {
      expect(error.matcherResult).toEqual(
          expect.objectContaining({
            actual,
            expected,
            name: 'toBe',
          }),
      );
    }
  });
});

test.describe('.toStrictEqual()', () => {
  class TestClassA {
    constructor(public a, public b) { }
  }

  class TestClassB {
    constructor(public a, public b) { }
  }

  const TestClassC = class Child extends TestClassA {
    constructor(a, b) {
      super(a, b);
    }
  };

  const TestClassD = class Child extends TestClassB {
    constructor(a, b) {
      super(a, b);
    }
  };

  test('does not ignore keys with undefined values', () => {
    expect({
      a: undefined,
      b: 2,
    }).not.toStrictEqual({ b: 2 });
  });

  test('does not ignore keys with undefined values inside an array', () => {
    expect([{ a: undefined }]).not.toStrictEqual([{}]);
  });

  test('does not ignore keys with undefined values deep inside an object', () => {
    expect([{ a: [{ a: undefined }] }]).not.toStrictEqual([{ a: [{}] }]);
  });

  test('does not consider holes as undefined in sparse arrays', () => {

    expect([, , , 1, , ,]).not.toStrictEqual([, , , 1, undefined, ,]);
  });

  test('passes when comparing same type', () => {
    expect({
      test: new TestClassA(1, 2),
    }).toStrictEqual({ test: new TestClassA(1, 2) });
  });

  test('matches the expected snapshot when it fails', () => {
    expect(() =>
      expectUnderTest({
        test: 2,
      }).toStrictEqual({ test: new TestClassA(1, 2) }),
    ).toThrowErrorMatchingSnapshot();

    expect(() =>
      expectUnderTest({
        test: new TestClassA(1, 2),
      }).not.toStrictEqual({ test: new TestClassA(1, 2) }),
    ).toThrowErrorMatchingSnapshot();
  });

  test('displays substring diff', () => {
    const expected =
      'Another caveat is that Jest will not typecheck your tests.';
    const received =
      'Because TypeScript support in Babel is just transpilation, Jest will not type-check your tests as they run.';
    expect(() =>
      expectUnderTest(received).toStrictEqual(expected),
    ).toThrowErrorMatchingSnapshot();
  });

  test('displays substring diff for multiple lines', () => {
    const expected = [
      '    69 | ',
      "    70 | test('assert.doesNotThrow', () => {",
      '  > 71 |   assert.doesNotThrow(() => {',
      '       |          ^',
      "    72 |     throw Error('err!');",
      '    73 |   });',
      '    74 | });',
      '    at Object.doesNotThrow (__tests__/assertionError.test.js:71:10)',
    ].join('\n');
    const received = [
      '    68 | ',
      "    69 | test('assert.doesNotThrow', () => {",
      '  > 70 |   assert.doesNotThrow(() => {',
      '       |          ^',
      "    71 |     throw Error('err!');",
      '    72 |   });',
      '    73 | });',
      '    at Object.doesNotThrow (__tests__/assertionError.test.js:70:10)',
    ].join('\n');
    expect(() =>
      expectUnderTest(received).toStrictEqual(expected),
    ).toThrowErrorMatchingSnapshot();
  });

  test('does not pass for different types', () => {
    expect({
      test: new TestClassA(1, 2),
    }).not.toStrictEqual({ test: new TestClassB(1, 2) });
  });

  test('does not simply compare constructor names', () => {
    const c = new TestClassC(1, 2);
    const d = new TestClassD(1, 2);
    expect(c.constructor.name).toEqual(d.constructor.name);
    expect({ test: c }).not.toStrictEqual({ test: d });
  });


  test('passes for matching sparse arrays', () => {
    expect([, 1]).toStrictEqual([, 1]);
  });

  test('does not pass when sparseness of arrays do not match', () => {
    expect([, 1]).not.toStrictEqual([undefined, 1]);
    expect([undefined, 1]).not.toStrictEqual([, 1]);
    expect([, , , 1]).not.toStrictEqual([, 1]);
  });

  test('does not pass when equally sparse arrays have different values', () => {
    expect([, 1]).not.toStrictEqual([, 2]);
  });

  test('does not pass when ArrayBuffers are not equal', () => {
    expect(Uint8Array.from([1, 2]).buffer).not.toStrictEqual(
        Uint8Array.from([0, 0]).buffer,
    );
    expect(Uint8Array.from([2, 1]).buffer).not.toStrictEqual(
        Uint8Array.from([2, 2]).buffer,
    );
    expect(Uint8Array.from([]).buffer).not.toStrictEqual(
        Uint8Array.from([1]).buffer,
    );
  });

  test('passes for matching buffers', () => {
    expect(Uint8Array.from([1]).buffer).toStrictEqual(
        Uint8Array.from([1]).buffer,
    );
    expect(Uint8Array.from([]).buffer).toStrictEqual(
        Uint8Array.from([]).buffer,
    );
    expect(Uint8Array.from([9, 3]).buffer).toStrictEqual(
        Uint8Array.from([9, 3]).buffer,
    );
  });

  test('fails for missing keys even if backed by an asymmetric matcher accepting them', () => {
    // issue 12463
    expect({ a: 1 }).not.toStrictEqual({ a: 1, b: expectUnderTestAsAny.optionalFn() });
    expect({ a: 1, b: expectUnderTestAsAny.optionalFn() }).not.toStrictEqual({ a: 1 });
    expect([1]).not.toStrictEqual([1, expectUnderTestAsAny.optionalFn()]);
    expect([1, expectUnderTestAsAny.optionalFn()]).not.toStrictEqual([1]);
  });

  test('passes if keys are present and asymmetric matcher accept them', () => {
    // issue 12463
    // with a proper function
    expect({ a: 1, b: () => { } }).toStrictEqual({
      a: 1,
      b: expectUnderTestAsAny.optionalFn(),
    });
    expect({ a: 1, b: expectUnderTestAsAny.optionalFn() }).toStrictEqual({
      a: 1,
      b: () => { },
    });
    expect([1, () => { }]).toStrictEqual([1, expectUnderTestAsAny.optionalFn()]);
    expect([1, expectUnderTestAsAny.optionalFn()]).toStrictEqual([1, () => { }]);
    // with undefined
    expect({ a: 1, b: undefined }).toStrictEqual({
      a: 1,
      b: expectUnderTestAsAny.optionalFn(),
    });
    expect({ a: 1, b: expectUnderTestAsAny.optionalFn() }).toStrictEqual({
      a: 1,
      b: undefined,
    });
    expect([1, undefined]).toStrictEqual([1, expectUnderTestAsAny.optionalFn()]);
    expect([1, expectUnderTestAsAny.optionalFn()]).toStrictEqual([1, undefined]);
  });

});

test.describe('.toEqual()', () => {

  [
    [true, false],
    [1, 2],
    [0, -0],
    [0, Number.MIN_VALUE], // issues/7941
    [Number.MIN_VALUE, 0],
    [0, new Number(0)],
    [new Number(0), 0],
    [new Number(0), new Number(1)],
    ['abc', new String('abc')],
    [new String('abc'), 'abc'],
    // @ts-ignore
    [/abc/gsy, /abc/g],
    [{ a: 1 }, { a: 2 }],
    [{ a: 5 }, { b: 6 }],
    [Object.freeze({ foo: { bar: 1 } }), { foo: {} }],
    [
      {
        get getterAndSetter() {
          return {};
        },
        set getterAndSetter(value) {
          throw new Error('noo');
        },
      },
      { getterAndSetter: { foo: 'bar' } },
    ],
    [
      Object.freeze({
        get frozenGetterAndSetter() {
          return {};
        },
        set frozenGetterAndSetter(value) {
          throw new Error('noo');
        },
      }),
      { frozenGetterAndSetter: { foo: 'bar' } },
    ],
    [
      {
        get getter() {
          return {};
        },
      },
      { getter: { foo: 'bar' } },
    ],
    [
      Object.freeze({
        get frozenGetter() {
          return {};
        },
      }),
      { frozenGetter: { foo: 'bar' } },
    ],
    [
      {

        set setter(value) {
          throw new Error('noo');
        },
      },
      { setter: { foo: 'bar' } },
    ],
    [
      Object.freeze({

        set frozenSetter(value) {
          throw new Error('noo');
        },
      }),
      { frozenSetter: { foo: 'bar' } },
    ],
    ['banana', 'apple'],
    ['1\u{00A0}234,57\u{00A0}$', '1 234,57 $'], // issues/6881
    [
      'type TypeName<T> = T extends Function ? "function" : "object";',
      'type TypeName<T> = T extends Function\n? "function"\n: "object";',
    ],
    [null, undefined],
    [[1], [2]],
    [
      [1, 2],
      [2, 1],
    ],
    [Immutable.List([1]), Immutable.List([2])],
    [Immutable.List([1, 2]), Immutable.List([2, 1])],
    [new Map(), new Set()],
    [new Set([1, 2]), new Set()],
    [new Set([1, 2]), new Set([1, 2, 3])],
    [new Set([[1], [2]]), new Set([[1], [2], [3]])],
    [new Set([[1], [2]]), new Set([[1], [2], [2]])],
    [
      new Set([new Set([1]), new Set([2])]),
      new Set([new Set([1]), new Set([3])]),
    ],
    [Immutable.Set([1, 2]), Immutable.Set()],
    [Immutable.Set([1, 2]), Immutable.Set([1, 2, 3])],
    [Immutable.OrderedSet([1, 2]), Immutable.OrderedSet([2, 1])],
    [
      new Map([
        [1, 'one'],
        [2, 'two'],
      ]),
      new Map([[1, 'one']]),
    ],
    [new Map([['a', 0]]), new Map([['b', 0]])],
    [new Map([['v', 1]]), new Map([['v', 2]])],
    [new Map([[['v'], 1]]), new Map([[['v'], 2]])],
    [
      new Map([[[1], new Map([[[1], 'one']])]]),
      new Map([[[1], new Map([[[1], 'two']])]]),
    ],
    [Immutable.Map({ a: 0 }), Immutable.Map({ b: 0 })],
    [Immutable.Map({ v: 1 }), Immutable.Map({ v: 2 })],
    [
      Immutable.OrderedMap().set(1, 'one').set(2, 'two'),
      Immutable.OrderedMap().set(2, 'two').set(1, 'one'),
    ],
    [
      Immutable.Map({ 1: Immutable.Map({ 2: { a: 99 } }) }),
      Immutable.Map({ 1: Immutable.Map({ 2: { a: 11 } }) }),
    ],
    [new Uint8Array([97, 98, 99]), new Uint8Array([97, 98, 100])],
    [{ a: 1, b: 2 }, expectUnderTest.objectContaining({ a: 2 })],
    [false, expectUnderTest.objectContaining({ a: 2 })],
    [[1, 3], expectUnderTest.arrayContaining([1, 2])],
    [1, expectUnderTest.arrayContaining([1, 2])],
    ['abd', expectUnderTest.stringContaining('bc')],
    ['abd', expectUnderTest.stringMatching(/bc/i)],
    [undefined, expectUnderTest.anything()],
    [undefined, expectUnderTest.any(Function)],
    [
      'Eve',
      {
        asymmetricMatch: function asymmetricMatch(who) {
          return who === 'Alice' || who === 'Bob';
        },
      },
    ],
    [
      {
        target: {
          nodeType: 1,
          value: 'a',
        },
      },
      {
        target: {
          nodeType: 1,
          value: 'b',
        },
      },
    ],
    [
      {
        nodeName: 'div',
        nodeType: 1,
      },
      {
        nodeName: 'p',
        nodeType: 1,
      },
    ],
    [
      {
        [Symbol.for('foo')]: 1,
        [Symbol.for('bar')]: 2,
      },
      {
        [Symbol.for('foo')]: expectUnderTest.any(Number),
        [Symbol.for('bar')]: 1,
      },
    ],
    [

      [, , 1, ,],

      [, , 2, ,],
    ],
    [
      Object.assign([], { 4294967295: 1 }),
      Object.assign([], { 4294967295: 2 }), // issue 11056
    ],
    [

      Object.assign([], { ['-0']: 1 }),

      Object.assign([], { ['0']: 1 }), // issue 11056: also check (-0, 0)
    ],
    [
      Object.assign([], { a: 1 }),
      Object.assign([], { b: 1 }), // issue 11056: also check strings
    ],
    [
      Object.assign([], { [Symbol()]: 1 }),
      Object.assign([], { [Symbol()]: 1 }), // issue 11056: also check symbols
    ],
  ].forEach(([a, b], index) => {
    test(`{pass: false} expect(${stringify(a)}).toEqual(${stringify(
        b,
    )} (${index}))`, () => {
      expect(() => expectUnderTest(a).toEqual(b)).toThrowErrorMatchingSnapshot();
      expectUnderTest(a).not.toEqual(b);
    });
  });

  [
    [BigInt(1), BigInt(2)],
    [BigInt(1), 1],
  ].forEach(([a, b]) => {
    test(`{pass: false} expect(${stringify(a)}).toEqual(${stringify(
        b,
    )})`, () => {
      expect(() => expectUnderTest(a).toEqual(b)).toThrow('toEqual');
      expectUnderTest(a).not.toEqual(b);
    });
  });

  [
    [true, true],
    [1, 1],
    [NaN, NaN],
    [0, Number(0)],
    [Number(0), 0],
    [new Number(0), new Number(0)],
    ['abc', 'abc'],
    [String('abc'), 'abc'],
    ['abc', String('abc')],
    [[1], [1]],
    [
      [1, 2],
      [1, 2],
    ],
    [Immutable.List([1]), Immutable.List([1])],
    [Immutable.List([1, 2]), Immutable.List([1, 2])],
    [{}, {}],
    [{ a: 99 }, { a: 99 }],
    [new Set(), new Set()],
    [new Set([1, 2]), new Set([1, 2])],
    [new Set([1, 2]), new Set([2, 1])],
    [new Set([[1], [2]]), new Set([[2], [1]])],
    [
      new Set([new Set([[1]]), new Set([[2]])]),
      new Set([new Set([[2]]), new Set([[1]])]),
    ],
    [new Set([[1], [2], [3], [3]]), new Set([[3], [3], [2], [1]])],
    [new Set([{ a: 1 }, { b: 2 }]), new Set([{ b: 2 }, { a: 1 }])],
    [Immutable.Set(), Immutable.Set()],
    [Immutable.Set([1, 2]), Immutable.Set([1, 2])],
    [Immutable.Set([1, 2]), Immutable.Set([2, 1])],
    [Immutable.OrderedSet(), Immutable.OrderedSet()],
    [Immutable.OrderedSet([1, 2]), Immutable.OrderedSet([1, 2])],
    [new Map(), new Map()],
    [
      new Map([
        [1, 'one'],
        [2, 'two'],
      ]),
      new Map([
        [1, 'one'],
        [2, 'two'],
      ]),
    ],
    [
      new Map([
        [1, 'one'],
        [2, 'two'],
      ]),
      new Map([
        [2, 'two'],
        [1, 'one'],
      ]),
    ],
    [
      new Map([
        [[1], 'one'],
        [[2], 'two'],
        [[3], 'three'],
        [[3], 'four'],
      ]),
      new Map([
        [[3], 'three'],
        [[3], 'four'],
        [[2], 'two'],
        [[1], 'one'],
      ]),
    ],
    [
      new Map([
        [[1], new Map([[[1], 'one']])],
        [[2], new Map([[[2], 'two']])],
      ]),
      new Map([
        [[2], new Map([[[2], 'two']])],
        [[1], new Map([[[1], 'one']])],
      ]),
    ],
    [
      new Map([
        [[1], 'one'],
        [[2], 'two'],
      ]),
      new Map([
        [[2], 'two'],
        [[1], 'one'],
      ]),
    ],
    [
      new Map([
        [{ a: 1 }, 'one'],
        [{ b: 2 }, 'two'],
      ]),
      new Map([
        [{ b: 2 }, 'two'],
        [{ a: 1 }, 'one'],
      ]),
    ],
    [
      new Map([
        [1, ['one']],
        [2, ['two']],
      ]),
      new Map([
        [2, ['two']],
        [1, ['one']],
      ]),
    ],
    [Immutable.Map(), Immutable.Map()],
    [
      Immutable.Map().set(1, 'one').set(2, 'two'),
      Immutable.Map().set(1, 'one').set(2, 'two'),
    ],
    [
      Immutable.Map().set(1, 'one').set(2, 'two'),
      Immutable.Map().set(2, 'two').set(1, 'one'),
    ],
    [
      Immutable.OrderedMap().set(1, 'one').set(2, 'two'),
      Immutable.OrderedMap().set(1, 'one').set(2, 'two'),
    ],
    [
      Immutable.Map({ 1: Immutable.Map({ 2: { a: 99 } }) }),
      Immutable.Map({ 1: Immutable.Map({ 2: { a: 99 } }) }),
    ],
    [new Uint8Array([97, 98, 99]), new Uint8Array([97, 98, 99])],
    [{ a: 1, b: 2 }, expectUnderTest.objectContaining({ a: 1 })],
    [[1, 2, 3], expectUnderTest.arrayContaining([2, 3])],
    ['abcd', expectUnderTest.stringContaining('bc')],
    ['abcd', expectUnderTest.stringMatching('bc')],
    [true, expectUnderTest.anything()],
    [() => { }, expectUnderTest.any(Function)],
    [
      {
        a: 1,
        b: function b() { },
        c: true,
      },
      {
        a: 1,
        b: expectUnderTest.any(Function),
        c: expectUnderTest.anything(),
      },
    ],
    [
      'Alice',
      {
        asymmetricMatch: function asymmetricMatch(who) {
          return who === 'Alice' || who === 'Bob';
        },
      },
    ],
    [
      {
        nodeName: 'div',
        nodeType: 1,
      },
      {
        nodeName: 'div',
        nodeType: 1,
      },
    ],
    [
      {
        [Symbol.for('foo')]: 1,
        [Symbol.for('bar')]: 2,
      },
      {
        [Symbol.for('foo')]: expectUnderTest.any(Number),
        [Symbol.for('bar')]: 2,
      },
    ],
    [

      [, , 1, ,],

      [, , 1, ,],
    ],
    [

      [, , 1, , ,],

      [, , 1, undefined, ,], // same length but hole replaced by undefined
    ],
    // issue 12463 - "matcher" vs "proper function"
    [
      { a: 1, b: () => { } },
      { a: 1, b: expectUnderTestAsAny.optionalFn() },
    ],
    [
      { a: 1, b: expectUnderTestAsAny.optionalFn() },
      { a: 1, b: () => { } },
    ],
    [
      [1, () => { }],
      [1, expectUnderTestAsAny.optionalFn()],
    ],
    [
      [1, expectUnderTestAsAny.optionalFn()],
      [1, () => { }],
    ],
    // issue 12463 - "matcher" vs "undefined"
    [
      { a: 1, b: undefined },
      { a: 1, b: expectUnderTestAsAny.optionalFn() },
    ],
    [
      { a: 1, b: expectUnderTestAsAny.optionalFn() },
      { a: 1, b: undefined },
    ],
    [
      [1, undefined],
      [1, expectUnderTestAsAny.optionalFn()],
    ],
    [
      [1, expectUnderTestAsAny.optionalFn()],
      [1, undefined],
    ],
    // issue 12463 - "matcher" vs "missing"
    [{ a: 1 }, { a: 1, b: expectUnderTestAsAny.optionalFn() }],
    [{ a: 1, b: expectUnderTestAsAny.optionalFn() }, { a: 1 }],
    [[1], [1, expectUnderTestAsAny.optionalFn()]],
    [[1, expectUnderTestAsAny.optionalFn()], [1]],
  ].forEach(([a, b], index) => {
    test(`{pass: true} expect(${stringify(a)}).not.toEqual(${stringify(
        b,
    )}) (${index})`, () => {
      expectUnderTest(a).toEqual(b);
      expect(() => expectUnderTest(a).not.toEqual(b)).toThrowErrorMatchingSnapshot();
    });
  });

  [
    [BigInt(1), BigInt(1)],
    [BigInt(0), BigInt('0')],
    [[BigInt(1)], [BigInt(1)]],
    [
      [BigInt(1), 2],
      [BigInt(1), 2],
    ],
    [Immutable.List([BigInt(1)]), Immutable.List([BigInt(1)])],
    [{ a: BigInt(99) }, { a: BigInt(99) }],
    [new Set([BigInt(1), BigInt(2)]), new Set([BigInt(1), BigInt(2)])],
  ].forEach(([a, b]) => {
    test(`{pass: true} expect(${stringify(a)}).not.toEqual(${stringify(
        b,
    )})`, () => {
      expectUnderTest(a).toEqual(b);
      expect(() => expectUnderTest(a).not.toEqual(b)).toThrow('toEqual');
    });
  });

  test('assertion error matcherResult property contains matcher name, expected and actual values', () => {
    const actual = { a: 1 };
    const expected = { a: 2 };
    try {
      expectUnderTest(actual).toEqual(expected);
    } catch (error) {
      expect(error.matcherResult).toEqual(
          expect.objectContaining({
            actual,
            expected,
            name: 'toEqual',
          }),
      );
    }
  });

  test('symbol based keys in arrays are processed correctly', () => {
    const mySymbol = Symbol('test');
    const actual1 = [];
    actual1[mySymbol] = 3;
    const actual2 = [];
    actual2[mySymbol] = 4;
    const expected = [];
    expected[mySymbol] = 3;

    expect(actual1).toEqual(expected);
    expect(actual2).not.toEqual(expected);
  });

  test('non-enumerable members should be skipped during equal', () => {
    const actual = {
      x: 3,
    };
    Object.defineProperty(actual, 'test', {
      enumerable: false,
      value: 5,
    });
    expect(actual).toEqual({ x: 3 });
  });

  test('non-enumerable symbolic members should be skipped during equal', () => {
    const actual = {
      x: 3,
    };
    const mySymbol = Symbol('test');
    Object.defineProperty(actual, mySymbol, {
      enumerable: false,
      value: 5,
    });
    expect(actual).toEqual({ x: 3 });
  });

  test.describe('cyclic object equality', () => {
    test('properties with the same circularity are equal', () => {
      const a: any = {};
      a.x = a;
      const b: any = {};
      b.x = b;
      expect(a).toEqual(b);
      expect(b).toEqual(a);

      const c: any = {};
      c.x = a;
      const d: any = {};
      d.x = b;
      expect(c).toEqual(d);
      expect(d).toEqual(c);
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

      const c: any = {};
      c.x = a;
      const d: any = {};
      d.x = b;
      expect(c).not.toEqual(d);
      expect(d).not.toEqual(c);
    });

    test('are not equal if circularity is not on the same property', () => {
      const a: any = {};
      const b: any = {};
      a.a = a;
      b.a = {};
      b.a.a = a;
      expect(a).not.toEqual(b);
      expect(b).not.toEqual(a);

      const c: any = {};
      c.x = { x: c };
      const d: any = {};
      d.x = d;
      expect(c).not.toEqual(d);
      expect(d).not.toEqual(c);
    });
  });

});

test.describe('.toBeInstanceOf()', () => {
  class A { }
  class B { }
  class C extends B { }
  class D extends C { }
  class E extends D { }

  class SubHasStaticNameMethod extends B {
    constructor() {
      super();
    }
    static name() { }
  }

  class HasStaticNameMethod {
    constructor() { }
    static name() { }
  }

  function DefinesNameProp() { }
  Object.defineProperty(DefinesNameProp, 'name', {
    configurable: true,
    enumerable: false,
    value: '',
    writable: true,
  });
  // @ts-ignore
  class SubHasNameProp extends DefinesNameProp { }

  [
    [new Map(), Map],
    [[], Array],
    [new A(), A],
    [new C(), B], // C extends B
    [new E(), B], // E extends … extends B
    [new SubHasNameProp(), DefinesNameProp], // omit extends
    [new SubHasStaticNameMethod(), B], // Received
    [new HasStaticNameMethod(), HasStaticNameMethod], // Expected
  ].forEach(([a, b], index) => {
    test(`passing ${stringify(a)} and ${stringify(b)} (${index})`, () => {
      expect(() =>
        expectUnderTest(a).not.toBeInstanceOf(b),
      ).toThrowErrorMatchingSnapshot();

      expectUnderTest(a).toBeInstanceOf(b);
    });
  });

  [
    ['a', String],
    [1, Number],
    [true, Boolean],
    [new A(), B],
    [Object.create(null), A],
    [undefined, String],
    [null, String],
    [/\w+/, function() { }],
    [new DefinesNameProp(), RegExp],
  ].forEach(([a, b], index) => {
    test(`failing ${stringify(a)} and ${stringify(b)} (${index})`, () => {
      expect(() =>
        expectUnderTest(a).toBeInstanceOf(b),
      ).toThrowErrorMatchingSnapshot();

      expectUnderTest(a).not.toBeInstanceOf(b);
    });
  });

  test('throws if constructor is not a function', () => {
    expect(() =>
      expectUnderTest({}).toBeInstanceOf(4),
    ).toThrowErrorMatchingSnapshot();
  });
});

test.describe('.toBeTruthy(), .toBeFalsy()', () => {
  test('does not accept arguments', () => {
    expect(() => expectUnderTestAsAny(0).toBeTruthy(null)).toThrowErrorMatchingSnapshot();

    expect(() =>
      expectUnderTestAsAny(0).not.toBeFalsy(null),
    ).toThrowErrorMatchingSnapshot();
  });

  [{}, [], true, 1, 'a', 0.5, new Map(), () => { }, Infinity].forEach(v => {
    test(`'${stringify(v)}' is truthy`, () => {
      expectUnderTest(v).toBeTruthy();
      expectUnderTest(v).not.toBeFalsy();

      expect(() =>
        expectUnderTest(v).not.toBeTruthy(),
      ).toThrowErrorMatchingSnapshot();

      expect(() => expectUnderTest(v).toBeFalsy()).toThrowErrorMatchingSnapshot();
    });
  });

  [BigInt(1)].forEach(v => {
    test(`'${stringify(v)}' is truthy`, () => {
      expectUnderTest(v).toBeTruthy();
      expectUnderTest(v).not.toBeFalsy();

      expect(() => expectUnderTest(v).not.toBeTruthy()).toThrow('toBeTruthy');

      expect(() => expectUnderTest(v).toBeFalsy()).toThrow('toBeFalsy');
    });
  });

  [false, null, NaN, 0, '', undefined].forEach(v => {
    test(`'${stringify(v)}' is falsy`, () => {
      expectUnderTest(v).toBeFalsy();
      expectUnderTest(v).not.toBeTruthy();

      expect(() => expectUnderTest(v).toBeTruthy()).toThrowErrorMatchingSnapshot();

      expect(() =>
        expectUnderTest(v).not.toBeFalsy(),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  [BigInt(0)].forEach(v => {
    test(`'${stringify(v)}' is falsy`, () => {
      expectUnderTest(v).toBeFalsy();
      expectUnderTest(v).not.toBeTruthy();

      expect(() => expectUnderTest(v).toBeTruthy()).toThrow('toBeTruthy');

      expect(() => expectUnderTest(v).not.toBeFalsy()).toThrow('toBeFalsy');
    });
  });
});

test.describe('.toBeNaN()', () => {
  test('{pass: true} expect(NaN).toBeNaN()', () => {
    [NaN, Math.sqrt(-1), Infinity - Infinity, 0 / 0].forEach(v => {
      expectUnderTest(v).toBeNaN();

      expect(() => expectUnderTest(v).not.toBeNaN()).toThrowErrorMatchingSnapshot();
    });
  });

  test('throws', () => {
    [1, '', null, undefined, {}, [], 0.2, 0, Infinity, -Infinity].forEach(v => {
      expect(() => expectUnderTest(v).toBeNaN()).toThrowErrorMatchingSnapshot();

      expectUnderTest(v).not.toBeNaN();
    });
  });
});

test.describe('.toBeNull()', () => {
  [{}, [], true, 1, 'a', 0.5, new Map(), () => { }, Infinity].forEach(v => {
    test(`fails for '${stringify(v)}'`, () => {
      expectUnderTest(v).not.toBeNull();

      expect(() => expectUnderTest(v).toBeNull()).toThrowErrorMatchingSnapshot();
    });
  });

  test('fails for null with .not', () => {
    expect(() =>
      expectUnderTest(null).not.toBeNull(),
    ).toThrowErrorMatchingSnapshot();
  });

  test('pass for null', () => {
    expectUnderTest(null).toBeNull();
  });
});

test.describe('.toBeDefined(), .toBeUndefined()', () => {
  [{}, [], true, 1, 'a', 0.5, new Map(), () => { }, Infinity].forEach(v => {
    test(`'${stringify(v)}' is defined`, () => {
      expectUnderTest(v).toBeDefined();
      expectUnderTest(v).not.toBeUndefined();

      expect(() =>
        expectUnderTest(v).not.toBeDefined(),
      ).toThrowErrorMatchingSnapshot();

      expect(() =>
        expectUnderTest(v).toBeUndefined(),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  [BigInt(1)].forEach(v => {
    test(`'${stringify(v)}' is defined`, () => {
      expectUnderTest(v).toBeDefined();
      expectUnderTest(v).not.toBeUndefined();

      expect(() => expectUnderTest(v).not.toBeDefined()).toThrow('toBeDefined');

      expect(() => expectUnderTest(v).toBeUndefined()).toThrow('toBeUndefined');
    });
  });

  test('undefined is undefined', () => {
    expectUnderTest(undefined).toBeUndefined();
    expectUnderTest(undefined).not.toBeDefined();

    expect(() =>
      expectUnderTest(undefined).toBeDefined(),
    ).toThrowErrorMatchingSnapshot();

    expect(() =>
      expectUnderTest(undefined).not.toBeUndefined(),
    ).toThrowErrorMatchingSnapshot();
  });
});

test.describe(
    '.toBeGreaterThan(), .toBeLessThan(), ' +
  '.toBeGreaterThanOrEqual(), .toBeLessThanOrEqual()',
    () => {
      [
        [1, 2],
        [-Infinity, Infinity],
        [Number.MIN_VALUE, Number.MAX_VALUE],
        [0x11, 0x22],
        [0b11, 0b111],
        [0o11, 0o22],
        [0.1, 0.2],
      ].forEach(([small, big]) => {
        test(`{pass: true} expect(${small}).toBeLessThan(${big})`, () => {
          expectUnderTest(small).toBeLessThan(big);
        });

        test(`{pass: false} expect(${big}).toBeLessThan(${small})`, () => {
          expectUnderTest(big).not.toBeLessThan(small);
        });

        test(`{pass: true} expect(${big}).toBeGreaterThan(${small})`, () => {
          expectUnderTest(big).toBeGreaterThan(small);
        });

        test(`{pass: false} expect(${small}).toBeGreaterThan(${big})`, () => {
          expectUnderTest(small).not.toBeGreaterThan(big);
        });

        test(`{pass: true} expect(${small}).toBeLessThanOrEqual(${big})`, () => {
          expectUnderTest(small).toBeLessThanOrEqual(big);
        });

        test(`{pass: false} expect(${big}).toBeLessThanOrEqual(${small})`, () => {
          expectUnderTest(big).not.toBeLessThanOrEqual(small);
        });

        test(`{pass: true} expect(${big}).toBeGreaterThanOrEqual(${small})`, () => {
          expectUnderTest(big).toBeGreaterThanOrEqual(small);
        });

        test(`{pass: false} expect(${small}).toBeGreaterThanOrEqual(${big})`, () => {
          expectUnderTest(small).not.toBeGreaterThanOrEqual(big);
        });

        test(`throws: [${small}, ${big}]`, () => {
          expect(() =>
            expectUnderTest(small).toBeGreaterThan(big),
          ).toThrowErrorMatchingSnapshot();

          expect(() =>
            expectUnderTest(small).not.toBeLessThan(big),
          ).toThrowErrorMatchingSnapshot();

          expect(() =>
            expectUnderTest(big).not.toBeGreaterThan(small),
          ).toThrowErrorMatchingSnapshot();

          expect(() =>
            expectUnderTest(big).toBeLessThan(small),
          ).toThrowErrorMatchingSnapshot();

          expect(() =>
            expectUnderTest(small).toBeGreaterThanOrEqual(big),
          ).toThrowErrorMatchingSnapshot();

          expect(() =>
            expectUnderTest(small).not.toBeLessThanOrEqual(big),
          ).toThrowErrorMatchingSnapshot();

          expect(() =>
            expectUnderTest(big).not.toBeGreaterThanOrEqual(small),
          ).toThrowErrorMatchingSnapshot();

          expect(() =>
            expectUnderTest(big).toBeLessThanOrEqual(small),
          ).toThrowErrorMatchingSnapshot();
        });
      });

      test('can compare BigInt to Numbers', () => {
        const a = BigInt(2);
        expectUnderTest(a).toBeGreaterThan(1);
        expectUnderTest(a).toBeGreaterThanOrEqual(2);
        expectUnderTest(2).toBeLessThanOrEqual(a);
        expectUnderTest(a).toBeLessThan(3);
        expectUnderTest(a).toBeLessThanOrEqual(2);
      });
      [
        [BigInt(1), BigInt(2)],
        [BigInt(0x11), BigInt(0x22)],
        [-1, BigInt(2)],
      ].forEach(([small, big]) => {
        test(`{pass: true} expect(${stringify(small)}).toBeLessThan(${stringify(
            big,
        )})`, () => {
          expectUnderTest(small).toBeLessThan(big);
        });

        test(`{pass: false} expect(${stringify(big)}).toBeLessThan(${stringify(
            small,
        )})`, () => {
          expectUnderTest(big).not.toBeLessThan(small);
        });

        test(`{pass: true} expect(${stringify(big)}).toBeGreaterThan(${stringify(
            small,
        )})`, () => {
          expectUnderTest(big).toBeGreaterThan(small);
        });

        test(`{pass: false} expect(${stringify(small)}).toBeGreaterThan(${stringify(
            big,
        )})`, () => {
          expectUnderTest(small).not.toBeGreaterThan(big);
        });

        test(`{pass: true} expect(${stringify(
            small,
        )}).toBeLessThanOrEqual(${stringify(big)})`, () => {
          expectUnderTest(small).toBeLessThanOrEqual(big);
        });

        test(`{pass: false} expect(${stringify(
            big,
        )}).toBeLessThanOrEqual(${stringify(small)})`, () => {
          expectUnderTest(big).not.toBeLessThanOrEqual(small);
        });

        test(`{pass: true} expect(${stringify(
            big,
        )}).toBeGreaterThanOrEqual(${stringify(small)})`, () => {
          expectUnderTest(big).toBeGreaterThanOrEqual(small);
        });

        test(`{pass: false} expect(${stringify(
            small,
        )}).toBeGreaterThanOrEqual(${stringify(big)})`, () => {
          expectUnderTest(small).not.toBeGreaterThanOrEqual(big);
        });

        test(`throws: [${stringify(small)}, ${stringify(big)}]`, () => {
          expect(() => expectUnderTest(small).toBeGreaterThan(big)).toThrow(
              'toBeGreaterThan',
          );

          expect(() => expectUnderTest(small).not.toBeLessThan(big)).toThrow(
              'toBeLessThan',
          );

          expect(() => expectUnderTest(big).not.toBeGreaterThan(small)).toThrow(
              'toBeGreaterThan',
          );

          expect(() => expectUnderTest(big).toBeLessThan(small)).toThrow(
              'toBeLessThan',
          );

          expect(() => expectUnderTest(small).toBeGreaterThanOrEqual(big)).toThrow(
              'toBeGreaterThanOrEqual',
          );

          expect(() => expectUnderTest(small).not.toBeLessThanOrEqual(big)).toThrow(
              'toBeLessThanOrEqual',
          );

          expect(() => expectUnderTest(big).not.toBeGreaterThanOrEqual(small)).toThrow(
              'toBeGreaterThanOrEqual',
          );

          expect(() => expectUnderTest(big).toBeLessThanOrEqual(small)).toThrow(
              'toBeLessThanOrEqual',
          );
        });
      });

      [
        [1, 1],
        [Number.MIN_VALUE, Number.MIN_VALUE],
        [Number.MAX_VALUE, Number.MAX_VALUE],
        [Infinity, Infinity],
        [-Infinity, -Infinity],
      ].forEach(([n1, n2]) => {
        test(`equal numbers: [${n1}, ${n2}]`, () => {
          expectUnderTest(n1).toBeGreaterThanOrEqual(n2);
          expectUnderTest(n1).toBeLessThanOrEqual(n2);

          expect(() =>
            expectUnderTest(n1).not.toBeGreaterThanOrEqual(n2),
          ).toThrowErrorMatchingSnapshot();

          expect(() =>
            expectUnderTest(n1).not.toBeLessThanOrEqual(n2),
          ).toThrowErrorMatchingSnapshot();
        });
      });

      [
        [BigInt(1), BigInt(1)],
        [BigInt(Number.MAX_SAFE_INTEGER), BigInt(Number.MAX_SAFE_INTEGER)],
      ].forEach(([n1, n2], index) => {
        test(`equal numbers: [${n1}, ${n2}] (${index})`, () => {
          expectUnderTest(n1).toBeGreaterThanOrEqual(n2);
          expectUnderTest(n1).toBeLessThanOrEqual(n2);

          expect(() => expectUnderTest(n1).not.toBeGreaterThanOrEqual(n2)).toThrow(
              'toBeGreaterThanOrEqual',
          );

          expect(() => expectUnderTest(n1).not.toBeLessThanOrEqual(n2)).toThrow(
              'toBeLessThanOrEqual',
          );
        });
      });
    },
);

test.describe('.toContain(), .toContainEqual()', () => {
  const typedArray = new Int8Array(2);
  typedArray[0] = 0;
  typedArray[1] = 1;

  test('iterable', () => {
    // different node versions print iterable differently, so we can't
    // use snapshots here.
    const iterable = {
      *[Symbol.iterator]() {
        yield 1;
        yield 2;
        yield 3;
      },
    };

    expectUnderTest(iterable).toContain(2);
    expectUnderTest(iterable).toContainEqual(2);
    expect(() => expectUnderTest(iterable).not.toContain(1)).toThrow('toContain');
    expect(() => expectUnderTest(iterable).not.toContainEqual(1)).toThrow(
        'toContainEqual',
    );
  });

  [
    [[1, 2, 3, 4], 1],
    [['a', 'b', 'c', 'd'], 'a'],
    [[undefined, null], null],
    [[undefined, null], undefined],
    [[Symbol.for('a')], Symbol.for('a')],
    ['abcdef', 'abc'],
    ['11112111', '2'],
    [new Set(['abc', 'def']), 'abc'],
    [typedArray, 1],
  ].forEach(([list, v]) => {
    test(`'${stringify(list)}' contains '${stringify(v)}'`, () => {
      expectUnderTest(list).toContain(v);

      expect(() =>
        expectUnderTest(list).not.toContain(v),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  [
    [[BigInt(1), BigInt(2), BigInt(3), BigInt(4)], BigInt(1)],
    [[1, 2, 3, BigInt(3), 4], BigInt(3)],
  ].forEach(([list, v]) => {
    test(`'${stringify(list)}' contains '${stringify(v)}'`, () => {
      expectUnderTest(list).toContain(v);

      expect(() => expectUnderTest(list).not.toContain(v)).toThrow('toContain');
    });
  });

  [
    [[1, 2, 3], 4],
    [[null, undefined], 1],
    [[{}, []], []],
    [[{}, []], {}],
  ].forEach(([list, v]) => {
    test(`'${stringify(list)}' does not contain '${stringify(v)}'`, () => {
      expectUnderTest(list).not.toContain(v);

      expect(() =>
        expectUnderTest(list).toContain(v),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  [[[BigInt(1), BigInt(2), BigInt(3)], 3]].forEach(([list, v]) => {
    test(`'${stringify(list)}' does not contain '${stringify(v)}'`, () => {
      expectUnderTest(list).not.toContain(v);

      expect(() => expectUnderTest(list).toContain(v)).toThrow('toContain');
    });
  });

  test('error cases', () => {
    expect(() => expectUnderTest(null).toContain(1)).toThrowErrorMatchingSnapshot();
    expect(() => expectUnderTest('-0').toContain(-0)).toThrowErrorMatchingSnapshot();
    expect(() =>
      expectUnderTest('null').toContain(null),
    ).toThrowErrorMatchingSnapshot();
    expect(() =>
      expectUnderTest('undefined').toContain(undefined),
    ).toThrowErrorMatchingSnapshot();
    expect(() =>
      expectUnderTest('false').toContain(false),
    ).toThrowErrorMatchingSnapshot();
    expect(() => expectUnderTest('1').toContain(BigInt(1))).toThrow('toContain');
  });

  [
    [[1, 2, 3, 4], 1],
    [['a', 'b', 'c', 'd'], 'a'],
    [[undefined, null], null],
    [[undefined, null], undefined],
    [[Symbol.for('a')], Symbol.for('a')],
    [[{ a: 'b' }, { a: 'c' }], { a: 'b' }],
    [new Set([1, 2, 3, 4]), 1],
    [typedArray, 1],
  ].forEach(([list, v]) => {
    test(`'${stringify(list)}' contains a value equal to '${stringify(
        v,
    )}'`, () => {
      expectUnderTest(list).toContainEqual(v);
      expect(() =>
        expectUnderTest(list).not.toContainEqual(v),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  [[[{ a: 'b' }, { a: 'c' }], { a: 'd' }]].forEach(([list, v]) => {
    test(`'${stringify(list)}' does not contain a value equal to'${stringify(
        v,
    )}'`, () => {
      expectUnderTest(list).not.toContainEqual(v);

      expect(() =>
        expectUnderTest(list).toContainEqual(v),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  test('error cases for toContainEqual', () => {
    expect(() =>
      expectUnderTest(null).toContainEqual(1),
    ).toThrowErrorMatchingSnapshot();
  });
});

test.describe('.toBeCloseTo', () => {
  [
    [0, 0],
    [0, 0.001],
    [1.23, 1.229],
    [1.23, 1.226],
    [1.23, 1.225],
    [1.23, 1.234],
    [Infinity, Infinity],
    [-Infinity, -Infinity],
  ].forEach(([n1, n2]) => {
    test(`{pass: true} expect(${n1}).toBeCloseTo(${n2})`, () => {
      expectUnderTest(n1).toBeCloseTo(n2);

      expect(() =>
        expectUnderTest(n1).not.toBeCloseTo(n2),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  [
    [0, 0.01],
    [1, 1.23],
    [1.23, 1.2249999],
    [Infinity, -Infinity],
    [Infinity, 1.23],
    [-Infinity, -1.23],
  ].forEach(([n1, n2]) => {
    test(`{pass: false} expect(${n1}).toBeCloseTo(${n2})`, () => {
      expectUnderTest(n1).not.toBeCloseTo(n2);

      expect(() =>
        expectUnderTest(n1).toBeCloseTo(n2),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  [
    [3.141592e-7, 3e-7, 8],
    [56789, 51234, -4],
  ].forEach(([n1, n2, p]) => {
    test(`{pass: false} expect(${n1}).toBeCloseTo(${n2}, ${p})`, () => {
      expectUnderTest(n1).not.toBeCloseTo(n2, p);

      expect(() =>
        expectUnderTest(n1).toBeCloseTo(n2, p),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  [
    [0, 0.1, 0],
    [0, 0.0001, 3],
    [0, 0.000004, 5],
    [2.0000002, 2, 5],
  ].forEach(([n1, n2, p]) => {
    test(`{pass: true} expect(${n1}).toBeCloseTo(${n2}, ${p})`, () => {
      expectUnderTest(n1).toBeCloseTo(n2, p);

      expect(() =>
        expectUnderTest(n1).not.toBeCloseTo(n2, p),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  test.describe('throws: Matcher error', () => {
    test('promise empty isNot false received', () => {
      const precision = 3;
      const expected = 0;
      const received = '';
      expect(() => {
        expectUnderTest(received).toBeCloseTo(expected, precision);
      }).toThrowErrorMatchingSnapshot();
    });

    test('promise empty isNot true expected', () => {
      const received = 0.1;
      // expected is undefined
      expect(() => {
        expectUnderTestAsAny(received).not.toBeCloseTo();
      }).toThrowErrorMatchingSnapshot();
    });

    test('promise rejects isNot false expected', () => {
      const expected = '0';
      const received = Promise.reject(0.01);
      return expect(
          expectUnderTestAsAny(received).rejects.toBeCloseTo(expected),
      // @ts-ignore
      ).rejects.toThrowErrorMatchingSnapshotAsync();
    });

    test('promise rejects isNot true received', () => {
      const expected = 0;
      const received = Promise.reject(Symbol('0.1'));
      return expect(
          expectUnderTest(received).rejects.not.toBeCloseTo(expected),
      // @ts-ignore
      ).rejects.toThrowErrorMatchingSnapshotAsync();
    });

    test('promise resolves isNot false received', () => {
      const precision = 3;
      const expected = 0;
      const received = Promise.resolve(false);
      return expect(
          expectUnderTest(received).resolves.toBeCloseTo(expected, precision),
      // @ts-ignore
      ).rejects.toThrowErrorMatchingSnapshotAsync();
    });

    test('promise resolves isNot true expected', () => {
      const precision = 3;
      const expected = null;
      const received = Promise.resolve(0.1);
      return expect(
          expectUnderTest(received).resolves.not.toBeCloseTo(expected, precision),
      // @ts-ignore
      ).rejects.toThrowErrorMatchingSnapshotAsync();
    });
  });
});

test.describe('.toMatch()', () => {
  [
    ['foo', 'foo'],
    ['Foo bar', /^foo/i],
  ].forEach(([n1, n2]) => {
    test(`{pass: true} expect(${n1}).toMatch(${n2})`, () => {
      expectUnderTest(n1).toMatch(n2);

      expect(() =>
        expectUnderTest(n1).not.toMatch(n2),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  [
    ['bar', 'foo'],
    ['bar', /foo/],
  ].forEach(([n1, n2]) => {
    test(`throws: [${n1}, ${n2}]`, () => {
      expect(() => expectUnderTest(n1).toMatch(n2)).toThrowErrorMatchingSnapshot();
    });
  });

  [
    [1, 'foo'],
    [{}, 'foo'],
    [[], 'foo'],
    [true, 'foo'],
    [/foo/i, 'foo'],
    [() => { }, 'foo'],
    [undefined, 'foo'],
  ].forEach(([n1, n2]) => {
    test(
        'throws if non String actual value passed:' +
      ` [${stringify(n1)}, ${stringify(n2)}]`,
        () => {
          // @ts-ignore
          expect(() => expectUnderTest(n1).toMatch(n2)).toThrowErrorMatchingSnapshot();
        },
    );
  });

  [
    ['foo', 1],
    ['foo', {}],
    ['foo', []],
    ['foo', true],
    ['foo', () => { }],
    ['foo', undefined],
  ].forEach(([n1, n2]) => {
    test(
        'throws if non String/RegExp expected value passed:' +
      ` [${stringify(n1)}, ${stringify(n2)}]`,
        () => {
          // @ts-ignore
          expect(() => expectUnderTest(n1).toMatch(n2)).toThrowErrorMatchingSnapshot();
        },
    );
  });

  test('escapes strings properly', () => {
    expectUnderTest('this?: throws').toMatch('this?: throws');
  });

  test('does not maintain RegExp state between calls', () => {
    const regex = /[f]\d+/gi;
    expectUnderTest('f123').toMatch(regex);
    expectUnderTest('F456').toMatch(regex);
    expectUnderTest(regex.lastIndex).toBe(0);
  });
});

test.describe('.toHaveLength', () => {
  [
    [[1, 2], 2],
    [[], 0],
    [['a', 'b'], 2],
    ['abc', 3],
    ['', 0],
    [() => { }, 0],
  ].forEach(([received, length]) => {
    test(`{pass: true} expect(${stringify(
        received,
    )}).toHaveLength(${length})`, () => {
      expectUnderTestAsAny(received).toHaveLength(length);
      expect(() =>
        expectUnderTestAsAny(received).not.toHaveLength(length),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  [
    [[1, 2], 3],
    [[], 1],
    [['a', 'b'], 99],
    ['abc', 66],
    ['', 1],
  ].forEach(([received, length]) => {
    test(`{pass: false} expect(${stringify(
        received,
    )}).toHaveLength(${length})`, () => {
      expectUnderTestAsAny(received).not.toHaveLength(length);
      expect(() =>
        expectUnderTestAsAny(received).toHaveLength(length),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  test('error cases', () => {
    expect(() =>
      expectUnderTest({ a: 9 }).toHaveLength(1),
    ).toThrowErrorMatchingSnapshot();
    expect(() => expectUnderTest(0).toHaveLength(1)).toThrowErrorMatchingSnapshot();
    expect(() =>
      expectUnderTest(undefined).not.toHaveLength(1),
    ).toThrowErrorMatchingSnapshot();
  });

  test.describe('matcher error expected length', () => {
    test('not number', () => {
      const expected = '3';
      const received = 'abc';
      expect(() => {
        expectUnderTestAsAny(received).not.toHaveLength(expected);
      }).toThrowErrorMatchingSnapshot();
    });

    test('number Infinity', () => {
      const expected = Infinity;
      const received = Promise.reject('abc');
      return expect(
          expectUnderTest(received).rejects.toHaveLength(expected),
      // @ts-ignore
      ).rejects.toThrowErrorMatchingSnapshotAsync();
    });

    test('number NaN', () => {
      const expected = NaN;
      const received = Promise.reject('abc');
      return expect(
          expectUnderTest(received).rejects.not.toHaveLength(expected),
      // @ts-ignore
      ).rejects.toThrowErrorMatchingSnapshotAsync();
    });

    test('number float', () => {
      const expected = 0.5;
      const received = Promise.resolve('abc');
      return expect(
          expectUnderTest(received).resolves.toHaveLength(expected),
      // @ts-ignore
      ).rejects.toThrowErrorMatchingSnapshotAsync();
    });

    test('number negative integer', () => {
      const expected = -3;
      const received = Promise.resolve('abc');
      return expect(
          expectUnderTest(received).resolves.not.toHaveLength(expected),
      // @ts-ignore
      ).rejects.toThrowErrorMatchingSnapshotAsync();
    });
  });
});

test.describe('.toHaveProperty()', () => {
  class Foo {
    val: any;
    get a() {
      return undefined;
    }
    get b() {
      return 'b';
    }

    set setter(val) {
      this.val = val;
    }
  }

  class Foo2 extends Foo {
    get c() {
      return 'c';
    }
  }
  const foo2 = new Foo2();
  foo2.setter = true;

  function E(nodeName) {
    this.nodeName = nodeName.toUpperCase();
  }
  E.prototype.nodeType = 1;

  const memoized = function() { };
  memoized.memo = [];

  const pathDiff = ['children', 0];

  const receivedDiffSingle = {
    children: ['"That cartoon"'],
    props: null,
    type: 'p',
  };
  const valueDiffSingle = '"That cat cartoon"';

  const receivedDiffMultiple = {
    children: [
      'Roses are red.\nViolets are blue.\nTesting with Jest is good for you.',
    ],
    props: null,
    type: 'pre',
  };
  const valueDiffMultiple =
    'Roses are red, violets are blue.\nTesting with Jest\nIs good for you.';

  [
    [{ a: { b: { c: { d: 1 } } } }, 'a.b.c.d', 1],
    [{ a: { b: { c: { d: 1 } } } }, ['a', 'b', 'c', 'd'], 1],
    [{ 'a.b.c.d': 1 }, ['a.b.c.d'], 1],
    [{ a: { b: [1, 2, 3] } }, ['a', 'b', 1], 2],
    [{ a: { b: [1, 2, 3] } }, ['a', 'b', 1], expect.any(Number)],
    [{ a: 0 }, 'a', 0],
    [{ a: { b: undefined } }, 'a.b', undefined],
    [{ a: { b: { c: 5 } } }, 'a.b', { c: 5 }],
    [{ a: { b: [{ c: [{ d: 1 }] }] } }, 'a.b[0].c[0].d', 1],
    [{ a: { b: [{ c: { d: [{ e: 1 }, { f: 2 }] } }] } }, 'a.b[0].c.d[1].f', 2],
    [{ a: { b: [[{ c: [{ d: 1 }] }]] } }, 'a.b[0][0].c[0].d', 1],
    [Object.assign(Object.create(null), { property: 1 }), 'property', 1],
    [new Foo(), 'a', undefined],
    [new Foo(), 'b', 'b'],
    [new Foo(), 'setter', undefined],
    [foo2, 'a', undefined],
    [foo2, 'c', 'c'],
    [foo2, 'val', true],
    [new E('div'), 'nodeType', 1],
    ['', 'length', 0],
    [memoized, 'memo', []],
    [{ '': 1 }, '', 1],
  ].forEach(([obj, keyPath, value]) => {
    test(`{pass: true} expect(${stringify(
        obj,
    )}).toHaveProperty('${keyPath}', ${stringify(value)})`, () => {
      expectUnderTestAsAny(obj).toHaveProperty(keyPath, value);
      expect(() =>
        expectUnderTestAsAny(obj).not.toHaveProperty(keyPath, value),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  [
    [{ a: { b: { c: { d: 1 } } } }, 'a.b.ttt.d', 1],
    [{ a: { b: { c: { d: 1 } } } }, 'a.b.c.d', 2],
    [{ 'a.b.c.d': 1 }, 'a.b.c.d', 2],
    [{ 'a.b.c.d': 1 }, ['a.b.c.d'], 2],
    [receivedDiffSingle, pathDiff, valueDiffSingle],
    [receivedDiffMultiple, pathDiff, valueDiffMultiple],
    [{ a: { b: { c: { d: 1 } } } }, ['a', 'b', 'c', 'd'], 2],
    [{ a: { b: { c: {} } } }, 'a.b.c.d', 1],
    [{ a: 1 }, 'a.b.c.d', 5],
    [{}, 'a', 'test'],
    [{ a: { b: 3 } }, 'a.b', undefined],
    [1, 'a.b.c', 'test'],
    ['abc', 'a.b.c', { a: 5 }],
    [{ a: { b: { c: 5 } } }, 'a.b', { c: 4 }],
    [new Foo(), 'a', 'a'],
    [new Foo(), 'b', undefined],
    [{ a: {} }, 'a.b', undefined],
  ].forEach(([obj, keyPath, value], index) => {
    test(`{pass: false} expect(${stringify(
        obj,
    )}).toHaveProperty('${keyPath}', ${stringify(value)})  (${index})`, () => {
      expect(() =>
        expectUnderTestAsAny(obj).toHaveProperty(keyPath, value),
      ).toThrowErrorMatchingSnapshot();
      expectUnderTestAsAny(obj).not.toHaveProperty(keyPath, value);
    });
  });

  [
    [{ a: { b: { c: { d: 1 } } } }, 'a.b.c.d'],
    [{ a: { b: { c: { d: 1 } } } }, ['a', 'b', 'c', 'd']],
    [{ 'a.b.c.d': 1 }, ['a.b.c.d']],
    [{ a: { b: [1, 2, 3] } }, ['a', 'b', 1]],
    [{ a: 0 }, 'a'],
    [{ a: { b: undefined } }, 'a.b'],
  ].forEach(([obj, keyPath]) => {
    test(`{pass: true} expect(${stringify(
        obj,
    )}).toHaveProperty('${keyPath}')`, () => {
      expectUnderTestAsAny(obj).toHaveProperty(keyPath);
      expect(() =>
        expectUnderTestAsAny(obj).not.toHaveProperty(keyPath),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  [
    [{ a: { b: { c: {} } } }, 'a.b.c.d'],
    [{ a: { b: { c: {} } } }, '.a.b.c'],
    [{ a: 1 }, 'a.b.c.d'],
    [{}, 'a'],
    [1, 'a.b.c'],
    ['abc', 'a.b.c'],
    [false, 'key'],
    [0, 'key'],
    ['', 'key'],
    [Symbol(), 'key'],
    [Object.assign(Object.create(null), { key: 1 }), 'not'],
  ].forEach(([obj, keyPath]) => {
    test(`{pass: false} expect(${stringify(
        obj,
    )}).toHaveProperty('${keyPath}')`, () => {
      expect(() =>
        expectUnderTest(obj).toHaveProperty(keyPath),
      ).toThrowErrorMatchingSnapshot();
      expectUnderTest(obj).not.toHaveProperty(keyPath);
    });
  });

  [
    [null, 'a.b'],
    [undefined, 'a'],
    [{ a: { b: {} } }, undefined],
    [{ a: { b: {} } }, null],
    [{ a: { b: {} } }, 1],
    [{}, []], // Residue: pass must be initialized
  ].forEach(([obj, keyPath]) => {
    test(`{error} expect(${stringify(
        obj,
    )}).toHaveProperty('${keyPath}')`, () => {
      expect(() =>
        expectUnderTestAsAny(obj).toHaveProperty(keyPath),
      ).toThrowErrorMatchingSnapshot();
    });
  });
});

test.describe('toMatchObject()', () => {
  class Foo {
    get a() {
      return undefined;
    }
    get b() {
      return 'b';
    }
  }

  class Sub extends Foo {
    get c() {
      return 'c';
    }
  }

  const withDefineProperty = (obj, key, val) => {
    Object.defineProperty(obj, key, {
      get() {
        return val;
      },
    });

    return obj;
  };

  const testNotToMatchSnapshots = tuples => {
    tuples.forEach(([n1, n2]) => {
      test(`{pass: true} expect(${stringify(n1)}).toMatchObject(${stringify(
          n2,
      )})`, () => {
        expectUnderTest(n1).toMatchObject(n2);
        expect(() =>
          expectUnderTest(n1).not.toMatchObject(n2),
        ).toThrowErrorMatchingSnapshot();
      });
    });
  };

  const testToMatchSnapshots = tuples => {
    tuples.forEach(([n1, n2]) => {
      test(`{pass: false} expect(${stringify(n1)}).toMatchObject(${stringify(
          n2,
      )})`, () => {
        expectUnderTest(n1).not.toMatchObject(n2);
        expect(() =>
          expectUnderTest(n1).toMatchObject(n2),
        ).toThrowErrorMatchingSnapshot();
      });
    });
  };

  test.describe('circular references', () => {
    test.describe('simple circular references', () => {
      const circularObjA1: any = { a: 'hello' };
      circularObjA1.ref = circularObjA1;

      const circularObjB: any = { a: 'world' };
      circularObjB.ref = circularObjB;

      const circularObjA2: any = { a: 'hello' };
      circularObjA2.ref = circularObjA2;

      const primitiveInsteadOfRef: any = {};
      primitiveInsteadOfRef.ref = 'not a ref';

      testNotToMatchSnapshots([
        [circularObjA1, {}],
        [circularObjA2, circularObjA1],
      ]);

      testToMatchSnapshots([
        [{}, circularObjA1],
        [circularObjA1, circularObjB],
        [primitiveInsteadOfRef, circularObjA1],
      ]);
    });

    test.describe('transitive circular references', () => {
      const transitiveCircularObjA1: any = { a: 'hello' };
      transitiveCircularObjA1.nestedObj = { parentObj: transitiveCircularObjA1 };

      const transitiveCircularObjA2: any = { a: 'hello' };
      transitiveCircularObjA2.nestedObj = {
        parentObj: transitiveCircularObjA2,
      };

      const transitiveCircularObjB: any = { a: 'world' };
      transitiveCircularObjB.nestedObj = {
        parentObj: transitiveCircularObjB,
      };

      const primitiveInsteadOfRef: any = {};
      primitiveInsteadOfRef.nestedObj = {
        parentObj: 'not the parent ref',
      };

      testNotToMatchSnapshots([
        [transitiveCircularObjA1, {}],
        [transitiveCircularObjA2, transitiveCircularObjA1],
      ]);

      testToMatchSnapshots([
        [{}, transitiveCircularObjA1],
        [transitiveCircularObjB, transitiveCircularObjA1],
        [primitiveInsteadOfRef, transitiveCircularObjA1],
      ]);
    });
  });

  testNotToMatchSnapshots([
    [{ a: 'b', c: 'd' }, { a: 'b' }],
    [
      { a: 'b', c: 'd' },
      { a: 'b', c: 'd' },
    ],
    [
      { a: 'b', t: { x: { r: 'r' }, z: 'z' } },
      { a: 'b', t: { z: 'z' } },
    ],
    [{ a: 'b', t: { x: { r: 'r' }, z: 'z' } }, { t: { x: { r: 'r' } } }],
    [{ a: [3, 4, 5], b: 'b' }, { a: [3, 4, 5] }],
    [{ a: [3, 4, 5, 'v'], b: 'b' }, { a: [3, 4, 5, 'v'] }],
    [{ a: 1, c: 2 }, { a: expectUnderTest.any(Number) }],
    [{ a: { x: 'x', y: 'y' } }, { a: { x: expectUnderTest.any(String) } }],
    [new Set([1, 2]), new Set([1, 2])],
    [new Set([1, 2]), new Set([2, 1])],
    [new Date('2015-11-30'), new Date('2015-11-30')],
    [{ a: new Date('2015-11-30'), b: 'b' }, { a: new Date('2015-11-30') }],
    [{ a: null, b: 'b' }, { a: null }],
    [{ a: undefined, b: 'b' }, { a: undefined }],
    [{ a: [{ a: 'a', b: 'b' }] }, { a: [{ a: 'a' }] }],
    [
      [1, 2],
      [1, 2],
    ],
    [{ a: undefined }, { a: undefined }],
    [[], []],
    [new Error('foo'), new Error('foo')],
    [new Error('bar'), { message: 'bar' }],
    [new Foo(), { a: undefined, b: 'b' }],
    [Object.assign(Object.create(null), { a: 'b' }), { a: 'b' }],
    [
      { a: 'b', c: 'd', [Symbol.for('jest')]: 'jest' },
      { a: 'b', [Symbol.for('jest')]: 'jest' },
    ],
    [
      { a: 'b', c: 'd', [Symbol.for('jest')]: 'jest' },
      { a: 'b', c: 'd', [Symbol.for('jest')]: 'jest' },
    ],
    // These snapshots will show {} as the object because the properties
    // are not enumerable. We will need to somehow make the serialization of
    // these keys a little smarter before reporting accurately.
    [new Sub(), { a: undefined, b: 'b', c: 'c' }],
    [withDefineProperty(new Sub(), 'd', 4), { d: 4 }],
    [{ a: 'b', toString() { } }, { toString: expectUnderTest.any(Function) }],
  ]);

  testToMatchSnapshots([
    [{ a: 'b', c: 'd' }, { e: 'b' }],
    [
      { a: 'b', c: 'd' },
      { a: 'b!', c: 'd' },
    ],
    [{ a: 'a', c: 'd' }, { a: expectUnderTest.any(Number) }],
    [
      { a: 'b', t: { x: { r: 'r' }, z: 'z' } },
      { a: 'b', t: { z: [3] } },
    ],
    [{ a: 'b', t: { x: { r: 'r' }, z: 'z' } }, { t: { l: { r: 'r' } } }],
    [{ a: [3, 4, 5], b: 'b' }, { a: [3, 4, 5, 6] }],
    [{ a: [3, 4, 5], b: 'b' }, { a: [3, 4] }],
    [{ a: [3, 4, 'v'], b: 'b' }, { a: ['v'] }],
    [{ a: [3, 4, 5], b: 'b' }, { a: { b: 4 } }],
    [{ a: [3, 4, 5], b: 'b' }, { a: { b: expectUnderTest.any(String) } }],
    [
      [1, 2],
      [1, 3],
    ],
    [[0], [-0]],
    [new Set([1, 2]), new Set([2])],
    [new Date('2015-11-30'), new Date('2015-10-10')],
    [{ a: new Date('2015-11-30'), b: 'b' }, { a: new Date('2015-10-10') }],
    [{ a: null, b: 'b' }, { a: '4' }],
    [{ a: null, b: 'b' }, { a: undefined }],
    [{ a: undefined }, { a: null }],
    [{ a: [{ a: 'a', b: 'b' }] }, { a: [{ a: 'c' }] }],
    [{ a: 1, b: 1, c: 1, d: { e: { f: 555 } } }, { d: { e: { f: 222 } } }],
    [{}, { a: undefined }],
    [
      [1, 2, 3],
      [2, 3, 1],
    ],
    [
      [1, 2, 3],
      [1, 2, 2],
    ],
    [new Error('foo'), new Error('bar')],
    [Object.assign(Object.create(null), { a: 'b' }), { c: 'd' }],
    [
      { a: 'b', c: 'd', [Symbol.for('jest')]: 'jest' },
      { a: 'c', [Symbol.for('jest')]: expect.any(String) },
    ],
    [{ a: 'b' }, { toString: expectUnderTest.any(Function) }],
  ]);

  [
    [null, {}],
    [4, {}],
    ['44', {}],
    [true, {}],
    [undefined, {}],
    [{}, null],
    [{}, 4],
    [{}, 'some string'],
    [{}, true],
    [{}, undefined],
  ].forEach(([n1, n2]: [any, any, string]) => {
    test(`throws expect(${stringify(n1)}).toMatchObject(${stringify(
        n2,
    )})`, () => {
      expect(() =>
        expectUnderTest(n1).toMatchObject(n2),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  test('does not match properties up in the prototype chain', () => {
    const a: any = {};
    a.ref = a;

    const b = Object.create(a);
    b.other = 'child';

    const matcher: any = { other: 'child' };
    matcher.ref = matcher;

    expectUnderTest(b).not.toMatchObject(matcher);
    expect(() =>
      expectUnderTest(b).toMatchObject(matcher),
    ).toThrowErrorMatchingSnapshot();
  });

  test('toMatchObject ignores symbol key properties', () => {
    // issue 13638
    const sym = Symbol('foo');
    const sym2 = Symbol('foo2');
    expectUnderTestAsAny({}).not.toMatchObject({ [sym]: true });
    expectUnderTestAsAny({ [sym]: true }).not.toMatchObject({ [sym2]: true });
    expectUnderTestAsAny({ [sym]: true }).not.toMatchObject({ [sym]: false });
    expectUnderTestAsAny({ example: 10, [sym]: true }).not.toMatchObject({
      example: 12,
      [sym]: true,
    });
    expectUnderTestAsAny({ [sym]: true }).toMatchObject({ [sym]: true });
    expectUnderTestAsAny({ example: 10, [sym]: true }).toMatchObject({
      example: 10,
      [sym]: true,
    });
  });
});
