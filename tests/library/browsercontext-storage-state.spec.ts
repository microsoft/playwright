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

import { attachFrame } from 'tests/config/utils';
import { browserTest as it, expect } from '../config/browserTest';
import fs from 'fs';

it('should capture local storage', async ({ contextFactory }) => {
  const context = await contextFactory();
  const page1 = await context.newPage();
  await page1.route('**/*', route => {
    route.fulfill({ body: '<html></html>' }).catch(() => {});
  });
  await page1.goto('https://www.example.com');
  await page1.evaluate(() => {
    localStorage['name1'] = 'value1';
  });
  await page1.goto('https://www.domain.com');
  await page1.evaluate(() => {
    localStorage['name2'] = 'value2';
  });
  const { origins } = await context.storageState();
  expect(origins).toEqual([{
    origin: 'https://www.domain.com',
    localStorage: [{
      name: 'name2',
      value: 'value2'
    }],
  }, {
    origin: 'https://www.example.com',
    localStorage: [{
      name: 'name1',
      value: 'value1'
    }],
  }]);
});

it('should set local storage', async ({ contextFactory }) => {
  const context = await contextFactory({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'https://www.example.com',
          localStorage: [{
            name: 'name1',
            value: 'value1'
          }]
        },
      ]
    }
  });
  const page = await context.newPage();
  await page.route('**/*', route => {
    route.fulfill({ body: '<html></html>' }).catch(() => {});
  });
  await page.goto('https://www.example.com');
  const localStorage = await page.evaluate('window.localStorage');
  expect(localStorage).toEqual({ name1: 'value1' });
  await context.close();
});

it('should round-trip through the file', async ({ contextFactory }, testInfo) => {
  const context = await contextFactory();
  const page1 = await context.newPage();
  await page1.route('**/*', route => {
    route.fulfill({ body: '<html></html>' }).catch(() => {});
  });
  await page1.goto('https://www.example.com');
  await page1.evaluate(async () => {
    localStorage['name1'] = 'value1';
    document.cookie = 'username=John Doe';

    await new Promise((resolve, reject) => {
      const openRequest = indexedDB.open('db', 42);
      openRequest.onupgradeneeded = () => {
        openRequest.result.createObjectStore('store', { keyPath: 'name' });
        openRequest.result.createObjectStore('store2');
      };
      openRequest.onsuccess = () => {
        const transaction = openRequest.result.transaction(['store', 'store2'], 'readwrite');
        transaction
            .objectStore('store')
            .put({ name: 'foo', date: new Date(0), null: null });
        transaction
            .objectStore('store2')
            .put(new TextEncoder().encode('bar'), 'foo');
        transaction.addEventListener('complete', resolve);
        transaction.addEventListener('error', reject);
      };
    });

    return document.cookie;
  });

  const path = testInfo.outputPath('storage-state.json');
  const state = await context.storageState({ path, indexedDB: true });
  const written = await fs.promises.readFile(path, 'utf8');
  expect(JSON.stringify(state, undefined, 2)).toBe(written);

  const context2 = await contextFactory({ storageState: path });
  const page2 = await context2.newPage();
  await page2.route('**/*', route => {
    route.fulfill({ body: '<html></html>' }).catch(() => {});
  });
  await page2.goto('https://www.example.com');
  const localStorage = await page2.evaluate('window.localStorage');
  expect(localStorage).toEqual({ name1: 'value1' });
  const cookie = await page2.evaluate('document.cookie');
  expect(cookie).toEqual('username=John Doe');
  const idbValues = await page2.evaluate(() => new Promise((resolve, reject) => {
    const openRequest = indexedDB.open('db', 42);
    openRequest.addEventListener('success', async () => {
      const db = openRequest.result;
      const transaction = db.transaction(['store', 'store2'], 'readonly');
      const request1 = transaction.objectStore('store').get('foo');
      const request2 = transaction.objectStore('store2').get('foo');

      const [result1, result2] = await Promise.all([request1, request2].map(request => new Promise((resolve, reject) => {
        request.addEventListener('success', () => resolve(request.result));
        request.addEventListener('error', () => reject(request.error));
      })));

      resolve([result1, new TextDecoder().decode(result2 as any)]);
    });
    openRequest.addEventListener('error', () => reject(openRequest.error));
  }));
  expect(idbValues).toEqual([
    { name: 'foo', date: new Date(0), null: null },
    'bar'
  ]);
  await context2.close();
});

