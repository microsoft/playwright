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
import { test as it, expect } from './pageTest';

it('eventList.track and eventList.untrack', async ({ page, server }) => {
  const eventList = page.events.console;

  await it.step('make sure no events are stored until we start tracking', async () => {
    await Promise.all([
      page.evaluate(() => console.log('foo')),
      page.waitForEvent('console'),
    ]);
    expect(eventList.all().length).toBe(0);
  });

  await it.step('make sure eventList.track() works', async () => {
    eventList.track();
    await Promise.all([
      page.evaluate(() => console.log('foo')),
      page.waitForEvent('console'),
    ]);
    expect(eventList.all().length).toBe(1);
  });

  await it.step('make sure eventList.clear() works', async () => {
    eventList.clear();
    expect(eventList.all().length).toBe(0);
  });

  await it.step('make sure eventList.untrack() works', async () => {
    eventList.untrack();
    await Promise.all([
      page.evaluate(() => console.log('foo')),
      page.waitForEvent('console'),
    ]);
    expect(eventList.all().length).toBe(0);
  });
});

it('eventList.take should return first element', async ({ page, server }) => {
  const eventList = page.events.console;
  eventList.track();

  await page.evaluate(() => {
    console.log('foo');
    console.log('bar');
  });
  await expect.poll(() => eventList.all().length).toBe(2);
  const msg1 = await eventList.take();
  expect(msg1.text()).toBe('foo');
  const msg2 = await eventList.take();
  expect(msg2.text()).toBe('bar');
});

it('concurrent eventList.take should resolve in order', async ({ page, server }) => {
  const eventList = page.events.console;
  eventList.track();

  const [msg1, msg2] = await Promise.all([
    eventList.take(),
    eventList.take(),
    page.evaluate(() => {
      console.log('foo');
      console.log('bar');
    }),
  ]);
  expect(msg1.text()).toBe('foo');
  expect(msg2.text()).toBe('bar');
});

it('eventList.take should respect timeout option', async ({ page, server }) => {
  const eventList = page.events.console;
  eventList.track();

  let error;
  await eventList.take({ timeout: 10 }).catch(e => error = e);
  expect(error).toBeTruthy();
  expect(error.message).toContain('page.events.console.take');
});

