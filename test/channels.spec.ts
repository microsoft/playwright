/**
 * Copyright 2017 Google Inc. All rights reserved.
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

import domain from 'domain';
import { folio } from './fixtures';
import type { ChromiumBrowser } from '..';

const fixtures = folio.extend<{}, { domain: any }>();
fixtures.domain.init(async ({ }, run) => {
  const local = domain.create();
  local.run(() => { });
  let err;
  local.on('error', e => err = e);
  await run(null);
  if (err)
    throw err;
}, { scope: 'worker' });
const { it, expect } = fixtures.build();

it('should work', async ({browser}) => {
  expect(!!browser['_connection']).toBeTruthy();
});

it('should scope context handles', async ({browser, server}) => {
  const GOLDEN_PRECONDITION = {
    _guid: '',
    objects: [
      { _guid: 'Android', objects: [] },
      { _guid: 'BrowserType', objects: [] },
      { _guid: 'BrowserType', objects: [] },
      { _guid: 'BrowserType', objects: [
        { _guid: 'Browser', objects: [] }
      ] },
      { _guid: 'Electron', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'Selectors', objects: [] },
    ]
  };
  await expectScopeState(browser, GOLDEN_PRECONDITION);

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await expectScopeState(browser, {
    _guid: '',
    objects: [
      { _guid: 'Android', objects: [] },
      { _guid: 'BrowserType', objects: [] },
      { _guid: 'BrowserType', objects: [] },
      { _guid: 'BrowserType', objects: [
        { _guid: 'Browser', objects: [
          { _guid: 'BrowserContext', objects: [
            { _guid: 'Frame', objects: [] },
            { _guid: 'Page', objects: [
              { _guid: 'Request', objects: [] },
              { _guid: 'Response', objects: [] },
            ]},
          ]},
        ] },
      ] },
      { _guid: 'Electron', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'Selectors', objects: [] },
    ]
  });

  await context.close();
  await expectScopeState(browser, GOLDEN_PRECONDITION);
});

it('should scope CDPSession handles', (test, { browserName }) => {
  test.skip(browserName !== 'chromium');
}, async ({browserType, browser}) => {
  const GOLDEN_PRECONDITION = {
    _guid: '',
    objects: [
      { _guid: 'Android', objects: [] },
      { _guid: 'BrowserType', objects: [] },
      { _guid: 'BrowserType', objects: [] },
      { _guid: 'BrowserType', objects: [
        { _guid: 'Browser', objects: [] }
      ] },
      { _guid: 'Electron', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'Selectors', objects: [] },
    ]
  };
  await expectScopeState(browserType, GOLDEN_PRECONDITION);

  const session = await (browser as ChromiumBrowser).newBrowserCDPSession();
  await expectScopeState(browserType, {
    _guid: '',
    objects: [
      { _guid: 'Android', objects: [] },
      { _guid: 'BrowserType', objects: [] },
      { _guid: 'BrowserType', objects: [] },
      { _guid: 'BrowserType', objects: [
        { _guid: 'Browser', objects: [
          { _guid: 'CDPSession', objects: [] },
        ] },
      ] },
      { _guid: 'Electron', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'Selectors', objects: [] },
    ]
  });

  await session.detach();
  await expectScopeState(browserType, GOLDEN_PRECONDITION);
});

it('should scope browser handles', async ({browserType, browserOptions}) => {
  const GOLDEN_PRECONDITION = {
    _guid: '',
    objects: [
      { _guid: 'Android', objects: [] },
      { _guid: 'BrowserType', objects: [] },
      { _guid: 'BrowserType', objects: [
        { _guid: 'Browser', objects: [] },
      ]
      },
      { _guid: 'BrowserType', objects: [] },
      { _guid: 'Electron', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'Selectors', objects: [] },
    ]
  };
  await expectScopeState(browserType, GOLDEN_PRECONDITION);

  const browser = await browserType.launch(browserOptions);
  await browser.newContext();
  await expectScopeState(browserType, {
    _guid: '',
    objects: [
      { _guid: 'Android', objects: [] },
      { _guid: 'BrowserType', objects: [] },
      { _guid: 'BrowserType', objects: [] },
      { _guid: 'BrowserType', objects: [
        { _guid: 'Browser', objects: [] },
        {
          _guid: 'Browser', objects: [
            { _guid: 'BrowserContext', objects: [] }
          ]
        },
      ]
      },
      { _guid: 'Electron', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'Selectors', objects: [] },
    ]
  });

  await browser.close();
  await expectScopeState(browserType, GOLDEN_PRECONDITION);
});

it('should work with the domain module', async ({ domain, browserType, browserOptions, server, isFirefox }) => {
  const browser = await browserType.launch(browserOptions);
  const page = await browser.newPage();

  expect(await page.evaluate(() => 1 + 1)).toBe(2);

  // At the time of writing, we used to emit 'error' event for WebSockets,
  // which failed with 'domain' module.
  let callback;
  const result = new Promise(f => callback = f);
  page.on('websocket', ws => ws.on('socketerror', callback));
  page.evaluate(port => {
    new WebSocket('ws://localhost:' + port + '/bogus-ws');
  }, server.PORT);
  const message = await result;
  if (isFirefox)
    expect(message).toBe('CLOSE_ABNORMAL');
  else
    expect(message).toContain(': 400');

  await browser.close();
});

async function expectScopeState(object, golden) {
  golden = trimGuids(golden);
  const remoteState = trimGuids(await object._channel.debugScopeState());
  const localState = trimGuids(object._connection._debugScopeState());
  expect(localState).toEqual(golden);
  expect(remoteState).toEqual(golden);
}

function compareObjects(a, b) {
  if (a._guid !== b._guid)
    return a._guid.localeCompare(b._guid);
  return a.objects.length - b.objects.length;
}

function trimGuids(object) {
  if (Array.isArray(object))
    return object.map(trimGuids).sort(compareObjects);
  if (typeof object === 'object') {
    const result = {};
    for (const key in object)
      result[key] = trimGuids(object[key]);
    return result;
  }
  if (typeof object === 'string')
    return object ? object.match(/[^@]+/)[0] : '';
  return object;
}
