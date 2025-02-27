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
import { APIRequestEvent, APIRequestFinishedEvent } from 'playwright-core/src/server/fetch';

it('APIRequestContext.Events.Request', async ({ context, server }) => {
  const requests: APIRequestEvent[] = [];
  context.request.on('apiRequest', request => {
    requests.push(request);
  });
  await context.request.fetch(server.EMPTY_PAGE);

  await setTimeout(() => {}, 100);

  const urls = requests.map(r => r.url.toString());
  expect(urls).toEqual([
    server.EMPTY_PAGE,
  ]);
});


it('APIRequestContext.Events.RequestFinished', async ({ context, server }) => {

  const finishedRequests: APIRequestFinishedEvent[] = [];

  context.request.on('apiRequestfinished', request => finishedRequests.push(request));
  await context.request.fetch(server.EMPTY_PAGE);

  const request = finishedRequests[0];

  expect(request.requestEvent.url.toString()).toBe(server.EMPTY_PAGE);
  expect(request.timings.send).toBeTruthy();
});

it('should fire events in proper order', async ({ context, server }) => {
  const events: string[] = [];
  context.request.on('apiRequest', () => events.push('apiRequest'));
  context.request.on('apiRequestfinished', () => events.push('apiRequestfinished'));
  await context.request.fetch(server.EMPTY_PAGE);
  expect(events).toEqual([
    'apiRequest',
    'apiRequestfinished'
  ]);
});
