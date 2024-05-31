/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from './pageTest';

declare global {
  interface Window {
    stub: (param?: any) => void
  }
}

const it = test.extend<{ calls: { params: any[] }[] }>({
  calls: async ({ page }, use) => {
    const calls = [];
    await page.exposeFunction('stub', async (...params: any[]) => {
      calls.push({ params });
    });
    await use(calls);
  }
});

it.describe('tick', () => {
  it('triggers immediately without specified delay', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(window.stub);
    });

    await page.clock.tick(0);
    expect(calls).toHaveLength(1);
  });

  it('does not trigger without sufficient delay', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(window.stub, 100);
    });
    await page.clock.tick(10);
    expect(calls).toEqual([]);
  });

  it('triggers after sufficient delay', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(window.stub, 100);
    });
    await page.clock.tick(100);
    expect(calls).toHaveLength(1);
  });

  it('triggers simultaneous timers', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(window.stub, 100);
      setTimeout(window.stub, 100);
    });
    await page.clock.tick(100);
    expect(calls).toHaveLength(2);
  });

  it('triggers multiple simultaneous timers', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(window.stub, 100);
      setTimeout(window.stub, 100);
      setTimeout(window.stub, 99);
      setTimeout(window.stub, 100);
    });
    await page.clock.tick(100);
    expect(calls.length).toBe(4);
  });

  it('waits after setTimeout was called', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(window.stub, 150);
    });
    await page.clock.tick(50);
    expect(calls).toEqual([]);
    await page.clock.tick(100);
    expect(calls).toHaveLength(1);
  });

  it('triggers event when some throw', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(() => { throw new Error(); }, 100);
      setTimeout(window.stub, 120);
    });

    await expect(page.clock.tick(120)).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it('creates updated Date while ticking', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setInterval(() => {
        window.stub(new Date().getTime());
      }, 10);
    });
    await page.clock.tick(100);
    expect(calls).toEqual([
      { params: [10] },
      { params: [20] },
      { params: [30] },
      { params: [40] },
      { params: [50] },
      { params: [60] },
      { params: [70] },
      { params: [80] },
      { params: [90] },
      { params: [100] },
    ]);
  });

  it('passes 8 seconds', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setInterval(window.stub, 4000);
    });

    await page.clock.tick('08');
    expect(calls.length).toBe(2);
  });

  it('passes 1 minute', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setInterval(window.stub, 6000);
    });

    await page.clock.tick('01:00');
    expect(calls.length).toBe(10);
  });

  it('passes 2 hours, 34 minutes and 10 seconds', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setInterval(window.stub, 10000);
    });

    await page.clock.tick('02:34:10');
    expect(calls.length).toBe(925);
  });

  it('throws for invalid format', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setInterval(window.stub, 10000);
    });
    await expect(page.clock.tick('12:02:34:10')).rejects.toThrow();
    expect(calls).toEqual([]);
  });

  it('returns the current now value', async ({ page }) => {
    await page.clock.install();
    const value = 200;
    await page.clock.tick(value);
    expect(await page.evaluate(() => Date.now())).toBe(value);
  });
});

it.describe('jump', () => {
  it(`ignores timers which wouldn't be run`, async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(() => {
        window.stub('should not be logged');
      }, 1000);
    });
    await page.clock.jump(500);
    expect(calls).toEqual([]);
  });

  it('pushes back execution time for skipped timers', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(() => {
        window.stub(Date.now());
      }, 1000);
    });

    await page.clock.jump(2000);
    expect(calls).toEqual([{ params: [2000] }]);
  });

  it('supports string time arguments', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(() => {
        window.stub(Date.now());
      }, 100000);  // 100000 = 1:40
    });
    await page.clock.jump('01:50');
    expect(calls).toEqual([{ params: [110000] }]);
  });
});

