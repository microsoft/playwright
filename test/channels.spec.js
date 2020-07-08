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

const { FFOX, CHROMIUM, WEBKIT, WIN, CHANNEL } = require('./utils').testOptions(browserType);

describe.skip(!CHANNEL)('Channels', function() {
  it('should work', async({browser}) => {
    expect(!!browser._channel).toBeTruthy();
  });

  it('should scope context handles', async({browser, server}) => {
    const GOLDEN_PRECONDITION = {
      objects: [ 'chromium', 'browser' ],
      scopes: [
        { _guid: '', objects: [ 'chromium', 'browser' ] },
        { _guid: 'browser', objects: [] }
      ]
    };
    await expectScopeState(browser, GOLDEN_PRECONDITION);

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    await expectScopeState(browser, {
      objects: [ 'chromium', 'browser', 'context', 'frame', 'page', 'request', 'response' ],
      scopes: [
        { _guid: '', objects: [ 'chromium', 'browser' ] },
        { _guid: 'browser', objects: ['context'] },
        { _guid: 'context', objects: ['frame', 'page', 'request', 'response'] }
      ]
    });

    await context.close();
    await expectScopeState(browser, GOLDEN_PRECONDITION);
  });

  it('should scope CDPSession handles', async({browserType, browser, server}) => {
    const GOLDEN_PRECONDITION = {
      objects: [ 'chromium', 'browser' ],
      scopes: [
        { _guid: '', objects: [ 'chromium', 'browser' ] },
        { _guid: 'browser', objects: [] }
      ]
    };
    await expectScopeState(browserType, GOLDEN_PRECONDITION);

    const session = await browser.newBrowserCDPSession();
    await expectScopeState(browserType, {
      objects: [ 'chromium', 'browser', 'cdpSession' ],
      scopes: [
        { _guid: '', objects: [ 'chromium', 'browser' ] },
        { _guid: 'browser', objects: ['cdpSession'] },
        { _guid: 'cdpSession', objects: [] },
      ]
    });

    await session.detach();
    await expectScopeState(browserType, GOLDEN_PRECONDITION);
  });

  it('should scope browser handles', async({browserType, defaultBrowserOptions}) => {
    const GOLDEN_PRECONDITION = {
      objects: [ 'chromium', 'browser' ],
      scopes: [
        { _guid: '', objects: [ 'chromium', 'browser' ] },
        { _guid: 'browser', objects: [] }
      ]
    };
    await expectScopeState(browserType, GOLDEN_PRECONDITION);

    const browser = await browserType.launch(defaultBrowserOptions);
    await browser.newContext();
    await expectScopeState(browserType, {
      objects: [ 'chromium', 'browser', 'browser', 'context' ],
      scopes: [
        { _guid: '', objects: [ 'chromium', 'browser', 'browser' ] },
        { _guid: 'browser', objects: [] },
        { _guid: 'browser', objects: ['context'] },
        { _guid: 'context', objects: [] },
      ]
    });

    await browser.close();
    await expectScopeState(browserType, GOLDEN_PRECONDITION);
  });
});

async function expectScopeState(object, golden) {
  const remoteState = trimGuids(await object._channel.debugScopeState());
  const localState = trimGuids(object._scope._connection._debugScopeState());
  expect(localState).toEqual(golden);
  expect(remoteState).toEqual(golden);
}

function trimGuids(object) {
  if (Array.isArray(object))
    return object.map(trimGuids);
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
