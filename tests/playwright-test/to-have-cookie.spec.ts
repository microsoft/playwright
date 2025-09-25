/**
 * Copyright Microsoft Corporation. All rights reserved.
 * Licensed under the Apache License, Version 2.0.
 */

import { test, expect } from './playwright-test-fixtures';

test('toHaveCookie should wait for cookie to appear', async ({ page }) => {
  await page.goto('https://example.com');

  // Schedule cookie creation later.
  (async () => {
    await page.waitForTimeout(200);
    await page.context().addCookies([{ name: 'foo', value: 'bar', url: 'https://example.com', path: '/' }]);
  })();

  await expect(page).toHaveCookie({ name: 'foo', value: 'bar' }, { timeout: 2000 });
});

test('toHaveCookie should support object map and regex', async ({ page }) => {
  await page.goto('https://example.com');
  await page.context().addCookies([
    { name: 'alpha', value: '123', url: 'https://example.com', path: '/' },
    { name: 'beta', value: 'xyz', url: 'https://example.com', path: '/' },
  ]);

  await expect(page).toHaveCookie({ alpha: /\d+/, beta: 'xyz' });
});

test('toHaveCookie should fail with informative message on timeout', async ({ page }) => {
  await page.goto('https://example.com');
  const error = await expect(page).toHaveCookie({ name: 'missing', value: 'x' }, { timeout: 300 }).catch(e => e);
  expect(error?.message).toContain('toHaveCookie');
  expect(String(error?.message)).toContain('Expected:');
  expect(String(error?.message)).toContain('Received:');
});


