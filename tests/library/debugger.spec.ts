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

import { contextTest as it, expect } from '../config/browserTest';
import type * as channels from '../../packages/playwright-core/src/client/channels';

type ApiCall = channels.DebuggerApiCallsUpdatedEvent['apiCalls'][number];

it('should pause at next and resume', async ({ context, server }) => {
  const page = await context.newPage();
  await page.setContent('<div>click me</div>');
  const dbg = context.debugger;
  expect(dbg.pausedDetails()).toBeNull();

  await dbg.requestPause();
  const clickPromise = page.click('div');
  await new Promise<void>(resolve => dbg.once('pausedstatechanged', resolve));

  expect(dbg.pausedDetails()).toEqual(
      expect.objectContaining({
        title: expect.stringContaining('Click'),
        location: expect.objectContaining({
          file: expect.stringContaining('debugger.spec'),
          line: expect.any(Number),
          column: expect.any(Number),
        }),
      }),
  );

  await Promise.all([
    dbg.resume(),
    new Promise<void>(resolve => dbg.once('pausedstatechanged', resolve)),
    clickPromise,
  ]);
  expect(dbg.pausedDetails()).toBeNull();
});

it('should pause at pause call', async ({ context, server }) => {
  const page = await context.newPage();
  await page.setContent('<div>click me</div>');
  const dbg = context.debugger;
  expect(dbg.pausedDetails()).toBeNull();

  await dbg.requestPause();
  const pausePromise = page.pause();
  await new Promise<void>(resolve => dbg.once('pausedstatechanged', resolve));

  expect(dbg.pausedDetails()).toEqual(
      expect.objectContaining({
        title: expect.stringContaining('Pause'),
      }),
  );

  await dbg.resume();
  await pausePromise;
});

it('should run to location', async ({ context, server }) => {
  const page = await context.newPage();
  await page.setContent('<div>click me</div>');
  const dbg = context.debugger;
  expect(dbg.pausedDetails()).toBeNull();

  // First, pause on next action.
  await dbg.requestPause();
  page.click('div').catch(() => {});
  await new Promise<void>(resolve => dbg.once('pausedstatechanged', resolve));

  // Now run to a specific location.
  const line = +(() => { return new Error('').stack.match(/debugger.spec.ts:(\d+)/)[1]; })();
  // Note: careful with the line offset below.
  await dbg.runTo({ file: 'debugger.spec', line: line + 4 });
  await page.content(); // should not pause here
  const clickPromise = page.click('div'); // should pause here
  await new Promise<void>(resolve => dbg.once('pausedstatechanged', resolve));

  expect(dbg.pausedDetails()).toEqual(
      expect.objectContaining({
        title: expect.stringContaining('Click'),
      }),
  );

  await dbg.resume();
  await clickPromise;
});

it('should stream api calls via _enable', async ({ context, server }) => {
  const page = await context.newPage();
  await page.setContent('<button>click me</button>');
  const dbg = context.debugger as any;

  // Accumulate deltas by id, appending newLogEntries — mirrors the dashboard bridge.
  const calls = new Map<string, { title: string; status: string; location?: any; actionPoint?: any; logs: string[] }>();
  const statusHistory = new Map<string, string[]>();
  dbg.on('apicallsupdated', (apiCalls: ApiCall[]) => {
    for (const call of apiCalls) {
      const existing = calls.get(call.id);
      calls.set(call.id, {
        title: call.title,
        status: call.status,
        location: call.location,
        actionPoint: call.actionPoint ?? existing?.actionPoint,
        logs: [...(existing?.logs ?? []), ...call.newLogEntries],
      });
      statusHistory.set(call.id, [...(statusHistory.get(call.id) ?? []), call.status]);
    }
  });
  await dbg._enable();

  await page.click('button');

  const clickCall = () => [...calls.values()].find(c => c.title.includes('Click'));
  await expect.poll(() => clickCall()?.status).toBe('success');

  const call = clickCall()!;
  expect(call.location).toEqual(expect.objectContaining({ file: expect.stringContaining('debugger.spec') }));
  expect(call.actionPoint).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  expect(call.logs.length).toBeGreaterThan(0);

  // The status streamed running -> success (not just a single terminal event).
  const clickId = [...calls.entries()].find(([, c]) => c.title.includes('Click'))![0];
  const history = statusHistory.get(clickId)!;
  expect(history[0]).toBe('running');
  expect(history[history.length - 1]).toBe('success');
});

it('should report error status for failed api calls', async ({ context, server }) => {
  const page = await context.newPage();
  await page.setContent('<div>no button here</div>');
  const dbg = context.debugger as any;

  const calls = new Map<string, ApiCall>();
  dbg.on('apicallsupdated', (apiCalls: ApiCall[]) => {
    for (const call of apiCalls)
      calls.set(call.id, call);
  });
  await dbg._enable();

  await page.click('button', { timeout: 1000 }).catch(() => {});

  await expect.poll(() => [...calls.values()].find(c => c.title.includes('Click'))?.status).toBe('error');
  const call = [...calls.values()].find(c => c.title.includes('Click'))!;
  expect(call.error).toBeTruthy();
});

