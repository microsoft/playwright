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

it('should fetch lodpi assets @smoke', async ({ contextFactory, server }) => {
  const context = await contextFactory({
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  const [request] = await Promise.all([
    page.waitForRequest('**/image*'),
    page.goto(server.PREFIX + '/highdpi.html'),
  ]);
  expect(request.url()).toContain('image1x');
});

it('should fetch hidpi assets', async ({ contextFactory, server }) => {
  const context = await contextFactory({
    deviceScaleFactor: 2
  });
  const page = await context.newPage();
  const [request] = await Promise.all([
    page.waitForRequest('**/image*'),
    page.goto(server.PREFIX + '/highdpi.html'),
  ]);
  expect(request.url()).toContain('image2x');
});