it('should capture cookies', async ({ server, context, page, contextFactory }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=b', 'empty=']);
    res.end();
  });

  await page.goto(server.PREFIX + '/setcookie.html');
  expect(await page.evaluate(() => {
    const cookies = document.cookie.split(';');
    return cookies.map(cookie => cookie.trim()).sort();
  })).toEqual([
    'a=b',
    'empty=',
  ]);

  const storageState = await context.storageState();
  expect(new Set(storageState.cookies)).toEqual(new Set([
    expect.objectContaining({
      name: 'a',
      value: 'b'
    }),
    expect.objectContaining({
      name: 'empty',
      value: ''
    })
  ]));
  const context2 = await contextFactory({ storageState });
  const page2 = await context2.newPage();
  await page2.goto(server.EMPTY_PAGE);
  expect(await page2.evaluate(() => {
    const cookies = document.cookie.split(';');
    return cookies.map(cookie => cookie.trim()).sort();
  })).toEqual([
    'a=b',
    'empty=',
  ]);
});

it('should not emit events about internal page', async ({ contextFactory }) => {
  const context = await contextFactory();
  const page = await context.newPage();
  await page.route('**/*', route => {
    void route.fulfill({ body: '<html></html>' });
  });
  await page.goto('https://www.example.com');
  await page.evaluate(() => localStorage['name1'] = 'value1');
  await page.goto('https://www.domain.com');
  await page.evaluate(() => localStorage['name2'] = 'value2');

  const events = [];
  context.on('page', e => events.push(e));
  context.on('request', e => events.push(e));
  context.on('requestfailed', e => events.push(e));
  context.on('requestfinished', e => events.push(e));
  context.on('response', e => events.push(e));
  await context.storageState();
  expect(events).toHaveLength(0);
});

it('should not restore localStorage twice', async ({ contextFactory }) => {
  const context = await contextFactory({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'https://www.example.com',
          localStorage: [{
            name: 'name1',
            value: 'value1'
          }]
        },
      ]
    }
  });
  const page = await context.newPage();
  await page.route('**/*', route => {
    route.fulfill({ body: '<html></html>' }).catch(() => {});
  });
  await page.goto('https://www.example.com');
  const localStorage1 = await page.evaluate('window.localStorage');
  expect(localStorage1).toEqual({ name1: 'value1' });

  await page.evaluate(() => window.localStorage['name1'] = 'value2');

  await page.goto('https://www.example.com');
  const localStorage2 = await page.evaluate('window.localStorage');
  expect(localStorage2).toEqual({ name1: 'value2' });

  await context.close();
});

it('should handle missing file', async ({ contextFactory }, testInfo) => {
  const file = testInfo.outputPath('does-not-exist.json');
  const error = await contextFactory({
    storageState: file,
  }).catch(e => e);
  expect(error.message).toContain(`Error reading storage state from ${file}:\nENOENT`);
});

it('should handle malformed file', async ({ contextFactory, nodeVersion }, testInfo) => {
  const file = testInfo.outputPath('state.json');
  fs.writeFileSync(file, 'not-json', 'utf-8');
  const error = await contextFactory({
    storageState: file,
  }).catch(e => e);
  if (nodeVersion.major > 18)
    expect(error.message).toContain(`Error reading storage state from ${file}:\nUnexpected token 'o', \"not-json\" is not valid JSON`);
  else
    expect(error.message).toContain(`Error reading storage state from ${file}:\nUnexpected token o in JSON at position 1`);
});

it('should serialize storageState with lone surrogates', async ({ page, context, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright-dotnet/issues/2819' });
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => window.localStorage.setItem('foo', String.fromCharCode(55934)));
  const storageState = await context.storageState();
  expect(storageState.origins[0].localStorage[0].value).toBe(String.fromCharCode(55934));
});

it('should work when service worker is intefering', async ({ page, context, server, isAndroid, isElectron, electronMajorVersion }) => {
  it.skip(isAndroid);
  it.skip(isElectron && electronMajorVersion < 30, 'error: Browser context management is not supported.');

  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`
      <script>
        console.log('from page');
        window.localStorage.foo = 'bar';
        window.registrationPromise = navigator.serviceWorker.register('sw.js');
        window.activationPromise = new Promise(resolve => navigator.serviceWorker.oncontrollerchange = resolve);
      </script>
    `);
  });

  server.setRoute('/sw.js', (req, res) => {
    res.writeHead(200, { 'content-type': 'application/javascript' });
    res.end(`
      const kHtmlPage = \`
        <script>
          console.log('from sw page');
          let counter = window.localStorage.counter || 0;
          ++counter;
          window.localStorage.counter = counter;
          setTimeout(() => {
            window.location.href = counter + '.html';
          }, 0);
        </script>
      \`;

      console.log('from sw 1');
      self.addEventListener('fetch', event => {
        console.log('fetching ' + event.request.url);
        const blob = new Blob([kHtmlPage], { type: 'text/html' });
        const response = new Response(blob, { status: 200 , statusText: 'OK' });
        event.respondWith(response);
      });

      self.addEventListener('activate', event => {
        console.log('from sw 2');
        event.waitUntil(clients.claim());
      });
    `);
  });

  await page.goto(server.PREFIX);
  await page.evaluate(() => window['activationPromise']);

  const storageState = await context.storageState();
  expect(storageState.origins[0].localStorage[0]).toEqual({ name: 'foo', value: 'bar' });
});

