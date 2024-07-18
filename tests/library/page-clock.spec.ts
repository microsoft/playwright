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

import { browserTest as test, expect } from '../config/browserTest';

test.skip(!!process.env.PW_CLOCK);

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

it.describe('runFor', () => {
  it.beforeEach(async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
  });

  it('triggers immediately without specified delay', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(window.stub);
    });

    await page.clock.runFor(0);
    expect(calls).toHaveLength(1);
  });

  it('does not trigger without sufficient delay', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(window.stub, 100);
    });
    await page.clock.runFor(10);
    expect(calls).toEqual([]);
  });

  it('triggers after sufficient delay', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(window.stub, 100);
    });
    await page.clock.runFor(100);
    expect(calls).toHaveLength(1);
  });

  it('triggers simultaneous timers', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(window.stub, 100);
      setTimeout(window.stub, 100);
    });
    await page.clock.runFor(100);
    expect(calls).toHaveLength(2);
  });

  it('triggers multiple simultaneous timers', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(window.stub, 100);
      setTimeout(window.stub, 100);
      setTimeout(window.stub, 99);
      setTimeout(window.stub, 100);
    });
    await page.clock.runFor(100);
    expect(calls.length).toBe(4);
  });

  it('waits after setTimeout was called', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(window.stub, 150);
    });
    await page.clock.runFor(50);
    expect(calls).toEqual([]);
    await page.clock.runFor(100);
    expect(calls).toHaveLength(1);
  });

  it('triggers event when some throw', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(() => { throw new Error(); }, 100);
      setTimeout(window.stub, 120);
    });
    await expect(page.clock.runFor(120)).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it('creates updated Date while ticking', async ({ page, calls }) => {
    await page.clock.setSystemTime(0);
    await page.evaluate(async () => {
      setInterval(() => {
        window.stub(new Date().getTime());
      }, 10);
    });
    await page.clock.runFor(100);
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
    await page.evaluate(async () => {
      setInterval(window.stub, 4000);
    });

    await page.clock.runFor('08');
    expect(calls.length).toBe(2);
  });

  it('passes 1 minute', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setInterval(window.stub, 6000);
    });

    await page.clock.runFor('01:00');
    expect(calls.length).toBe(10);
  });

  it('passes 2 hours, 34 minutes and 10 seconds', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setInterval(window.stub, 10000);
    });

    await page.clock.runFor('02:34:10');
    expect(calls.length).toBe(925);
  });

  it('throws for invalid format', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setInterval(window.stub, 10000);
    });
    await expect(page.clock.runFor('12:02:34:10')).rejects.toThrow();
    expect(calls).toEqual([]);
  });

  it('returns the current now value', async ({ page }) => {
    await page.clock.setSystemTime(0);
    const value = 200;
    await page.clock.runFor(value);
    expect(await page.evaluate(() => Date.now())).toBe(value);
  });
});

it.describe('fastForward', () => {
  it.beforeEach(async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
  });

  it(`ignores timers which wouldn't be run`, async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(() => {
        window.stub('should not be logged');
      }, 1000);
    });
    await page.clock.fastForward(500);
    expect(calls).toEqual([]);
  });

  it('pushes back execution time for skipped timers', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(() => {
        window.stub(Date.now());
      }, 1000);
    });

    await page.clock.fastForward(2000);
    expect(calls).toEqual([{ params: [1000 + 2000] }]);
  });

  it('supports string time arguments', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(() => {
        window.stub(Date.now());
      }, 100000);  // 100000 = 1:40
    });
    await page.clock.fastForward('01:50');
    expect(calls).toEqual([{ params: [1000 + 110000] }]);
  });
});

