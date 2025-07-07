/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import { browserTest as it, expect } from '../config/browserTest';
import type { Route } from '@playwright/test';
import { ManualPromise } from '../../packages/playwright-core/lib/utils/isomorphic/manualPromise';

it('context.unroute should not wait for pending handlers to complete', async ({ page, context, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23781' });
  let secondHandlerCalled = false;
  await context.route(/.*/, async route => {
    secondHandlerCalled = true;
    await route.continue();
  });
  let routeCallback;
  const routePromise = new Promise(f => routeCallback = f);
  let continueRouteCallback;
  const routeBarrier = new Promise(f => continueRouteCallback = f);
  const handler = async route => {
    routeCallback();
    await routeBarrier;
    await route.fallback();
  };
  await context.route(/.*/, handler);
  const navigationPromise = page.goto(server.EMPTY_PAGE);
  await routePromise;
  await context.unroute(/.*/, handler);
  continueRouteCallback();
  await navigationPromise;
  expect(secondHandlerCalled).toBe(true);
});

it('context.unrouteAll removes all handlers', async ({ page, context, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23781' });
  await context.route('**/*', route => {
    void route.abort();
  });
  await context.route('**/empty.html', route => {
    void route.abort();
  });
  await context.unrouteAll();
  await page.goto(server.EMPTY_PAGE);
});

it('context.unrouteAll should wait for pending handlers to complete', async ({ page, context, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23781' });
  let secondHandlerCalled = false;
  await context.route(/.*/, async route => {
    secondHandlerCalled = true;
    await route.abort();
  });
  let routeCallback;
  const routePromise = new Promise(f => routeCallback = f);
  let continueRouteCallback;
  const routeBarrier = new Promise(f => continueRouteCallback = f);
  const handler = async route => {
    routeCallback();
    await routeBarrier;
    await route.fallback();
  };
  await context.route(/.*/, handler);
  const navigationPromise = page.goto(server.EMPTY_PAGE);
  await routePromise;
  let didUnroute = false;
  const unroutePromise = context.unrouteAll({ behavior: 'wait' }).then(() => didUnroute = true);
  await new Promise(f => setTimeout(f, 500));
  expect(didUnroute).toBe(false);
  continueRouteCallback();
  await unroutePromise;
  expect(didUnroute).toBe(true);
  await navigationPromise;
  expect(secondHandlerCalled).toBe(false);
});

it('context.unrouteAll should not wait for pending handlers to complete if behavior is ignoreErrors', async ({ page, context, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23781' });
  let secondHandlerCalled = false;
  await context.route(/.*/, async route => {
    secondHandlerCalled = true;
    await route.abort();
  });
  let routeCallback;
  const routePromise = new Promise(f => routeCallback = f);
  let continueRouteCallback;
  const routeBarrier = new Promise(f => continueRouteCallback = f);
  const handler = async route => {
    routeCallback();
    await routeBarrier;
    throw new Error('Handler error');
  };
  await context.route(/.*/, handler);
  const navigationPromise = page.goto(server.EMPTY_PAGE);
  await routePromise;
  let didUnroute = false;
  const unroutePromise = context.unrouteAll({ behavior: 'ignoreErrors' }).then(() => didUnroute = true);
  await new Promise(f => setTimeout(f, 500));
  await unroutePromise;
  expect(didUnroute).toBe(true);
  continueRouteCallback();
  await navigationPromise.catch(e => void e);
  // The error in the unrouted handler should be silently caught and remaining handler called.
  expect(secondHandlerCalled).toBe(false);
});

it('page.close should not wait for active route handlers on the owning context', async ({ page, context, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23781' });
  let routeCallback;
  const routePromise = new Promise(f => routeCallback = f);
  await context.route(/.*/, async route => {
    routeCallback();
  });
  await page.route(/.*/, async route => {
    await route.fallback();
  });
  page.goto(server.EMPTY_PAGE).catch(() => {});
  await routePromise;
  await page.close();
});

it('context.close should not wait for active route handlers on the owned pages', async ({ page, context, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23781' });
  let routeCallback;
  const routePromise = new Promise(f => routeCallback = f);
  await page.route(/.*/, async route => {
    routeCallback();
  });
  await page.route(/.*/, async route => {
    await route.fallback();
  });
  page.goto(server.EMPTY_PAGE).catch(() => {});
  await routePromise;
  await context.close();
});

it('page.unroute should not wait for pending handlers to complete', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23781' });
  let secondHandlerCalled = false;
  await page.route(/.*/, async route => {
    secondHandlerCalled = true;
    await route.continue();
  });
  let routeCallback;
  const routePromise = new Promise(f => routeCallback = f);
  let continueRouteCallback;
  const routeBarrier = new Promise(f => continueRouteCallback = f);
  const handler = async route => {
    routeCallback();
    await routeBarrier;
    await route.fallback();
  };
  await page.route(/.*/, handler);
  const navigationPromise = page.goto(server.EMPTY_PAGE);
  await routePromise;
  await page.unroute(/.*/, handler);
  continueRouteCallback();
  await navigationPromise;
  expect(secondHandlerCalled).toBe(true);
});

it('page.unrouteAll removes all routes', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23781' });
  await page.route('**/*', route => {
    void route.abort();
  });
  await page.route('**/empty.html', route => {
    void route.abort();
  });
  await page.unrouteAll();
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.ok()).toBe(true);
});

it('page.unrouteAll should wait for pending handlers to complete', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23781' });
  let secondHandlerCalled = false;
  await page.route(/.*/, async route => {
    secondHandlerCalled = true;
    await route.abort();
  });
  let routeCallback;
  const routePromise = new Promise(f => routeCallback = f);
  let continueRouteCallback;
  const routeBarrier = new Promise(f => continueRouteCallback = f);
  const handler = async route => {
    routeCallback();
    await routeBarrier;
    await route.fallback();
  };
  await page.route(/.*/, handler);
  const navigationPromise = page.goto(server.EMPTY_PAGE);
  await routePromise;
  let didUnroute = false;
  const unroutePromise = page.unrouteAll({ behavior: 'wait' }).then(() => didUnroute = true);
  await new Promise(f => setTimeout(f, 500));
  expect(didUnroute).toBe(false);
  continueRouteCallback();
  await unroutePromise;
  expect(didUnroute).toBe(true);
  await navigationPromise;
  expect(secondHandlerCalled).toBe(false);
});

it('page.unrouteAll should not wait for pending handlers to complete if behavior is ignoreErrors', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23781' });
  let secondHandlerCalled = false;
  await page.route(/.*/, async route => {
    secondHandlerCalled = true;
    await route.abort();
  });
  let routeCallback;
  const routePromise = new Promise(f => routeCallback = f);
  let continueRouteCallback;
  const routeBarrier = new Promise(f => continueRouteCallback = f);
  const handler = async route => {
    routeCallback();
    await routeBarrier;
    throw new Error('Handler error');
  };
  await page.route(/.*/, handler);
  const navigationPromise = page.goto(server.EMPTY_PAGE);
  await routePromise;
  let didUnroute = false;
  const unroutePromise = page.unrouteAll({ behavior: 'ignoreErrors' }).then(() => didUnroute = true);
  await new Promise(f => setTimeout(f, 500));
  await unroutePromise;
  expect(didUnroute).toBe(true);
  continueRouteCallback();
  await navigationPromise.catch(e => void e);
  // The error in the unrouted handler should be silently caught.
  expect(secondHandlerCalled).toBe(false);
});

it('page.close does not wait for active route handlers', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23781' });
  let secondHandlerCalled = false;
  await page.route(/.*/, () => secondHandlerCalled = true);
  let routeCallback;
  const routePromise = new Promise(f => routeCallback = f);
  await page.route(/.*/, async route => {
    routeCallback();
    await new Promise(() => {});
  });
  page.goto(server.EMPTY_PAGE).catch(() => {});
  await routePromise;
  await page.close();
  await new Promise(f => setTimeout(f, 500));
  expect(secondHandlerCalled).toBe(false);
});

