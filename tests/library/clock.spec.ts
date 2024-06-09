/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from '@playwright/test';
import { createClock as rawCreateClock, install as rawInstall } from '../../packages/playwright-core/src/server/injected/clock';
import type { InstallConfig, ClockController, ClockMethods } from '../../packages/playwright-core/src/server/injected/clock';

const createClock = (now?: Date | number, loopLimit?: number): ClockController & ClockMethods => {
  const { clock, api } = rawCreateClock(globalThis, { now, loopLimit });
  for (const key of Object.keys(api))
    clock[key] = api[key];
  return clock as ClockController & ClockMethods;
};

type ClockFixtures = {
  clock: ClockController & ClockMethods;
  now: Date | number | undefined;
  loopLimit: number | undefined;
  install: (config?: InstallConfig) => ClockController & ClockMethods;
  installEx: (config?: InstallConfig) => { clock: ClockController, api: ClockMethods, originals: ClockMethods };
};

const it = test.extend<ClockFixtures>({
  clock: async ({ now, loopLimit }, use) => {
    const clock = createClock(now, loopLimit);
    await use(clock);
  },

  now: undefined,

  loopLimit: undefined,

  install: async ({}, use) => {
    let clockObject: ClockController & ClockMethods;
    const install = (config?: InstallConfig) => {
      const { clock, api } = rawInstall(globalThis, config);
      for (const key of Object.keys(api))
        clock[key] = api[key];
      clockObject = clock as ClockController & ClockMethods;
      return clockObject;
    };
    await use(install);
    clockObject?.uninstall();
  },

  installEx: async ({}, use) => {
    let clock: ClockController;
    await use((config?: InstallConfig) => {
      const result = rawInstall(globalThis, config);
      clock = result.clock;
      return result;
    });
    clock?.uninstall();
  },
});

it.describe('setTimeout', () => {
  it('throws if no arguments', async ({ clock }) => {
    expect(() => {
      // @ts-expect-error
      clock.setTimeout();
    }).toThrow();
  });

  it('returns numeric id or object with numeric id', async ({ clock }) => {
    const result = clock.setTimeout(() => { }, 10);
    expect(result).toEqual(expect.any(Number));
  });

  it('returns unique id', async ({ clock }) => {
    const id1 = clock.setTimeout(() => { }, 10);
    const id2 = clock.setTimeout(() => { }, 10);
    expect(id2).not.toBe(id1);
  });

  it('starts id from a large number', async ({ clock }) => {
    const timer = clock.setTimeout(() => { }, 10);
    expect(timer).toBeGreaterThanOrEqual(1e12);
  });

  it('sets timers on instance', async ({ clock }) => {
    const clock1 = createClock();
    const clock2 = createClock();
    const stubs = [createStub(), createStub()];

    clock1.setTimeout(stubs[0], 100);
    clock2.setTimeout(stubs[1], 100);
    await clock2.tick(200);

    expect(stubs[0].called).toBeFalsy();
    expect(stubs[1].called).toBeTruthy();
  });

  it('parses numeric string times', async ({ clock }) => {
    let evalCalled = false;
    clock.setTimeout(() => {
      evalCalled = true;
      // @ts-expect-error
    }, '10');
    await clock.tick(10);
    expect(evalCalled).toBeTruthy();
  });

  it('parses no-numeric string times', async ({ clock }) => {
    let evalCalled = false;
    clock.setTimeout(() => {
      evalCalled = true;
      // @ts-expect-error
    }, 'string');
    await clock.tick(10);

    expect(evalCalled).toBeTruthy();
  });

  it('passes setTimeout parameters', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub, 2, 'the first', 'the second');
    await clock.tick(3);
    expect(stub.calledWithExactly('the first', 'the second')).toBeTruthy();
  });

  it('calls correct timeout on recursive tick', async ({ clock }) => {
    const stub = createStub();
    const recurseCallback = () => {
      void clock.tick(100);
    };

    clock.setTimeout(recurseCallback, 50);
    clock.setTimeout(stub, 100);

    await clock.tick(50);
    expect(stub.called).toBeTruthy();
  });

  it('does not depend on this', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub, 100);
    await clock.tick(100);
    expect(stub.called).toBeTruthy();
  });

  it('is not influenced by forward system clock changes', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub, 5000);
    await clock.tick(1000);
    clock.setTime(new clock.Date().getTime() + 1000);
    await clock.tick(3990);
    expect(stub.callCount).toBe(0);
    await clock.tick(20);
    expect(stub.callCount).toBe(1);
  });

  it('is not influenced by backward system clock changes', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub, 5000);
    await clock.tick(1000);
    clock.setTime(new clock.Date().getTime() - 1000);
    await clock.tick(3990);
    expect(stub.callCount).toBe(0);
    await clock.tick(20);
    expect(stub.callCount).toBe(1);
  });

  it('handles Infinity and negative Infinity correctly', async ({ clock }) => {
    const calls = [];
    clock.setTimeout(() => {
      calls.push('NaN');
    }, NaN);
    clock.setTimeout(() => {
      calls.push('Infinity');
    }, Number.POSITIVE_INFINITY);
    clock.setTimeout(() => {
      calls.push('-Infinity');
    }, Number.NEGATIVE_INFINITY);
    await clock.runAll();
    expect(calls).toEqual(['NaN', 'Infinity', '-Infinity']);
  });

  it.describe('use of eval when not in node', () => {
    it.beforeEach(() => {
      globalThis.evalCalled = false;
    });

    it.afterEach(() => {
      delete globalThis.evalCalled.evalCalled;
    });

    it('evals non-function callbacks', async ({ clock }) => {
      clock.setTimeout('globalThis.evalCalled = true', 10);
      await clock.tick(10);

      expect(globalThis.evalCalled).toBeTruthy();
    });

    it('only evals on global scope', async ({ clock }) => {
      const x = 15;
      try {
        clock.setTimeout('x', x);
        await clock.tick(x);
        expect(true).toBeFalsy();
      } catch (e) {
        expect(e).toBeInstanceOf(ReferenceError);
      }
    });
  });
});

