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

test('route-list shows no routes when empty', async ({ cli, server }) => {
  await cli('open', server.EMPTY_PAGE);
  const { output } = await cli('route-list');
  expect(output).toContain('No active routes');
});

test('route adds a mock and route-list shows it', async ({ cli, server }) => {
  await cli('open', server.EMPTY_PAGE);

  // Add a route
  const { output: routeOutput } = await cli('route', '**/api/users', '--body', '[]', '--status', '200');
  expect(routeOutput).toContain('Route added');

  // List routes
  const { output: listOutput } = await cli('route-list');
  expect(listOutput).toContain('**/api/users');
  expect(listOutput).toContain('status=200');
});

test('route with content-type', async ({ cli, server }) => {
  await cli('open', server.EMPTY_PAGE);

  await cli('route', '**/api/data', '--body', '{"test":true}', '--content-type', 'application/json');

  const { output } = await cli('route-list');
  expect(output).toContain('**/api/data');
  expect(output).toContain('contentType=application/json');
});

test('route with header', async ({ cli, server }) => {
  await cli('open', server.EMPTY_PAGE);

  await cli('route', '**/api/**', '--header', 'Authorization: Bearer token');

  const { output } = await cli('route-list');
  expect(output).toContain('**/api/**');
  expect(output).toContain('Authorization');
});

test('route with numerical body', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-cli/issues/235' } }, async ({ cli, server }) => {
  await cli('open', server.EMPTY_PAGE);

  await cli('route', '**/api/data', '--body', '42', '--content-type', 'text/plain');

  const { output } = await cli('route-list');
  expect(output).toContain('**/api/data');
  expect(output).toContain('contentType=text/plain');
});

test('unroute removes specific route', async ({ cli, server }) => {
  await cli('open', server.EMPTY_PAGE);

  // Add routes
  await cli('route', '**/api/users', '--status', '200');
  await cli('route', '**/api/posts', '--status', '201');

  // Remove specific route
  const { output: unrouteOutput } = await cli('unroute', '**/api/users');
  expect(unrouteOutput).toContain('Removed 1 route');

  // Verify
  const { output: listOutput } = await cli('route-list');
  expect(listOutput).not.toContain('**/api/users');
  expect(listOutput).toContain('**/api/posts');
});

test('unroute removes all routes', async ({ cli, server }) => {
  await cli('open', server.EMPTY_PAGE);

  // Add routes
  await cli('route', '**/api/users', '--status', '200');
  await cli('route', '**/api/posts', '--status', '201');

  // Remove all routes
  const { output: unrouteOutput } = await cli('unroute');
  expect(unrouteOutput).toContain('Removed all 2 route');

  // Verify
  const { output: listOutput } = await cli('route-list');
  expect(listOutput).toContain('No active routes');
});
