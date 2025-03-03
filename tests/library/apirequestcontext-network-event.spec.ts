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
// import type { APIRequestEvent, APIRequestFinishedEvent } from 'playwright-core/src/server/fetch';

it('APIRequestContext.Events.Request', async ({ context, server }) => {
  const urls: string[] = [];
  context.request.on('apirequest', request => {
    urls.push(request.url.toString());
  });
  await context.request.fetch(server.EMPTY_PAGE);

  await setTimeout(() => {}, 100);

  expect(urls).toEqual([
    server.EMPTY_PAGE,
  ]);
});


it('APIRequestContext.Events.RequestFinished', async ({ context, server }) => {

  const urls: string[] = [];

  context.request.on('apirequestfinished', request => urls.push(request.requestEvent.url.toString()));
  await context.request.fetch(server.EMPTY_PAGE);


  expect(urls[0]).toBe(server.EMPTY_PAGE);
});

it('should fire events in proper order', async ({ context, server }) => {
  const events: string[] = [];
  context.request.on('apirequest', () => events.push('apirequest'));
  context.request.on('apirequestfinished', () => events.push('apirequestfinished'));
  await context.request.fetch(server.EMPTY_PAGE);
  expect(events).toEqual([
    'apirequest',
    'apirequestfinished'
  ]);
});