it.describe('stubTimers', () => {
  it.beforeEach(async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
  });
  it('sets initial timestamp', async ({ page, calls }) => {
    await page.clock.setSystemTime(1400);
    expect(await page.evaluate(() => Date.now())).toBe(1400);
  });

  it('should throw for invalid date', async ({ page }) => {
    await expect(page.clock.setSystemTime(new Date('invalid'))).rejects.toThrow('Invalid date: Invalid Date');
    await expect(page.clock.setSystemTime('invalid')).rejects.toThrow('clock.setSystemTime: Invalid date: invalid');
  });

  it('replaces global setTimeout', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(window.stub, 1000);
    });
    await page.clock.runFor(1000);
    expect(calls.length).toBe(1);
  });

  it('global fake setTimeout should return id', async ({ page, calls }) => {
    const to = await page.evaluate(() => setTimeout(window.stub, 1000));
    expect(typeof to).toBe('number');
  });

  it('replaces global clearTimeout', async ({ page, calls }) => {
    await page.evaluate(async () => {
      const to = setTimeout(window.stub, 1000);
      clearTimeout(to);
    });
    await page.clock.runFor(1000);
    expect(calls).toEqual([]);
  });

  it('replaces global setInterval', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setInterval(window.stub, 500);
    });
    await page.clock.runFor(1000);
    expect(calls.length).toBe(2);
  });

  it('replaces global clearInterval', async ({ page, calls }) => {
    await page.evaluate(async () => {
      const to = setInterval(window.stub, 500);
      clearInterval(to);
    });
    await page.clock.runFor(1000);
    expect(calls).toEqual([]);
  });

  it('replaces global performance.now', async ({ page }) => {
    const promise = page.evaluate(async () => {
      const prev = performance.now();
      await new Promise(f => setTimeout(f, 1000));
      const next = performance.now();
      return { prev, next };
    });
    await page.clock.runFor(1000);
    expect(await promise).toEqual({ prev: 1000, next: 2000 });
  });

  it('fakes Date constructor', async ({ page }) => {
    const now = await page.evaluate(() => new Date().getTime());
    expect(now).toBe(1000);
  });
});

it.describe('stubTimers', () => {
  it('replaces global performance.timeOrigin', async ({ page }) => {
    await page.clock.install({ time: 1000 });
    await page.clock.pauseAt(2000);
    const promise = page.evaluate(async () => {
      const prev = performance.now();
      await new Promise(f => setTimeout(f, 1000));
      const next = performance.now();
      return { prev, next };
    });
    await page.clock.runFor(1000);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(1000);
    expect(await promise).toEqual({ prev: 1000, next: 2000 });
  });
});

it.describe('popup', () => {
  it('should tick after popup', async ({ page }) => {
    await page.clock.install({ time: 0 });
    const now = new Date('2015-09-25');
    await page.clock.pauseAt(now);
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => window.open('about:blank')),
    ]);
    const popupTime = await popup.evaluate(() => Date.now());
    expect(popupTime).toBe(now.getTime());
    await page.clock.runFor(1000);
    const popupTimeAfter = await popup.evaluate(() => Date.now());
    expect(popupTimeAfter).toBe(now.getTime() + 1000);
  });

  it('should tick before popup', async ({ page }) => {
    await page.clock.install({ time: 0 });
    const now = new Date('2015-09-25');
    await page.clock.pauseAt(now);
    await page.clock.runFor(1000);

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => window.open('about:blank')),
    ]);
    const popupTime = await popup.evaluate(() => Date.now());
    expect(popupTime).toBe(now.getTime() + 1000);
  });

  it('should run time before popup', async ({ page, server }) => {
    server.setRoute('/popup.html', async (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<script>window.time = Date.now()</script>`);
    });
    await page.goto(server.EMPTY_PAGE);
    // Wait for 2 second in real life to check that it is past in popup.
    await page.waitForTimeout(2000);
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(url => window.open(url), server.PREFIX + '/popup.html'),
    ]);
    const popupTime = await popup.evaluate('time');
    expect(popupTime).toBeGreaterThanOrEqual(2000);
  });

  it('should not run time before popup on pause', async ({ page, server }) => {
    server.setRoute('/popup.html', async (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<script>window.time = Date.now()</script>`);
    });
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
    await page.goto(server.EMPTY_PAGE);
    // Wait for 2 second in real life to check that it is past in popup.
    await page.waitForTimeout(2000);
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(url => window.open(url), server.PREFIX + '/popup.html'),
    ]);
    const popupTime = await popup.evaluate('time');
    expect(popupTime).toBe(1000);
  });
});

it.describe('setFixedTime', () => {
  it('does not fake methods', async ({ page }) => {
    await page.clock.setFixedTime(0);

    // Should not stall.
    await page.evaluate(() => {
      return new Promise(f => setTimeout(f, 1));
    });
  });

  it('allows setting time multiple times', async ({ page }) => {
    await page.clock.setFixedTime(100);
    expect(await page.evaluate(() => Date.now())).toBe(100);
    await page.clock.setFixedTime(200);
    expect(await page.evaluate(() => Date.now())).toBe(200);
  });

  it('fixed time is not affected by clock manipulation', async ({ page }) => {
    await page.clock.setFixedTime(100);
    expect(await page.evaluate(() => Date.now())).toBe(100);
    await page.clock.fastForward(20);
    expect(await page.evaluate(() => Date.now())).toBe(100);
  });

  it('allows installing fake timers after settings time', async ({ page, calls }) => {
    await page.clock.setFixedTime(100);
    expect(await page.evaluate(() => Date.now())).toBe(100);
    await page.clock.setFixedTime(200);
    await page.evaluate(async () => {
      setTimeout(() => window.stub(Date.now()));
    });
    await page.clock.runFor(0);
    expect(calls).toEqual([{ params: [200] }]);
  });
});