it.describe('runAll', () => {
  it('if there are no timers just return', async ({ page }) => {
    await page.clock.install();
    await page.clock.runAll();
  });

  it('runs all timers', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(window.stub, 10);
      setTimeout(window.stub, 50);
    });
    await page.clock.runAll();
    expect(calls.length).toBe(2);
  });

  it('new timers added while running are also run', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(() => {
        setTimeout(window.stub, 50);
      }, 10);
    });
    await page.clock.runAll();
    expect(calls.length).toBe(1);
  });

  it('new timers added in promises while running are also run', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(() => {
        void Promise.resolve().then(() => {
          setTimeout(window.stub, 50);
        });
      }, 10);
    });
    await page.clock.runAll();
    expect(calls.length).toBe(1);
  });

  it('throws before allowing infinite recursion', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      const recursiveCallback = () => {
        window.stub();
        setTimeout(recursiveCallback, 10);
      };
      setTimeout(recursiveCallback, 10);
    });
    await expect(page.clock.runAll()).rejects.toThrow();
    expect(calls).toHaveLength(1000);
  });

  it('throws before allowing infinite recursion from promises', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      const recursiveCallback = () => {
        window.stub();
        void Promise.resolve().then(() => {
          setTimeout(recursiveCallback, 10);
        });
      };
      setTimeout(recursiveCallback, 10);
    });
    await expect(page.clock.runAll()).rejects.toThrow();
    expect(calls).toHaveLength(1000);
  });

  it('the loop limit can be set when creating a clock', async ({ page, calls }) => {
    await page.clock.install({ loopLimit: 1 });
    await page.evaluate(async () => {
      setTimeout(window.stub, 10);
      setTimeout(window.stub, 50);
    });
    await expect(page.clock.runAll()).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it('should settle user-created promises', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(() => {
        void Promise.resolve().then(() => window.stub());
      }, 55);
    });
    await page.clock.runAll();
    expect(calls).toHaveLength(1);
  });

  it('should settle nested user-created promises', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(() => {
        void Promise.resolve().then(() => {
          void Promise.resolve().then(() => {
            void Promise.resolve().then(() => window.stub());
          });
        });
      }, 55);
    });
    await page.clock.runAll();
    expect(calls).toHaveLength(1);
  });

  it('should settle local promises before firing timers', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      void Promise.resolve().then(() => window.stub(1));
      setTimeout(() => window.stub(2), 55);
    });
    await page.clock.runAll();
    expect(calls).toEqual([
      { params: [1] },
      { params: [2] },
    ]);
  });
});

