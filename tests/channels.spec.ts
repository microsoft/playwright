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
import { playwrightTest as it, expect } from './config/browserTest';

// Use something worker-scoped (e.g. launch args) to force a new worker for this file.
// Otherwise, a browser launched for other tests in this worker will affect the expectations.
it.use({ args: [] });

it('should scope context handles', async ({browserType, browserOptions, server}) => {
  const browser = await browserType.launch(browserOptions);
  const GOLDEN_PRECONDITION = {
    _guid: '',
    objects: [
      { _guid: 'android', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [
        { _guid: 'browser', objects: [] }
      ] },
      { _guid: 'electron', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'selectors', objects: [] },
    ]
  };
  await expectScopeState(browser, GOLDEN_PRECONDITION);

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await expectScopeState(browser, {
    _guid: '',
    objects: [
      { _guid: 'android', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [
        { _guid: 'browser', objects: [
          { _guid: 'browser-context', objects: [
            { _guid: 'frame', objects: [] },
            { _guid: 'page', objects: []},
            { _guid: 'request', objects: [] },
            { _guid: 'response', objects: [] },
          ]},
        ] },
      ] },
      { _guid: 'electron', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'selectors', objects: [] },
    ]
  });

  await context.close();
  await expectScopeState(browser, GOLDEN_PRECONDITION);
  await browser.close();
});

it('should scope CDPSession handles', async ({browserType, browserOptions, browserName}) => {
  it.skip(browserName !== 'chromium');

  const browser = await browserType.launch(browserOptions);
  const GOLDEN_PRECONDITION = {
    _guid: '',
    objects: [
      { _guid: 'android', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [
        { _guid: 'browser', objects: [] }
      ] },
      { _guid: 'electron', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'selectors', objects: [] },
    ]
  };
  await expectScopeState(browserType, GOLDEN_PRECONDITION);

  const session = await browser.newBrowserCDPSession();
  await expectScopeState(browserType, {
    _guid: '',
    objects: [
      { _guid: 'android', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [
        { _guid: 'browser', objects: [
          { _guid: 'cdp-session', objects: [] },
        ] },
      ] },
      { _guid: 'electron', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'selectors', objects: [] },
    ]
  });

  await session.detach();
  await expectScopeState(browserType, GOLDEN_PRECONDITION);

  await browser.close();
});

it('should scope browser handles', async ({browserType, browserOptions}) => {
  const GOLDEN_PRECONDITION = {
    _guid: '',
    objects: [
      { _guid: 'android', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'electron', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'selectors', objects: [] },
    ]
  };
  await expectScopeState(browserType, GOLDEN_PRECONDITION);

  const browser = await browserType.launch(browserOptions);
  await browser.newContext();
  await expectScopeState(browserType, {
    _guid: '',
    objects: [
      { _guid: 'android', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [
        {
          _guid: 'browser', objects: [
            { _guid: 'browser-context', objects: [] }
          ]
        },
      ]
      },
      { _guid: 'electron', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'selectors', objects: [] },
    ]
  });

  await browser.close();
  await expectScopeState(browserType, GOLDEN_PRECONDITION);
});

it('should work with the domain module', async ({ browserType, browserOptions, server, browserName }) => {
  const local = domain.create();
  local.run(() => { });
  let err;
  local.on('error', e => err = e);

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
  if (browserName === 'firefox')
    expect(message).toBe('CLOSE_ABNORMAL');
  else
    expect(message).toContain(': 400');

  await browser.close();

  if (err)
    throw err;
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
