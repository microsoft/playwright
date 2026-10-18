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
import { createClock as rawCreateClock, install as rawInstall } from '../../../packages/injected/src/clock';
import type { InstallConfig, ClockController } from '../../../packages/injected/src/clock';
import type { Builtins } from '../../../packages/injected/src/utilityScript';

const createClock = (now?: number): ClockController & Builtins => {
  const { clock, api } = rawCreateClock(globalThis);
  clock.setSystemTime(now || 0);
  for (const key of Object.keys(api))
    clock[key] = api[key];
  return clock as ClockController & Builtins;
};

type ClockFixtures = {
  clock: ClockController & Builtins;
  now: number | undefined;
  install: (now?: number) => ClockController & Builtins;
  installEx: (config?: InstallConfig) => { clock: ClockController, api: Builtins, originals: Builtins };
};

const it = test.extend<ClockFixtures>({
  clock: async ({ now }, use) => {
    const clock = createClock(now);
    await use(clock);
  },

  now: undefined,

  install: async ({}, use) => {
    let clockObject: ClockController & Builtins;
    const install = (now?: number) => {
      const { clock, api } = rawInstall(globalThis);
      if (now)
        clock.setSystemTime(now);
      for (const key of Object.keys(api))
        clock[key] = api[key];
      clockObject = clock as ClockController & Builtins;
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
  it('CK-057 throws if no arguments', async ({ clock }) => {
    expect(() => {
      // @ts-expect-error
      clock.setTimeout();
    }).toThrow();
  });

  it('CK-058 does not throw if |undefined| or |null| is passed as a callback', async ({ clock }) => {
    const timerId1 = clock.setTimeout(undefined, 10);
    const timerId2 = clock.setTimeout(null, 10);
    await clock.runFor(10);
    expect(timerId1).toBeGreaterThan(0);
    expect(timerId2).toBeGreaterThan(timerId1);
  });

  it('CK-059 returns numeric id or object with numeric id', async ({ clock }) => {
    const result = clock.setTimeout(() => { }, 10);
    expect(result).toEqual(expect.any(Number));
  });

  it('CK-060 returns unique id', async ({ clock }) => {
    const id1 = clock.setTimeout(() => { }, 10);
    const id2 = clock.setTimeout(() => { }, 10);
    expect(id2).not.toBe(id1);
  });

  it('CK-061 starts id from a large number', async ({ clock }) => {
    const timer = clock.setTimeout(() => { }, 10);
    expect(timer).toBeGreaterThanOrEqual(1e12);
  });

  it('CK-062 sets timers on instance', async ({ clock }) => {
    const clock1 = createClock();
    const clock2 = createClock();
    const stubs = [createStub(), createStub()];

    clock1.setTimeout(stubs[0], 100);
    clock2.setTimeout(stubs[1], 100);
    await clock2.runFor(200);

    expect(stubs[0].called).toBeFalsy();
    expect(stubs[1].called).toBeTruthy();
  });

  it('CK-063 parses numeric string times', async ({ clock }) => {
    let evalCalled = false;
    clock.setTimeout(() => {
      evalCalled = true;
      // @ts-expect-error
    }, '10');
    await clock.runFor(10);
    expect(evalCalled).toBeTruthy();
  });

  it('CK-064 parses no-numeric string times', async ({ clock }) => {
    let evalCalled = false;
    clock.setTimeout(() => {
      evalCalled = true;
      // @ts-expect-error
    }, 'string');
    await clock.runFor(10);

    expect(evalCalled).toBeTruthy();
  });

  it('CK-065 passes setTimeout parameters', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub, 2, 'the first', 'the second');
    await clock.runFor(3);
    expect(stub.calledWithExactly('the first', 'the second')).toBeTruthy();
  });

  it('CK-066 calls correct timeout on recursive tick', async ({ clock }) => {
    const stub = createStub();
    const recurseCallback = () => {
      void clock.runFor(100);
    };

    clock.setTimeout(recurseCallback, 50);
    clock.setTimeout(stub, 100);

    await clock.runFor(50);
    expect(stub.called).toBeTruthy();
  });

  it('CK-067 does not depend on this', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub, 100);
    await clock.runFor(100);
    expect(stub.called).toBeTruthy();
  });

  it('CK-068 is not influenced by forward system clock changes', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub, 5000);
    await clock.runFor(1000);
    clock.setSystemTime(new clock.Date().getTime() + 1000);
    await clock.runFor(3990);
    expect(stub.callCount).toBe(0);
    await clock.runFor(20);
    expect(stub.callCount).toBe(1);
  });

  it('CK-069 is not influenced by backward system clock changes', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub, 5000);
    await clock.runFor(1000);
    clock.setSystemTime(new clock.Date().getTime() - 1000);
    await clock.runFor(3990);
    expect(stub.callCount).toBe(0);
    await clock.runFor(20);
    expect(stub.callCount).toBe(1);
  });

  it.describe('use of eval when not in node', () => {
    it.beforeEach(() => {
      globalThis.evalCalled = false;
    });

    it.afterEach(() => {
      delete globalThis.evalCalled.evalCalled;
    });

    it('CK-070 evals non-function callbacks', async ({ clock }) => {
      clock.setTimeout('globalThis.evalCalled = true', 10);
      await clock.runFor(10);

      expect(globalThis.evalCalled).toBeTruthy();
    });

    it('CK-071 only evals on global scope', async ({ clock }) => {
      const x = 15;
      try {
        clock.setTimeout('x', x);
        await clock.runFor(x);
        expect(true).toBeFalsy();
      } catch (e) {
        expect(e).toBeInstanceOf(ReferenceError);
      }
    });
  });
});

