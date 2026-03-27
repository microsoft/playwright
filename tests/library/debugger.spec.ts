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
