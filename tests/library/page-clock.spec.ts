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

  it('CK-001 triggers immediately without specified delay', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(window.stub);
    });

    await page.clock.runFor(0);
    expect(calls).toHaveLength(1);
  });

  it('CK-002 does not trigger without sufficient delay', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(window.stub, 100);
    });
    await page.clock.runFor(10);
    expect(calls).toEqual([]);
  });

  it('CK-003 triggers after sufficient delay', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(window.stub, 100);
    });
    await page.clock.runFor(100);
    expect(calls).toHaveLength(1);
  });

  it('CK-004 triggers simultaneous timers', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(window.stub, 100);
      setTimeout(window.stub, 100);
    });
    await page.clock.runFor(100);
    expect(calls).toHaveLength(2);
  });

  it('CK-005 triggers multiple simultaneous timers', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(window.stub, 100);
      setTimeout(window.stub, 100);
      setTimeout(window.stub, 99);
      setTimeout(window.stub, 100);
    });
    await page.clock.runFor(100);
    expect(calls.length).toBe(4);
  });

  it('CK-006 waits after setTimeout was called', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(window.stub, 150);
    });
    await page.clock.runFor(50);
    expect(calls).toEqual([]);
    await page.clock.runFor(100);
    expect(calls).toHaveLength(1);
  });

  it('CK-007 triggers event when some throw', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(() => { throw new Error(); }, 100);
      setTimeout(window.stub, 120);
    });
    await expect(page.clock.runFor(120)).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it('CK-008 creates updated Date while ticking', async ({ page, calls }) => {
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

  it('CK-009 passes 8 seconds', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setInterval(window.stub, 4000);
    });

    await page.clock.runFor('08');
    expect(calls.length).toBe(2);
  });

  it('CK-010 passes 1 minute', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setInterval(window.stub, 6000);
    });

    await page.clock.runFor('01:00');
    expect(calls.length).toBe(10);
  });

  it('CK-011 passes 2 hours, 34 minutes and 10 seconds', {
    annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43452' },
  }, async ({ page, calls }) => {
    await page.evaluate(async () => {
      setInterval(window.stub, 10000);
    });

    await page.clock.runFor('02:34:10');
    expect(calls.length).toBe(925);
  });

  it('CK-012 throws for invalid format', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setInterval(window.stub, 10000);
    });
    await expect(page.clock.runFor('12:02:34:10')).rejects.toThrow();
    await expect(page.clock.runFor(NaN)).rejects.toThrow('clock.runFor: Invalid ticks: NaN');
    await expect(page.clock.fastForward(Infinity)).rejects.toThrow('clock.fastForward: Invalid ticks: Infinity');
    expect(calls).toEqual([]);
  });

  it('CK-013 returns the current now value', async ({ page }) => {
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

  it(`CK-014 ignores timers which wouldn't be run`, async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(() => {
        window.stub('should not be logged');
      }, 1000);
    });
    await page.clock.fastForward(500);
    expect(calls).toEqual([]);
  });

  it('CK-015 pushes back execution time for skipped timers', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(() => {
        window.stub(Date.now());
      }, 1000);
    });

    await page.clock.fastForward(2000);
    expect(calls).toEqual([{ params: [1000 + 2000] }]);
  });

  it('CK-016 supports string time arguments', async ({ page, calls }) => {
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
  it('CK-017 sets initial timestamp', async ({ page, calls }) => {
    await page.clock.setSystemTime(1400);
    expect(await page.evaluate(() => Date.now())).toBe(1400);
  });

  it('CK-018 should throw for invalid date', async ({ page }) => {
    await expect(page.clock.setSystemTime(new Date('invalid'))).rejects.toThrow('Invalid date: Invalid Date');
    await expect(page.clock.setSystemTime('invalid')).rejects.toThrow('clock.setSystemTime: Invalid date: invalid');
  });

  it('CK-019 replaces global setTimeout', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setTimeout(window.stub, 1000);
    });
    await page.clock.runFor(1000);
    expect(calls.length).toBe(1);
  });

  it('CK-020 global fake setTimeout should return id', async ({ page, calls }) => {
    const to = await page.evaluate(() => setTimeout(window.stub, 1000));
    expect(typeof to).toBe('number');
  });

  it('CK-021 replaces global clearTimeout', async ({ page, calls }) => {
    await page.evaluate(async () => {
      const to = setTimeout(window.stub, 1000);
      clearTimeout(to);
    });
    await page.clock.runFor(1000);
    expect(calls).toEqual([]);
  });

  it('CK-022 replaces global setInterval', async ({ page, calls }) => {
    await page.evaluate(async () => {
      setInterval(window.stub, 500);
    });
    await page.clock.runFor(1000);
    expect(calls.length).toBe(2);
  });

  it('CK-023 replaces global clearInterval', async ({ page, calls }) => {
    await page.evaluate(async () => {
      const to = setInterval(window.stub, 500);
      clearInterval(to);
    });
    await page.clock.runFor(1000);
    expect(calls).toEqual([]);
  });

  it('CK-024 replaces global performance.now', async ({ page }) => {
    const promise = page.evaluate(async () => {
      const prev = performance.now();
      await new Promise(f => setTimeout(f, 1000));
      const next = performance.now();
      return { prev, next };
    });
    await page.clock.runFor(1000);
    expect(await promise).toEqual({ prev: 1000, next: 2000 });
  });

  it('CK-025 fakes Date constructor', async ({ page }) => {
    const now = await page.evaluate(() => new Date().getTime());
    expect(now).toBe(1000);
  });
});