it.describe('tick', () => {
  it('triggers immediately without specified delay', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub);
    await clock.tick(0);
    expect(stub.called).toBeTruthy();
  });

  it('does not trigger without sufficient delay', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub, 100);
    await clock.tick(10);
    expect(stub.called).toBeFalsy();
  });

  it('triggers after sufficient delay', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub, 100);
    await clock.tick(100);
    expect(stub.called).toBeTruthy();
  });

  it('triggers simultaneous timers', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    clock.setTimeout(spies[0], 100);
    clock.setTimeout(spies[1], 100);
    await clock.tick(100);
    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeTruthy();
  });

  it('triggers multiple simultaneous timers', async ({ clock }) => {
    const spies = [createStub(), createStub(), createStub(), createStub()];
    clock.setTimeout(spies[0], 100);
    clock.setTimeout(spies[1], 100);
    clock.setTimeout(spies[2], 99);
    clock.setTimeout(spies[3], 100);
    await clock.tick(100);
    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeTruthy();
    expect(spies[2].called).toBeTruthy();
    expect(spies[3].called).toBeTruthy();
  });

  it('triggers multiple simultaneous timers with zero callAt', async ({ clock }) => {
    const spies = [
      createStub(() => {
        clock.setTimeout(spies[1], 0);
      }),
      createStub(),
      createStub(),
    ];

    // First spy calls another setTimeout with delay=0
    clock.setTimeout(spies[0], 0);
    clock.setTimeout(spies[2], 10);
    await clock.tick(10);
    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeTruthy();
    expect(spies[2].called).toBeTruthy();
  });

  it('waits after setTimeout was called', async ({ clock }) => {
    await clock.tick(100);
    const stub = createStub();
    clock.setTimeout(stub, 150);
    await clock.tick(50);
    expect(stub.called).toBeFalsy();
    await clock.tick(100);
    expect(stub.called).toBeTruthy();
  });

  it('mini integration test', async ({ clock }) => {
    const stubs = [createStub(), createStub(), createStub()];
    clock.setTimeout(stubs[0], 100);
    clock.setTimeout(stubs[1], 120);
    await clock.tick(10);
    await clock.tick(89);
    expect(stubs[0].called).toBeFalsy();
    expect(stubs[1].called).toBeFalsy();
    clock.setTimeout(stubs[2], 20);
    await clock.tick(1);
    expect(stubs[0].called).toBeTruthy();
    expect(stubs[1].called).toBeFalsy();
    expect(stubs[2].called).toBeFalsy();
    await clock.tick(19);
    expect(stubs[1].called).toBeFalsy();
    expect(stubs[2].called).toBeTruthy();
    await clock.tick(1);
    expect(stubs[1].called).toBeTruthy();
  });

  it('triggers even when some throw', async ({ clock }) => {
    const stubs = [createStub().throws(), createStub()];

    clock.setTimeout(stubs[0], 100);
    clock.setTimeout(stubs[1], 120);

    await expect(clock.tick(120)).rejects.toThrow();

    expect(stubs[0].called).toBeTruthy();
    expect(stubs[1].called).toBeTruthy();
  });

  it('calls function with global object or null (strict mode) as this', async ({ clock }) => {
    const stub = createStub().throws();
    clock.setTimeout(stub, 100);
    await expect(clock.tick(100)).rejects.toThrow();
    expect(stub.calledOn(global) || stub.calledOn(null)).toBeTruthy();
  });

  it('triggers in the order scheduled', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    clock.setTimeout(spies[0], 13);
    clock.setTimeout(spies[1], 11);

    await clock.tick(15);

    expect(spies[1].calledBefore(spies[0])).toBeTruthy();
  });

  it('creates updated Date while ticking', async ({ clock }) => {
    const spy = createStub();

    clock.setInterval(() => {
      spy(new clock.Date().getTime());
    }, 10);

    await clock.tick(100);

    expect(spy.callCount).toBe(10);
    expect(spy.calledWith(10)).toBeTruthy();
    expect(spy.calledWith(20)).toBeTruthy();
    expect(spy.calledWith(30)).toBeTruthy();
    expect(spy.calledWith(40)).toBeTruthy();
    expect(spy.calledWith(50)).toBeTruthy();
    expect(spy.calledWith(60)).toBeTruthy();
    expect(spy.calledWith(70)).toBeTruthy();
    expect(spy.calledWith(80)).toBeTruthy();
    expect(spy.calledWith(90)).toBeTruthy();
    expect(spy.calledWith(100)).toBeTruthy();
  });

  it('fires timer in intervals of 13', async ({ clock }) => {
    const spy = createStub();
    clock.setInterval(spy, 13);
    await clock.tick(500);
    expect(spy.callCount).toBe(38);
  });

  it('fires timer in intervals of "13"', async ({ clock }) => {
    const spy = createStub();
    // @ts-expect-error
    clock.setInterval(spy, '13');
    await clock.tick(500);
    expect(spy.callCount).toBe(38);
  });

  it('fires timers in correct order', async ({ clock }) => {
    const spy13 = createStub();
    const spy10 = createStub();

    clock.setInterval(() => {
      spy13(new clock.Date().getTime());
    }, 13);

    clock.setInterval(() => {
      spy10(new clock.Date().getTime());
    }, 10);

    await clock.tick(500);

    expect(spy13.callCount).toBe(38);
    expect(spy10.callCount).toBe(50);

    expect(spy13.calledWith(416)).toBeTruthy();
    expect(spy10.calledWith(320)).toBeTruthy();
  });

  it('triggers timeouts and intervals in the order scheduled', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    clock.setInterval(spies[0], 10);
    clock.setTimeout(spies[1], 50);

    await clock.tick(100);

    expect(spies[0].calledBefore(spies[1])).toBeTruthy();
    expect(spies[0].callCount).toBe(10);
    expect(spies[1].callCount).toBe(1);
  });

  it('does not fire canceled intervals', async ({ clock }) => {
    // eslint-disable-next-line prefer-const
    let id;
    const callback = createStub(() => {
      if (callback.callCount === 3)
        clock.clearInterval(id);
    });
    id = clock.setInterval(callback, 10);
    await clock.tick(100);
    expect(callback.callCount).toBe(3);
  });

  it('passes 8 seconds', async ({ clock }) => {
    const spy = createStub();
    clock.setInterval(spy, 4000);
    await clock.tick('08');
    expect(spy.callCount).toBe(2);
  });

  it('passes 1 minute', async ({ clock }) => {
    const spy = createStub();
    clock.setInterval(spy, 6000);
    await clock.tick('01:00');
    expect(spy.callCount).toBe(10);
  });

  it('passes 2 hours, 34 minutes and 10 seconds', async ({ clock }) => {
    const spy = createStub();
    clock.setInterval(spy, 10000);
    await clock.tick('02:34:10');
    expect(spy.callCount).toBe(925);
  });

  it('throws for invalid format', async ({ clock }) => {
    const spy = createStub();
    clock.setInterval(spy, 10000);

    await expect(clock.tick('12:02:34:10')).rejects.toThrow();

    expect(spy.callCount).toBe(0);
  });

  it('throws for invalid minutes', async ({ clock }) => {
    const spy = createStub();
    clock.setInterval(spy, 10000);
    await expect(clock.tick('67:10')).rejects.toThrow();
    expect(spy.callCount).toBe(0);
  });

  it('throws for negative minutes', async ({ clock }) => {
    const spy = createStub();
    clock.setInterval(spy, 10000);

    await expect(clock.tick('-7:10')).rejects.toThrow();
    expect(spy.callCount).toBe(0);
  });

  it('treats missing argument as 0', async ({ clock }) => {
    // @ts-expect-error
    await clock.tick();

    expect(clock.now()).toBe(0);
  });

  it('fires nested setTimeout calls properly', async ({ clock }) => {
    let i = 0;
    const callback = () => {
      ++i;
      clock.setTimeout(() => {
        callback();
      }, 100);
    };

    callback();
    await clock.tick(1000);
    expect(i).toBe(11);
  });

  it('does not silently catch errors', async ({ clock }) => {
    const callback = () => {
      throw new Error('oh no!');
    };
    clock.setTimeout(callback, 1000);
    await expect(clock.tick(1000)).rejects.toThrow();
  });

  it('returns the current now value', async ({ clock }) => {
    const value = await clock.tick(200);
    expect(clock.now()).toBe(value);
  });

  it('is not influenced by forward system clock changes', async ({ clock }) => {
    const callback = () => {
      clock.setTime(new clock.Date().getTime() + 1000);
    };
    const stub = createStub();
    clock.setTimeout(callback, 1000);
    clock.setTimeout(stub, 2000);
    await clock.tick(1990);
    expect(stub.callCount).toBe(0);
    await clock.tick(20);
    expect(stub.callCount).toBe(1);
  });

  it('is not influenced by forward system clock changes 2', async ({ clock }) => {
    const callback = () => {
      clock.setTime(new clock.Date().getTime() - 1000);
    };
    const stub = createStub();
    clock.setTimeout(callback, 1000);
    clock.setTimeout(stub, 2000);
    await clock.tick(1990);
    expect(stub.callCount).toBe(0);
    await clock.tick(20);
    expect(stub.callCount).toBe(1);
  });

  it('is not influenced by forward system clock changes when an error is thrown', async ({ clock }) => {
    const callback = () => {
      clock.setTime(new clock.Date().getTime() + 1000);
      throw new Error();
    };
    const stub = createStub();
    clock.setTimeout(callback, 1000);
    clock.setTimeout(stub, 2000);

    await expect(clock.tick(1990)).rejects.toThrow();

    expect(stub.callCount).toBe(0);
    await clock.tick(20);
    expect(stub.callCount).toBe(1);
  });

  it('is not influenced by forward system clock changes when an error is thrown 2', async ({ clock }) => {
    const callback = () => {
      clock.setTime(new clock.Date().getTime() - 1000);
      throw new Error();
    };
    const stub = createStub();
    clock.setTimeout(callback, 1000);
    clock.setTimeout(stub, 2000);

    await expect(clock.tick(1990)).rejects.toThrow();

    expect(stub.callCount).toBe(0);
    await clock.tick(20);
    expect(stub.callCount).toBe(1);
  });

  it('throws on negative ticks', async ({ clock }) => {
    await expect(clock.tick(-500)).rejects.toThrow('Negative ticks are not supported');
  });

  it('creates updated Date while ticking promises', async ({ clock }) => {
    const spy = createStub();

    clock.setInterval(() => {
      void Promise.resolve().then(() => {
        spy(new clock.Date().getTime());
      });
    }, 10);

    await clock.tick(100);

    expect(spy.callCount).toBe(10);
    expect(spy.calledWith(10)).toBeTruthy();
    expect(spy.calledWith(20)).toBeTruthy();
    expect(spy.calledWith(30)).toBeTruthy();
    expect(spy.calledWith(40)).toBeTruthy();
    expect(spy.calledWith(50)).toBeTruthy();
    expect(spy.calledWith(60)).toBeTruthy();
    expect(spy.calledWith(70)).toBeTruthy();
    expect(spy.calledWith(80)).toBeTruthy();
    expect(spy.calledWith(90)).toBeTruthy();
    expect(spy.calledWith(100)).toBeTruthy();
  });

  it('fires promise timers in correct order', async ({ clock }) => {
    const spy13 = createStub();
    const spy10 = createStub();

    clock.setInterval(() => {
      void Promise.resolve().then(() => {
        spy13(new clock.Date().getTime());
      });
    }, 13);

    clock.setInterval(() => {
      void Promise.resolve().then(() => {
        spy10(new clock.Date().getTime());
      });
    }, 10);

    await clock.tick(500);

    expect(spy13.callCount).toBe(38);
    expect(spy10.callCount).toBe(50);

    expect(spy13.calledWith(416)).toBeTruthy();
    expect(spy10.calledWith(320)).toBeTruthy();
  });

  it('does not fire intervals canceled in a promise', async ({ clock }) => {
    // ESLint fails to detect this correctly
    /* eslint-disable prefer-const */
    let id;
    const callback = createStub(() => {
      if (callback.callCount === 3) {
        void Promise.resolve().then(() => {
          clock.clearInterval(id);
        });
      }
    });

    id = clock.setInterval(callback, 10);
    await clock.tick(100);

    expect(callback.callCount).toBe(3);
  });

  it('fires nested setTimeout calls in user-created promises properly', async ({ clock }) => {
    let i = 0;
    const callback = () => {
      void Promise.resolve().then(() => {
        ++i;
        clock.setTimeout(() => {
          void Promise.resolve().then(() => {
            callback();
          });
        }, 100);
      });
    };

    callback();

    // Clock API is async.
    await new Promise(setImmediate);
    await clock.tick(1000);
    expect(i).toBe(11);
  });

  it('is not influenced by forward system clock changes in promises', async ({ clock }) => {
    const callback = () => {
      void Promise.resolve().then(() => {
        clock.setTime(new clock.Date().getTime() + 1000);
      });
    };
    const stub = createStub();
    clock.setTimeout(callback, 1000);
    clock.setTimeout(stub, 2000);
    await clock.tick(1990);
    expect(stub.callCount).toBe(0);
    await clock.tick(20);
    expect(stub.callCount).toBe(1);
  });

  it('should settle user-created promises', async ({ clock }) => {
    const spy = createStub();

    clock.setTimeout(() => {
      void Promise.resolve().then(spy);
    }, 100);

    await clock.tick(100);

    expect(spy.called).toBeTruthy();
  });

  it('should settle chained user-created promises', async ({ clock }) => {
    const spies = [createStub(), createStub(), createStub()];

    clock.setTimeout(() => {
      void Promise.resolve()
          .then(spies[0])
          .then(spies[1])
          .then(spies[2]);
    }, 100);

    await clock.tick(100);

    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeTruthy();
    expect(spies[2].called).toBeTruthy();
  });

  it('should settle multiple user-created promises', async ({ clock }) => {
    const spies = [createStub(), createStub(), createStub()];

    clock.setTimeout(() => {
      void Promise.resolve().then(spies[0]);
      void Promise.resolve().then(spies[1]);
      void Promise.resolve().then(spies[2]);
    }, 100);

    await clock.tick(100);

    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeTruthy();
    expect(spies[2].called).toBeTruthy();
  });

  it('should settle nested user-created promises', async ({ clock }) => {
    const spy = createStub();

    clock.setTimeout(() => {
      void Promise.resolve().then(() => {
        void Promise.resolve().then(() => {
          void Promise.resolve().then(spy);
        });
      });
    }, 100);

    await clock.tick(100);

    expect(spy.called).toBeTruthy();
  });

  it('should settle user-created promises even if some throw', async ({ clock }) => {
    const spies = [createStub(), createStub(), createStub(), createStub()];

    clock.setTimeout(() => {
      void Promise.reject().then(spies[0]).catch(spies[1]);
      void Promise.resolve().then(spies[2]).catch(spies[3]);
    }, 100);

    await clock.tick(100);

    expect(spies[0].callCount).toBe(0);
    expect(spies[1].called).toBeTruthy();
    expect(spies[2].called).toBeTruthy();
    expect(spies[3].callCount).toBe(0);
  });

  it('should settle user-created promises before calling more timeouts', async ({ clock }) => {
    const spies = [createStub(), createStub()];

    clock.setTimeout(() => {
      void Promise.resolve().then(spies[0]);
    }, 100);

    clock.setTimeout(spies[1], 200);

    await clock.tick(200);

    expect(spies[0].calledBefore(spies[1])).toBeTruthy();
  });

  it('should settle local promises before calling timeouts', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    void Promise.resolve().then(spies[0]);
    clock.setTimeout(spies[1], 100);

    // Clock API is async.
    await new Promise(setImmediate);

    await clock.tick(100);
    expect(spies[0].calledBefore(spies[1])).toBeTruthy();
  });

  it('should settle local nested promises before calling timeouts', async ({ clock }) => {
    const spies = [createStub(), createStub()];

    void Promise.resolve().then(() => {
      void Promise.resolve().then(() => {
        void Promise.resolve().then(spies[0]);
      });
    });

    clock.setTimeout(spies[1], 100);

    // Clock API is async.
    await new Promise(setImmediate);
    await clock.tick(100);

    expect(spies[0].calledBefore(spies[1])).toBeTruthy();
  });
});

