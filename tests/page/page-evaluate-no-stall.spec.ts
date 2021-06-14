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

test.describe('non-stalling evaluate', () => {
  test.skip(({mode}) => mode !== 'default');

  test('should work', async ({page, server, toImpl}) => {
    await page.goto(server.EMPTY_PAGE);
    const result = await toImpl(page.mainFrame()).nonStallingRawEvaluateInExistingMainContext('2+2');
    expect(result).toBe(4);
  });

  test('should throw while pending navigation', async ({page, server, toImpl}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.evaluate(() => document.body.textContent = 'HELLO WORLD');
    let error;
    await page.route('**/empty.html', async (route, request) => {
      error = await toImpl(page.mainFrame()).nonStallingRawEvaluateInExistingMainContext('2+2').catch(e => e);
      route.abort();
    });
    await page.goto(server.EMPTY_PAGE).catch(() => {});
    expect(error.message).toContain('Frame is currently attempting a navigation');
  });

  test('should throw when no main execution context', async ({page, toImpl}) => {
    let errorPromise;
    page.on('frameattached', frame => {
      errorPromise = toImpl(frame).nonStallingRawEvaluateInExistingMainContext('2+2').catch(e => e);
    });
    await page.setContent('<iframe></iframe>');
    const error = await errorPromise;
    // bail out if we accidentally succeeded
    if (error === 4)
      return;
    // Testing this as a race.
    expect([
      'Frame does not yet have a main execution context',
      'Frame is currently attempting a navigation',
      'Navigation interrupted the evaluation',
    ]).toContain(error.message);
  });
});
