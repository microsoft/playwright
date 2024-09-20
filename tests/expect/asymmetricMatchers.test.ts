/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { test } from '../playwright-test/stable-test-runner';
import { expect as expectUnderTest, asymmetricMatchers } from '../../packages/playwright/bundles/expect/src/expectBundleImpl';

const {
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
} = asymmetricMatchers;

test('Any.asymmetricMatch()', () => {
  class Thing {}

  [
    any(String).asymmetricMatch('jest'),
    any(Number).asymmetricMatch(1),
    any(Function).asymmetricMatch(() => {}),
    any(Boolean).asymmetricMatch(true),
    any(BigInt).asymmetricMatch(1n),
    any(Symbol).asymmetricMatch(Symbol()),
    any(Object).asymmetricMatch({}),
    any(Object).asymmetricMatch(null),
    any(Array).asymmetricMatch([]),
    any(Thing).asymmetricMatch(new Thing()),
  ].forEach(test => {
    expectUnderTest(test).toBe(true);
  });
});

test('Any.asymmetricMatch() on primitive wrapper classes', () => {
  [

    any(String).asymmetricMatch(new String('jest')),

    any(Number).asymmetricMatch(new Number(1)),

    any(Function).asymmetricMatch(new Function('() => {}')),

    any(Boolean).asymmetricMatch(new Boolean(true)),
    any(BigInt).asymmetricMatch(Object(1n)),
    any(Symbol).asymmetricMatch(Object(Symbol())),
  ].forEach(test => {
    expectUnderTest(test).toBe(true);
  });
});

test('Any.toAsymmetricMatcher()', () => {
  expectUnderTest(any(Number).toAsymmetricMatcher()).toBe('Any<Number>');
});

test('Any.toAsymmetricMatcher() with function name', () => {
  [
    ['someFunc', function someFunc() {}],
    ['$someFunc', function $someFunc() {}],
    [
      '$someFunc2',
      (function() {
        function $someFunc2() {}
        Object.defineProperty($someFunc2, 'name', { value: '' });
        return $someFunc2;
      })(),
    ],
    [
      '$someAsyncFunc',
      (function() {
        async function $someAsyncFunc() {}
        Object.defineProperty($someAsyncFunc, 'name', { value: '' });
        return $someAsyncFunc;
      })(),
    ],
    [
      '$someGeneratorFunc',
      (function() {
        function* $someGeneratorFunc() {}
        Object.defineProperty($someGeneratorFunc, 'name', { value: '' });
        return $someGeneratorFunc;
      })(),
    ],
    [
      '$someFuncWithFakeToString',
      (function() {
        function $someFuncWithFakeToString() {}
        $someFuncWithFakeToString.toString = () => 'Fake to string';
        return $someFuncWithFakeToString;
      })(),
    ],
  ].forEach(([name, fn]) => {
    expectUnderTest(any(fn).toAsymmetricMatcher()).toBe(`Any<${name}>`);
  });
});

test('Any throws when called with empty constructor', () => {
  // @ts-expect-error: Testing runtime error
  expectUnderTest(() => any()).toThrow(
      'any() expects to be passed a constructor function. Please pass one or use anything() to match any object.',
  );
});

test('Anything matches any type', () => {
  [
    anything().asymmetricMatch('jest'),
    anything().asymmetricMatch(1),
    anything().asymmetricMatch(() => {}),
    anything().asymmetricMatch(true),
    anything().asymmetricMatch({}),
    anything().asymmetricMatch([]),
  ].forEach(test => {
    expectUnderTest(test).toBe(true);
  });
});

test('Anything does not match null and undefined', () => {
  [
    anything().asymmetricMatch(null),
    anything().asymmetricMatch(undefined),
  ].forEach(test => {
    expectUnderTest(test).toBe(false);
  });
});

test('Anything.toAsymmetricMatcher()', () => {
  expectUnderTest(anything().toAsymmetricMatcher()).toBe('Anything');
});

test('ArrayContaining matches', () => {
  [
    arrayContaining([]).asymmetricMatch('jest'),
    arrayContaining(['foo']).asymmetricMatch(['foo']),
    arrayContaining(['foo']).asymmetricMatch(['foo', 'bar']),
    arrayContaining([]).asymmetricMatch({}),
  ].forEach(test => {
    expectUnderTest(test).toEqual(true);
  });
});

test('ArrayContaining does not match', () => {
  expectUnderTest(arrayContaining(['foo']).asymmetricMatch(['bar'])).toBe(false);
});

test('ArrayContaining throws for non-arrays', () => {
  expectUnderTest(() => {
    // @ts-expect-error: Testing runtime error
    arrayContaining('foo').asymmetricMatch([]);
  }).toThrow("You must provide an array to ArrayContaining, not 'string'.");
});