it.describe('while running', () => {
  it('should progress time', async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.goto('data:text/html,');
    await page.waitForTimeout(1000);
    const now = await page.evaluate(() => Date.now());
    expect(now).toBeGreaterThanOrEqual(1000);
    expect(now).toBeLessThanOrEqual(2000);
  });

  it('should runFor', async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.goto('data:text/html,');
    await page.clock.runFor(10000);
    const now = await page.evaluate(() => Date.now());
    expect(now).toBeGreaterThanOrEqual(10000);
    expect(now).toBeLessThanOrEqual(11000);
  });

  it('should fastForward', async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.goto('data:text/html,');
    await page.clock.fastForward(10000);
    const now = await page.evaluate(() => Date.now());
    expect(now).toBeGreaterThanOrEqual(10000);
    expect(now).toBeLessThanOrEqual(11000);
  });

  it('should fastForwardTo', async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.goto('data:text/html,');
    await page.clock.fastForward(10000);
    const now = await page.evaluate(() => Date.now());
    expect(now).toBeGreaterThanOrEqual(10000);
    expect(now).toBeLessThanOrEqual(11000);
  });

  it('should pause', async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.goto('data:text/html,');
    await page.clock.pauseAt(1000);
    await page.waitForTimeout(1000);
    await page.clock.resume();
    const now = await page.evaluate(() => Date.now());
    expect(now).toBeGreaterThanOrEqual(0);
    expect(now).toBeLessThanOrEqual(1000);
  });

  it('should pause and fastForward', async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.goto('data:text/html,');
    await page.clock.pauseAt(1000);
    await page.clock.fastForward(1000);
    const now = await page.evaluate(() => Date.now());
    expect(now).toBe(2000);
  });

  it('should set system time on pause', async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.goto('data:text/html,');
    await page.clock.pauseAt(1000);
    const now = await page.evaluate(() => Date.now());
    expect(now).toBe(1000);
  });
});

it.describe('while on pause', () => {
  it('fastForward should not run nested immediate', async ({ page, calls }) => {
    await page.clock.install({ time: 0 });
    await page.goto('data:text/html,');
    await page.clock.pauseAt(1000);
    await page.evaluate(() => {
      setTimeout(() => {
        window.stub('outer');
        setTimeout(() => window.stub('inner'), 0);
      }, 1000);
    });
    await page.clock.fastForward(1000);
    expect(calls).toEqual([{ params: ['outer'] }]);
    await page.clock.fastForward(1);
    expect(calls).toEqual([{ params: ['outer'] }, { params: ['inner'] }]);
  });

  it('runFor should not run nested immediate', async ({ page, calls }) => {
    await page.clock.install({ time: 0 });
    await page.goto('data:text/html,');
    await page.clock.pauseAt(1000);
    await page.evaluate(() => {
      setTimeout(() => {
        window.stub('outer');
        setTimeout(() => window.stub('inner'), 0);
      }, 1000);
    });
    await page.clock.runFor(1000);
    expect(calls).toEqual([{ params: ['outer'] }]);
    await page.clock.runFor(1);
    expect(calls).toEqual([{ params: ['outer'] }, { params: ['inner'] }]);
  });

  it('runFor should not run nested immediate from microtask', async ({ page, calls }) => {
    await page.clock.install({ time: 0 });
    await page.goto('data:text/html,');
    await page.clock.pauseAt(1000);
    await page.evaluate(() => {
      setTimeout(() => {
        window.stub('outer');
        void Promise.resolve().then(() => setTimeout(() => window.stub('inner'), 0));
      }, 1000);
    });
    await page.clock.runFor(1000);
    expect(calls).toEqual([{ params: ['outer'] }]);
    await page.clock.runFor(1);
    expect(calls).toEqual([{ params: ['outer'] }, { params: ['inner'] }]);
  });
});

it.describe('Date.now', () => {
  it('check Date.now is an integer', async ({ page }) => {
    await page.clock.install();
    await page.goto('data:text/html,');
    await page.waitForTimeout(1000);
    const dateValue = await page.evaluate('Date.now()');
    expect(Number.isInteger(dateValue)).toBeTruthy();
    await page.waitForTimeout(1000);
    const dateValue2 = await page.evaluate('Date.now()');
    expect(Number.isInteger(dateValue2)).toBeTruthy();
  });

  it('check Date.now is an integer (2)', async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.goto('data:text/html,');
    await page.clock.pauseAt(1000);
    await page.clock.runFor(0.5);
    const dateValue = await page.evaluate('Date.now()');
    expect(dateValue).toBe(1001);
  });
});
