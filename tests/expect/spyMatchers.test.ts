/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { test, expect } from './fixtures';
import { expect as expectUnderTest, mock } from '../../packages/playwright/bundles/expect/src/expectBundleImpl';
import Immutable from 'immutable';

const expectUnderTestAsAny = expectUnderTest as any;

expectUnderTest.extend({
  optionalFn(fn?: unknown) {
    const pass = fn === undefined || typeof fn === 'function';
    return { message: () => 'expect either a function or undefined', pass };
  },
});


// Given a Jest mock function, return a minimal mock of a spy.
const createSpy = (fn: mock.Mock) => {
  const spy = function() { };

  spy.calls = {
    all() {
      return fn.mock.calls.map(args => ({ args }));
    },
    count() {
      return fn.mock.calls.length;
    },
  };

  return spy;
};

for (const called of ['toBeCalled', 'toHaveBeenCalled']) {
  test.describe(called, () => {
    test('works only on spies or mock.fn', () => {
      const fn = function fn() { };

      expect(() => expectUnderTest(fn)[called]()).toThrowErrorMatchingSnapshot();
    });

    test('passes when called', () => {
      const fn = mock.fn();
      fn('arg0', 'arg1', 'arg2');
      expectUnderTest(createSpy(fn))[called]();
      expectUnderTest(fn)[called]();
      expect(() => expectUnderTest(fn).not[called]()).toThrowErrorMatchingSnapshot();
    });

    test('.not passes when called', () => {
      const fn = mock.fn();
      const spy = createSpy(fn);

      expectUnderTest(spy).not[called]();
      expectUnderTest(fn).not[called]();
      expect(() => expectUnderTest(spy)[called]()).toThrowErrorMatchingSnapshot();
    });

    test('fails with any argument passed', () => {
      const fn = mock.fn();

      fn();
      expect(() => expectUnderTest(fn)[called](555)).toThrowErrorMatchingSnapshot();
    });

    test('.not fails with any argument passed', () => {
      const fn = mock.fn();

      expect(() =>
        expectUnderTest(fn).not[called](555),
      ).toThrowErrorMatchingSnapshot();
    });

    test('includes the custom mock name in the error message', () => {
      const fn = mock.fn().mockName('named-mock');

      fn();
      expectUnderTest(fn)[called]();
      expect(() => expectUnderTest(fn).not[called]()).toThrowErrorMatchingSnapshot();
    });
  });
}

for (const calledTimes of ['toBeCalledTimes', 'toHaveBeenCalledTimes']) {
  test.describe(calledTimes, () => {
    test('.not works only on spies or mock.fn', () => {
      const fn = function fn() { };

      expect(() =>
        expectUnderTest(fn).not[calledTimes](2),
      ).toThrowErrorMatchingSnapshot();
    });

    test('only accepts a number argument', () => {
      const fn = mock.fn();
      fn();
      expectUnderTest(fn)[calledTimes](1);

      [{}, [], true, 'a', new Map(), () => { }].forEach(value => {
        expect(() =>
          expectUnderTest(fn)[calledTimes](value),
        ).toThrowErrorMatchingSnapshot();
      });
    });

    test('.not only accepts a number argument', () => {
      const fn = mock.fn();
      expectUnderTest(fn).not[calledTimes](1);

      [{}, [], true, 'a', new Map(), () => { }].forEach(value => {
        expect(() =>
          expectUnderTest(fn).not[calledTimes](value),
        ).toThrowErrorMatchingSnapshot();
      });
    });

    test('passes if function called equal to expected times', () => {
      const fn = mock.fn();
      fn();
      fn();

      const spy = createSpy(fn);
      expectUnderTest(spy)[calledTimes](2);
      expectUnderTest(fn)[calledTimes](2);

      expect(() =>
        expectUnderTest(spy).not[calledTimes](2),
      ).toThrowErrorMatchingSnapshot();
    });

    test('.not passes if function called more than expected times', () => {
      const fn = mock.fn();
      fn();
      fn();
      fn();

      const spy = createSpy(fn);
      expectUnderTest(spy)[calledTimes](3);
      expectUnderTest(spy).not[calledTimes](2);

      expectUnderTest(fn)[calledTimes](3);
      expectUnderTest(fn).not[calledTimes](2);

      expect(() =>
        expectUnderTest(fn)[calledTimes](2),
      ).toThrowErrorMatchingSnapshot();
    });

    test('.not passes if function called less than expected times', () => {
      const fn = mock.fn();
      fn();

      const spy = createSpy(fn);
      expectUnderTest(spy)[calledTimes](1);
      expectUnderTest(spy).not[calledTimes](2);

      expectUnderTest(fn)[calledTimes](1);
      expectUnderTest(fn).not[calledTimes](2);

      expect(() =>
        expectUnderTest(fn)[calledTimes](2),
      ).toThrowErrorMatchingSnapshot();
    });

    test('includes the custom mock name in the error message', () => {
      const fn = mock.fn().mockName('named-mock');
      fn();

      expect(() =>
        expectUnderTest(fn)[calledTimes](2),
      ).toThrowErrorMatchingSnapshot();
    });
  });
}