test('ArrayNotContaining matches', () => {
  expectUnderTest(arrayNotContaining(['foo']).asymmetricMatch(['bar'])).toBe(true);
});

test('ArrayNotContaining does not match', () => {
  [
    arrayNotContaining([]).asymmetricMatch('jest'),
    arrayNotContaining(['foo']).asymmetricMatch(['foo']),
    arrayNotContaining(['foo']).asymmetricMatch(['foo', 'bar']),
    arrayNotContaining([]).asymmetricMatch({}),
  ].forEach(test => {
    expectUnderTest(test).toEqual(false);
  });
});

test('ArrayNotContaining throws for non-arrays', () => {
  expectUnderTest(() => {
    // @ts-expect-error: Testing runtime error
    arrayNotContaining('foo').asymmetricMatch([]);
  }).toThrow("You must provide an array to ArrayNotContaining, not 'string'.");
});

test('ObjectContaining matches', () => {
  const foo = Symbol('foo');
  [
    objectContaining({}).asymmetricMatch('jest'),
    objectContaining({ foo: 'foo' }).asymmetricMatch({ foo: 'foo', jest: 'jest' }),
    objectContaining({ foo: undefined }).asymmetricMatch({ foo: undefined }),
    objectContaining({ first: objectContaining({ second: {} }) }).asymmetricMatch({
      first: { second: {} },
    }),
    objectContaining({ foo: Buffer.from('foo') }).asymmetricMatch({
      foo: Buffer.from('foo'),
      jest: 'jest',
    }),
    objectContaining({ [foo]: 'foo' }).asymmetricMatch({ [foo]: 'foo' }),
  ].forEach(test => {
    expectUnderTest(test).toEqual(true);
  });
});

test('ObjectContaining does not match', () => {
  const foo = Symbol('foo');
  const bar = Symbol('bar');
  [
    objectContaining({ foo: 'foo' }).asymmetricMatch({ bar: 'bar' }),
    objectContaining({ foo: 'foo' }).asymmetricMatch({ foo: 'foox' }),
    objectContaining({ foo: undefined }).asymmetricMatch({}),
    objectContaining({
      answer: 42,
      foo: { bar: 'baz', foobar: 'qux' },
    }).asymmetricMatch({ foo: { bar: 'baz' } }),
    objectContaining({ [foo]: 'foo' }).asymmetricMatch({ [bar]: 'bar' }),
  ].forEach(test => {
    expectUnderTest(test).toEqual(false);
  });
});

test('ObjectContaining matches defined properties', () => {
  const definedPropertyObject = {};
  Object.defineProperty(definedPropertyObject, 'foo', { get: () => 'bar' });
  expectUnderTest(
      objectContaining({ foo: 'bar' }).asymmetricMatch(definedPropertyObject),
  ).toBe(true);
});

test('ObjectContaining matches prototype properties', () => {
  const prototypeObject = { foo: 'bar' };
  let obj;

  if (Object.create) {
    obj = Object.create(prototypeObject);
  } else {
    function Foo() {}
    Foo.prototype = prototypeObject;
    Foo.prototype.constructor = Foo;
    obj = new (Foo as any)();
  }
  expectUnderTest(objectContaining({ foo: 'bar' }).asymmetricMatch(obj)).toBe(true);
});

test('ObjectContaining throws for non-objects', () => {
  // @ts-expect-error: Testing runtime error
  expectUnderTest(() => objectContaining(1337).asymmetricMatch()).toThrow(
      "You must provide an object to ObjectContaining, not 'number'.",
  );
});

test('ObjectContaining does not mutate the sample', () => {
  const sample = { foo: { bar: {} } };
  const sample_json = JSON.stringify(sample);
  expectUnderTest({ foo: { bar: {} } }).toEqual(expectUnderTest.objectContaining(sample));

  expectUnderTest(JSON.stringify(sample)).toEqual(sample_json);
});

test('ObjectNotContaining matches', () => {
  const foo = Symbol('foo');
  const bar = Symbol('bar');
  [
    objectContaining({}).asymmetricMatch(null),
    objectContaining({}).asymmetricMatch(undefined),
    objectNotContaining({ [foo]: 'foo' }).asymmetricMatch({ [bar]: 'bar' }),
    objectNotContaining({ foo: 'foo' }).asymmetricMatch({ bar: 'bar' }),
    objectNotContaining({ foo: 'foo' }).asymmetricMatch({ foo: 'foox' }),
    objectNotContaining({ foo: undefined }).asymmetricMatch({}),
    objectNotContaining({
      first: objectNotContaining({ second: {} }),
    }).asymmetricMatch({ first: { second: {} } }),
    objectNotContaining({ first: { second: {}, third: {} } }).asymmetricMatch({
      first: { second: {} },
    }),
    objectNotContaining({ first: { second: {} } }).asymmetricMatch({
      first: { second: {}, third: {} },
    }),
    objectNotContaining({ foo: 'foo', jest: 'jest' }).asymmetricMatch({
      foo: 'foo',
    }),
  ].forEach(test => {
    expectUnderTest(test).toEqual(true);
  });
});

