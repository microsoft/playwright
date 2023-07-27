
/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

it('should receive pageError in context', async ({ browser, server }) => {
  const messages = [];
  const context = await browser.newContext();
  context.on('pageeror', e => messages.push(e));
  const page = await context.newPage();
  await Promise.all([
    context.waitForEvent('pageerror'),
    page.goto(server.PREFIX + '/error.html'),
  ]);
  console.log('messages', messages);
  expect(messages.length).toBe(1);
});