it.describe('runFor', () => {
  it('CK-072 triggers immediately without specified delay', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub);
    await clock.runFor(0);
    expect(stub.called).toBeTruthy();
  });

  it('CK-073 does not trigger without sufficient delay', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub, 100);
    await clock.runFor(10);
    expect(stub.called).toBeFalsy();
  });

  it('CK-074 triggers after sufficient delay', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub, 100);
    await clock.runFor(100);
    expect(stub.called).toBeTruthy();
  });

  it('CK-075 triggers simultaneous timers', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    clock.setTimeout(spies[0], 100);
    clock.setTimeout(spies[1], 100);
    await clock.runFor(100);
    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeTruthy();
  });

  it('CK-076 triggers multiple simultaneous timers', async ({ clock }) => {
    const spies = [createStub(), createStub(), createStub(), createStub()];
    clock.setTimeout(spies[0], 100);
    clock.setTimeout(spies[1], 100);
    clock.setTimeout(spies[2], 99);
    clock.setTimeout(spies[3], 100);
    await clock.runFor(100);
    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeTruthy();
    expect(spies[2].called).toBeTruthy();
    expect(spies[3].called).toBeTruthy();
  });

  it('CK-077 triggers multiple simultaneous timers with zero callAt', async ({ clock }) => {
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
    await clock.runFor(10);
    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeTruthy();
    expect(spies[2].called).toBeTruthy();
  });

  it('CK-078 waits after setTimeout was called', async ({ clock }) => {
    await clock.runFor(100);
    const stub = createStub();
    clock.setTimeout(stub, 150);
    await clock.runFor(50);
    expect(stub.called).toBeFalsy();
    await clock.runFor(100);
    expect(stub.called).toBeTruthy();
  });

  it('CK-079 mini integration test', async ({ clock }) => {
    const stubs = [createStub(), createStub(), createStub()];
    clock.setTimeout(stubs[0], 100);
    clock.setTimeout(stubs[1], 120);
    await clock.runFor(10);
    await clock.runFor(89);
    expect(stubs[0].called).toBeFalsy();
    expect(stubs[1].called).toBeFalsy();
    clock.setTimeout(stubs[2], 20);
    await clock.runFor(1);
    expect(stubs[0].called).toBeTruthy();
    expect(stubs[1].called).toBeFalsy();
    expect(stubs[2].called).toBeFalsy();
    await clock.runFor(19);
    expect(stubs[1].called).toBeFalsy();
    expect(stubs[2].called).toBeTruthy();
    await clock.runFor(1);
    expect(stubs[1].called).toBeTruthy();
  });

  it('CK-080 triggers even when some throw', async ({ clock }) => {
    const stubs = [createStub().throws(), createStub()];

    clock.setTimeout(stubs[0], 100);
    clock.setTimeout(stubs[1], 120);

    await expect(clock.runFor(120)).rejects.toThrow();

    expect(stubs[0].called).toBeTruthy();
    expect(stubs[1].called).toBeTruthy();
  });

  it('CK-081 calls function with global object or null (strict mode) as this', async ({ clock }) => {
    const stub = createStub().throws();
    clock.setTimeout(stub, 100);
    await expect(clock.runFor(100)).rejects.toThrow();
    expect(stub.calledOn(global) || stub.calledOn(null)).toBeTruthy();
  });

  it('CK-082 triggers in the order scheduled', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    clock.setTimeout(spies[0], 13);
    clock.setTimeout(spies[1], 11);

    await clock.runFor(15);

    expect(spies[1].calledBefore(spies[0])).toBeTruthy();
  });

  it('CK-083 creates updated Date while ticking', async ({ clock }) => {
    const spy = createStub();

    clock.setInterval(() => {
      spy(new clock.Date().getTime());
    }, 10);

    await clock.runFor(100);

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

  it('CK-084 fires timer in intervals of 13', async ({ clock }) => {
    const spy = createStub();
    clock.setInterval(spy, 13);
    await clock.runFor(500);
    expect(spy.callCount).toBe(38);
  });

  it('CK-085 fires timer in intervals of "13"', async ({ clock }) => {
    const spy = createStub();
    // @ts-expect-error
    clock.setInterval(spy, '13');
    await clock.runFor(500);
    expect(spy.callCount).toBe(38);
  });

  it('CK-086 fires timers in correct order', async ({ clock }) => {
    const spy13 = createStub();
    const spy10 = createStub();

    clock.setInterval(() => {
      spy13(new clock.Date().getTime());
    }, 13);

    clock.setInterval(() => {
      spy10(new clock.Date().getTime());
    }, 10);

    await clock.runFor(500);

    expect(spy13.callCount).toBe(38);
    expect(spy10.callCount).toBe(50);

    expect(spy13.calledWith(416)).toBeTruthy();
    expect(spy10.calledWith(320)).toBeTruthy();
  });

  it('CK-087 triggers timeouts and intervals in the order scheduled', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    clock.setInterval(spies[0], 10);
    clock.setTimeout(spies[1], 50);

    await clock.runFor(100);

    expect(spies[0].calledBefore(spies[1])).toBeTruthy();
    expect(spies[0].callCount).toBe(10);
    expect(spies[1].callCount).toBe(1);
  });

  it('CK-088 does not fire canceled intervals', async ({ clock }) => {
    // eslint-disable-next-line prefer-const
    let id;
    const callback = createStub(() => {
      if (callback.callCount === 3)
        clock.clearInterval(id);
    });
    id = clock.setInterval(callback, 10);
    await clock.runFor(100);
    expect(callback.callCount).toBe(3);
  });

  it('CK-089 throws for negative minutes', async ({ clock }) => {
    const spy = createStub();
    clock.setInterval(spy, 10000);

    await expect(clock.runFor(-7)).rejects.toThrow();
    expect(spy.callCount).toBe(0);
  });

  it('CK-090 fires nested setTimeout calls properly', async ({ clock }) => {
    let i = 0;
    const callback = () => {
      ++i;
      clock.setTimeout(() => {
        callback();
      }, 100);
    };

    callback();
    await clock.runFor(1000);
    expect(i).toBe(11);
  });

  it('CK-091 does not silently catch errors', async ({ clock }) => {
    const callback = () => {
      throw new Error('oh no!');
    };
    clock.setTimeout(callback, 1000);
    await expect(clock.runFor(1000)).rejects.toThrow();
  });

  it('CK-092 is not influenced by forward system clock changes', async ({ clock }) => {
    const callback = () => {
      clock.setSystemTime(new clock.Date().getTime() + 1000);
    };
    const stub = createStub();
    clock.setTimeout(callback, 1000);
    clock.setTimeout(stub, 2000);
    await clock.runFor(1990);
    expect(stub.callCount).toBe(0);
    await clock.runFor(20);
    expect(stub.callCount).toBe(1);
  });

  it('CK-093 is not influenced by forward system clock changes 2', async ({ clock }) => {
    const callback = () => {
      clock.setSystemTime(new clock.Date().getTime() - 1000);
    };
    const stub = createStub();
    clock.setTimeout(callback, 1000);
    clock.setTimeout(stub, 2000);
    await clock.runFor(1990);
    expect(stub.callCount).toBe(0);
    await clock.runFor(20);
    expect(stub.callCount).toBe(1);
  });

  it('CK-094 is not influenced by forward system clock changes when an error is thrown', async ({ clock }) => {
    const callback = () => {
      clock.setSystemTime(new clock.Date().getTime() + 1000);
      throw new Error();
    };
    const stub = createStub();
    clock.setTimeout(callback, 1000);
    clock.setTimeout(stub, 2000);

    await expect(clock.runFor(1990)).rejects.toThrow();

    expect(stub.callCount).toBe(0);
    await clock.runFor(20);
    expect(stub.callCount).toBe(1);
  });

  it('CK-095 is not influenced by forward system clock changes when an error is thrown 2', async ({ clock }) => {
    const callback = () => {
      clock.setSystemTime(new clock.Date().getTime() - 1000);
      throw new Error();
    };
    const stub = createStub();
    clock.setTimeout(callback, 1000);
    clock.setTimeout(stub, 2000);

    await expect(clock.runFor(1990)).rejects.toThrow();

    expect(stub.callCount).toBe(0);
    await clock.runFor(20);
    expect(stub.callCount).toBe(1);
  });

  it('CK-096 throws on negative ticks', async ({ clock }) => {
    await expect(clock.runFor(-500)).rejects.toThrow('Negative ticks are not supported');
  });

  it('CK-097 creates updated Date while ticking promises', async ({ clock }) => {
    const spy = createStub();

    clock.setInterval(() => {
      void Promise.resolve().then(() => {
        spy(new clock.Date().getTime());
      });
    }, 10);

    await clock.runFor(100);

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

  it('CK-098 fires promise timers in correct order', async ({ clock }) => {
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

    await clock.runFor(500);

    expect(spy13.callCount).toBe(38);
    expect(spy10.callCount).toBe(50);

    expect(spy13.calledWith(416)).toBeTruthy();
    expect(spy10.calledWith(320)).toBeTruthy();
  });

  it('CK-099 does not fire intervals canceled in a promise', async ({ clock }) => {
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
    await clock.runFor(100);

    expect(callback.callCount).toBe(3);
  });

  it('CK-100 fires nested setTimeout calls in user-created promises properly', async ({ clock }) => {
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
    await clock.runFor(1000);
    expect(i).toBe(11);
  });

  it('CK-101 is not influenced by forward system clock changes in promises', async ({ clock }) => {
    const callback = () => {
      void Promise.resolve().then(() => {
        clock.setSystemTime(new clock.Date().getTime() + 1000);
      });
    };
    const stub = createStub();
    clock.setTimeout(callback, 1000);
    clock.setTimeout(stub, 2000);
    await clock.runFor(1990);
    expect(stub.callCount).toBe(0);
    await clock.runFor(20);
    expect(stub.callCount).toBe(1);
  });

  it('CK-102 should settle user-created promises', async ({ clock }) => {
    const spy = createStub();

    clock.setTimeout(() => {
      void Promise.resolve().then(spy);
    }, 100);

    await clock.runFor(100);

    expect(spy.called).toBeTruthy();
  });

  it('CK-103 should settle chained user-created promises', async ({ clock }) => {
    const spies = [createStub(), createStub(), createStub()];

    clock.setTimeout(() => {
      void Promise.resolve()
          .then(spies[0])
          .then(spies[1])
          .then(spies[2]);
    }, 100);

    await clock.runFor(100);

    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeTruthy();
    expect(spies[2].called).toBeTruthy();
  });

  it('CK-104 should settle multiple user-created promises', async ({ clock }) => {
    const spies = [createStub(), createStub(), createStub()];

    clock.setTimeout(() => {
      void Promise.resolve().then(spies[0]);
      void Promise.resolve().then(spies[1]);
      void Promise.resolve().then(spies[2]);
    }, 100);

    await clock.runFor(100);

    expect(spies[0].called).toBeTruthy();
    expect(spies[1].called).toBeTruthy();
    expect(spies[2].called).toBeTruthy();
  });

  it('CK-105 should settle nested user-created promises', async ({ clock }) => {
    const spy = createStub();

    clock.setTimeout(() => {
      void Promise.resolve().then(() => {
        void Promise.resolve().then(() => {
          void Promise.resolve().then(spy);
        });
      });
    }, 100);

    await clock.runFor(100);

    expect(spy.called).toBeTruthy();
  });

  it('CK-106 should settle user-created promises even if some throw', async ({ clock }) => {
    const spies = [createStub(), createStub(), createStub(), createStub()];

    clock.setTimeout(() => {
      void Promise.reject().then(spies[0]).catch(spies[1]);
      void Promise.resolve().then(spies[2]).catch(spies[3]);
    }, 100);

    await clock.runFor(100);

    expect(spies[0].callCount).toBe(0);
    expect(spies[1].called).toBeTruthy();
    expect(spies[2].called).toBeTruthy();
    expect(spies[3].callCount).toBe(0);
  });

  it('CK-107 should settle user-created promises before calling more timeouts', async ({ clock }) => {
    const spies = [createStub(), createStub()];

    clock.setTimeout(() => {
      void Promise.resolve().then(spies[0]);
    }, 100);

    clock.setTimeout(spies[1], 200);

    await clock.runFor(200);

    expect(spies[0].calledBefore(spies[1])).toBeTruthy();
  });

  it('CK-108 should settle local promises before calling timeouts', async ({ clock }) => {
    const spies = [createStub(), createStub()];
    void Promise.resolve().then(spies[0]);
    clock.setTimeout(spies[1], 100);

    // Clock API is async.
    await new Promise(setImmediate);

    await clock.runFor(100);
    expect(spies[0].calledBefore(spies[1])).toBeTruthy();
  });

  it('CK-109 should settle local nested promises before calling timeouts', async ({ clock }) => {
    const spies = [createStub(), createStub()];

    void Promise.resolve().then(() => {
      void Promise.resolve().then(() => {
        void Promise.resolve().then(spies[0]);
      });
    });

    clock.setTimeout(spies[1], 100);

    // Clock API is async.
    await new Promise(setImmediate);
    await clock.runFor(100);

    expect(spies[0].calledBefore(spies[1])).toBeTruthy();
  });

  it('CK-110 does not rewind back in time', async ({ clock }) => {
    const stub = createStub();
    const gotTime = await new Promise<number>(done => {
      clock.setTimeout(() => {
        stub(clock.Date.now());
      }, 10);
      clock.setTimeout(() => {
        stub(clock.Date.now());
      }, 10);
      clock.resume();
      setTimeout(async () => {
        // Call fast-forward right after the real time sync happens,
        // but before all the callbacks are processed.
        await clock.runFor(1000);
        setTimeout(() => {
          done(clock.Date.now());
        }, 20);
      }, 10);
    });
    expect(stub.callCount).toBe(2);
    expect(gotTime).toBeGreaterThan(1010);
  });
});

it.describe('clearTimeout', () => {
  it('CK-111 removes timeout', async ({ clock }) => {
    const stub = createStub();
    const id = clock.setTimeout(stub, 50);
    clock.clearTimeout(id);
    await clock.runFor(50);
    expect(stub.called).toBeFalsy();
  });

  it('CK-112 removes interval', async ({ clock }) => {
    const stub = createStub();
    const id = clock.setInterval(stub, 50);
    clock.clearTimeout(id);
    await clock.runFor(50);
    expect(stub.called).toBeFalsy();
  });

  it('CK-113 removes interval with undefined interval', async ({ clock }) => {
    const stub = createStub();
    const id = clock.setInterval(stub);
    clock.clearTimeout(id);
    await clock.runFor(50);
    expect(stub.called).toBeFalsy();
  });

  it('CK-114 ignores null argument', async ({ clock }) => {
    clock.clearTimeout(null);
  });
});

it.describe('setInterval', () => {
  it('CK-115 throws if no arguments', async ({ clock }) => {
    expect(() => {
      // @ts-expect-error
      clock.setInterval();
    }).toThrow();
  });

  it('CK-116 does not throw if |undefined| or |null| is passed as a callback', async ({ clock }) => {
    const timerId1 = clock.setInterval(undefined, 10);
    const timerId2 = clock.setInterval(null, 10);
    await clock.runFor(10);
    expect(timerId1).toBeGreaterThan(0);
    expect(timerId2).toBeGreaterThan(timerId1);
  });

  it('CK-117 returns numeric id or object with numeric id', async ({ clock }) => {
    const result = clock.setInterval(() => {}, 10);
    expect(result).toBeGreaterThan(0);
  });

  it('CK-118 returns unique id', async ({ clock }) => {
    const id1 = clock.setInterval(() => {}, 10);
    const id2 = clock.setInterval(() => {}, 10);

    expect(id2).not.toEqual(id1);
  });

  it('CK-119 schedules recurring timeout', async ({ clock }) => {
    const stub = createStub();
    clock.setInterval(stub, 10);
    await clock.runFor(99);

    expect(stub.callCount).toBe(9);
  });

  it('CK-120 is not influenced by forward system clock changes', async ({ clock }) => {
    const stub = createStub();
    clock.setInterval(stub, 10);
    await clock.runFor(11);
    expect(stub.callCount).toBe(1);
    clock.setSystemTime(new clock.Date().getTime() + 1000);
    await clock.runFor(8);
    expect(stub.callCount).toBe(1);
    await clock.runFor(3);
    expect(stub.callCount).toBe(2);
  });

  it('CK-121 is not influenced by backward system clock changes', async ({ clock }) => {
    const stub = createStub();
    clock.setInterval(stub, 10);
    await clock.runFor(5);
    clock.setSystemTime(new clock.Date().getTime() - 1000);
    await clock.runFor(6);
    expect(stub.callCount).toBe(1);
    await clock.runFor(10);
    expect(stub.callCount).toBe(2);
  });

  it('CK-122 does not schedule recurring timeout when cleared', async ({ clock }) => {
    const stub = createStub(() => {
      if (stub.callCount === 3)
        clock.clearInterval(id);
    });

    const id = clock.setInterval(stub, 10);
    await clock.runFor(100);

    expect(stub.callCount).toBe(3);
  });

  it('CK-123 passes setTimeout parameters', async ({ clock }) => {
    const stub = createStub();
    clock.setInterval(stub, 2, 'the first', 'the second');
    await clock.runFor(3);
    expect(stub.calledWithExactly('the first', 'the second')).toBeTruthy();
  });
});

it.describe('clearInterval', () => {
  it('CK-124 removes interval', async ({ clock }) => {
    const stub = createStub();
    const id = clock.setInterval(stub, 50);
    clock.clearInterval(id);
    await clock.runFor(50);
    expect(stub.called).toBeFalsy();
  });

  it('CK-125 removes interval with undefined interval', async ({ clock }) => {
    const stub = createStub();
    const id = clock.setInterval(stub);
    clock.clearInterval(id);
    await clock.runFor(50);
    expect(stub.called).toBeFalsy();
  });

  it('CK-126 removes timeout', async ({ clock }) => {
    const stub = createStub();
    const id = clock.setTimeout(stub, 50);
    clock.clearInterval(id);
    await clock.runFor(50);
    expect(stub.called).toBeFalsy();
  });

  it('CK-127 ignores null argument', async ({ clock }) => {
    clock.clearInterval(null);
  });
});

it.describe('date', () => {
  it('CK-128 provides date constructor', async ({ clock }) => {
    expect(clock.Date).toEqual(expect.any(Function));
  });

  it('CK-129 creates real Date objects', async ({ clock }) => {
    const date = new clock.Date();
    expect(Date.prototype.isPrototypeOf(date)).toBeTruthy();
  });

  it('CK-130 returns date as string when called as function', async ({ clock }) => {
    const date = clock.Date();
    expect(typeof date).toBe('string');
  });

  it('CK-131 creates Date objects representing clock time', async ({ clock }) => {
    const date = new clock.Date();
    expect(date.getTime()).toBe(new Date(clock.now()).getTime());
  });

  it('CK-132 returns date as string representing clock time', async ({ clock }) => {
    const date = clock.Date();
    expect(date).toBe(new Date(clock.now()).toString());
  });

  it('CK-133 listens to ticking clock', async ({ clock }) => {
    const date1 = new clock.Date();
    await clock.runFor(3);
    const date2 = new clock.Date();
    expect(date2.getTime() - date1.getTime()).toBe(3);
  });

  it('CK-134 listens to system clock changes', async ({ clock }) => {
    const date1 = new clock.Date();
    clock.setSystemTime(date1.getTime() + 1000);
    const date2 = new clock.Date();
    expect(date2.getTime() - date1.getTime()).toBe(1000);
  });

  it('CK-135 creates regular date when passing timestamp', async ({ clock }) => {
    const date = new Date();
    const fakeDate = new clock.Date(date.getTime());
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('CK-136 creates regular date when passing a date as string', async ({ clock }) => {
    const date = new Date();
    const fakeDate = new clock.Date(date.toISOString());
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('CK-137 creates regular date when passing a date as RFC 2822 string', async ({ clock }) => {
    const date = new Date('Sat Apr 12 2014 12:22:00 GMT+1000');
    const fakeDate = new clock.Date('Sat Apr 12 2014 12:22:00 GMT+1000');
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('CK-138 creates regular date when passing year, month', async ({ clock }) => {
    const date = new Date(2010, 4);
    const fakeDate = new clock.Date(2010, 4);
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('CK-139 creates regular date when passing y, m, d', async ({ clock }) => {
    const date = new Date(2010, 4, 2);
    const fakeDate = new clock.Date(2010, 4, 2);
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('CK-140 creates regular date when passing y, m, d, h', async ({ clock }) => {
    const date = new Date(2010, 4, 2, 12);
    const fakeDate = new clock.Date(2010, 4, 2, 12);
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('CK-141 creates regular date when passing y, m, d, h, m', async ({ clock }) => {
    const date = new Date(2010, 4, 2, 12, 42);
    const fakeDate = new clock.Date(2010, 4, 2, 12, 42);
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('CK-142 creates regular date when passing y, m, d, h, m, s', async ({ clock }) => {
    const date = new Date(2010, 4, 2, 12, 42, 53);
    const fakeDate = new clock.Date(2010, 4, 2, 12, 42, 53);
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('CK-143 creates regular date when passing y, m, d, h, m, s, ms', async ({ clock }) => {
    const date = new Date(2010, 4, 2, 12, 42, 53, 498);
    const fakeDate = new clock.Date(2010, 4, 2, 12, 42, 53, 498);
    expect(fakeDate.getTime()).toBe(date.getTime());
  });

  it('CK-144 returns date as string when calling with arguments', async ({ clock }) => {
    // @ts-expect-error
    const fakeDateStr = clock.Date(2010, 4, 2, 12, 42, 53, 498);
    expect(fakeDateStr).toBe(new clock.Date().toString());
  });

  it('CK-145 returns date as string when calling with timestamp', async ({ clock }) => {
    // @ts-expect-error
    const fakeDateStr = clock.Date(1);
    expect(fakeDateStr).toBe(new clock.Date().toString());
  });

  it('CK-146 mirrors native Date.prototype', async ({ clock }) => {
    expect(clock.Date.prototype).toEqual(Date.prototype);
  });

  it('CK-147 supports now method if present', async ({ clock }) => {
    expect(typeof clock.Date.now).toEqual(typeof Date.now);
  });

  it('CK-148 returns clock.now()', async ({ clock }) => {
    const clock_now = clock.Date.now();
    const global_now = Date.now();
    expect(clock_now).toBeGreaterThanOrEqual(clock.now());
    expect(clock_now).toBeLessThanOrEqual(global_now);
  });

  it('CK-149 mirrors parse method', async ({ clock }) => {
    expect(clock.Date.parse).toEqual(Date.parse);
  });

  it('CK-150 mirrors UTC method', async ({ clock }) => {
    expect(clock.Date.UTC).toEqual(Date.UTC);
  });

  it('CK-151 mirrors toUTCString method', async ({ clock }) => {
    expect(clock.Date.prototype.toUTCString).toEqual(Date.prototype.toUTCString);
  });
});

it.describe('stubTimers', () => {
  it('CK-152 returns clock object', async ({ install }) => {
    const clock = install();
    expect(clock).toEqual(expect.any(Object));
    expect(clock.runFor).toEqual(expect.any(Function));
  });

  it('CK-153 takes an object parameter', async ({ install }) => {
    const clock = install();
    expect(clock).toEqual(expect.any(Object));
  });

  it('CK-154 sets initial timestamp', async ({ install }) => {
    const clock = install(1400);
    expect(clock.now()).toBe(1400);
  });

  it('CK-155 replaces global setTimeout', async ({ install }) => {
    const clock = install();
    const stub = createStub();

    setTimeout(stub, 1000);
    await clock.runFor(1000);

    expect(stub.called).toBeTruthy();
  });

  it('CK-156 global fake setTimeout should return id', async ({ install }) => {
    install();
    const stub = createStub();
    const to = setTimeout(stub, 1000);
    expect(to).toEqual(expect.any(Number));
  });

  it('CK-157 replaces global clearTimeout', async ({ install }) => {
    const clock = install();
    const stub = createStub();

    clearTimeout(setTimeout(stub, 1000));
    await clock.runFor(1000);

    expect(stub.called).toBeFalsy();
  });

  it('CK-158 replaces global setInterval', async ({ install }) => {
    const clock = install();
    const stub = createStub();

    setInterval(stub, 500);
    await clock.runFor(1000);

    expect(stub.callCount).toBe(2);
  });

  it('CK-159 replaces global clearInterval', async ({ install }) => {
    const clock = install();
    const stub = createStub();

    clearInterval(setInterval(stub, 500));
    await clock.runFor(1000);

    expect(stub.called).toBeFalsy();
  });

  it('CK-160 replaces global performance.now', async ({ install }) => {
    const clock = install();
    const prev = performance.now();
    await clock.runFor(1000);
    const next = performance.now();
    expect(next).toBe(1000);
    expect(prev).toBe(0);
  });

  it('CK-161 replace Event.prototype.timeStamp', async ({ install }) => {
    it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31924' });
    const clock = install();
    await clock.runFor(1000);
    const event1 = new Event('foo');
    expect(event1.timeStamp).toBe(1000);
    await clock.runFor(1000);
    const event2 = new Event('foo');
    expect(event2.timeStamp).toBe(2000);
    expect(event1.timeStamp).toBe(1000);
  });

  it('CK-162 uninstalls global performance.now', async ({ install }) => {
    const oldNow = performance.now;
    const clock = install();
    expect(performance.now).toBe(clock.performance.now);
    clock.uninstall();
    expect(performance.now).toBe(oldNow);
  });

  it('CK-163 should let performance.mark still be callable after install() (#136)', async ({ install }) => {
    it.skip(nodeMajorVersion < 20);
    install();
    expect(() => {
      performance.mark('a name');
    }).not.toThrow();
  });

  it('CK-164 should not alter the global performance properties and methods', async ({ install }) => {
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

  it('CK-165 should replace the getEntries, getEntriesByX methods with noops that return []', async ({ install }) => {
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

  it('CK-166 should return PerformanceEntry-like objects from performance.mark and performance.measure', async ({ install }) => {
    it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/39816' });
    it.skip(nodeMajorVersion < 20);
    install();
    const markEntry = performance.mark('foo');
    const measureEntry = performance.measure('bar');
    for (const entry of [markEntry, measureEntry]) {
      expect(entry).toHaveProperty('startTime');
      expect(entry).toHaveProperty('duration');
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('entryType');
      expect(typeof entry.toJSON()).toBe('string');
    }
    expect(markEntry.name).toBe('foo');
    expect(markEntry.entryType).toBe('mark');
    expect(measureEntry.name).toBe('bar');
    expect(measureEntry.entryType).toBe('measure');
    expect(measureEntry.duration).toBe(50);
  });

  it('CK-167 restores global property on uninstall if it was inherited onto the global object', ({}) => {
    // Give the global object an inherited 'setTimeout' method
    const proto = {
      Date,
      Intl,
      Map,
      Set,
      performance,
      setTimeout: () => {},
      clearTimeout: () => {},
      setInterval: () => {},
      clearInterval: () => {},
    };
    const myGlobal = Object.create(proto);

    const { clock } = rawInstall(myGlobal, { now: 0, toFake: ['setTimeout'] });
    expect(myGlobal.hasOwnProperty('setTimeout')).toBeTruthy();
    expect(myGlobal.setTimeout).not.toBe(proto.setTimeout);
    clock.uninstall();
    expect(myGlobal.hasOwnProperty('setTimeout')).toBeTruthy();
    expect(myGlobal.setTimeout).toBe(proto.setTimeout);
  });

  it('CK-168 fakes Date constructor', ({ installEx }) => {
    const { originals } = installEx({ now: 0 });
    const now = new Date();

    expect(Date).not.toBe(originals.Date);
    expect(now.getTime()).toBe(0);
  });

  it(`CK-169 fake Date constructor should mirror Date's properties`, async ({ clock }) => {
    expect(Date).not.toBe(clock.Date);
    expect(Date.prototype).toEqual(clock.Date.prototype);
  });

  it('CK-170 mirrors custom Date properties', async ({ install }) => {
    const f = () => {
      return '';
    };
    (Date as any).format = f;
    install();

    expect((Date as any).format).toEqual(f);
  });

  it('CK-171 uninstalls Date constructor', () => {
    const { clock, originals } = rawInstall(globalThis, { now: 0 });
    clock.uninstall();
    expect(Date).toBe(originals.Date);
  });

  it('CK-172 fakes provided methods', ({ installEx }) => {
    const { originals } = installEx({ now: 0, toFake: ['setTimeout', 'Date'] });
    expect(setTimeout).not.toBe(originals.setTimeout);
    expect(Date).not.toBe(originals.Date);
  });

  it('CK-173 resets faked methods', async ({ }) => {
    const { clock, originals } = rawInstall(globalThis, {
      now: 0,
      toFake: ['setTimeout', 'Date'],
    });
    clock.uninstall();

    expect(setTimeout).toBe(originals.setTimeout);
    expect(Date).toBe(originals.Date);
  });

  it('CK-174 does not fake methods not provided', ({ installEx }) => {
    const { originals } = installEx({
      now: 0,
      toFake: ['setTimeout', 'Date'],
    });

    expect(clearTimeout).toBe(originals.clearTimeout);
    expect(setInterval).toBe(originals.setInterval);
    expect(clearInterval).toBe(originals.clearInterval);
  });
});

it.describe('requestAnimationFrame', () => {
  it('CK-175 throws if no arguments', async ({ clock }) => {
    expect(() => {
      // @ts-expect-error
      clock.requestAnimationFrame();
    }).toThrow();
  });

  it('CK-176 returns numeric id or object with numeric id', async ({ clock }) => {
    const result = clock.requestAnimationFrame(() => {});
    expect(result).toEqual(expect.any(Number));
  });

  it('CK-177 returns unique id', async ({ clock }) => {
    const id1 = clock.requestAnimationFrame(() => {});
    const id2 = clock.requestAnimationFrame(() => {});
    expect(id2).not.toEqual(id1);
  });

  it('CK-178 should run every 16ms', async ({ clock }) => {
    const stub = createStub();
    clock.requestAnimationFrame(stub);
    await clock.runFor(15);
    expect(stub.callCount).toBe(0);
    await clock.runFor(1);
    expect(stub.callCount).toBe(1);
  });

  it('CK-179 should be called with performance.now() when available', async ({ clock }) => {
    const stub = createStub();
    clock.requestAnimationFrame(stub);
    await clock.runFor(20);
    expect(stub.calledWith(16)).toBeTruthy();
  });

  it('CK-180 should be called with performance.now() even when performance unavailable', async ({ clock }) => {
    const stub = createStub();
    clock.requestAnimationFrame(stub);
    await clock.runFor(20);
    expect(stub.calledWith(16)).toBeTruthy();
  });

  it('CK-181 should call callback once', async ({ clock }) => {
    const stub = createStub();
    clock.requestAnimationFrame(stub);
    await clock.runFor(32);
    expect(stub.callCount).toBe(1);
  });

  it('CK-182 should schedule two callbacks before the next frame at the same time', async ({ clock }) => {
    const stub1 = createStub();
    const stub2 = createStub();
    clock.requestAnimationFrame(stub1);
    await clock.runFor(5);
    clock.requestAnimationFrame(stub2);
    await clock.runFor(11);
    expect(stub1.calledWith(16)).toBeTruthy();
    expect(stub2.calledWith(16)).toBeTruthy();
  });

  it('CK-183 should properly schedule callback for 3rd frame', async ({ clock }) => {
    const stub1 = createStub();
    const stub2 = createStub();
    clock.requestAnimationFrame(stub1);
    await clock.runFor(57);
    clock.requestAnimationFrame(stub2);
    await clock.runFor(10);
    expect(stub1.calledWith(16)).toBeTruthy();
    expect(stub2.calledWith(64)).toBeTruthy();
  });

  it('CK-184 should schedule for next frame if on current frame', async ({ clock }) => {
    const stub = createStub();
    await clock.runFor(16);
    clock.requestAnimationFrame(stub);
    await clock.runFor(16);
    expect(stub.calledWith(32)).toBeTruthy();
  });
});

it.describe('cancelAnimationFrame', () => {
  it('CK-185 removes animation frame', async ({ clock }) => {
    const stub = createStub();
    const id = clock.requestAnimationFrame(stub);
    clock.cancelAnimationFrame(id);
    await clock.runFor(16);
    expect(stub.called).toBeFalsy();
  });

  it('CK-186 does not remove timeout', async ({ clock }) => {
    const stub = createStub();
    const id = clock.setTimeout(stub, 50);
    expect(() => {
      clock.cancelAnimationFrame(id);
    }).toThrow();
    await clock.runFor(50);
    expect(stub.called).toBeTruthy();
  });

  it('CK-187 does not remove interval', async ({ clock }) => {
    const stub = createStub();
    const id = clock.setInterval(stub, 50);
    expect(() => {
      clock.cancelAnimationFrame(id);
    }).toThrow();
    await clock.runFor(50);
    expect(stub.called).toBeTruthy();
  });

  it('CK-188 ignores null argument', async ({ clock }) => {
    clock.cancelAnimationFrame(null);
  });
});

it.describe('fastForward', () => {
  it('CK-189 ignores timers which wouldn\'t be run', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(stub, 1000);
    await clock.fastForward(500);
    expect(stub.called).toBeFalsy();
  });

  it('CK-190 pushes back execution time for skipped timers', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(() => {
      stub(clock.Date.now());
    }, 1000);
    await clock.fastForward(2000);
    expect(stub.callCount).toBe(1);
    expect(stub.calledWith(2000)).toBeTruthy();
  });

  it('CK-191 handles multiple pending timers and types', async ({ clock }) => {
    const longTimers = [createStub(), createStub()];
    const shortTimers = [createStub(), createStub(), createStub()];
    clock.setTimeout(longTimers[0], 2000);
    clock.setInterval(longTimers[1], 2500);
    clock.setTimeout(shortTimers[0], 250);
    clock.setInterval(shortTimers[1], 100);
    clock.requestAnimationFrame(shortTimers[2]);
    await clock.fastForward(1500);
    expect(longTimers[0].called).toBeFalsy();
    expect(longTimers[1].called).toBeFalsy();
    expect(shortTimers[0].callCount).toBe(1);
    expect(shortTimers[1].callCount).toBe(1);
    expect(shortTimers[2].callCount).toBe(1);
  });

  it('CK-192 does not rewind back in time', async ({ clock }) => {
    const stub = createStub();
    const gotTime = await new Promise<number>(done => {
      clock.setTimeout(() => {
        stub(clock.Date.now());
      }, 10);
      clock.setTimeout(() => {
        stub(clock.Date.now());
      }, 10);
      clock.resume();
      setTimeout(async () => {
        // Call fast-forward right after the real time sync happens,
        // but before all the callbacks are processed.
        await clock.fastForward(1000);
        setTimeout(() => {
          done(clock.Date.now());
        }, 20);
      }, 10);
    });
    expect(stub.callCount).toBe(2);
    expect(gotTime).toBeGreaterThan(1010);
  });

  it('CK-193 error does not break the clock', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(() => {
      stub(clock.Date.now());
    }, 1000);
    const error = await clock.fastForward(-1000).catch(e => e);
    expect(error.message).toContain('Cannot fast-forward to the past');
    await clock.fastForward(2000);
    expect(stub.callCount).toBe(1);
    expect(stub.calledWith(2000)).toBeTruthy();
  });

  it('CK-194 error does not pause forever', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(() => {
      stub(clock.Date.now());
    }, 1000);
    clock.resume();
    const error = await clock.fastForward(-1000).catch(e => e);
    expect(error.message).toContain('Cannot fast-forward to the past');
    await new Promise(f => setTimeout(f, 1500));
    expect(stub.callCount).toBe(1);
  });
});

it.describe('pauseAt', () => {
  it('CK-195 pause at target time', async ({ clock }) => {
    clock.install(0);
    await clock.pauseAt(1000);
    expect(clock.Date.now()).toBe(1000);
  });

  it('CK-196 fire target timers', async ({ clock }) => {
    clock.install(0);
    const stub = createStub();
    clock.setTimeout(stub, 1000);
    clock.setTimeout(stub, 1001);
    await clock.pauseAt(1000);
    expect(stub.callCount).toBe(1);
  });

  it('CK-197 returns consumed clicks', async ({ clock }) => {
    const now = Date.now();
    clock.install(now);
    const consumedTicks = await clock.pauseAt(now + 1000 * 60 * 60 * 24);
    expect(consumedTicks).toBe(1000 * 60 * 60 * 24);
  });
});

it.describe('performance.now()', () => {
  it('CK-198 should start at 0', async ({ clock }) => {
    const result = clock.performance.now();
    expect(result).toBe(0);
  });

  it('CK-199 should run along with clock.tick', async ({ clock }) => {
    await clock.runFor(5000);
    const result = clock.performance.now();
    expect(result).toBe(5000);
  });

  it('CK-200 should listen to multiple ticks in performance.now', async ({ clock }) => {
    for (let i = 0; i < 10; i++) {
      const next = clock.performance.now();
      expect(next).toBe(1000 * i);
      await clock.runFor(1000);
    }
  });

  it('CK-201 should run with ticks with timers set', async ({ clock }) => {
    clock.setTimeout(() => {
      const result = clock.performance.now();
      expect(result).toBe(2500);
    }, 2500);
    await clock.runFor(5000);
  });
});

it.describe('requestIdleCallback', () => {
  it('CK-202 throws if no arguments', async ({ clock }) => {
    expect(() => {
      // @ts-expect-error
      clock.requestIdleCallback();
    }).toThrow();
  });

  it('CK-203 returns numeric id', async ({ clock }) => {
    const result = clock.requestIdleCallback(() => {});
    expect(result).toEqual(expect.any(Number));
  });

  it('CK-204 returns unique id', async ({ clock }) => {
    const id1 = clock.requestIdleCallback(() => {});
    const id2 = clock.requestIdleCallback(() => {});
    expect(id2).not.toEqual(id1);
  });

  it('CK-205 runs after all timers', async ({ clock }) => {
    const stub = createStub();
    clock.requestIdleCallback(stub);
    await clock.runFor(1000);
    expect(stub.called).toBeTruthy();
    const idleCallbackArg = stub.firstCall.args[0];
    expect(idleCallbackArg.didTimeout).toBeFalsy();
    expect(idleCallbackArg.timeRemaining()).toBe(0);
  });

  it('CK-206 runs no later than timeout option even if there are any timers', async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(() => {}, 10);
    clock.setTimeout(() => {}, 30);
    clock.requestIdleCallback(stub, { timeout: 20 });
    await clock.runFor(20);
    expect(stub.called).toBeTruthy();
  });

  it(`CK-207 doesn't runs if there are any timers and no timeout option`, async ({ clock }) => {
    const stub = createStub();
    clock.setTimeout(() => {}, 30);
    clock.requestIdleCallback(stub);
    await clock.runFor(35);
    expect(stub.called).toBeFalsy();
  });
});

it.describe('cancelIdleCallback', () => {
  it('CK-208 removes idle callback', async ({ clock }) => {
    const stub = createStub();
    const callbackId = clock.requestIdleCallback(stub, { timeout: 0 });
    clock.cancelIdleCallback(callbackId);
    await clock.runFor(0);
    expect(stub.called).toBeFalsy();
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

  it('CK-209 Executes formatRange like normal', async ({ clock }) => {
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

  it('CK-210 Executes formatRangeToParts like normal', async ({ clock }) => {
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

  it('CK-211 Executes resolvedOptions like normal', async ({ clock }) => {
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

  it('CK-212 formatToParts via isFirstOfMonth -> Returns true when passed a timestamp argument that is first of the month', async ({ clock }) => {
    // June 1 04:00 UTC - Toronto is June 1 00:00
    expect(isFirstOfMonth('America/Toronto', Date.UTC(2022, 5, 1, 4))).toBeTruthy();
  });

  it('CK-213 formatToParts via isFirstOfMonth -> Returns false when passed a timestamp argument that is not first of the month', async ({ clock }) => {
    // June 1 00:00 UTC - Toronto is May 31 20:00
    expect(isFirstOfMonth('America/Toronto', Date.UTC(2022, 5, 1))).toBeFalsy();
  });

  it('CK-214 formatToParts via isFirstOfMonth -> Returns true when passed no timestamp and system time is first of the month', async ({ install }) => {
    // June 1 04:00 UTC - Toronto is June 1 00:00
    install(Date.UTC(2022, 5, 1, 4));
    expect(isFirstOfMonth('America/Toronto')).toBeTruthy();
    // A timestamp of 0 is the epoch, not "use the system time".
    // https://github.com/microsoft/playwright/issues/43424
    expect(isFirstOfMonth('America/Toronto', 0)).toBeFalsy();
  });

  it('CK-215 formatToParts via isFirstOfMonth -> Returns false when passed no timestamp and system time is not first of the month', async ({ install }) => {
    // June 1 00:00 UTC - Toronto is May 31 20:00
    install(Date.UTC(2022, 5, 1));
    expect(isFirstOfMonth('America/Toronto')).toBeFalsy();
  });

  it('CK-216 Executes supportedLocalesOf like normal', async ({ installEx }) => {
    const { originals } = installEx();
    expect(Intl.DateTimeFormat.supportedLocalesOf([])).toEqual(
        originals.Intl.DateTimeFormat.supportedLocalesOf([]),
    );
  });

  it('CK-217 Creates a RelativeTimeFormat like normal', async ({ clock }) => {
    const rtf = new Intl.RelativeTimeFormat('en-GB', {
      numeric: 'auto',
    });
    expect(rtf.format(2, 'day')).toBe('in 2 days');
  });
});

it('CK-218 works with slow setTimeout in busy embedder', async ({ installEx }) => {
  const { originals, api, clock } = installEx({ now: 0 });
  await clock.pauseAt(0);

  const log: string[] = [];
  api.setTimeout(() => {
    log.push(`100: ${api.Date.now()}`);
    api.setTimeout(() => {
      log.push(`100+10: ${api.Date.now()}`);
    }, 10);
  }, 100);
  api.setTimeout(() => log.push(`200: ${api.Date.now()}`), 200);
  api.setTimeout(() => log.push(`300: ${api.Date.now()}`), 300);
  api.setTimeout(() => log.push(`400: ${api.Date.now()}`), 400);

  (clock as any)._embedder.setTimeout = (task, timeout) => {
    const timerId = originals.setTimeout(task, (timeout || 0) + 200);
    return () => originals.clearTimeout(timerId);
  };

  await clock.runFor(500);
  expect(log).toEqual([
    `100: 100`,
    `100+10: 110`,
    `200: 200`,
    `300: 300`,
    `400: 400`,
  ]);
});

it('CK-219 works with slow setTimeout in busy embedder when not paused', async ({ installEx }) => {
  const { originals, api, clock } = installEx({ now: 0 });
  clock.setSystemTime(0);

  const log: string[] = [];
  api.setTimeout(() => {
    log.push(`200: ${api.Date.now()}`);
    api.setTimeout(() => {
      log.push(`200+10: ${api.Date.now()}`);
    }, 10);
  }, 200);
  api.setTimeout(() => log.push(`400: ${api.Date.now()}`), 400);
  api.setTimeout(() => log.push(`600: ${api.Date.now()}`), 600);
  api.setTimeout(() => log.push(`800: ${api.Date.now()}`), 800);

  (clock as any)._embedder.setTimeout = (task, timeout) => {
    const timerId = originals.setTimeout(task, timeout === undefined ? 300 : timeout);
    return () => originals.clearTimeout(timerId);
  };

  await clock.runFor(5000);
  expect(log).toEqual([
    `200: 200`,
    `200+10: 210`,
    `400: 400`,
    `600: 600`,
    `800: 800`,
  ]);
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
  const stub: Stub = function(this: any, ...args: any[]) {
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