it.describe('next', () => {
  it('triggers the next timer', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub, 100);

    await clock.next();

    expect(stub.called).toBeTruthy();
  });

  it('does not trigger simultaneous timers', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    clock.setTimeout(spies[0], 100);
    clock.setTimeout(spies[1], 100);

    await clock.next();

    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeFalsy();
  });

  it('subsequent calls trigger simultaneous timers', async ({ clock }) => {
    const spies = [createStub(), createStub(), createStub(), createStub()];
    clock.setTimeout(spies[0], 100);
    clock.setTimeout(spies[1], 100);
    clock.setTimeout(spies[2], 99);
    clock.setTimeout(spies[3], 100);

    await clock.next();

    expect(spies[2].called).toBeTruthy();
    expect(spies[0].called).toBeFalsy();
    expect(spies[1].called).toBeFalsy();
    expect(spies[3].called).toBeFalsy();

    await clock.next();

    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeFalsy();
    expect(spies[3].called).toBeFalsy();

    await clock.next();

    expect(spies[1].called).toBeTruthy();
    expect(spies[3].called).toBeFalsy();

    await clock.next();

    expect(spies[3].called).toBeTruthy();
  });

  it('subsequent calls trigger simultaneous timers with zero callAt', async ({ clock }) => {
    const spies = [
      createStub(() => {
        clock.setTimeout(spies[1], 0);
      }),
      createStub(),
      createStub(),
    ];

    // First spy calls another setTimeout with delay=0
    clock.setTimeout(spies[0], 0);
    clock.setTimeout(spies[2], 10);

    await clock.next();

    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeFalsy();

    await clock.next();

    expect(spies[1].called).toBeTruthy();

    await clock.next();

    expect(spies[2].called).toBeTruthy();
  });

  it('throws exception thrown by timer', async ({ clock }) => {
    const stub = createStub().throws();
    clock.setTimeout(stub, 100);
    await expect(clock.next()).rejects.toThrow();
    expect(stub.called).toBeTruthy();
  });

  it('calls function with global object or null (strict mode) as this', async ({ clock }) => {
    const stub = createStub().throws();
    clock.setTimeout(stub, 100);
    await expect(clock.next()).rejects.toThrow();
    expect(stub.calledOn(global) || stub.calledOn(null)).toBeTruthy();
  });

  it('subsequent calls trigger in the order scheduled', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    clock.setTimeout(spies[0], 13);
    clock.setTimeout(spies[1], 11);

    await clock.next();
    await clock.next();

    expect(spies[1].calledBefore(spies[0])).toBeTruthy();
  });

  it('creates updated Date while ticking', async ({ clock }) => {
    const spy = createStub();

    clock.setInterval(() => {
      spy(new clock.Date().getTime());
    }, 10);

    await clock.next();
    await clock.next();
    await clock.next();
    await clock.next();
    await clock.next();
    await clock.next();
    await clock.next();
    await clock.next();
    await clock.next();
    await clock.next();

    expect(spy.callCount).toBe(10);
    expect(spy.calledWith(10)).toBeTruthy();
    expect(spy.calledWith(20)).toBeTruthy();
    expect(spy.calledWith(30)).toBeTruthy();
    expect(spy.calledWith(40)).toBeTruthy();
    expect(spy.calledWith(50)).toBeTruthy();
    expect(spy.calledWith(60)).toBeTruthy();
    expect(spy.calledWith(70)).toBeTruthy();
    expect(spy.calledWith(80)).toBeTruthy();
    expect(spy.calledWith(90)).toBeTruthy();
    expect(spy.calledWith(100)).toBeTruthy();
  });

  it('subsequent calls trigger timeouts and intervals in the order scheduled', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    clock.setInterval(spies[0], 10);
    clock.setTimeout(spies[1], 50);

    await clock.next();
    await clock.next();
    await clock.next();
    await clock.next();
    await clock.next();
    await clock.next();

    expect(spies[0].calledBefore(spies[1])).toBeTruthy();
    expect(spies[0].callCount).toBe(5);
    expect(spies[1].callCount).toBe(1);
  });

  it('subsequent calls do not fire canceled intervals', async ({ clock }) => {
    // ESLint fails to detect this correctly
    /* eslint-disable prefer-const */
    let id;
    const callback = createStub(() => {
      if (callback.callCount === 3)
        clock.clearInterval(id);
    });

    id = clock.setInterval(callback, 10);
    await clock.next();
    await clock.next();
    await clock.next();
    await clock.next();

    expect(callback.callCount).toBe(3);
  });

  it('advances the clock based on when the timer was supposed to be called', async ({ clock }) => {
    clock.setTimeout(createStub(), 55);
    await clock.next();

    expect(clock.now()).toBe(55);
  });

  it('returns the current now value', async ({ clock }) => {
    clock.setTimeout(createStub(), 55);
    const value = await clock.next();

    expect(clock.now()).toBe(value);
  });

  it('does not fire intervals canceled in promises', async ({ clock }) => {
    // ESLint fails to detect this correctly
    /* eslint-disable prefer-const */
    let id;
    const callback = createStub(() => {
      if (callback.callCount === 3) {
        void Promise.resolve().then(() => {
          clock.clearInterval(id);
        });
      }
    });

    id = clock.setInterval(callback, 10);
    await clock.next();
    await clock.next();
    await clock.next();
    await clock.next();

    expect(callback.callCount).toBe(3);
  });

  it('should settle user-created promises', async ({ clock }) => {
    const spy = createStub();

    clock.setTimeout(() => {
      void Promise.resolve().then(spy);
    }, 55);

    await clock.next();

    expect(spy.called).toBeTruthy();
  });

  it('should settle nested user-created promises', async ({ clock }) => {
    const spy = createStub();

    clock.setTimeout(() => {
      void Promise.resolve().then(() => {
        void Promise.resolve().then(() => {
          void Promise.resolve().then(spy);
        });
      });
    }, 55);

    await clock.next();

    expect(spy.called).toBeTruthy();
  });

  it('should settle local promises before firing timers', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    void Promise.resolve().then(spies[0]);
    clock.setTimeout(spies[1], 55);

    // Clock API is async.
    await new Promise(setImmediate);
    await clock.next();
    expect(spies[0].calledBefore(spies[1])).toBeTruthy();
  });
});