it('should set local storage in third-party context', async ({ contextFactory, server }) => {
  const context = await contextFactory({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: server.CROSS_PROCESS_PREFIX,
          localStorage: [{
            name: 'name1',
            value: 'value1'
          }]
        },
      ]
    }
  });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const frame = await attachFrame(page, 'frame1', server.CROSS_PROCESS_PREFIX + '/empty.html');

  const localStorage = await frame.evaluate('window.localStorage');
  expect(localStorage).toEqual({ name1: 'value1' });
  await context.close();
});

it('should roundtrip local storage in third-party context', async ({ page, contextFactory, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const frame = await attachFrame(page, 'frame1', server.CROSS_PROCESS_PREFIX + '/empty.html');
  await frame.evaluate(() => window.localStorage.setItem('name1', 'value1'));
  const storageState = await page.context().storageState();

  const context2 = await contextFactory({ storageState });
  const page2 = await context2.newPage();
  await page2.goto(server.EMPTY_PAGE);
  const frame2 = await attachFrame(page2, 'frame1', server.CROSS_PROCESS_PREFIX + '/empty.html');

  const localStorage = await frame2.evaluate('window.localStorage');
  expect(localStorage).toEqual({ name1: 'value1' });
  await context2.close();
});

it('should support IndexedDB', async ({ page, server, contextFactory }) => {
  await page.goto(server.PREFIX + '/to-do-notifications/index.html');

  await expect(page.locator('#notifications')).toMatchAriaSnapshot(`
    - list:
      - listitem: Database initialised.
  `);
  await page.getByLabel('Task title').fill('Pet the cat');
  await page.getByLabel('Hours').fill('1');
  await page.getByLabel('Mins').fill('1');
  await page.getByText('Add Task').click();
  await expect(page.locator('#notifications')).toMatchAriaSnapshot(`
    - list:
      - listitem: "Transaction completed: database modification finished."
  `);

  const storageState = await page.context().storageState({ indexedDB: true });
  expect(storageState.origins).toEqual([
    {
      origin: server.PREFIX,
      localStorage: [],
      indexedDB: [
        {
          name: 'toDoList',
          version: 4,
          stores: [
            {
              name: 'toDoList',
              autoIncrement: false,
              keyPath: 'taskTitle',
              records: [
                {
                  value: {
                    day: '01',
                    hours: '1',
                    minutes: '1',
                    month: 'January',
                    notified: 'no',
                    taskTitle: 'Pet the cat',
                    year: '2025',
                  },
                },
              ],
              indexes: [
                {
                  name: 'day',
                  keyPath: 'day',
                  multiEntry: false,
                  unique: false,
                },
                {
                  name: 'hours',
                  keyPath: 'hours',
                  multiEntry: false,
                  unique: false,
                },
                {
                  name: 'minutes',
                  keyPath: 'minutes',
                  multiEntry: false,
                  unique: false,
                },
                {
                  name: 'month',
                  keyPath: 'month',
                  multiEntry: false,
                  unique: false,
                },
                {
                  name: 'notified',
                  keyPath: 'notified',
                  multiEntry: false,
                  unique: false,
                },
                {
                  name: 'year',
                  keyPath: 'year',
                  multiEntry: false,
                  unique: false,
                },
              ],
            },
          ],
        },
      ],
    },
  ]);

  const context = await contextFactory({ storageState });
  expect(await context.storageState({ indexedDB: true })).toEqual(storageState);

  const recreatedPage = await context.newPage();
  await recreatedPage.goto(server.PREFIX + '/to-do-notifications/index.html');
  await expect(recreatedPage.locator('#task-list')).toMatchAriaSnapshot(`
    - list:
      - listitem:
        - text: /Pet the cat/
  `);

  expect(await context.storageState()).toEqual({ cookies: [], origins: [] });
});

it('should support empty indexedDB', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/35760' } }, async ({ page, server, contextFactory }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => new Promise<void>(resolve => {
    const openRequest = indexedDB.open('unused-db');
    openRequest.onsuccess = () => resolve();
    openRequest.onerror = () => resolve();
  }));
  const storageState = await page.context().storageState({ indexedDB: true });
  expect(storageState.origins).toEqual([{
    origin: server.PREFIX,
    localStorage: [],
    indexedDB: [{
      name: 'unused-db',
      version: 1,
      stores: [],
    }]
  }]);

  const context = await contextFactory({ storageState });
  expect(await context.storageState({ indexedDB: true })).toEqual(storageState);
});
