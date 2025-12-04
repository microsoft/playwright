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

import { test as it } from './pageTest';
import './perform-task.cache';

// @ts-ignore
it('perform task', async ({ page, _perform }) => {
  await page.goto('https://demo.playwright.dev/todomvc');
  await _perform('Add "Buy groceries" todo');
  await _perform('Add "Walk the dog" todo');
  await _perform('Add "Read a book" todo');
});
