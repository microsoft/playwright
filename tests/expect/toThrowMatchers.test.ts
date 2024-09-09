/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { test, expect } from './fixtures';
import { expect as expectUnderTest } from '../../packages/playwright/bundles/expect/src/expectBundleImpl';

const expectUnderTestAsAny = expectUnderTest as any;

// Custom Error class because node versions have different stack trace strings.
class CustomError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'Error';
    this.stack =
      'Error\n' +
      '  at expectUnderTest' +
      ' (packages/expect/src/__tests__/toThrowMatchers-test.js:24:74)';
  }
}

for (const toThrow of ['toThrowError', 'toThrow'] as const) {
  test.describe(toThrow, () => {
    class Err extends CustomError {}
    class Err2 extends CustomError {}

    test('to throw or not to throw', () => {
      expectUnderTest(() => {
        throw new CustomError('apple');
      })[toThrow]();
      expectUnderTest(() => {}).not[toThrow]();
    });

    test.describe('substring', () => {
      test('passes', () => {
        expectUnderTest(() => {
          throw new CustomError('apple');
        })[toThrow]('apple');
        expectUnderTest(() => {
          throw new CustomError('banana');
        }).not[toThrow]('apple');
        expectUnderTest(() => {}).not[toThrow]('apple');
      });

      test('did not throw at all', () => {
        expect(() =>
          expectUnderTest(() => {})[toThrow]('apple'),
        ).toThrowErrorMatchingSnapshot();
      });

      test('threw, but message did not match (error)', () => {
        expect(() => {
          expectUnderTest(() => {
            throw new CustomError('apple');
          })[toThrow]('banana');
        }).toThrowErrorMatchingSnapshot();
      });

      test('threw, but message did not match (non-error falsey)', () => {
        expect(() => {
          expectUnderTest(() => {

            throw '';
          })[toThrow]('Server Error');
        }).toThrowErrorMatchingSnapshot();
      });

      test('properly escapes strings when matching against errors', () => {
        expectUnderTest(() => {
          throw new TypeError('"this"? throws.');
        })[toThrow]('"this"? throws.');
      });

      test('threw, but message should not match (error)', () => {
        expect(() => {
          expectUnderTest(() => {
            throw new CustomError('Invalid array length');
          }).not[toThrow]('array');
        }).toThrowErrorMatchingSnapshot();
      });

      test('threw, but message should not match (non-error truthy)', () => {
        expect(() => {
          expectUnderTest(() => {

            throw 'Internal Server Error';
          }).not[toThrow]('Server Error');
        }).toThrowErrorMatchingSnapshot();
      });
    });

    test.describe('regexp', () => {
      test('passes', () => {
        expectUnderTest(() => {
          throw new CustomError('apple');
        })[toThrow](/apple/);
        expectUnderTest(() => {
          throw new CustomError('banana');
        }).not[toThrow](/apple/);
        expectUnderTest(() => {}).not[toThrow](/apple/);
      });

      test('did not throw at all', () => {
        expect(() =>
          expectUnderTest(() => {})[toThrow](/apple/),
        ).toThrowErrorMatchingSnapshot();
      });

      test('threw, but message did not match (error)', () => {
        expect(() => {
          expectUnderTest(() => {
            throw new CustomError('apple');
          })[toThrow](/banana/);
        }).toThrowErrorMatchingSnapshot();
      });

      test('threw, but message did not match (non-error falsey)', () => {
        expect(() => {
          expectUnderTest(() => {

            throw 0;
          })[toThrow](/^[123456789]\d*/);
        }).toThrowErrorMatchingSnapshot();
      });

      test('threw, but message should not match (error)', () => {
        expect(() => {
          expectUnderTest(() => {
            throw new CustomError('Invalid array length');
          }).not[toThrow](/ array /);
        }).toThrowErrorMatchingSnapshot();
      });

      test('threw, but message should not match (non-error truthy)', () => {
        expect(() => {
          expectUnderTest(() => {

            throw 404;
          }).not[toThrow](/^[123456789]\d*/);
        }).toThrowErrorMatchingSnapshot();
      });
    });

    test.describe('error class', () => {
      class SubErr extends Err {
        constructor(message?: string) {
          super(message);
          // In a carefully written error subclass,
          // name property is equal to constructor name.
          this.name = this.constructor.name;
        }
      }

      class SubSubErr extends SubErr {
        constructor(message?: string) {
          super(message);
          // In a carefully written error subclass,
          // name property is equal to constructor name.
          this.name = this.constructor.name;
        }
      }

      test('passes', () => {
        expectUnderTest(() => {
          throw new Err();
        })[toThrow](Err);
        expectUnderTest(() => {
          throw new Err();
        })[toThrow](CustomError);
        expectUnderTest(() => {
          throw new Err();
        }).not[toThrow](Err2);
        expectUnderTest(() => {}).not[toThrow](Err);
      });

      test('did not throw at all', () => {
        expect(() =>
          expect(() => {})[toThrow](Err),
        ).toThrowErrorMatchingSnapshot();
      });

      test('threw, but class did not match (error)', () => {
        expect(() => {
          expectUnderTest(() => {
            throw new Err('apple');
          })[toThrow](Err2);
        }).toThrowErrorMatchingSnapshot();
      });

      test('threw, but class did not match (non-error falsey)', () => {
        expect(() => {
          expectUnderTest(() => {

            throw undefined;
          })[toThrow](Err2);
        }).toThrowErrorMatchingSnapshot();
      });

      test('threw, but class should not match (error)', () => {
        expect(() => {
          expectUnderTest(() => {
            throw new Err('apple');
          }).not[toThrow](Err);
        }).toThrowErrorMatchingSnapshot();
      });

      test('threw, but class should not match (error subclass)', () => {
        expect(() => {
          expectUnderTest(() => {
            throw new SubErr('apple');
          }).not[toThrow](Err);
        }).toThrowErrorMatchingSnapshot();
      });

      test('threw, but class should not match (error subsubclass)', () => {
        expect(() => {
          expectUnderTest(() => {
            throw new SubSubErr('apple');
          }).not[toThrow](Err);
        }).toThrowErrorMatchingSnapshot();
      });
    });

    test.describe('error-message', () => {
      // Received message in report if object has message property.
      class ErrorMessage {
        // not extending Error!
        constructor(public message: string) {}
      }
      const expected = new ErrorMessage('apple');

      test.describe('pass', () => {
        test('isNot false', () => {
          expectUnderTest(() => {
            throw new ErrorMessage('apple');
          })[toThrow](expected);
        });

        test('isNot true', () => {
          expectUnderTest(() => {
            throw new ErrorMessage('banana');
          }).not[toThrow](expected);
        });
      });

      test.describe('fail', () => {
        test('isNot false', () => {
          expect(() =>
            expectUnderTest(() => {
              throw new ErrorMessage('banana');
            })[toThrow](expected),
          ).toThrowErrorMatchingSnapshot();
        });

        test('isNot true', () => {
          const message = 'Invalid array length';
          expect(() =>
            expectUnderTest(() => {
              throw new ErrorMessage(message);
            }).not[toThrow]({ message }),
          ).toThrowErrorMatchingSnapshot();
        });

        test('multiline diff highlight incorrect expected space', () => {
          // jest/issues/2673
          const a =
            "There is no route defined for key Settings. \nMust be one of: 'Home'";
          const b =
            "There is no route defined for key Settings.\nMust be one of: 'Home'";
          expect(() =>
            expectUnderTest(() => {
              throw new ErrorMessage(b);
            })[toThrow]({ message: a }),
          ).toThrowErrorMatchingSnapshot();
        });
      });
    });

    test.describe('error message and cause', () => {
      const errorA = new Error('A');
      const errorB = new Error('B', { cause: errorA });
      const expected = new Error('good', { cause: errorB });

      test.describe('pass', () => {
        test('isNot false', () => {
          expectUnderTest(() => {
            throw new Error('good', { cause: errorB });
          })[toThrow](expected);
        });

        test('isNot true, incorrect message', () => {
          expectUnderTest(() => {
            throw new Error('bad', { cause: errorB });
          }).not[toThrow](expected);
        });

        test('isNot true, incorrect cause', () => {
          expectUnderTest(() => {
            throw new Error('good', { cause: errorA });
          }).not[toThrow](expected);
        });
      });

      test.describe('fail', () => {
        test('isNot false, incorrect message', () => {
          expect(() =>
            expectUnderTest(() => {
              throw new Error('bad', { cause: errorB });
            })[toThrow](expected),
          ).toThrow(
              /^(?=.*Expected message and cause: ).*Received message and cause: /s,
          );
        });

        test('isNot true, incorrect cause', () => {
          expect(() =>
            expectUnderTest(() => {
              throw new Error('good', { cause: errorA });
            })[toThrow](expected),
          ).toThrow(
              /^(?=.*Expected message and cause: ).*Received message and cause: /s,
          );
        });
      });
    });

    test.describe('asymmetric', () => {
      test.describe('any-Class', () => {
        test.describe('pass', () => {
          test('isNot false', () => {
            expectUnderTest(() => {
              throw new Err('apple');
            })[toThrow](expect.any(Err));
          });

          test('isNot true', () => {
            expectUnderTest(() => {
              throw new Err('apple');
            }).not[toThrow](expect.any(Err2));
          });
        });

        test.describe('fail', () => {
          test('isNot false', () => {
            expect(() =>
              expectUnderTest(() => {
                throw new Err('apple');
              })[toThrow](expect.any(Err2)),
            ).toThrowErrorMatchingSnapshot();
          });

          test('isNot true', () => {
            expect(() =>
              expectUnderTest(() => {
                throw new Err('apple');
              }).not[toThrow](expect.any(Err)),
            ).toThrowErrorMatchingSnapshot();
          });
        });
      });

      test.describe('anything', () => {
        test.describe('pass', () => {
          test('isNot false', () => {
            expectUnderTest(() => {
              throw new CustomError('apple');
            })[toThrow](expect.anything());
          });

          test('isNot true', () => {
            expectUnderTest(() => {}).not[toThrow](expect.anything());
            expectUnderTest(() => {

              throw null;
            }).not[toThrow](expect.anything());
          });
        });

        test.describe('fail', () => {
          test('isNot false', () => {
            expect(() =>
              expectUnderTest(() => {

                throw null;
              })[toThrow](expect.anything()),
            ).toThrowErrorMatchingSnapshot();
          });

          test('isNot true', () => {
            expect(() =>
              expectUnderTest(() => {
                throw new CustomError('apple');
              }).not[toThrow](expect.anything()),
            ).toThrowErrorMatchingSnapshot();
          });
        });
      });

      test.describe('no-symbol', () => {
        // Test serialization of asymmetric matcher which has no property:
        // this.$$typeof = Symbol.for('jest.asymmetricMatcher')
        const matchError = {
          asymmetricMatch(received: Error | null | undefined) {
            return (
              received !== null &&
              received !== undefined &&
              received.name === 'Error'
            );
          },
        };
        const matchNotError = {
          asymmetricMatch(received: Error | null | undefined) {
            return (
              received !== null &&
              received !== undefined &&
              received.name !== 'Error'
            );
          },
        };

        test.describe('pass', () => {
          test('isNot false', () => {
            expectUnderTest(() => {
              throw new CustomError('apple');
            })[toThrow](matchError);
          });

          test('isNot true', () => {
            expectUnderTest(() => {
              throw new CustomError('apple');
            }).not[toThrow](matchNotError);
          });
        });

        test.describe('fail', () => {
          test('isNot false', () => {
            expect(() =>
              expectUnderTest(() => {
                throw new CustomError('apple');
              })[toThrow](matchNotError),
            ).toThrowErrorMatchingSnapshot();
          });

          test('isNot true', () => {
            expect(() =>
              expectUnderTest(() => {
                throw new CustomError('apple');
              }).not[toThrow](matchError),
            ).toThrowErrorMatchingSnapshot();
          });
        });
      });

      test.describe('objectContaining', () => {
        const matchError = expect.objectContaining({
          name: 'Error',
        });
        const matchNotError = expect.objectContaining({
          name: 'NotError',
        });

        test.describe('pass', () => {
          test('isNot false', () => {
            expectUnderTest(() => {
              throw new CustomError('apple');
            })[toThrow](matchError);
          });

          test('isNot true', () => {
            expectUnderTest(() => {
              throw new CustomError('apple');
            }).not[toThrow](matchNotError);
          });
        });

        test.describe('fail', () => {
          test('isNot false', () => {
            expect(() =>
              expectUnderTest(() => {
                throw new CustomError('apple');
              })[toThrow](matchNotError),
            ).toThrowErrorMatchingSnapshot();
          });

          test('isNot true', () => {
            expect(() =>
              expectUnderTest(() => {
                throw new CustomError('apple');
              }).not[toThrow](matchError),
            ).toThrowErrorMatchingSnapshot();
          });
        });
      });
    });

    test.describe('promise/async throws if Error-like object is returned', () => {
      const asyncFn = async (shouldThrow?: boolean, resolve?: boolean) => {
        let err;
        if (shouldThrow)
          err = new Err('async apple');

        if (resolve)
          return Promise.resolve(err || 'apple');
        else
          return Promise.reject(err || 'apple');
      };

      test('passes', async () => {
        await expectUnderTest(Promise.reject(new Error())).rejects[toThrow]();

        await expectUnderTest(asyncFn(true)).rejects[toThrow]();
        await expectUnderTest(asyncFn(true)).rejects[toThrow](Err);
        await expectUnderTest(asyncFn(true)).rejects[toThrow](Error);
        await expectUnderTest(asyncFn(true)).rejects[toThrow]('apple');
        await expectUnderTest(asyncFn(true)).rejects[toThrow](/app/);

        await expectUnderTest(asyncFn(true)).rejects.not[toThrow](Err2);
        await expectUnderTest(asyncFn(true)).rejects.not[toThrow]('banana');
        await expectUnderTest(asyncFn(true)).rejects.not[toThrow](/banana/);

        await expectUnderTest(asyncFn(true, true)).resolves[toThrow]();

        await expectUnderTest(asyncFn(false, true)).resolves.not[toThrow]();
        await expectUnderTest(asyncFn(false, true)).resolves.not[toThrow](Error);
        await expectUnderTest(asyncFn(false, true)).resolves.not[toThrow]('apple');
        await expectUnderTest(asyncFn(false, true)).resolves.not[toThrow](/apple/);
        await expectUnderTest(asyncFn(false, true)).resolves.not[toThrow]('banana');
        await expectUnderTest(asyncFn(false, true)).resolves.not[toThrow](/banana/);

        await expectUnderTest(asyncFn()).rejects.not[toThrow]();
        await expectUnderTest(asyncFn()).rejects.not[toThrow](Error);
        await expectUnderTest(asyncFn()).rejects.not[toThrow]('apple');
        await expectUnderTest(asyncFn()).rejects.not[toThrow](/apple/);
        await expectUnderTest(asyncFn()).rejects.not[toThrow]('banana');
        await expectUnderTest(asyncFn()).rejects.not[toThrow](/banana/);

        // Works with nested functions inside promises
        await expectUnderTest(
            Promise.reject(() => {
              throw new Error();
            }),
        ).rejects[toThrow]();
        await expectUnderTest(Promise.reject(() => {})).rejects.not[toThrow]();
      });

      test('did not throw at all', async () => {
        await expectUnderTestAsAny(
            expectUnderTest(asyncFn()).rejects[toThrow](),
        ).rejects.toThrowErrorMatchingSnapshot();
      });

      test('threw, but class did not match', async () => {
        await expectUnderTestAsAny(
            expectUnderTest(asyncFn(true)).rejects[toThrow](Err2),
        ).rejects.toThrowErrorMatchingSnapshot();
      });

      test('threw, but should not have', async () => {
        await expectUnderTestAsAny(
            expectUnderTest(asyncFn(true)).rejects.not[toThrow](),
        ).rejects.toThrowErrorMatchingSnapshot();
      });
    });

    test.describe('expected is undefined', () => {
      test('threw, but should not have (non-error falsey)', () => {
        expect(() => {
          expectUnderTest(() => {

            throw null;
          }).not[toThrow]();
        }).toThrowErrorMatchingSnapshot();
      });
    });

    test('invalid arguments', () => {
      expect(() =>
        expectUnderTest(() => {}).not[toThrow](111),
      ).toThrowErrorMatchingSnapshot();
    });

    test('invalid actual', () => {
      expect(() =>
        expectUnderTest('a string')[toThrow](),
      ).toThrowErrorMatchingSnapshot();
    });
  });
}