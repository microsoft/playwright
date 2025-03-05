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

import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'https://jsonplaceholder.typicode.com',
});

test('posts', async ({ request }) => {
  const get = await request.get('/posts');
  expect(get.ok()).toBeTruthy();
  expect(await get.json()).toBeInstanceOf(Array);

  const post = await request.post('/posts');
  expect(post.ok()).toBeTruthy();
  expect(await post.json()).toEqual({
    id: expect.any(Number),
  });

  const del = await request.delete('/posts/1');
  expect(del.ok()).toBeTruthy();
  expect(await del.json()).toEqual({});
});