it.describe('runAll', () => {
  it('if there are no timers just return', async ({ clock }) => {
    await clock.runAll();
  });

  it('runs all timers', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    clock.setTimeout(spies[0], 10);
    clock.setTimeout(spies[1], 50);

    await clock.runAll();

    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeTruthy();
  });

  it('new timers added while running are also run', async ({ clock }) => {
    const spies = [
      createStub(() => {
        clock.setTimeout(spies[1], 50);
      }),
      createStub(),
    ];

    // Spy calls another setTimeout
    clock.setTimeout(spies[0], 10);

    await clock.runAll();

    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeTruthy();
  });

  it('throws before allowing infinite recursion', async ({ clock }) => {
    const recursiveCallback = () => {
      clock.setTimeout(recursiveCallback, 10);
    };
    recursiveCallback();
    await expect(clock.runAll()).rejects.toThrow();
  });

  it('the loop limit can be set when creating a clock', async ({}) => {
    const clock = createClock(0, 1);
    const spies = [createStub(), createStub()];
    clock.setTimeout(spies[0], 10);
    clock.setTimeout(spies[1], 50);
    await expect(clock.runAll()).rejects.toThrow();
  });

  it('the loop limit can be set when installing a clock', async ({ install }) => {
    const clock = install({ loopLimit: 1 });
    const spies = [createStub(), createStub()];
    setTimeout(spies[0], 10);
    setTimeout(spies[1], 50);

    await expect(clock.runAll()).rejects.toThrow();
  });

  it('throws before allowing infinite recursion from promises', async ({ clock }) => {
    const recursiveCallback = () => {
      void Promise.resolve().then(() => {
        clock.setTimeout(recursiveCallback, 10);
      });
    };
    recursiveCallback();

    // Clock API is async.
    await new Promise(setImmediate);
    await expect(clock.runAll()).rejects.toThrow();
  });

  it('should settle user-created promises', async ({ clock }) => {
    const spy = createStub();
    clock.setTimeout(() => {
      void Promise.resolve().then(spy);
    }, 55);
    await clock.runAll();
    expect(spy.called).toBeTruthy();
  });

  it('should settle nested user-created promises', async ({ clock }) => {
    const spy = createStub();

    clock.setTimeout(() => {
      void Promise.resolve().then(() => {
        void Promise.resolve().then(() => {
          void Promise.resolve().then(spy);
        });
      });
    }, 55);

    await clock.runAll();

    expect(spy.called).toBeTruthy();
  });

  it('should settle local promises before firing timers', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    void Promise.resolve().then(spies[0]);
    clock.setTimeout(spies[1], 55);

    // Clock API is async.
    await new Promise(setImmediate);
    await clock.runAll();
    expect(spies[0].calledBefore(spies[1])).toBeTruthy();
  });

  it('should settle user-created promises before firing more timers', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    clock.setTimeout(() => {
      void Promise.resolve().then(spies[0]);
    }, 55);
    clock.setTimeout(spies[1], 75);
    await clock.runAll();
    expect(spies[0].calledBefore(spies[1])).toBeTruthy();
  });
});

it.describe('runToLast', () => {
  it('returns current time when there are no timers', async ({ clock }) => {
    const time = await clock.runToLast();
    expect(time).toBe(0);
  });

  it('runs all existing timers', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    clock.setTimeout(spies[0], 10);
    clock.setTimeout(spies[1], 50);
    await clock.runToLast();
    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeTruthy();
  });

  it('returns time of the last timer', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    clock.setTimeout(spies[0], 10);
    clock.setTimeout(spies[1], 50);
    const time = await clock.runToLast();
    expect(time).toBe(50);
  });

  it('runs all existing timers when two timers are matched for being last', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    clock.setTimeout(spies[0], 10);
    clock.setTimeout(spies[1], 10);
    await clock.runToLast();
    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeTruthy();
  });

  it('new timers added with a call time later than the last existing timer are NOT run', async ({ clock }) => {
    const spies = [
      createStub(() => {
        clock.setTimeout(spies[1], 50);
      }),
      createStub(),
    ];

    // Spy calls another setTimeout
    clock.setTimeout(spies[0], 10);
    await clock.runToLast();
    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeFalsy();
  });

  it('new timers added with a call time earlier than the last existing timer are run', async ({ clock }) => {
    const spies = [
      createStub(),
      createStub(() => {
        clock.setTimeout(spies[2], 50);
      }),
      createStub(),
    ];

    clock.setTimeout(spies[0], 100);
    // Spy calls another setTimeout
    clock.setTimeout(spies[1], 10);
    await clock.runToLast();
    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeTruthy();
    expect(spies[2].called).toBeTruthy();
  });

  it('new timers cannot cause an infinite loop', async ({ clock }) => {
    const spy = createStub();
    const recursiveCallback = () => {
      clock.setTimeout(recursiveCallback, 0);
    };

    clock.setTimeout(recursiveCallback, 0);
    clock.setTimeout(spy, 100);
    await clock.runToLast();
    expect(spy.called).toBeTruthy();
  });

  it('should support clocks with start time', async ({ clock }) => {
    let invocations = 0;

    clock.setTimeout(function cb() {
      invocations++;
      clock.setTimeout(cb, 50);
    }, 50);

    await clock.runToLast();

    expect(invocations).toBe(1);
  });

  it('should settle user-created promises', async ({ clock }) => {
    const spy = createStub();
    clock.setTimeout(() => {
      void Promise.resolve().then(spy);
    }, 55);
    await clock.runToLast();
    expect(spy.called).toBeTruthy();
  });

  it('should settle nested user-created promises', async ({ clock }) => {
    const spy = createStub();

    clock.setTimeout(() => {
      void Promise.resolve().then(() => {
        void Promise.resolve().then(() => {
          void Promise.resolve().then(spy);
        });
      });
    }, 55);

    await clock.runToLast();
    expect(spy.called).toBeTruthy();
  });

  it('should settle local promises before firing timers', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    void Promise.resolve().then(spies[0]);
    clock.setTimeout(spies[1], 55);

    // Clock API is async.
    await new Promise(setImmediate);
    await clock.runToLast();
    expect(spies[0].calledBefore(spies[1])).toBeTruthy();
  });

  it('should settle user-created promises before firing more timers', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    clock.setTimeout(() => {
      void Promise.resolve().then(spies[0]);
    }, 55);
    clock.setTimeout(spies[1], 75);
    await clock.runToLast();
    expect(spies[0].calledBefore(spies[1])).toBeTruthy();
  });
});