test('ObjectNotContaining does not match', () => {
  [
    objectNotContaining({}).asymmetricMatch('jest'),
    objectNotContaining({ foo: 'foo' }).asymmetricMatch({
      foo: 'foo',
      jest: 'jest',
    }),
    objectNotContaining({ foo: undefined }).asymmetricMatch({ foo: undefined }),
    objectNotContaining({ first: { second: {} } }).asymmetricMatch({
      first: { second: {} },
    }),
    objectNotContaining({
      first: objectContaining({ second: {} }),
    }).asymmetricMatch({ first: { second: {} } }),
    objectNotContaining({}).asymmetricMatch(null),
    objectNotContaining({}).asymmetricMatch(undefined),
    objectNotContaining({}).asymmetricMatch({}),
  ].forEach(test => {
    expectUnderTest(test).toEqual(false);
  });
});

test('ObjectNotContaining inverts ObjectContaining', () => {
  (
    [
      [{}, null],
      [{ foo: 'foo' }, { foo: 'foo', jest: 'jest' }],
      [{ foo: 'foo', jest: 'jest' }, { foo: 'foo' }],
      [{ foo: undefined }, { foo: undefined }],
      [{ foo: undefined }, {}],
      [{ first: { second: {} } }, { first: { second: {} } }],
      [{ first: objectContaining({ second: {} }) }, { first: { second: {} } }],
      [{ first: objectNotContaining({ second: {} }) }, { first: { second: {} } }],
      [{}, { foo: undefined }],
    ] as const
  ).forEach(([sample, received]) => {
    expectUnderTest(objectNotContaining(sample).asymmetricMatch(received)).toEqual(
        !objectContaining(sample).asymmetricMatch(received),
    );
  });
});

test('ObjectNotContaining throws for non-objects', () => {
  expectUnderTest(() => {
    // @ts-expect-error: Testing runtime error
    objectNotContaining(1337).asymmetricMatch();
  }).toThrow(
      "You must provide an object to ObjectNotContaining, not 'number'.",
  );
});

test('StringContaining matches string against string', () => {
  expectUnderTest(stringContaining('en*').asymmetricMatch('queen*')).toBe(true);
  expectUnderTest(stringContaining('en').asymmetricMatch('queue')).toBe(false);
});

test('StringContaining throws if expected value is not string', () => {
  expectUnderTest(() => {
    // @ts-expect-error: Testing runtime error
    stringContaining([1]).asymmetricMatch('queen');
  }).toThrow('Expected is not a string');
});

test('StringContaining returns false if received value is not string', () => {
  expectUnderTest(stringContaining('en*').asymmetricMatch(1)).toBe(false);
});

test('StringNotContaining matches string against string', () => {
  expectUnderTest(stringNotContaining('en*').asymmetricMatch('queen*')).toBe(false);
  expectUnderTest(stringNotContaining('en').asymmetricMatch('queue')).toBe(true);
});

test('StringNotContaining throws if expected value is not string', () => {
  expectUnderTest(() => {
    // @ts-expect-error: Testing runtime error
    stringNotContaining([1]).asymmetricMatch('queen');
  }).toThrow('Expected is not a string');
});

test('StringNotContaining returns true if received value is not string', () => {
  expectUnderTest(stringNotContaining('en*').asymmetricMatch(1)).toBe(true);
});

test('StringMatching matches string against regexp', () => {
  expectUnderTest(stringMatching(/en/).asymmetricMatch('queen')).toBe(true);
  expectUnderTest(stringMatching(/en/).asymmetricMatch('queue')).toBe(false);
});

test('StringMatching matches string against string', () => {
  expectUnderTest(stringMatching('en').asymmetricMatch('queen')).toBe(true);
  expectUnderTest(stringMatching('en').asymmetricMatch('queue')).toBe(false);
});

test('StringMatching throws if expected value is neither string nor regexp', () => {
  expectUnderTest(() => {
    // @ts-expect-error: Testing runtime error
    stringMatching([1]).asymmetricMatch('queen');
  }).toThrow('Expected is not a String or a RegExp');
});

test('StringMatching returns false if received value is not string', () => {
  expectUnderTest(stringMatching('en').asymmetricMatch(1)).toBe(false);
});