it('should not stream internal api calls', async ({ context, server }) => {
  const page = await context.newPage();
  await page.setContent('<button>click me</button>');
  const dbg = context.debugger as any;
  const calls: ApiCall[] = [];
  dbg.on('apicallsupdated', (apiCalls: ApiCall[]) => calls.push(...apiCalls));
  await dbg._enable();

  // A call wrapped as internal (mirrors the dashboard's own traffic) is excluded.
  await (page as any)._wrapApiCall(() => page.click('button'), { internal: true });
  // A normal call is still streamed.
  await page.click('button');

  await expect.poll(() => calls.some(c => c.title.includes('Click'))).toBe(true);
  const clickIds = new Set(calls.filter(c => c.title.includes('Click')).map(c => c.id));
  expect(clickIds.size).toBe(1);
});

it('should not pause at internal api calls', async ({ context, server }) => {
  const page = await context.newPage();
  await page.setContent('<button>click me</button>');
  const dbg = context.debugger as any;

  await dbg.requestPause();
  // The internal call must not trip the pause, and must not consume the arming.
  await (page as any)._wrapApiCall(() => page.click('button'), { internal: true });
  expect(dbg.pausedDetails()).toBeNull();

  // The next normal call still pauses.
  const clickPromise = page.click('button');
  await new Promise<void>(resolve => dbg.once('pausedstatechanged', resolve));
  expect(dbg.pausedDetails()).toBeTruthy();
  await Promise.all([
    dbg.resume(),
    new Promise<void>(resolve => dbg.once('pausedstatechanged', resolve)),
    clickPromise,
  ]);
});

it('should expose the action point while paused on an input action', async ({ context, server }) => {
  const page = await context.newPage();
  await page.setContent('<button style="position:absolute; left:40px; top:60px">click me</button>');
  const dbg = context.debugger as any;
  const calls = new Map<string, ApiCall & { actionPoint?: { x: number; y: number } }>();
  dbg.on('apicallsupdated', (apiCalls: ApiCall[]) => {
    for (const c of apiCalls) {
      const existing = calls.get(c.id);
      calls.set(c.id, { ...c, actionPoint: c.actionPoint ?? existing?.actionPoint });
    }
  });
  await dbg._enable();

  // With api calls enabled, requestPause pauses inside the action (after auto-waiting),
  // so the action point is known — unlike the default "pause before waiting" behavior.
  await dbg.requestPause();
  const clickPromise = page.click('button');
  await new Promise<void>(resolve => dbg.once('pausedstatechanged', resolve));

  expect(dbg.pausedDetails()).toEqual(expect.objectContaining({ title: expect.stringContaining('Click') }));
  const clickCall = [...calls.values()].find(c => c.title.includes('Click'))!;
  expect(clickCall.status).toBe('running');
  expect(clickCall.actionPoint).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));

  await Promise.all([
    dbg.resume(),
    new Promise<void>(resolve => dbg.once('pausedstatechanged', resolve)),
    clickPromise,
  ]);
});

it('should replay ongoing calls when enabled late', async ({ context, server }) => {
  const page = await context.newPage();
  await page.setContent('<button>click me</button>');
  const dbg = context.debugger as any;

  // Start a call and pause on it, so it is definitely in-flight — but do NOT enable yet.
  await dbg.requestPause();
  const clickPromise = page.click('button');
  await new Promise<void>(resolve => dbg.once('pausedstatechanged', resolve));

  // Enabling now must replay the already-ongoing call right away.
  const calls: ApiCall[] = [];
  dbg.on('apicallsupdated', (apiCalls: ApiCall[]) => calls.push(...apiCalls));
  await dbg._enable();

  await expect.poll(() => calls.find(c => c.title.includes('Click'))?.status).toBe('running');
  const clickCall = calls.find(c => c.title.includes('Click'))!;
  expect(clickCall.location).toEqual(expect.objectContaining({ file: expect.stringContaining('debugger.spec') }));

  await Promise.all([
    dbg.resume(),
    new Promise<void>(resolve => dbg.once('pausedstatechanged', resolve)),
    clickPromise,
  ]);
});

it('should keep pause working when api calls are enabled', async ({ context, server }) => {
  const page = await context.newPage();
  await page.setContent('<div>click me</div>');
  const dbg = context.debugger as any;
  await dbg._enable();

  await dbg.requestPause();
  const clickPromise = page.click('div');
  await new Promise<void>(resolve => dbg.once('pausedstatechanged', resolve));
  expect(dbg.pausedDetails()).toEqual(expect.objectContaining({ title: expect.stringContaining('Click') }));

  await Promise.all([
    dbg.resume(),
    new Promise<void>(resolve => dbg.once('pausedstatechanged', resolve)),
    clickPromise,
  ]);
  expect(dbg.pausedDetails()).toBeNull();
});
