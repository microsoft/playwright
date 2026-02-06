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

import { test, expect, eventsPage } from './cli-fixtures';

test('mousemove', async ({ cli, server }) => {
  server.setContent('/', eventsPage, 'text/html');
  await cli('open', server.PREFIX);
  await cli('mousemove', '45', '35');
  const { snapshot } = await cli('snapshot');
  expect(snapshot).toContain('mouse move 45 35');
});

test('mousedown mouseup', async ({ cli, server }) => {
  server.setContent('/', eventsPage, 'text/html');
  await cli('open', server.PREFIX);
  await cli('mousemove', '45', '35');
  await cli('mousedown');
  await cli('mouseup');
  const { snapshot } = await cli('snapshot');
  expect(snapshot).toContain('mouse down');
  expect(snapshot).toContain('mouse up');
});

test('mousewheel', async ({ cli, server }) => {
  server.setContent('/', eventsPage, 'text/html');
  await cli('open', server.PREFIX);
  // click to focus
  await cli('mousemove', '50', '50');
  await cli('mousedown');
  await cli('mouseup');

  await cli('mousewheel', '10', '5');

  await expect.poll(() => cli('snapshot').then(result => result.snapshot)).toContain('wheel 5 10');
});