test('StringMatching returns false even if coerced non-string received value matches pattern', () => {
  expectUnderTest(stringMatching('null').asymmetricMatch(null)).toBe(false);
});

test('StringNotMatching matches string against regexp', () => {
  expectUnderTest(stringNotMatching(/en/).asymmetricMatch('queen')).toBe(false);
  expectUnderTest(stringNotMatching(/en/).asymmetricMatch('queue')).toBe(true);
});

test('StringNotMatching matches string against string', () => {
  expectUnderTest(stringNotMatching('en').asymmetricMatch('queen')).toBe(false);
  expectUnderTest(stringNotMatching('en').asymmetricMatch('queue')).toBe(true);
});

test('StringNotMatching throws if expected value is neither string nor regexp', () => {
  expectUnderTest(() => {
    // @ts-expect-error: Testing runtime error
    stringNotMatching([1]).asymmetricMatch('queen');
  }).toThrow('Expected is not a String or a RegExp');
});

test('StringNotMatching returns true if received value is not string', () => {
  expectUnderTest(stringNotMatching('en').asymmetricMatch(1)).toBe(true);
});

test.describe('closeTo', () => {
  [
    [0, 0],
    [0, 0.001],
    [1.23, 1.229],
    [1.23, 1.226],
    [1.23, 1.225],
    [1.23, 1.234],
    [Infinity, Infinity],
    [-Infinity, -Infinity],
  ].forEach(([expected, received]) => {
    test(`${expected} closeTo ${received} return true`, () => {
      expectUnderTest(closeTo(expected).asymmetricMatch(received)).toBe(true);
    });
    test(`${expected} notCloseTo ${received} return false`, () => {
      expectUnderTest(notCloseTo(expected).asymmetricMatch(received)).toBe(false);
    });
  });

  [
    [0, 0.01],
    [1, 1.23],
    [1.23, 1.2249999],
    [Infinity, -Infinity],
    [Infinity, 1.23],
    [-Infinity, -1.23],
  ].forEach(([expected, received]) => {
    test(`${expected} closeTo ${received} return false`, () => {
      expectUnderTest(closeTo(expected).asymmetricMatch(received)).toBe(false);
    });
    test(`${expected} notCloseTo ${received} return true`, () => {
      expectUnderTest(notCloseTo(expected).asymmetricMatch(received)).toBe(true);
    });
  });

  [
    [0, 0.1, 0],
    [0, 0.0001, 3],
    [0, 0.000004, 5],
    [2.0000002, 2, 5],
  ].forEach(([expected, received, precision]) => {
    test(`${expected} closeTo ${received} with precision ${precision} return true`, () => {
      expectUnderTest(closeTo(expected, precision).asymmetricMatch(received)).toBe(
          true,
      );
    });
    test(`${expected} notCloseTo ${received} with precision ${precision} return false`, () => {
      expectUnderTest(
          notCloseTo(expected, precision).asymmetricMatch(received),
      ).toBe(false);
    });
  });

  [
    [3.141592e-7, 3e-7, 8],
    [56789, 51234, -4],
  ].forEach(([expected, received, precision]) => {
    test(`${expected} closeTo ${received} with precision ${precision} return false`, () => {
      expectUnderTest(closeTo(expected, precision).asymmetricMatch(received)).toBe(
          false,
      );
    });
    test(`${expected} notCloseTo ${received} with precision ${precision} return true`, () => {
      expectUnderTest(
          notCloseTo(expected, precision).asymmetricMatch(received),
      ).toBe(true);
    });
  });

  test('closeTo throw if expected is not number', () => {
    expectUnderTest(() => {
      // @ts-expect-error: Testing runtime error
      closeTo('a');
    }).toThrow('Expected is not a Number');
  });

  test('notCloseTo throw if expected is not number', () => {
    expectUnderTest(() => {
      // @ts-expect-error: Testing runtime error
      notCloseTo('a');
    }).toThrow('Expected is not a Number');
  });

  test('closeTo throw if precision is not number', () => {
    expectUnderTest(() => {
      // @ts-expect-error: Testing runtime error
      closeTo(1, 'a');
    }).toThrow('Precision is not a Number');
  });

  test('notCloseTo throw if precision is not number', () => {
    expectUnderTest(() => {
      // @ts-expect-error: Testing runtime error
      notCloseTo(1, 'a');
    }).toThrow('Precision is not a Number');
  });

  test('closeTo return false if received is not number', () => {
    expectUnderTest(closeTo(1).asymmetricMatch('a')).toBe(false);
  });

  test('notCloseTo return false if received is not number', () => {
    expectUnderTest(notCloseTo(1).asymmetricMatch('a')).toBe(false);
  });
});
