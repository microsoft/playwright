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

import { test, expect } from './cli-fixtures';

test('network-state shows online by default', async ({ cli, server }) => {
  await cli('open', server.EMPTY_PAGE);
  const { output } = await cli('network-state');
  expect(output).toContain('online');
});

test('set-network-state toggles offline state', async ({ cli, server }) => {
  await cli('open', server.EMPTY_PAGE);

  // Set offline
  const { output: offlineOutput } = await cli('set-network-state', 'offline');
  expect(offlineOutput).toContain('offline');

  // Check status
  const { output: statusOutput } = await cli('network-state');
  expect(statusOutput).toContain('offline');

  // Restore online
  const { output: onlineOutput } = await cli('set-network-state', 'online');
  expect(onlineOutput).toContain('online');
});