it.describe('runToLast', () => {
  it('returns current time when there are no timers', async ({ page }) => {
    await page.clock.install();
    const time = await page.clock.runToLast();
    expect(time).toBe(0);
  });

  it('runs all existing timers', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(window.stub, 10);
      setTimeout(window.stub, 50);
    });
    await page.clock.runToLast();
    expect(calls.length).toBe(2);
  });

  it('returns time of the last timer', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(window.stub, 10);
      setTimeout(window.stub, 50);
    });
    const time = await page.clock.runToLast();
    expect(time).toBe(50);
  });

  it('runs all existing timers when two timers are matched for being last', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(window.stub, 10);
      setTimeout(window.stub, 10);
    });
    await page.clock.runToLast();
    expect(calls.length).toBe(2);
  });

  it('new timers added with a call time later than the last existing timer are NOT run', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(() => {
        window.stub();
        setTimeout(window.stub, 50);
      }, 10);
    });
    await page.clock.runToLast();
    expect(calls.length).toBe(1);
  });

  it('new timers added with a call time earlier than the last existing timer are run', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(window.stub, 100);
      setTimeout(() => {
        setTimeout(window.stub, 50);
      }, 10);
    });
    await page.clock.runToLast();
    expect(calls.length).toBe(2);
  });

  it('new timers cannot cause an infinite loop', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      const recursiveCallback = () => {
        window.stub();
        setTimeout(recursiveCallback, 0);
      };
      setTimeout(recursiveCallback, 0);
      setTimeout(window.stub, 100);
    });
    await page.clock.runToLast();
    expect(calls.length).toBe(102);
  });

  it('should support clocks with start time', async ({ page, calls }) => {
    await page.clock.install({ now: 200 });
    await page.evaluate(async () => {
      setTimeout(function cb() {
        window.stub();
        setTimeout(cb, 50);
      }, 50);
    });
    await page.clock.runToLast();
    expect(calls.length).toBe(1);
  });

  it('new timers created from promises cannot cause an infinite loop', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      const recursiveCallback = () => {
        void Promise.resolve().then(() => {
          setTimeout(recursiveCallback, 0);
        });
      };
      setTimeout(recursiveCallback, 0);
      setTimeout(window.stub, 100);
    });
    await page.clock.runToLast();
    expect(calls.length).toBe(1);
  });

  it('should settle user-created promises', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(() => {
        void Promise.resolve().then(() => window.stub());
      }, 55);
    });
    await page.clock.runToLast();
    expect(calls.length).toBe(1);
  });

  it('should settle nested user-created promises', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(() => {
        void Promise.resolve().then(() => {
          void Promise.resolve().then(() => {
            void Promise.resolve().then(() => window.stub());
          });
        });
      }, 55);
    });
    await page.clock.runToLast();
    expect(calls.length).toBe(1);
  });

  it('should settle local promises before firing timers', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      void Promise.resolve().then(() => window.stub(1));
      setTimeout(() => window.stub(2), 55);
    });
    await page.clock.runToLast();
    expect(calls).toEqual([
      { params: [1] },
      { params: [2] },
    ]);
  });

  it('should settle user-created promises before firing more timers', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(() => {
        void Promise.resolve().then(() => window.stub(1));
      }, 55);
      setTimeout(() => window.stub(2), 75);
    });
    await page.clock.runToLast();
    expect(calls).toEqual([
      { params: [1] },
      { params: [2] },
    ]);
  });
});

it.describe('stubTimers', () => {
  it('sets initial timestamp', async ({ page, calls }) => {
    await page.clock.install({ now: 1400 });
    expect(await page.evaluate(() => Date.now())).toBe(1400);
  });

  it('replaces global setTimeout', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(window.stub, 1000);
    });
    await page.clock.tick(1000);
    expect(calls.length).toBe(1);
  });

  it('global fake setTimeout should return id', async ({ page, calls }) => {
    await page.clock.install();
    const to = await page.evaluate(() => setTimeout(window.stub, 1000));
    expect(typeof to).toBe('number');
  });

  it('replaces global clearTimeout', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      const to = setTimeout(window.stub, 1000);
      clearTimeout(to);
    });
    await page.clock.tick(1000);
    expect(calls).toEqual([]);
  });

  it('replaces global setInterval', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setInterval(window.stub, 500);
    });
    await page.clock.tick(1000);
    expect(calls.length).toBe(2);
  });

  it('replaces global clearInterval', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      const to = setInterval(window.stub, 500);
      clearInterval(to);
    });
    await page.clock.tick(1000);
    expect(calls).toEqual([]);
  });

  it('replaces global performance.now', async ({ page }) => {
    await page.clock.install();
    const promise = page.evaluate(async () => {
      const prev = performance.now();
      await new Promise(f => setTimeout(f, 1000));
      const next = performance.now();
      return { prev, next };
    });
    await page.clock.tick(1000);
    expect(await promise).toEqual({ prev: 0, next: 1000 });
  });

  it('fakes Date constructor', async ({ page }) => {
    await page.clock.install({ now: 0 });
    const now = await page.evaluate(() => new Date().getTime());
    expect(now).toBe(0);
  });

  it('does not fake methods not provided', async ({ page }) => {
    await page.clock.install({
      now: 0,
      toFake: ['Date'],
    });

    // Should not stall.
    await page.evaluate(() => {
      return new Promise(f => setTimeout(f, 1));
    });
  });
});

