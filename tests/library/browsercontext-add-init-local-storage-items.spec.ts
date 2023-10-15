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
import { contextTest as it, expect } from '../config/browserTest';

async function goToExample(page) {
  await page.route('**/*', route => {
    route.fulfill({ body: '<html></html>' }).catch(() => {});
  });
  await page.goto('https://www.example.com');
}

it('should overwrite existing items by default', async ({
  contextFactory,
}) => {
  const context = await contextFactory({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'https://www.example.com',
          localStorage: [{
            name: 'predefined-name',
            value: 'predefined-value'
          }]
        },
      ]
    }
  });

  const page = await context.newPage();

  await page.addInitLocalStorageItems([
    {
      name: 'predefined-name',
      value: 'new-element-value',
    }
  ]);

  await goToExample(page);

  const localStorage = await page.evaluate(() => window.localStorage);
  await expect(localStorage['predefined-name']).toBe('new-element-value');
});


it('should not overwrite existing items if overwrite flag is false', async ({
  contextFactory,
  server,
}) => {
  const context = await contextFactory({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'https://www.example.com',
          localStorage: [{
            name: 'predefined-name',
            value: 'predefined-value'
          }]
        },
      ]
    }
  });

  const page = await context.newPage();

  await page.addInitLocalStorageItems([
    {
      name: 'predefined-name',
      value: 'new-element-value',
    },
    {
      name: 'new-element-2-name',
      value: 'new-element-2-value',
    }
  ], false);

  await goToExample(page);

  const localStorage = await page.evaluate(() => window.localStorage);
  await expect(localStorage['predefined-name']).toBe('predefined-value');
  await expect(localStorage['new-element-2-name']).toBe('new-element-2-value');
});