it.describe('clearTimeout', () => {
  it('removes timeout', async ({ clock }) => {
    const stub = createStub();
    const id = clock.setTimeout(stub, 50);
    clock.clearTimeout(id);
    await clock.tick(50);
    expect(stub.called).toBeFalsy();
  });

  it('removes interval', async ({ clock }) => {
    const stub = createStub();
    const id = clock.setInterval(stub, 50);
    clock.clearTimeout(id);
    await clock.tick(50);
    expect(stub.called).toBeFalsy();
  });

  it('removes interval with undefined interval', async ({ clock }) => {
    const stub = createStub();
    const id = clock.setInterval(stub);
    clock.clearTimeout(id);
    await clock.tick(50);
    expect(stub.called).toBeFalsy();
  });

  it('ignores null argument', async ({ clock }) => {
    clock.clearTimeout(null);
  });
});

it.describe('reset', () => {
  it('resets to the time install with - issue #183', async ({ clock }) => {
    await clock.tick(100);
    clock.reset();
    expect(clock.now()).toBe(0);
  });

  it('resets hrTime - issue #206', async ({ clock }) => {
    await clock.tick(100);
    expect(clock.performance.now()).toEqual(100);
    clock.reset();
    expect(clock.performance.now()).toEqual(0);
  });
});

it.describe('setInterval', () => {
  it('throws if no arguments', async ({ clock }) => {
    expect(() => {
      // @ts-expect-error
      clock.setInterval();
    }).toThrow();
  });

  it('returns numeric id or object with numeric id', async ({ clock }) => {
    const result = clock.setInterval(() => {}, 10);
    expect(result).toBeGreaterThan(0);
  });

  it('returns unique id', async ({ clock }) => {
    const id1 = clock.setInterval(() => {}, 10);
    const id2 = clock.setInterval(() => {}, 10);

    expect(id2).not.toEqual(id1);
  });

  it('schedules recurring timeout', async ({ clock }) => {
    const stub = createStub();
    clock.setInterval(stub, 10);
    await clock.tick(99);

    expect(stub.callCount).toBe(9);
  });

  it('is not influenced by forward system clock changes', async ({ clock }) => {
    const stub = createStub();
    clock.setInterval(stub, 10);
    await clock.tick(11);
    expect(stub.callCount).toBe(1);
    clock.setTime(new clock.Date().getTime() + 1000);
    await clock.tick(8);
    expect(stub.callCount).toBe(1);
    await clock.tick(3);
    expect(stub.callCount).toBe(2);
  });

  it('is not influenced by backward system clock changes', async ({ clock }) => {
    const stub = createStub();
    clock.setInterval(stub, 10);
    await clock.tick(5);
    clock.setTime(new clock.Date().getTime() - 1000);
    await clock.tick(6);
    expect(stub.callCount).toBe(1);
    await clock.tick(10);
    expect(stub.callCount).toBe(2);
  });

  it('does not schedule recurring timeout when cleared', async ({ clock }) => {
    const stub = createStub(() => {
      if (stub.callCount === 3)
        clock.clearInterval(id);
    });

    const id = clock.setInterval(stub, 10);
    await clock.tick(100);

    expect(stub.callCount).toBe(3);
  });

  it('passes setTimeout parameters', async ({ clock }) => {
    const stub = createStub();
    clock.setInterval(stub, 2, 'the first', 'the second');
    await clock.tick(3);
    expect(stub.calledWithExactly('the first', 'the second')).toBeTruthy();
  });
});

it.describe('clearInterval', () => {
  it('removes interval', async ({ clock }) => {
    const stub = createStub();
    const id = clock.setInterval(stub, 50);
    clock.clearInterval(id);
    await clock.tick(50);
    expect(stub.called).toBeFalsy();
  });

  it('removes interval with undefined interval', async ({ clock }) => {
    const stub = createStub();
    const id = clock.setInterval(stub);
    clock.clearInterval(id);
    await clock.tick(50);
    expect(stub.called).toBeFalsy();
  });

  it('removes timeout', async ({ clock }) => {
    const stub = createStub();
    const id = clock.setTimeout(stub, 50);
    clock.clearInterval(id);
    await clock.tick(50);
    expect(stub.called).toBeFalsy();
  });

  it('ignores null argument', async ({ clock }) => {
    clock.clearInterval(null);
  });
});