it.describe('shouldAdvanceTime', () => {
  it('should create an auto advancing timer', async ({ page, calls }) => {
    const testDelay = 29;
    const now = new Date('2015-09-25');
    await page.clock.install({ now, shouldAdvanceTime: true });
    const pageNow = await page.evaluate(() => Date.now());
    expect(pageNow).toBe(1443139200000);

    await page.evaluate(async testDelay => {
      return new Promise<void>(f => {
        const timeoutStarted = Date.now();
        setTimeout(() => {
          window.stub(Date.now() - timeoutStarted);
          f();
        }, testDelay);
      });
    }, testDelay);

    expect(calls).toEqual([
      { params: [testDelay] }
    ]);
  });

  it('should test setInterval', async ({ page, calls }) => {
    const now = new Date('2015-09-25');
    await page.clock.install({ now, shouldAdvanceTime: true });

    const timeDifference = await page.evaluate(async () => {
      return new Promise(f => {
        const interval = 20;
        const cyclesToTrigger = 3;
        const timeoutStarted = Date.now();
        let intervalsTriggered = 0;
        const intervalId = setInterval(() => {
          if (++intervalsTriggered === cyclesToTrigger) {
            clearInterval(intervalId);
            const timeDifference = Date.now() - timeoutStarted;
            f(timeDifference - interval * cyclesToTrigger);
          }
        }, interval);
      });
    });

    expect(timeDifference).toBe(0);
  });
});

it.describe('popup', () => {
  it('should tick after popup', async ({ page }) => {
    const now = new Date('2015-09-25');
    await page.clock.install({ now });
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => window.open('about:blank')),
    ]);
    const popupTime = await popup.evaluate(() => Date.now());
    expect(popupTime).toBe(now.getTime());
    await page.clock.tick(1000);
    const popupTimeAfter = await popup.evaluate(() => Date.now());
    expect(popupTimeAfter).toBe(now.getTime() + 1000);
  });

  it('should tick before popup', async ({ page, browserName }) => {
    it.skip(browserName === 'chromium');
    const now = new Date('2015-09-25');
    await page.clock.install({ now });
    const newNow = await page.clock.tick(1000);
    expect(newNow).toBe(now.getTime() + 1000);

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => window.open('about:blank')),
    ]);
    const popupTime = await popup.evaluate(() => Date.now());
    expect(popupTime).toBe(now.getTime() + 1000);
  });
});

it.describe('next', () => {
  it('triggers the next timer', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(window.stub, 100);
    });
    expect(await page.clock.next()).toBe(100);
    expect(calls).toHaveLength(1);
  });

  it('does not trigger simultaneous timers', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(() => {
      setTimeout(() => {
        window.stub();
      }, 100);
      setTimeout(() => {
        window.stub();
      }, 100);
    });

    await page.clock.next();
    expect(calls).toHaveLength(1);
  });

  it('subsequent calls trigger simultaneous timers', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(() => {
        window.stub();
      }, 100);
      setTimeout(() => {
        window.stub();
      }, 100);
      setTimeout(() => {
        window.stub();
      }, 99);
      setTimeout(() => {
        window.stub();
      }, 100);
    });

    await page.clock.next();
    expect(calls).toHaveLength(1);
    await page.clock.next();
    expect(calls).toHaveLength(2);
    await page.clock.next();
    expect(calls).toHaveLength(3);
    await page.clock.next();
    expect(calls).toHaveLength(4);
  });

  it('subsequent calls triggers simultaneous timers with zero callAt', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      window.stub(1);
      setTimeout(() => {
        setTimeout(() => window.stub(2), 0);
      }, 0);
    });

    await page.clock.next();
    expect(calls).toEqual([{ params: [1] }]);
    await page.clock.next();
    expect(calls).toEqual([{ params: [1] }, { params: [2] }]);
  });

  it('throws exception thrown by timer', async ({ page, calls }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      setTimeout(() => {
        throw new Error();
      }, 100);
    });

    await expect(page.clock.next()).rejects.toThrow();
  });
});