it('route.continue should not throw if page has been closed', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23781' });
  let routeCallback;
  const routePromise = new Promise<Route>(f => routeCallback = f);
  await page.route(/.*/, async route => {
    routeCallback(route);
  });
  page.goto(server.EMPTY_PAGE).catch(() => {});
  const route = await routePromise;
  await page.close();
  // Should not throw.
  await route.continue();
});

it('route.fallback should not throw if page has been closed', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23781' });
  let routeCallback;
  const routePromise = new Promise<Route>(f => routeCallback = f);
  await page.route(/.*/, async route => {
    routeCallback(route);
  });
  page.goto(server.EMPTY_PAGE).catch(() => {});
  const route = await routePromise;
  await page.close();
  // Should not throw.
  await route.fallback();
});

it('route.fulfill should not throw if page has been closed', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23781' });
  let routeCallback;
  const routePromise = new Promise<Route>(f => routeCallback = f);
  await page.route(/.*/, async route => {
    routeCallback(route);
  });
  page.goto(server.EMPTY_PAGE).catch(() => {});
  const route = await routePromise;
  await page.close();
  // Should not throw.
  await route.fulfill();
});

it('should not continue requests in flight (page)', async ({ page, server }) => {
  const routePromise = new ManualPromise();
  await page.goto(server.EMPTY_PAGE);
  await page.route('**/*', async route => {
    routePromise.resolve();
    await new Promise(f => setTimeout(f, 3000));
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  void page.evaluate(() => fetch('/')).catch(() => {});
  await routePromise;
  await page.unrouteAll({ behavior: 'wait' });
});

it('should not continue requests in flight (context)', async ({ page, context, server }) => {
  const routePromise = new ManualPromise();
  await page.goto(server.EMPTY_PAGE);
  await context.route('**/*', async route => {
    routePromise.resolve();
    await new Promise(f => setTimeout(f, 3000));
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  void page.evaluate(() => fetch('/')).catch(() => {});
  await routePromise;
  await context.unrouteAll({ behavior: 'wait' });
});