for (const calledWith of [
  'lastCalledWith',
  'toHaveBeenLastCalledWith',
  'nthCalledWith',
  'toHaveBeenNthCalledWith',
  'toBeCalledWith',
  'toHaveBeenCalledWith',
]) {
  test.describe(calledWith, () => {
    function isToHaveNth(
      calledWith: string,
    ): calledWith is 'nthCalledWith' | 'toHaveBeenNthCalledWith' {
      return (
        calledWith === 'nthCalledWith' || calledWith === 'toHaveBeenNthCalledWith'
      );
    }

    test('works only on spies or mock.fn', () => {
      const fn = function fn() { };

      if (isToHaveNth(calledWith)) {
        expect(() =>
          expectUnderTest(fn)[calledWith](3),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expect(() => expectUnderTest(fn)[calledWith]()).toThrowErrorMatchingSnapshot();
      }
    });

    test('works when not called', () => {
      const fn = mock.fn();

      if (isToHaveNth(calledWith)) {
        expectUnderTest(createSpy(fn)).not[calledWith](1, 'foo', 'bar');
        expectUnderTest(fn).not[calledWith](1, 'foo', 'bar');

        expect(() =>
          expectUnderTest(fn)[calledWith](1, 'foo', 'bar'),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(createSpy(fn)).not[calledWith]('foo', 'bar');
        expectUnderTest(fn).not[calledWith]('foo', 'bar');

        expect(() =>
          expectUnderTest(fn)[calledWith]('foo', 'bar'),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('works with no arguments', () => {
      const fn = mock.fn();
      fn();

      if (isToHaveNth(calledWith)) {
        expectUnderTest(createSpy(fn))[calledWith](1);
        expectUnderTest(fn)[calledWith](1);
      } else {
        expectUnderTest(createSpy(fn))[calledWith]();
        expectUnderTest(fn)[calledWith]();
      }
    });

    test("works with arguments that don't match", () => {
      const fn = mock.fn();
      fn('foo', 'bar1');

      if (isToHaveNth(calledWith)) {
        expectUnderTest(createSpy(fn)).not[calledWith](1, 'foo', 'bar');
        expectUnderTest(fn).not[calledWith](1, 'foo', 'bar');

        expect(() =>
          expectUnderTest(fn)[calledWith](1, 'foo', 'bar'),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(createSpy(fn)).not[calledWith]('foo', 'bar');
        expectUnderTest(fn).not[calledWith]('foo', 'bar');

        expect(() =>
          expectUnderTest(fn)[calledWith]('foo', 'bar'),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test("works with arguments that don't match in number of arguments", () => {
      const fn = mock.fn();
      fn('foo', 'bar', 'plop');

      if (isToHaveNth(calledWith)) {
        expectUnderTest(createSpy(fn)).not[calledWith](1, 'foo', 'bar');
        expectUnderTest(fn).not[calledWith](1, 'foo', 'bar');

        expect(() =>
          expectUnderTest(fn)[calledWith](1, 'foo', 'bar'),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(createSpy(fn)).not[calledWith]('foo', 'bar');
        expectUnderTest(fn).not[calledWith]('foo', 'bar');

        expect(() =>
          expectUnderTest(fn)[calledWith]('foo', 'bar'),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test("works with arguments that don't match with matchers", () => {
      const fn = mock.fn();
      fn('foo', 'bar');

      if (isToHaveNth(calledWith)) {
        expectUnderTest(createSpy(fn)).not[calledWith](
            1,
            expectUnderTest.any(String),
            expectUnderTest.any(Number),
        );
        expectUnderTest(fn).not[calledWith](
            1,
            expectUnderTest.any(String),
            expectUnderTest.any(Number),
        );

        expect(() =>
          expectUnderTest(fn)[calledWith](
              1,
              expectUnderTest.any(String),
              expectUnderTest.any(Number),
          ),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(createSpy(fn)).not[calledWith](
            expectUnderTest.any(String),
            expectUnderTest.any(Number),
        );
        expectUnderTest(fn).not[calledWith](
            expectUnderTest.any(String),
            expectUnderTest.any(Number),
        );

        expect(() =>
          expectUnderTest(fn)[calledWith](
              expectUnderTest.any(String),
              expectUnderTest.any(Number),
          ),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test("works with arguments that don't match with matchers even when argument is undefined", () => {
      const fn = mock.fn();
      fn('foo', undefined);

      if (isToHaveNth(calledWith)) {
        expectUnderTest(createSpy(fn)).not[calledWith](
            1,
            'foo',
            expectUnderTest.any(String),
        );
        expectUnderTest(fn).not[calledWith](1, 'foo', expectUnderTest.any(String));

        expect(() =>
          expectUnderTest(fn)[calledWith](1, 'foo', expectUnderTest.any(String)),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(createSpy(fn)).not[calledWith]('foo', expectUnderTest.any(String));
        expectUnderTest(fn).not[calledWith]('foo', expectUnderTest.any(String));

        expect(() =>
          expectUnderTest(fn)[calledWith]('foo', expectUnderTest.any(String)),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test("works with arguments that don't match in size even if one is an optional matcher", () => {
      // issue 12463
      const fn = mock.fn();
      fn('foo');

      if (isToHaveNth(calledWith)) {
        expectUnderTest(fn).not[calledWith](1, 'foo', expectUnderTestAsAny.optionalFn());
        expect(() =>
          expectUnderTest(fn)[calledWith](1, 'foo', expectUnderTestAsAny.optionalFn()),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(fn).not[calledWith]('foo', expectUnderTestAsAny.optionalFn());
        expect(() =>
          expectUnderTest(fn)[calledWith]('foo', expectUnderTestAsAny.optionalFn()),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('works with arguments that match', () => {
      const fn = mock.fn();
      fn('foo', 'bar');

      if (isToHaveNth(calledWith)) {
        expectUnderTest(createSpy(fn))[calledWith](1, 'foo', 'bar');
        expectUnderTest(fn)[calledWith](1, 'foo', 'bar');

        expect(() =>
          expectUnderTest(fn).not[calledWith](1, 'foo', 'bar'),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(createSpy(fn))[calledWith]('foo', 'bar');
        expectUnderTest(fn)[calledWith]('foo', 'bar');

        expect(() =>
          expectUnderTest(fn).not[calledWith]('foo', 'bar'),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('works with arguments that match with matchers', () => {
      const fn = mock.fn();
      fn('foo', 'bar');

      if (isToHaveNth(calledWith)) {
        expectUnderTest(createSpy(fn))[calledWith](
            1,
            expectUnderTest.any(String),
            expectUnderTest.any(String),
        );
        expectUnderTest(fn)[calledWith](
            1,
            expectUnderTest.any(String),
            expectUnderTest.any(String),
        );

        expect(() =>
          expectUnderTest(fn).not[calledWith](
              1,
              expectUnderTest.any(String),
              expectUnderTest.any(String),
          ),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(createSpy(fn))[calledWith](
            expectUnderTest.any(String),
            expectUnderTest.any(String),
        );
        expectUnderTest(fn)[calledWith](
            expectUnderTest.any(String),
            expectUnderTest.any(String),
        );

        expect(() =>
          expectUnderTest(fn).not[calledWith](
              expectUnderTest.any(String),
              expectUnderTest.any(String),
          ),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('works with trailing undefined arguments', () => {
      const fn = mock.fn();
      fn('foo', undefined);

      if (isToHaveNth(calledWith)) {
        expect(() =>
          expectUnderTest(fn)[calledWith](1, 'foo'),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expect(() =>
          expectUnderTest(fn)[calledWith]('foo'),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('works with trailing undefined arguments if requested by the match query', () => {
      const fn = mock.fn();
      fn('foo', undefined);

      if (isToHaveNth(calledWith)) {
        expectUnderTest(fn)[calledWith](1, 'foo', undefined);
        expect(() =>
          expectUnderTest(fn).not[calledWith](1, 'foo', undefined),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(fn)[calledWith]('foo', undefined);
        expect(() =>
          expectUnderTest(fn).not[calledWith]('foo', undefined),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('works with trailing undefined arguments when explicitly requested as optional by matcher', () => {
      // issue 12463
      const fn = mock.fn();
      fn('foo', undefined);

      if (isToHaveNth(calledWith)) {
        expectUnderTest(fn)[calledWith](1, 'foo', expectUnderTestAsAny.optionalFn());
        expect(() =>
          expectUnderTest(fn).not[calledWith](1, 'foo', expectUnderTestAsAny.optionalFn()),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(fn)[calledWith]('foo', expectUnderTestAsAny.optionalFn());
        expect(() =>
          expectUnderTest(fn).not[calledWith]('foo', expectUnderTestAsAny.optionalFn()),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('works with Map', () => {
      const fn = mock.fn();

      const m1 = new Map([
        [1, 2],
        [2, 1],
      ]);
      const m2 = new Map([
        [1, 2],
        [2, 1],
      ]);
      const m3 = new Map([
        ['a', 'b'],
        ['b', 'a'],
      ]);

      fn(m1);

      if (isToHaveNth(calledWith)) {
        expectUnderTest(fn)[calledWith](1, m2);
        expectUnderTest(fn).not[calledWith](1, m3);

        expect(() =>
          expectUnderTest(fn).not[calledWith](1, m2),
        ).toThrowErrorMatchingSnapshot();
        expect(() =>
          expectUnderTest(fn)[calledWith](1, m3),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(fn)[calledWith](m2);
        expectUnderTest(fn).not[calledWith](m3);

        expect(() =>
          expectUnderTest(fn).not[calledWith](m2),
        ).toThrowErrorMatchingSnapshot();
        expect(() =>
          expectUnderTest(fn)[calledWith](m3),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('works with Set', () => {
      const fn = mock.fn();

      const s1 = new Set([1, 2]);
      const s2 = new Set([1, 2]);
      const s3 = new Set([3, 4]);

      fn(s1);

      if (isToHaveNth(calledWith)) {
        expectUnderTest(fn)[calledWith](1, s2);
        expectUnderTest(fn).not[calledWith](1, s3);

        expect(() =>
          expectUnderTest(fn).not[calledWith](1, s2),
        ).toThrowErrorMatchingSnapshot();
        expect(() =>
          expectUnderTest(fn)[calledWith](1, s3),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(fn)[calledWith](s2);
        expectUnderTest(fn).not[calledWith](s3);

        expect(() =>
          expectUnderTest(fn).not[calledWith](s2),
        ).toThrowErrorMatchingSnapshot();
        expect(() =>
          expectUnderTest(fn)[calledWith](s3),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('works with Immutable.js objects', () => {
      const fn = mock.fn();
      const directlyCreated = Immutable.Map([['a', { b: 'c' }]]);
      const indirectlyCreated = Immutable.Map().set('a', { b: 'c' });
      fn(directlyCreated, indirectlyCreated);

      if (isToHaveNth(calledWith)) {
        expectUnderTest(fn)[calledWith](1, indirectlyCreated, directlyCreated);

        expect(() =>
          expectUnderTest(fn).not[calledWith](1, indirectlyCreated, directlyCreated),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(fn)[calledWith](indirectlyCreated, directlyCreated);

        expect(() =>
          expectUnderTest(fn).not[calledWith](indirectlyCreated, directlyCreated),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    if (!isToHaveNth(calledWith)) {
      test('works with many arguments', () => {
        const fn = mock.fn();
        fn('foo1', 'bar');
        fn('foo', 'bar1');
        fn('foo', 'bar');

        expectUnderTest(fn)[calledWith]('foo', 'bar');

        expect(() =>
          expectUnderTest(fn).not[calledWith]('foo', 'bar'),
        ).toThrowErrorMatchingSnapshot();
      });

      test("works with many arguments that don't match", () => {
        const fn = mock.fn();
        fn('foo', 'bar1');
        fn('foo', 'bar2');
        fn('foo', 'bar3');

        expectUnderTest(fn).not[calledWith]('foo', 'bar');

        expect(() =>
          expectUnderTest(fn)[calledWith]('foo', 'bar'),
        ).toThrowErrorMatchingSnapshot();
      });
    }

    if (isToHaveNth(calledWith)) {
      test('works with three calls', () => {
        const fn = mock.fn();
        fn('foo1', 'bar');
        fn('foo', 'bar1');
        fn('foo', 'bar');

        expectUnderTest(fn)[calledWith](1, 'foo1', 'bar');
        expectUnderTest(fn)[calledWith](2, 'foo', 'bar1');
        expectUnderTest(fn)[calledWith](3, 'foo', 'bar');

        expect(() => {
          expectUnderTest(fn).not[calledWith](1, 'foo1', 'bar');
        }).toThrowErrorMatchingSnapshot();
      });

      test('positive throw matcher error for n that is not positive integer', async () => {
        const fn = mock.fn();
        fn('foo1', 'bar');

        expect(() => {
          expectUnderTest(fn)[calledWith](0, 'foo1', 'bar');
        }).toThrowErrorMatchingSnapshot();
      });

      test('positive throw matcher error for n that is not integer', async () => {
        const fn = mock.fn();
        fn('foo1', 'bar');

        expect(() => {
          expectUnderTest(fn)[calledWith](0.1, 'foo1', 'bar');
        }).toThrowErrorMatchingSnapshot();
      });

      test('negative throw matcher error for n that is not integer', async () => {
        const fn = mock.fn();
        fn('foo1', 'bar');

        expect(() => {
          expectUnderTest(fn).not[calledWith](Infinity, 'foo1', 'bar');
        }).toThrowErrorMatchingSnapshot();
      });
    }

    test('includes the custom mock name in the error message', () => {
      const fn = mock.fn().mockName('named-mock');
      fn('foo', 'bar');

      if (isToHaveNth(calledWith)) {
        expectUnderTest(fn)[calledWith](1, 'foo', 'bar');

        expect(() =>
          expectUnderTest(fn).not[calledWith](1, 'foo', 'bar'),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(fn)[calledWith]('foo', 'bar');

        expect(() =>
          expectUnderTest(fn).not[calledWith]('foo', 'bar'),
        ).toThrowErrorMatchingSnapshot();
      }
    });
  });
}

for (const returned of ['toReturn', 'toHaveReturned']) {
  test.describe(returned, () => {
    test('.not works only on mock.fn', () => {
      const fn = function fn() { };

      expect(() => expectUnderTest(fn).not[returned]()).toThrowErrorMatchingSnapshot();
    });

    test('throw matcher error if received is spy', () => {
      const spy = createSpy(mock.fn());

      expect(() => expectUnderTest(spy)[returned]()).toThrowErrorMatchingSnapshot();
    });

    test('passes when returned', () => {
      const fn = mock.fn(() => 42);
      fn();
      expectUnderTest(fn)[returned]();
      expect(() => expectUnderTest(fn).not[returned]()).toThrowErrorMatchingSnapshot();
    });

    test('passes when undefined is returned', () => {
      const fn = mock.fn(() => undefined);
      fn();
      expectUnderTest(fn)[returned]();
      expect(() => expectUnderTest(fn).not[returned]()).toThrowErrorMatchingSnapshot();
    });

    test('passes when at least one call does not throw', () => {
      const fn = mock.fn((causeError: boolean) => {
        if (causeError)
          throw new Error('Error!');


        return 42;
      });

      fn(false);

      try {
        fn(true);
      } catch {
        // ignore error
      }

      fn(false);

      expectUnderTest(fn)[returned]();
      expect(() => expectUnderTest(fn).not[returned]()).toThrowErrorMatchingSnapshot();
    });

    test('.not passes when not returned', () => {
      const fn = mock.fn();

      expectUnderTest(fn).not[returned]();
      expect(() => expectUnderTest(fn)[returned]()).toThrowErrorMatchingSnapshot();
    });

    test('.not passes when all calls throw', () => {
      const fn = mock.fn(() => {
        throw new Error('Error!');
      });

      try {
        fn();
      } catch {
        // ignore error
      }

      try {
        fn();
      } catch {
        // ignore error
      }

      expectUnderTest(fn).not[returned]();
      expect(() => expectUnderTest(fn)[returned]()).toThrowErrorMatchingSnapshot();
    });

    test('.not passes when a call throws undefined', () => {
      const fn = mock.fn(() => {

        throw undefined;
      });

      try {
        fn();
      } catch {
        // ignore error
      }

      expectUnderTest(fn).not[returned]();
      expect(() => expectUnderTest(fn)[returned]()).toThrowErrorMatchingSnapshot();
    });

    test('fails with any argument passed', () => {
      const fn = mock.fn();

      fn();
      expect(() => expectUnderTest(fn)[returned](555)).toThrowErrorMatchingSnapshot();
    });

    test('.not fails with any argument passed', () => {
      const fn = mock.fn();

      expect(() =>
        expectUnderTest(fn).not[returned](555),
      ).toThrowErrorMatchingSnapshot();
    });

    test('includes the custom mock name in the error message', () => {
      const fn = mock.fn(() => 42).mockName('named-mock');
      fn();
      expectUnderTest(fn)[returned]();
      expect(() => expectUnderTest(fn).not[returned]()).toThrowErrorMatchingSnapshot();
    });

    test('incomplete recursive calls are handled properly', () => {
      // sums up all integers from 0 -> value, using recursion
      const fn: mock.Mock<(value: number) => number> = mock.fn(value => {
        if (value === 0) {
          // Before returning from the base case of recursion, none of the
          // calls have returned yet.
          expectUnderTest(fn).not[returned]();
          expect(() => expectUnderTest(fn)[returned]()).toThrowErrorMatchingSnapshot();
          return 0;
        } else {
          return value + fn(value - 1);
        }
      });

      fn(3);
    });
  });
}

for (const returnedTimes of ['toReturnTimes', 'toHaveReturnedTimes']) {
  test.describe(returnedTimes, () => {
    test('throw matcher error if received is spy', () => {
      const spy = createSpy(mock.fn());

      expect(() =>
        expectUnderTest(spy).not[returnedTimes](2),
      ).toThrowErrorMatchingSnapshot();
    });

    test('only accepts a number argument', () => {
      const fn = mock.fn(() => 42);
      fn();
      expectUnderTest(fn)[returnedTimes](1);

      [{}, [], true, 'a', new Map(), () => { }].forEach(value => {
        expect(() =>
          expectUnderTest(fn)[returnedTimes](value),
        ).toThrowErrorMatchingSnapshot();
      });
    });

    test('.not only accepts a number argument', () => {
      const fn = mock.fn(() => 42);
      expectUnderTest(fn).not[returnedTimes](2);

      [{}, [], true, 'a', new Map(), () => { }].forEach(value => {
        expect(() =>
          expectUnderTest(fn).not[returnedTimes](value),
        ).toThrowErrorMatchingSnapshot();
      });
    });

    test('passes if function returned equal to expected times', () => {
      const fn = mock.fn(() => 42);
      fn();
      fn();

      expectUnderTest(fn)[returnedTimes](2);

      expect(() =>
        expectUnderTest(fn).not[returnedTimes](2),
      ).toThrowErrorMatchingSnapshot();
    });

    test('calls that return undefined are counted as returns', () => {
      const fn = mock.fn(() => undefined);
      fn();
      fn();

      expectUnderTest(fn)[returnedTimes](2);

      expect(() =>
        expectUnderTest(fn).not[returnedTimes](2),
      ).toThrowErrorMatchingSnapshot();
    });

    test('.not passes if function returned more than expected times', () => {
      const fn = mock.fn(() => 42);
      fn();
      fn();
      fn();

      expectUnderTest(fn)[returnedTimes](3);
      expectUnderTest(fn).not[returnedTimes](2);

      expect(() =>
        expectUnderTest(fn)[returnedTimes](2),
      ).toThrowErrorMatchingSnapshot();
    });

    test('.not passes if function called less than expected times', () => {
      const fn = mock.fn(() => 42);
      fn();

      expectUnderTest(fn)[returnedTimes](1);
      expectUnderTest(fn).not[returnedTimes](2);

      expect(() =>
        expectUnderTest(fn)[returnedTimes](2),
      ).toThrowErrorMatchingSnapshot();
    });

    test('calls that throw are not counted', () => {
      const fn = mock.fn((causeError: boolean) => {
        if (causeError)
          throw new Error('Error!');


        return 42;
      });

      fn(false);

      try {
        fn(true);
      } catch {
      // ignore error
      }

      fn(false);

      expectUnderTest(fn).not[returnedTimes](3);

      expect(() =>
        expectUnderTest(fn)[returnedTimes](3),
      ).toThrowErrorMatchingSnapshot();
    });

    test('calls that throw undefined are not counted', () => {
      const fn = mock.fn((causeError: boolean) => {
        if (causeError)

          throw undefined;


        return 42;
      });

      fn(false);

      try {
        fn(true);
      } catch {
      // ignore error
      }

      fn(false);

      expectUnderTest(fn)[returnedTimes](2);

      expect(() =>
        expectUnderTest(fn).not[returnedTimes](2),
      ).toThrowErrorMatchingSnapshot();
    });

    test('includes the custom mock name in the error message', () => {
      const fn = mock.fn(() => 42).mockName('named-mock');
      fn();
      fn();

      expectUnderTest(fn)[returnedTimes](2);

      expect(() =>
        expectUnderTest(fn)[returnedTimes](1),
      ).toThrowErrorMatchingSnapshot();
    });

    test('incomplete recursive calls are handled properly', () => {
    // sums up all integers from 0 -> value, using recursion
      const fn: mock.Mock<(value: number) => number> = mock.fn(value => {
        if (value === 0) {
          return 0;
        } else {
          const recursiveResult = fn(value - 1);

          if (value === 2) {
          // Only 2 of the recursive calls have returned at this point
            expectUnderTest(fn)[returnedTimes](2);
            expect(() =>
              expectUnderTest(fn).not[returnedTimes](2),
            ).toThrowErrorMatchingSnapshot();
          }

          return value + recursiveResult;
        }
      });

      fn(3);
    });
  });
}

for (const returnedWith of [
  'lastReturnedWith',
  'toHaveLastReturnedWith',
  'nthReturnedWith',
  'toHaveNthReturnedWith',
  'toReturnWith',
  'toHaveReturnedWith',
]) {
  test.describe(returnedWith, () => {
    function isToHaveNth(
      returnedWith: string,
    ): returnedWith is 'nthReturnedWith' | 'toHaveNthReturnedWith' {
      return (
        returnedWith === 'nthReturnedWith' ||
        returnedWith === 'toHaveNthReturnedWith'
      );
    }

    function isToHaveLast(
      returnedWith: string,
    ): returnedWith is 'lastReturnedWith' | 'toHaveLastReturnedWith' {
      return (
        returnedWith === 'lastReturnedWith' ||
        returnedWith === 'toHaveLastReturnedWith'
      );
    }
    test('works only on spies or mock.fn', () => {
      const fn = function fn() { };

      expect(() => expectUnderTest(fn)[returnedWith]()).toThrowErrorMatchingSnapshot();
    });

    test('works when not called', () => {
      const fn = mock.fn();

      if (isToHaveNth(returnedWith)) {
        expectUnderTest(fn).not[returnedWith](1, 'foo');

        expect(() =>
          expectUnderTest(fn)[returnedWith](1, 'foo'),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(fn).not[returnedWith]('foo');

        expect(() =>
          expectUnderTest(fn)[returnedWith]('foo'),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('works with no arguments', () => {
      const fn = mock.fn();
      fn();

      if (isToHaveNth(returnedWith))
        expectUnderTest(fn)[returnedWith](1);
      else
        expectUnderTest(fn)[returnedWith]();

    });

    test('works with argument that does not match', () => {
      const fn = mock.fn(() => 'foo');
      fn();

      if (isToHaveNth(returnedWith)) {
        expectUnderTest(fn).not[returnedWith](1, 'bar');

        expect(() =>
          expectUnderTest(fn)[returnedWith](1, 'bar'),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(fn).not[returnedWith]('bar');

        expect(() =>
          expectUnderTest(fn)[returnedWith]('bar'),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('works with argument that does match', () => {
      const fn = mock.fn(() => 'foo');
      fn();

      if (isToHaveNth(returnedWith)) {
        expectUnderTest(fn)[returnedWith](1, 'foo');

        expect(() =>
          expectUnderTest(fn).not[returnedWith](1, 'foo'),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(fn)[returnedWith]('foo');

        expect(() =>
          expectUnderTest(fn).not[returnedWith]('foo'),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('works with undefined', () => {
      const fn = mock.fn(() => undefined);
      fn();

      if (isToHaveNth(returnedWith)) {
        expectUnderTest(fn)[returnedWith](1, undefined);

        expect(() =>
          expectUnderTest(fn).not[returnedWith](1, undefined),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(fn)[returnedWith](undefined);

        expect(() =>
          expectUnderTest(fn).not[returnedWith](undefined),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('works with Map', () => {
      const m1 = new Map([
        [1, 2],
        [2, 1],
      ]);
      const m2 = new Map([
        [1, 2],
        [2, 1],
      ]);
      const m3 = new Map([
        ['a', 'b'],
        ['b', 'a'],
      ]);

      const fn = mock.fn(() => m1);
      fn();

      if (isToHaveNth(returnedWith)) {
        expectUnderTest(fn)[returnedWith](1, m2);
        expectUnderTest(fn).not[returnedWith](1, m3);

        expect(() =>
          expectUnderTest(fn).not[returnedWith](1, m2),
        ).toThrowErrorMatchingSnapshot();
        expect(() =>
          expectUnderTest(fn)[returnedWith](1, m3),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(fn)[returnedWith](m2);
        expectUnderTest(fn).not[returnedWith](m3);

        expect(() =>
          expectUnderTest(fn).not[returnedWith](m2),
        ).toThrowErrorMatchingSnapshot();
        expect(() =>
          expectUnderTest(fn)[returnedWith](m3),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('works with Set', () => {
      const s1 = new Set([1, 2]);
      const s2 = new Set([1, 2]);
      const s3 = new Set([3, 4]);

      const fn = mock.fn(() => s1);
      fn();

      if (isToHaveNth(returnedWith)) {
        expectUnderTest(fn)[returnedWith](1, s2);
        expectUnderTest(fn).not[returnedWith](1, s3);

        expect(() =>
          expectUnderTest(fn).not[returnedWith](1, s2),
        ).toThrowErrorMatchingSnapshot();
        expect(() =>
          expectUnderTest(fn)[returnedWith](1, s3),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(fn)[returnedWith](s2);
        expectUnderTest(fn).not[returnedWith](s3);

        expect(() =>
          expectUnderTest(fn).not[returnedWith](s2),
        ).toThrowErrorMatchingSnapshot();
        expect(() =>
          expectUnderTest(fn)[returnedWith](s3),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('works with Immutable.js objects directly created', () => {
      const directlyCreated = Immutable.Map([['a', { b: 'c' }]]);
      const fn = mock.fn(() => directlyCreated);
      fn();

      if (isToHaveNth(returnedWith)) {
        expectUnderTest(fn)[returnedWith](1, directlyCreated);

        expect(() =>
          expectUnderTest(fn).not[returnedWith](1, directlyCreated),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(fn)[returnedWith](directlyCreated);

        expect(() =>
          expectUnderTest(fn).not[returnedWith](directlyCreated),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('works with Immutable.js objects indirectly created', () => {
      const indirectlyCreated = Immutable.Map().set('a', { b: 'c' });
      const fn = mock.fn(() => indirectlyCreated);
      fn();

      if (isToHaveNth(returnedWith)) {
        expectUnderTest(fn)[returnedWith](1, indirectlyCreated);

        expect(() =>
          expectUnderTest(fn).not[returnedWith](1, indirectlyCreated),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(fn)[returnedWith](indirectlyCreated);

        expect(() =>
          expectUnderTest(fn).not[returnedWith](indirectlyCreated),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('a call that throws is not considered to have returned', () => {
      const fn = mock.fn(() => {
        throw new Error('Error!');
      });

      try {
        fn();
      } catch {
        // ignore error
      }

      if (isToHaveNth(returnedWith)) {
        // It doesn't matter what return value is tested if the call threw
        expectUnderTest(fn).not[returnedWith](1, 'foo');
        expectUnderTest(fn).not[returnedWith](1, null);
        expectUnderTest(fn).not[returnedWith](1, undefined);

        expect(() =>
          expectUnderTest(fn)[returnedWith](1, undefined),
        ).toThrowErrorMatchingSnapshot();
      } else {
        // It doesn't matter what return value is tested if the call threw
        expectUnderTest(fn).not[returnedWith]('foo');
        expectUnderTest(fn).not[returnedWith](null);
        expectUnderTest(fn).not[returnedWith](undefined);

        expect(() =>
          expectUnderTest(fn)[returnedWith](undefined),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    test('a call that throws undefined is not considered to have returned', () => {
      const fn = mock.fn(() => {

        throw undefined;
      });

      try {
        fn();
      } catch {
        // ignore error
      }

      if (isToHaveNth(returnedWith)) {
        // It doesn't matter what return value is tested if the call threw
        expectUnderTest(fn).not[returnedWith](1, 'foo');
        expectUnderTest(fn).not[returnedWith](1, null);
        expectUnderTest(fn).not[returnedWith](1, undefined);

        expect(() =>
          expectUnderTest(fn)[returnedWith](1, undefined),
        ).toThrowErrorMatchingSnapshot();
      } else {
        // It doesn't matter what return value is tested if the call threw
        expectUnderTest(fn).not[returnedWith]('foo');
        expectUnderTest(fn).not[returnedWith](null);
        expectUnderTest(fn).not[returnedWith](undefined);

        expect(() =>
          expectUnderTest(fn)[returnedWith](undefined),
        ).toThrowErrorMatchingSnapshot();
      }
    });

    if (!isToHaveNth(returnedWith)) {
      test.describe('returnedWith', () => {
        test('works with more calls than the limit', () => {
          const fn = mock.fn<() => string>();
          fn.mockReturnValueOnce('foo1');
          fn.mockReturnValueOnce('foo2');
          fn.mockReturnValueOnce('foo3');
          fn.mockReturnValueOnce('foo4');
          fn.mockReturnValueOnce('foo5');
          fn.mockReturnValueOnce('foo6');

          fn();
          fn();
          fn();
          fn();
          fn();
          fn();

          expectUnderTest(fn).not[returnedWith]('bar');

          expect(() => {
            expectUnderTest(fn)[returnedWith]('bar');
          }).toThrowErrorMatchingSnapshot();
        });

        test('incomplete recursive calls are handled properly', () => {
          // sums up all integers from 0 -> value, using recursion
          const fn: mock.Mock<(value: number) => number> = mock.fn(value => {
            if (value === 0) {
              // Before returning from the base case of recursion, none of the
              // calls have returned yet.
              // This test ensures that the incomplete calls are not incorrectly
              // interpreted as have returned undefined
              expectUnderTest(fn).not[returnedWith](undefined);
              expect(() =>
                expectUnderTest(fn)[returnedWith](undefined),
              ).toThrowErrorMatchingSnapshot();

              return 0;
            } else {
              return value + fn(value - 1);
            }
          });

          fn(3);
        });
      });
    }

    if (isToHaveNth(returnedWith)) {
      test.describe('nthReturnedWith', () => {
        test('works with three calls', () => {
          const fn = mock.fn<() => string>();
          fn.mockReturnValueOnce('foo1');
          fn.mockReturnValueOnce('foo2');
          fn.mockReturnValueOnce('foo3');
          fn();
          fn();
          fn();

          expectUnderTest(fn)[returnedWith](1, 'foo1');
          expectUnderTest(fn)[returnedWith](2, 'foo2');
          expectUnderTest(fn)[returnedWith](3, 'foo3');

          expect(() => {
            expectUnderTest(fn).not[returnedWith](1, 'foo1');
            expectUnderTest(fn).not[returnedWith](2, 'foo2');
            expectUnderTest(fn).not[returnedWith](3, 'foo3');
          }).toThrowErrorMatchingSnapshot();
        });

        test('should replace 1st, 2nd, 3rd with first, second, third', async () => {
          const fn = mock.fn<() => string>();
          fn.mockReturnValueOnce('foo1');
          fn.mockReturnValueOnce('foo2');
          fn.mockReturnValueOnce('foo3');
          fn();
          fn();
          fn();

          expect(() => {
            expectUnderTest(fn)[returnedWith](1, 'bar1');
            expectUnderTest(fn)[returnedWith](2, 'bar2');
            expectUnderTest(fn)[returnedWith](3, 'bar3');
          }).toThrowErrorMatchingSnapshot();

          expect(() => {
            expectUnderTest(fn).not[returnedWith](1, 'foo1');
            expectUnderTest(fn).not[returnedWith](2, 'foo2');
            expectUnderTest(fn).not[returnedWith](3, 'foo3');
          }).toThrowErrorMatchingSnapshot();
        });

        test('positive throw matcher error for n that is not positive integer', async () => {
          const fn = mock.fn(() => 'foo');
          fn();

          expect(() => {
            expectUnderTest(fn)[returnedWith](0, 'foo');
          }).toThrowErrorMatchingSnapshot();
        });

        test('should reject nth value greater than number of calls', async () => {
          const fn = mock.fn(() => 'foo');
          fn();
          fn();
          fn();

          expect(() => {
            expectUnderTest(fn)[returnedWith](4, 'foo');
          }).toThrowErrorMatchingSnapshot();
        });

        test('positive throw matcher error for n that is not integer', async () => {
          const fn = mock.fn<(a: string) => string>(() => 'foo');
          fn('foo');

          expect(() => {
            expectUnderTest(fn)[returnedWith](0.1, 'foo');
          }).toThrowErrorMatchingSnapshot();
        });

        test('negative throw matcher error for n that is not number', async () => {
          const fn = mock.fn<(a: string) => string>(() => 'foo');
          fn('foo');

          expect(() => {
            // @ts-expect-error: Testing runtime error
            expectUnderTest(fn).not[returnedWith]();
          }).toThrowErrorMatchingSnapshot();
        });

        test('incomplete recursive calls are handled properly', () => {
          // sums up all integers from 0 -> value, using recursion
          const fn: mock.Mock<(value: number) => number> = mock.fn(value => {
            if (value === 0) {
              return 0;
            } else {
              const recursiveResult = fn(value - 1);

              if (value === 2) {
                // Only 2 of the recursive calls have returned at this point
                expectUnderTest(fn).not[returnedWith](1, 6);
                expectUnderTest(fn).not[returnedWith](2, 3);
                expectUnderTest(fn)[returnedWith](3, 1);
                expectUnderTest(fn)[returnedWith](4, 0);

                expect(() =>
                  expectUnderTest(fn)[returnedWith](1, 6),
                ).toThrowErrorMatchingSnapshot();
                expect(() =>
                  expectUnderTest(fn)[returnedWith](2, 3),
                ).toThrowErrorMatchingSnapshot();
                expect(() =>
                  expectUnderTest(fn).not[returnedWith](3, 1),
                ).toThrowErrorMatchingSnapshot();
                expect(() =>
                  expectUnderTest(fn).not[returnedWith](4, 0),
                ).toThrowErrorMatchingSnapshot();
              }

              return value + recursiveResult;
            }
          });

          fn(3);
        });
      });
    }

    if (isToHaveLast(returnedWith)) {
      test.describe('lastReturnedWith', () => {
        test('works with three calls', () => {
          const fn = mock.fn<() => string>();
          fn.mockReturnValueOnce('foo1');
          fn.mockReturnValueOnce('foo2');
          fn.mockReturnValueOnce('foo3');
          fn();
          fn();
          fn();

          expectUnderTest(fn)[returnedWith]('foo3');

          expect(() => {
            expectUnderTest(fn).not[returnedWith]('foo3');
          }).toThrowErrorMatchingSnapshot();
        });

        test('incomplete recursive calls are handled properly', () => {
          // sums up all integers from 0 -> value, using recursion
          const fn: mock.Mock<(value: number) => number> = mock.fn(value => {
            if (value === 0) {
              // Before returning from the base case of recursion, none of the
              // calls have returned yet.
              expectUnderTest(fn).not[returnedWith](0);
              expect(() =>
                expectUnderTest(fn)[returnedWith](0),
              ).toThrowErrorMatchingSnapshot();
              return 0;
            } else {
              return value + fn(value - 1);
            }
          });

          fn(3);
        });
      });
    }

    test('includes the custom mock name in the error message', () => {
      const fn = mock.fn().mockName('named-mock');

      if (isToHaveNth(returnedWith)) {
        expectUnderTest(fn).not[returnedWith](1, 'foo');

        expect(() =>
          expectUnderTest(fn)[returnedWith](1, 'foo'),
        ).toThrowErrorMatchingSnapshot();
      } else {
        expectUnderTest(fn).not[returnedWith]('foo');

        expect(() =>
          expectUnderTest(fn)[returnedWith]('foo'),
        ).toThrowErrorMatchingSnapshot();
      }
    });
  });
}