it.describe('date', () => {
  it('provides date constructor', async ({ clock }) => {
    expect(clock.Date).toEqual(expect.any(Function));
  });

  it('creates real Date objects', async ({ clock }) => {
    const date = new clock.Date();
    expect(Date.prototype.isPrototypeOf(date)).toBeTruthy();
  });

  it('returns date as string when called as function', async ({ clock }) => {
    const date = clock.Date();
    expect(typeof date).toBe('string');
  });

  it('creates Date objects representing clock time', async ({ clock }) => {
    const date = new clock.Date();
    expect(date.getTime()).toBe(new Date(clock.now()).getTime());
  });

  it('returns date as string representing clock time', async ({ clock }) => {
    const date = clock.Date();
    expect(date).toBe(new Date(clock.now()).toString());
  });

  it('listens to ticking clock', async ({ clock }) => {
    const date1 = new clock.Date();
    await clock.tick(3);
    const date2 = new clock.Date();
    expect(date2.getTime() - date1.getTime()).toBe(3);
  });

  it('listens to system clock changes', async ({ clock }) => {
    const date1 = new clock.Date();
    clock.setTime(date1.getTime() + 1000);
    const date2 = new clock.Date();
    expect(date2.getTime() - date1.getTime()).toBe(1000);
  });

  it('creates regular date when passing timestamp', async ({ clock }) => {
    const date = new Date();
    const fakeDate = new clock.Date(date.getTime());
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('creates regular date when passing a date as string', async ({ clock }) => {
    const date = new Date();
    const fakeDate = new clock.Date(date.toISOString());
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('creates regular date when passing a date as RFC 2822 string', async ({ clock }) => {
    const date = new Date('Sat Apr 12 2014 12:22:00 GMT+1000');
    const fakeDate = new clock.Date('Sat Apr 12 2014 12:22:00 GMT+1000');
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('creates regular date when passing year, month', async ({ clock }) => {
    const date = new Date(2010, 4);
    const fakeDate = new clock.Date(2010, 4);
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('creates regular date when passing y, m, d', async ({ clock }) => {
    const date = new Date(2010, 4, 2);
    const fakeDate = new clock.Date(2010, 4, 2);
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('creates regular date when passing y, m, d, h', async ({ clock }) => {
    const date = new Date(2010, 4, 2, 12);
    const fakeDate = new clock.Date(2010, 4, 2, 12);
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('creates regular date when passing y, m, d, h, m', async ({ clock }) => {
    const date = new Date(2010, 4, 2, 12, 42);
    const fakeDate = new clock.Date(2010, 4, 2, 12, 42);
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('creates regular date when passing y, m, d, h, m, s', async ({ clock }) => {
    const date = new Date(2010, 4, 2, 12, 42, 53);
    const fakeDate = new clock.Date(2010, 4, 2, 12, 42, 53);
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('creates regular date when passing y, m, d, h, m, s, ms', async ({ clock }) => {
    const date = new Date(2010, 4, 2, 12, 42, 53, 498);
    const fakeDate = new clock.Date(2010, 4, 2, 12, 42, 53, 498);
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('returns date as string when calling with arguments', async ({ clock }) => {
    // @ts-expect-error
    const fakeDateStr = clock.Date(2010, 4, 2, 12, 42, 53, 498);
    expect(fakeDateStr).toBe(new clock.Date().toString());
  });

  it('returns date as string when calling with timestamp', async ({ clock }) => {
    // @ts-expect-error
    const fakeDateStr = clock.Date(1);
    expect(fakeDateStr).toBe(new clock.Date().toString());
  });

  it('mirrors native Date.prototype', async ({ clock }) => {
    expect(clock.Date.prototype).toEqual(Date.prototype);
  });

  it('supports now method if present', async ({ clock }) => {
    expect(typeof clock.Date.now).toEqual(typeof Date.now);
  });

  it('returns clock.now()', async ({ clock }) => {
    const clock_now = clock.Date.now();
    const global_now = Date.now();
    expect(clock_now).toBeGreaterThanOrEqual(clock.now());
    expect(clock_now).toBeLessThanOrEqual(global_now);
  });

  it('mirrors parse method', async ({ clock }) => {
    expect(clock.Date.parse).toEqual(Date.parse);
  });

  it('mirrors UTC method', async ({ clock }) => {
    expect(clock.Date.UTC).toEqual(Date.UTC);
  });

  it('mirrors toUTCString method', async ({ clock }) => {
    expect(clock.Date.prototype.toUTCString).toEqual(Date.prototype.toUTCString);
  });
});

it.describe('stubTimers', () => {
  it('returns clock object', async ({ install }) => {
    const clock = install();
    expect(clock).toEqual(expect.any(Object));
    expect(clock.tick).toEqual(expect.any(Function));
  });

  it('takes an object parameter', async ({ install }) => {
    const clock = install({});
    expect(clock).toEqual(expect.any(Object));
  });

  it('sets initial timestamp', async ({ install }) => {
    const clock = install({ now: 1400 });
    expect(clock.now()).toBe(1400);
  });

  it('replaces global setTimeout', async ({ install }) => {
    const clock = install();
    const stub = createStub();

    setTimeout(stub, 1000);
    await clock.tick(1000);

    expect(stub.called).toBeTruthy();
  });

  it('global fake setTimeout should return id', async ({ install }) => {
    install();
    const stub = createStub();
    const to = setTimeout(stub, 1000);
    expect(to).toEqual(expect.any(Number));
  });

  it('replaces global clearTimeout', async ({ install }) => {
    const clock = install();
    const stub = createStub();

    clearTimeout(setTimeout(stub, 1000));
    await clock.tick(1000);

    expect(stub.called).toBeFalsy();
  });

  it('replaces global setInterval', async ({ install }) => {
    const clock = install();
    const stub = createStub();

    setInterval(stub, 500);
    await clock.tick(1000);

    expect(stub.callCount).toBe(2);
  });

  it('replaces global clearInterval', async ({ install }) => {
    const clock = install();
    const stub = createStub();

    clearInterval(setInterval(stub, 500));
    await clock.tick(1000);

    expect(stub.called).toBeFalsy();
  });

  it('replaces global performance.now', async ({ install }) => {
    const clock = install();
    const prev = performance.now();
    await clock.tick(1000);
    const next = performance.now();
    expect(next).toBe(1000);
    expect(prev).toBe(0);
  });

  it('uninstalls global performance.now', async ({ install }) => {
    const oldNow = performance.now;
    const clock = install();
    expect(performance.now).toBe(clock.performance.now);
    clock.uninstall();
    expect(performance.now).toBe(oldNow);
  });

  it('should let performance.mark still be callable after install() (#136)', async ({ install }) => {
    it.skip(nodeMajorVersion < 20);
    install();
    expect(() => {
      performance.mark('a name');
    }).not.toThrow();
  });

  it('should not alter the global performance properties and methods', async ({ install }) => {
    it.skip(nodeMajorVersion < 20);
    (Performance.prototype as any).someFunc1 = () => {};
    (Performance.prototype as any).someFunc2 = () => {};
    (Performance.prototype as any).someFunc3 = () => {};

    const clock = install();
    expect((performance as any).someFunc1).toEqual(expect.any(Function));
    expect((performance as any).someFunc2).toEqual(expect.any(Function));
    expect((performance as any).someFunc3).toEqual(expect.any(Function));
    clock.uninstall();
    delete (Performance.prototype as any).someFunc1;
    delete (Performance.prototype as any).someFunc2;
    delete (Performance.prototype as any).someFunc3;
  });

  it('should replace the getEntries, getEntriesByX methods with noops that return []', async ({ install }) => {
    it.skip(nodeMajorVersion < 20);
    const backupDescriptors = Object.getOwnPropertyDescriptors(Performance);

    function noop() {
      return ['foo'];
    }

    for (const propName of ['getEntries', 'getEntriesByName', 'getEntriesByType']) {
      Object.defineProperty(Performance.prototype, propName, {
        writable: true,
      });
    }

    (Performance.prototype as any).getEntries = noop;
    (Performance.prototype as any).getEntriesByName = noop;
    (Performance.prototype as any).getEntriesByType = noop;

    const clock = install();

    expect(performance.getEntries()).toEqual([]);
    expect((performance as any).getEntriesByName()).toEqual([]);
    expect((performance as any).getEntriesByType()).toEqual([]);

    clock.uninstall();

    expect(performance.getEntries()).toEqual(['foo']);
    expect((performance as any).getEntriesByName()).toEqual(['foo']);
    expect((performance as any).getEntriesByType()).toEqual(['foo']);

    Object.keys(backupDescriptors).forEach(key => {
      Object.defineProperty(Performance.prototype, key, backupDescriptors[key]);
    });
  });

  it.fixme('deletes global property on uninstall if it was inherited onto the global object', ({}) => {
    // Give the global object an inherited 'setTimeout' method
    const proto = { Date,
      setTimeout: () => {},
      clearTimeout: () => {},
      setInterval: () => {},
      clearInterval: () => {},
    };
    const myGlobal = Object.create(proto);

    const { clock } = rawInstall(myGlobal, { now: 0, toFake: ['setTimeout'] });
    expect(myGlobal.hasOwnProperty('setTimeout')).toBeTruthy();
    clock.uninstall();
    expect(myGlobal.hasOwnProperty('setTimeout')).toBeFalsy();
  });

  it('fakes Date constructor', ({ installEx }) => {
    const { originals } = installEx({ now: 0 });
    const now = new Date();

    expect(Date).not.toBe(originals.Date);
    expect(now.getTime()).toBe(0);
  });

  it(`fake Date constructor should mirror Date's properties`, async ({ clock }) => {
    expect(Date).not.toBe(clock.Date);
    expect(Date.prototype).toEqual(clock.Date.prototype);
  });

  it('decide on Date.now support at call-time when supported', async ({ install }) => {
    (Date.now as any) = () => {};
    install({ now: 0 });
    expect(Date.now).toEqual(expect.any(Function));
  });

  it('mirrors custom Date properties', async ({ install }) => {
    const f = () => {
      return '';
    };
    (Date as any).format = f;
    install();

    expect((Date as any).format).toEqual(f);
  });

  it('uninstalls Date constructor', () => {
    const { clock, originals } = rawInstall(globalThis, { now: 0 });
    clock.uninstall();
    expect(Date).toBe(originals.Date);
  });

  it('fakes provided methods', ({ installEx }) => {
    const { originals } = installEx({ now: 0, toFake: ['setTimeout', 'Date'] });
    expect(setTimeout).not.toBe(originals.setTimeout);
    expect(Date).not.toBe(originals.Date);
  });

  it('resets faked methods', async ({ install }) => {
    const { clock, originals } = rawInstall(globalThis, {
      now: 0,
      toFake: ['setTimeout', 'Date'],
    });
    clock.uninstall();

    expect(setTimeout).toBe(originals.setTimeout);
    expect(Date).toBe(originals.Date);
  });

  it('does not fake methods not provided', ({ installEx }) => {
    const { originals } = installEx({
      now: 0,
      toFake: ['setTimeout', 'Date'],
    });

    expect(clearTimeout).toBe(originals.clearTimeout);
    expect(setInterval).toBe(originals.setInterval);
    expect(clearInterval).toBe(originals.clearInterval);
  });
});

it.describe('shouldAdvanceTime', () => {
  it('should create an auto advancing timer', async () => {
    const testDelay = 29;
    const date = new Date('2015-09-25');
    const clock = createClock(date);
    clock.advanceAutomatically();
    expect(clock.Date.now()).toBe(1443139200000);
    const timeoutStarted = clock.Date.now();

    let callback: (r: number) => void;
    const promise = new Promise<number>(r => callback = r);

    clock.setTimeout(() => {
      const timeDifference = clock.Date.now() - timeoutStarted;
      callback(timeDifference);
    }, testDelay);
    expect(await promise).toBe(testDelay);

  });

  it('should test setInterval', async () => {
    const interval = 20;
    let intervalsTriggered = 0;
    const cyclesToTrigger = 3;
    const date = new Date('2015-09-25');
    const clock = createClock(date);
    clock.advanceAutomatically();
    expect(clock.Date.now()).toBe(1443139200000);
    const timeoutStarted = clock.Date.now();

    let callback: (r: number) => void;
    const promise = new Promise<number>(r => callback = r);

    const intervalId = clock.setInterval(() => {
      if (++intervalsTriggered === cyclesToTrigger) {
        clock.clearInterval(intervalId);
        const timeDifference = clock.Date.now() - timeoutStarted;
        callback(timeDifference);
      }
    }, interval);

    expect(await promise).toBe(interval * cyclesToTrigger);
  });

  it('should not depend on having to stub setInterval or clearInterval to work', async ({ install }) => {
    const origSetInterval = globalThis.setInterval;
    const origClearInterval = globalThis.clearInterval;

    install({ toFake: ['setTimeout'] });
    expect(globalThis.setInterval).toBe(origSetInterval);
    expect(globalThis.clearInterval).toBe(origClearInterval);
  });
});

it.describe('requestAnimationFrame', () => {
  it('throws if no arguments', async ({ clock }) => {
    expect(() => {
      // @ts-expect-error
      clock.requestAnimationFrame();
    }).toThrow();
  });

  it('returns numeric id or object with numeric id', async ({ clock }) => {
    const result = clock.requestAnimationFrame(() => {});
    expect(result).toEqual(expect.any(Number));
  });

  it('returns unique id', async ({ clock }) => {
    const id1 = clock.requestAnimationFrame(() => {});
    const id2 = clock.requestAnimationFrame(() => {});
    expect(id2).not.toEqual(id1);
  });

  it('should run every 16ms', async ({ clock }) => {
    const stub = createStub();
    clock.requestAnimationFrame(stub);
    await clock.tick(15);
    expect(stub.callCount).toBe(0);
    await clock.tick(1);
    expect(stub.callCount).toBe(1);
  });

  it('should be called with performance.now() when available', async ({ clock }) => {
    const stub = createStub();
    clock.requestAnimationFrame(stub);
    await clock.tick(20);
    expect(stub.calledWith(16)).toBeTruthy();
  });

  it('should be called with performance.now() even when performance unavailable', async ({ clock }) => {
    const stub = createStub();
    clock.requestAnimationFrame(stub);
    await clock.tick(20);
    expect(stub.calledWith(16)).toBeTruthy();
  });

  it('should call callback once', async ({ clock }) => {
    const stub = createStub();
    clock.requestAnimationFrame(stub);
    await clock.tick(32);
    expect(stub.callCount).toBe(1);
  });

  it('should schedule two callbacks before the next frame at the same time', async ({ clock }) => {
    const stub1 = createStub();
    const stub2 = createStub();
    clock.requestAnimationFrame(stub1);
    await clock.tick(5);
    clock.requestAnimationFrame(stub2);
    await clock.tick(11);
    expect(stub1.calledWith(16)).toBeTruthy();
    expect(stub2.calledWith(16)).toBeTruthy();
  });

  it('should properly schedule callback for 3rd frame', async ({ clock }) => {
    const stub1 = createStub();
    const stub2 = createStub();
    clock.requestAnimationFrame(stub1);
    await clock.tick(57);
    clock.requestAnimationFrame(stub2);
    await clock.tick(10);
    expect(stub1.calledWith(16)).toBeTruthy();
    expect(stub2.calledWith(64)).toBeTruthy();
  });

  it('should schedule for next frame if on current frame', async ({ clock }) => {
    const stub = createStub();
    await clock.tick(16);
    clock.requestAnimationFrame(stub);
    await clock.tick(16);
    expect(stub.calledWith(32)).toBeTruthy();
  });
});

it.describe('cancelAnimationFrame', () => {
  it('removes animation frame', async ({ clock }) => {
    const stub = createStub();
    const id = clock.requestAnimationFrame(stub);
    clock.cancelAnimationFrame(id);
    await clock.tick(16);
    expect(stub.called).toBeFalsy();
  });

  it('does not remove timeout', async ({ clock }) => {
    const stub = createStub();
    const id = clock.setTimeout(stub, 50);
    expect(() => {
      clock.cancelAnimationFrame(id);
    }).toThrow();
    await clock.tick(50);
    expect(stub.called).toBeTruthy();
  });

  it('does not remove interval', async ({ clock }) => {
    const stub = createStub();
    const id = clock.setInterval(stub, 50);
    expect(() => {
      clock.cancelAnimationFrame(id);
    }).toThrow();
    await clock.tick(50);
    expect(stub.called).toBeTruthy();
  });

  it('ignores null argument', async ({ clock }) => {
    clock.cancelAnimationFrame(null);
  });
});

it.describe('runToFrame', () => {
  it('should tick next frame', async ({ clock }) => {
    await clock.runToFrame();
    expect(clock.now()).toBe(16);
    await clock.tick(3);
    await clock.runToFrame();
    expect(clock.now()).toBe(32);
  });
});

it.describe('jump', () => {
  it('ignores timers which wouldn\'t be run', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub, 1000);
    await clock.jump(500);
    expect(stub.called).toBeFalsy();
  });

  it('pushes back execution time for skipped timers', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(() => {
      stub(clock.Date.now());
    }, 1000);
    await clock.jump(2000);
    expect(stub.callCount).toBe(1);
    expect(stub.calledWith(2000)).toBeTruthy();
  });

  it('handles multiple pending timers and types', async ({ clock }) => {
    const longTimers = [createStub(), createStub()];
    const shortTimers = [createStub(), createStub(), createStub()];
    clock.setTimeout(longTimers[0], 2000);
    clock.setInterval(longTimers[1], 2500);
    clock.setTimeout(shortTimers[0], 250);
    clock.setInterval(shortTimers[1], 100);
    clock.requestAnimationFrame(shortTimers[2]);
    await clock.jump(1500);
    for (const stub of longTimers)
      expect(stub.called).toBeFalsy();
    for (const stub of shortTimers)
      expect(stub.callCount).toBe(1);
  });

  it('supports string time arguments', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub, 100000); // 100000 = 1:40
    await clock.jump('01:50');
    expect(stub.callCount).toBe(1);
  });
});

it.describe('performance.now()', () => {
  it('should start at 0', async ({ clock }) => {
    const result = clock.performance.now();
    expect(result).toBe(0);
  });

  it('should run along with clock.tick', async ({ clock }) => {
    await clock.tick(5000);
    const result = clock.performance.now();
    expect(result).toBe(5000);
  });

  it('should listen to multiple ticks in performance.now', async ({ clock }) => {
    for (let i = 0; i < 10; i++) {
      const next = clock.performance.now();
      expect(next).toBe(1000 * i);
      await clock.tick(1000);
    }
  });

  it('should run with ticks with timers set', async ({ clock }) => {
    clock.setTimeout(() => {
      const result = clock.performance.now();
      expect(result).toBe(2500);
    }, 2500);
    await clock.tick(5000);
  });
});

it.describe('requestIdleCallback', () => {
  it('throws if no arguments', async ({ clock }) => {
    expect(() => {
      // @ts-expect-error
      clock.requestIdleCallback();
    }).toThrow();
  });

  it('returns numeric id', async ({ clock }) => {
    const result = clock.requestIdleCallback(() => {});
    expect(result).toEqual(expect.any(Number));
  });

  it('returns unique id', async ({ clock }) => {
    const id1 = clock.requestIdleCallback(() => {});
    const id2 = clock.requestIdleCallback(() => {});
    expect(id2).not.toEqual(id1);
  });

  it('runs after all timers', async ({ clock }) => {
    const stub = createStub();
    clock.requestIdleCallback(stub);
    await clock.tick(1000);
    expect(stub.called).toBeTruthy();
    const idleCallbackArg = stub.firstCall.args[0];
    expect(idleCallbackArg.didTimeout).toBeFalsy();
    expect(idleCallbackArg.timeRemaining()).toBe(0);
  });

  it('runs no later than timeout option even if there are any timers', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(() => {}, 10);
    clock.setTimeout(() => {}, 30);
    clock.requestIdleCallback(stub, { timeout: 20 });
    await clock.tick(20);
    expect(stub.called).toBeTruthy();
  });

  it(`doesn't runs if there are any timers and no timeout option`, async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(() => {}, 30);
    clock.requestIdleCallback(stub);
    await clock.tick(35);
    expect(stub.called).toBeFalsy();
  });
});

it.describe('cancelIdleCallback', () => {
  it('removes idle callback', async ({ clock }) => {
    const stub = createStub();
    const callbackId = clock.requestIdleCallback(stub, { timeout: 0 });
    clock.cancelIdleCallback(callbackId);
    await clock.tick(0);
    expect(stub.called).toBeFalsy();
  });
});

it.describe('loop limit stack trace', () => {
  const expectedMessage =
    'Aborting after running 5 timers, assuming an infinite loop!';
  it.use({ loopLimit: 5 });

  it.describe('setTimeout', () => {
    it('provides a stack trace for running all async', async ({ clock }) => {
      const catchSpy = createStub();
      const recursiveCreateTimer = () => {
        clock.setTimeout(recursiveCreateTimer, 10);
      };

      recursiveCreateTimer();
      await clock.runAll().catch(catchSpy);
      expect(catchSpy.callCount).toBe(1);
      const err = catchSpy.firstCall.args[0];
      expect(err.message).toBe(expectedMessage);
      expect(err.stack).toMatch(new RegExp(`Error: ${expectedMessage}\\s+Timeout - recursiveCreateTimer`));
    });

    it('provides a stack trace for running all sync', async ({ clock }) => {
      let caughtError = false;
      const recursiveCreateTimer = () => {
        clock.setTimeout(recursiveCreateTimer, 10);
      };

      recursiveCreateTimer();
      try {
        await clock.runAll();
      } catch (err) {
        caughtError = true;
        expect(err.message).toBe(expectedMessage);
        expect(err.stack).toMatch(new RegExp(`Error: ${expectedMessage}\\s+Timeout - recursiveCreateTimer`));
      }
      expect(caughtError).toBeTruthy();
    });
  });

  it.describe('requestIdleCallback', () => {
    it('provides a stack trace for running all async', async ({ clock }) => {
      const catchSpy = createStub();
      const recursiveCreateTimer = () => {
        clock.requestIdleCallback(recursiveCreateTimer, { timeout: 10 });
      };

      recursiveCreateTimer();
      await clock.runAll().catch(catchSpy);
      expect(catchSpy.callCount).toBe(1);
      const err = catchSpy.firstCall.args[0];
      expect(err.message).toBe(expectedMessage);
      expect(err.stack).toMatch(new RegExp(`Error: ${expectedMessage}\\s+IdleCallback - recursiveCreateTimer`));
    });

    it('provides a stack trace for running all sync', async ({ clock }) => {
      let caughtError = false;
      const recursiveCreateTimer = () => {
        clock.requestIdleCallback(recursiveCreateTimer, { timeout: 10 });
      };

      recursiveCreateTimer();
      try {
        await clock.runAll();
      } catch (err) {
        caughtError = true;
        expect(err.message).toBe(expectedMessage);
        expect(err.stack).toMatch(new RegExp(`Error: ${expectedMessage}\\s+IdleCallback - recursiveCreateTimer`));
      }
      expect(caughtError).toBeTruthy();
    });
  });

  it.describe('setInterval', () => {
    it('provides a stack trace for running all async', async ({ clock }) => {
      const catchSpy = createStub();
      const recursiveCreateTimer = () => {
        clock.setInterval(recursiveCreateTimer, 10);
      };

      recursiveCreateTimer();
      await clock.runAll().catch(catchSpy);
      expect(catchSpy.callCount).toBe(1);
      const err = catchSpy.firstCall.args[0];
      expect(err.message).toBe(expectedMessage);
      expect(err.stack).toMatch(new RegExp(`Error: ${expectedMessage}\\s+Interval - recursiveCreateTimer`));
    });

    it('provides a stack trace for running all sync', async ({ clock }) => {
      let caughtError = false;
      const recursiveCreateTimer = () => {
        clock.setInterval(recursiveCreateTimer, 10);
      };

      recursiveCreateTimer();
      try {
        await clock.runAll();
      } catch (err) {
        caughtError = true;
        expect(err.message).toBe(expectedMessage);
        expect(err.stack).toMatch(new RegExp(`Error: ${expectedMessage}\\s+Interval - recursiveCreateTimer`));
      }
      expect(caughtError).toBeTruthy();
    });
  });

  it.describe('requestAnimationFrame', () => {
    it('provides a stack trace for running all async', async ({ clock }) => {
      const catchSpy = createStub();
      const recursiveCreateTimer = () => {
        clock.requestAnimationFrame(recursiveCreateTimer);
      };

      recursiveCreateTimer();
      await clock.runAll().catch(catchSpy);
      expect(catchSpy.callCount).toBe(1);
      const err = catchSpy.firstCall.args[0];
      expect(err.message).toBe(expectedMessage);
      expect(err.stack).toMatch(new RegExp(`Error: ${expectedMessage}\\s+AnimationFrame - recursiveCreateTimer`));
    });

    it('provides a stack trace for running all sync', async ({ clock }) => {
      let caughtError = false;
      const recursiveCreateTimer = () => {
        clock.requestAnimationFrame(recursiveCreateTimer);
      };

      recursiveCreateTimer();
      try {
        await clock.runAll();
      } catch (err) {
        caughtError = true;
        expect(err.message).toBe(expectedMessage);
        expect(err.stack).toMatch(new RegExp(`Error: ${expectedMessage}\\s+AnimationFrame - recursiveCreateTimer`));
      }
      expect(caughtError).toBeTruthy();
    });
  });
});

it.describe('Intl API', () => {
  function isFirstOfMonth(ianaTimeZone, timestamp?: number) {
    return (
      new Intl.DateTimeFormat(undefined, { timeZone: ianaTimeZone })
          .formatToParts(timestamp)
          .find(part => part.type === 'day').value === '1'
    );
  }

  it('Executes formatRange like normal', async ({ clock }) => {
    const start = new Date(Date.UTC(2020, 0, 1, 0, 0));
    const end = new Date(Date.UTC(2020, 0, 1, 0, 1));
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'UTC',
      hour12: false,
      hour: 'numeric',
      minute: 'numeric',
    };
    expect(
        new Intl.DateTimeFormat('en-GB', options).formatRange(start, end),
    ).toBe('00:00–00:01');
  });

  it('Executes formatRangeToParts like normal', async ({ clock }) => {
    const start = new Date(Date.UTC(2020, 0, 1, 0, 0));
    const end = new Date(Date.UTC(2020, 0, 1, 0, 1));
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'UTC',
      hour12: false,
      hour: 'numeric',
      minute: 'numeric',
    };
    expect(new Intl.DateTimeFormat('en-GB', options).formatRangeToParts(start, end)).toEqual([
      { type: 'hour', value: '00', source: 'startRange' },
      { type: 'literal', value: ':', source: 'startRange' },
      { type: 'minute', value: '00', source: 'startRange' },
      { type: 'literal', value: '–', source: 'shared' },
      { type: 'hour', value: '00', source: 'endRange' },
      { type: 'literal', value: ':', source: 'endRange' },
      { type: 'minute', value: '01', source: 'endRange' },
    ]);
  });

  it('Executes resolvedOptions like normal', async ({ clock }) => {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'UTC',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    };
    expect(new Intl.DateTimeFormat('en-GB', options).resolvedOptions()).toEqual({
      locale: 'en-GB',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: 'UTC',
      hour12: false,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  it('formatToParts via isFirstOfMonth -> Returns true when passed a timestamp argument that is first of the month', async ({ clock }) => {
    // June 1 04:00 UTC - Toronto is June 1 00:00
    expect(isFirstOfMonth('America/Toronto', Date.UTC(2022, 5, 1, 4))).toBeTruthy();
  });

  it('formatToParts via isFirstOfMonth -> Returns false when passed a timestamp argument that is not first of the month', async ({ clock }) => {
    // June 1 00:00 UTC - Toronto is May 31 20:00
    expect(isFirstOfMonth('America/Toronto', Date.UTC(2022, 5, 1))).toBeFalsy();
  });

  it('formatToParts via isFirstOfMonth -> Returns true when passed no timestamp and system time is first of the month', async ({ install }) => {
    // June 1 04:00 UTC - Toronto is June 1 00:00
    install({ now: Date.UTC(2022, 5, 1, 4) });
    expect(isFirstOfMonth('America/Toronto')).toBeTruthy();
  });

  it('formatToParts via isFirstOfMonth -> Returns false when passed no timestamp and system time is not first of the month', async ({ install }) => {
    // June 1 00:00 UTC - Toronto is May 31 20:00
    install({ now: Date.UTC(2022, 5, 1) });
    expect(isFirstOfMonth('America/Toronto')).toBeFalsy();
  });

  it('Executes supportedLocalesOf like normal', async ({ installEx }) => {
    const { originals } = installEx();
    expect(Intl.DateTimeFormat.supportedLocalesOf([])).toEqual(
        originals.Intl.DateTimeFormat.supportedLocalesOf([]),
    );
  });

  it('Creates a RelativeTimeFormat like normal', async ({ clock }) => {
    const rtf = new Intl.RelativeTimeFormat('en-GB', {
      numeric: 'auto',
    });
    expect(rtf.format(2, 'day')).toBe('in 2 days');
  });
});

interface Stub {
  called: boolean;
  callCount: number;
  calls: { receiver: any, args: any[], time: bigint }[];
  firstCall: { args: any[] } | undefined;
  calledOn: (thisObj: any) => boolean;
  calledBefore: (other: Stub) => boolean;
  calledWithExactly: (...args: any[]) => void;
  calledWith(arg: any): void;
  (...args: any[]): void;
  throws: () => Stub;
}

const createStub = (body?: () => void): Stub => {
  const allFirstArgs = new Set<any>();
  const stub: Stub = function(...args: any[]) {
    stub.calls.push({ receiver: this, args, time: process.hrtime.bigint() });
    allFirstArgs.add(args[0]);
    if (body)
      body();
  } as any;

  stub.calls = [];
  const stubAny = stub as any;
  stubAny.__defineGetter__('callCount', () => stub.calls.length);
  stubAny.__defineGetter__('called', () => stub.calls.length > 0);
  stubAny.__defineGetter__('firstCall', () => stub.calls[0]);

  stub.calledOn = thisObj => stub.calls[0].receiver === thisObj;

  stub.calledWithExactly = (...args) => {
    expect(stub.calls[0].args).toEqual(args);
    return true;
  };
  stub.calledWith = arg => {
    expect(allFirstArgs).toContain(arg);
    return true;
  };
  stub.calledBefore = other => {
    expect(other.calls[0].time).toBeGreaterThan(stub.calls[0].time);
    return true;
  };
  stub.throws = () => createStub(() => { throw new Error(''); });
  return stub;
};

const nodeMajorVersion = +process.versions.node.split('.')[0];