it.describe('stubTimers', () => {
  it('CK-026 replaces global performance.timeOrigin', async ({ page }) => {
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
  it('CK-027 should tick after popup', async ({ page }) => {
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

  it('CK-028 should tick before popup', async ({ page }) => {
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

  it('CK-029 should run time before popup', async ({ page, server }) => {
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

  it('CK-030 should not run time before popup on pause', async ({ page, server }) => {
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
    await popup.waitForLoadState();
    const popupTime = await popup.evaluate('time');
    expect(popupTime).toBe(1000);
  });
});

it.describe('setFixedTime', () => {
  it('CK-031 does not fake methods', async ({ page }) => {
    await page.clock.setFixedTime(0);

    // Should not stall.
    await page.evaluate(() => {
      return new Promise(f => setTimeout(f, 1));
    });
  });

  it('CK-032 allows setting time multiple times', async ({ page }) => {
    await page.clock.setFixedTime(100);
    expect(await page.evaluate(() => Date.now())).toBe(100);
    await page.clock.setFixedTime(200);
    expect(await page.evaluate(() => Date.now())).toBe(200);
  });

  it('CK-033 fixed time is not affected by clock manipulation', async ({ page }) => {
    await page.clock.setFixedTime(100);
    expect(await page.evaluate(() => Date.now())).toBe(100);
    await page.clock.fastForward(20);
    expect(await page.evaluate(() => Date.now())).toBe(100);
  });

  it('CK-034 allows installing fake timers after settings time', async ({ page, calls }) => {
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
  it('CK-035 should progress time', async ({ page }) => {
    await page.clock.install({ time: 0 });
    const startRealTime = Date.now();
    await page.goto('data:text/html,');
    await page.waitForTimeout(1000);
    const now = await page.evaluate(() => Date.now());
    const realElapsed = Date.now() - startRealTime;
    expect(now).toBeGreaterThanOrEqual(1000);
    expect(now).toBeLessThanOrEqual(realElapsed + 1000);
  });

  it('CK-036 should runFor', async ({ page }) => {
    await page.clock.install({ time: 0 });
    const startRealTime = Date.now();
    await page.goto('data:text/html,');
    await page.clock.runFor(10000);
    const now = await page.evaluate(() => Date.now());
    const realElapsed = Date.now() - startRealTime;
    expect(now).toBeGreaterThanOrEqual(10000);
    expect(now).toBeLessThanOrEqual(10000 + realElapsed + 1000);
  });

  it('CK-037 should fastForward', async ({ page }) => {
    await page.clock.install({ time: 0 });
    const startRealTime = Date.now();
    await page.goto('data:text/html,');
    await page.clock.fastForward(10000);
    const now = await page.evaluate(() => Date.now());
    const realElapsed = Date.now() - startRealTime;
    expect(now).toBeGreaterThanOrEqual(10000);
    expect(now).toBeLessThanOrEqual(10000 + realElapsed + 1000);
  });

  it('CK-038 should pause', async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.goto('data:text/html,');
    await page.clock.pauseAt(60000);
    // Internally wait to make sure the clock is paused and not running.
    await page.waitForTimeout(1111);
    const now = await page.evaluate(() => Date.now());
    expect(now).toBe(60000);
  });

  it('CK-039 should reject an invalid target time with an active requestAnimationFrame loop', {
    annotation: {
      type: 'issue',
      description: 'https://github.com/microsoft/playwright-python/issues/3137',
    }
  }, async ({ page }) => {
    await page.clock.install();
    await page.setContent(`<script>function tick() { requestAnimationFrame(tick); } requestAnimationFrame(tick);</script>`);
    const invalidTime = await page.evaluate(() => Date.now()) * 1_000_000;
    await expect(page.clock.pauseAt(invalidTime)).rejects.toThrow(`clock.pauseAt: Invalid date: ${invalidTime}`);
  });

  it('CK-040 should pause and fastForward', async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.goto('data:text/html,');
    await page.clock.pauseAt(60000);
    await page.clock.fastForward(1000);
    const now = await page.evaluate(() => Date.now());
    expect(now).toBe(61000);
  });

  it('CK-041 should set system time on pause', async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.goto('data:text/html,');
    await page.clock.pauseAt(60000);
    const now = await page.evaluate(() => Date.now());
    expect(now).toBe(60000);
  });
});

it.describe('while on pause', () => {
  it('CK-042 fastForward should not run nested immediate', async ({ page, calls }) => {
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

  it('CK-043 runFor should not run nested immediate', async ({ page, calls }) => {
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

  it('CK-044 runFor should not run nested immediate from microtask', async ({ page, calls }) => {
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

  it('CK-045 should stay paused on the next page when an init script reads the time', {
    annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43214' },
  }, async ({ page, server }) => {
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
    await page.addInitScript(() => Date.now());
    await page.goto(server.EMPTY_PAGE);
    await page.clock.runFor(1000);
    await page.goto(server.PREFIX + '/title.html');
    expect(await page.evaluate(() => Date.now())).toBe(2000);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => Date.now())).toBe(2000);
  });

  it('CK-046 should not advance performance.now() before the first clock call on a new page', {
    annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43214' },
  }, async ({ page, server }) => {
    await page.clock.pauseAt(1000);
    await page.goto(server.EMPTY_PAGE);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => [performance.now(), Date.now()])).toEqual([0, 1000]);
  });
});

it.describe('Date.now', () => {
  it('CK-047 check Date.now is an integer', async ({ page }) => {
    await page.clock.install();
    await page.goto('data:text/html,');
    await page.waitForTimeout(1000);
    const dateValue = await page.evaluate('Date.now()');
    expect(Number.isInteger(dateValue)).toBeTruthy();
    await page.waitForTimeout(1000);
    const dateValue2 = await page.evaluate('Date.now()');
    expect(Number.isInteger(dateValue2)).toBeTruthy();
  });

  it('CK-048 check Date.now is an integer (2)', async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.goto('data:text/html,');
    await page.clock.pauseAt(1000);
    await page.clock.runFor(0.5);
    const dateValue = await page.evaluate('Date.now()');
    expect(dateValue).toBe(1001);
  });
});

it.describe('Temporal.Now', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42830' } }, () => {
  it.beforeEach(async ({ page }) => {
    it.skip(!await page.evaluate(() => 'Temporal' in globalThis), 'Temporal is not supported');
  });

  it('CK-049 should follow fixed time', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2020-01-01T00:00:00Z'));
    await page.goto('data:text/html,');
    expect(await page.evaluate(() => {
      const Temporal = (globalThis as any).Temporal;
      return {
        instant: Temporal.Now.instant().toString(),
        zonedDateTime: Temporal.Now.zonedDateTimeISO('UTC').toString(),
        plainDateTime: Temporal.Now.plainDateTimeISO('UTC').toString(),
        plainDate: Temporal.Now.plainDateISO('UTC').toString(),
        plainTime: Temporal.Now.plainTimeISO('UTC').toString(),
      };
    })).toEqual({
      instant: '2020-01-01T00:00:00Z',
      zonedDateTime: '2020-01-01T00:00:00+00:00[UTC]',
      plainDateTime: '2020-01-01T00:00:00',
      plainDate: '2020-01-01',
      plainTime: '00:00:00',
    });
  });

  it('CK-050 should advance with the clock', async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.goto('data:text/html,');
    await page.clock.pauseAt(1000);
    await page.clock.runFor(2000);
    expect(await page.evaluate(() => (globalThis as any).Temporal.Now.instant().epochMilliseconds)).toBe(3000);
  });

  it('CK-051 should use the system time zone by default', async ({ browser }) => {
    const context = await browser.newContext({ timezoneId: 'America/Los_Angeles' });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2020-01-01T00:00:00Z'));
    await page.goto('data:text/html,');
    expect(await page.evaluate(() => {
      const Temporal = (globalThis as any).Temporal;
      return {
        timeZoneId: Temporal.Now.timeZoneId(),
        zonedDateTime: Temporal.Now.zonedDateTimeISO().toString(),
        plainDateTime: Temporal.Now.plainDateTimeISO().toString(),
      };
    })).toEqual({
      timeZoneId: 'America/Los_Angeles',
      zonedDateTime: '2019-12-31T16:00:00-08:00[America/Los_Angeles]',
      plainDateTime: '2019-12-31T16:00:00',
    });
    await context.close();
  });

  it('CK-052 should keep the rest of Temporal intact', async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.goto('data:text/html,');
    expect(await page.evaluate(() => {
      const Temporal = (globalThis as any).Temporal;
      return {
        tag: Object.prototype.toString.call(Temporal.Now),
        enumerable: Object.keys(Temporal).concat(Object.keys(Temporal.Now)),
        isInstant: Temporal.Now.instant() instanceof Temporal.Instant,
        duration: Temporal.Duration.from({ hours: 1 }).toString(),
      };
    })).toEqual({
      tag: '[object Temporal.Now]',
      enumerable: [],
      isInstant: true,
      duration: 'PT1H',
    });
  });
});

it('CK-053 AbortSignal.timeout', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/39293' } }, async ({ page, browserName }) => {
  await page.clock.install({ time: 0 });
  const controller = await page.evaluateHandle(() => {
    const signal = AbortSignal.any([
      AbortSignal.timeout(100)
    ]);
    const handle = {
      signal,
      event: false,
      handler: false,
    };
    signal.addEventListener('abort', () => handle.event = true);
    signal.onabort = () => handle.handler = true;
    return handle;
  });
  expect(await controller.evaluate(handle => ({
    signal: handle.signal.aborted,
    event: handle.event,
    handler: handle.handler,
  }))).toEqual({
    signal: false,
    event: false,
    handler: false,
  });
  await page.clock.runFor(200);
  expect(await controller.evaluate(handle => ({
    signal: handle.signal.aborted,
    event: handle.event,
    handler: handle.handler,
    reason: {
      name: handle.signal.reason.name,
      message: handle.signal.reason.message,
      code: handle.signal.reason.code,
    },
  }))).toEqual({
    signal: true,
    event: true,
    handler: true,
    reason: {
      name: 'TimeoutError',
      message: browserName === 'chromium' ? 'signal timed out' : 'The operation timed out.',
      code: 23,
    },
  });
  expect(await page.evaluate(() => AbortSignal.abort().aborted)).toBe(true);
});

it('CK-054 correctly increments Date.now()/performance.now() during blocking execution', {
  annotation: {
    type: 'issue',
    description: 'https://github.com/microsoft/playwright/issues/35362',
  }
}, async ({ page, server }) => {
  await page.clock.setSystemTime(new Date('2026-01-01'));
  server.setRoute('/repro.html', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body>
          <script>
          {
            const start = performance.now();
            while (performance.now() - start < 100) { }
          }
          {
            const start = Date.now();
            while (Date.now() - start < 100) { }
          }
          console.log('done');
          </script>
        </body>
      </html>
    `);
  });
  const waitForDone = page.waitForEvent('console', msg => msg.text() === 'done');
  await page.goto(server.PREFIX + '/repro.html');
  await waitForDone;
});
