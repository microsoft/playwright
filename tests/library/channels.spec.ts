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
import { playwrightTest, expect } from '../config/browserTest';

// Use something worker-scoped (e.g. expectScopeState) forces a new worker for this file.
// Otherwise, a browser launched for other tests in this worker will affect the expectations.
const it = playwrightTest.extend<{}, { expectScopeState: (object: any, golden: any) => void }>({
  expectScopeState: [async ({ toImplInWorkerScope }, use) => {
    await use((object, golden) => {
      golden = trimGuids(golden);
      const remoteRoot = toImplInWorkerScope();
      const remoteState = trimGuids(remoteRoot._debugScopeState());
      const localRoot = object._connection._rootObject;
      const localState = trimGuids(localRoot._debugScopeState());
      expect(localState).toEqual(golden);
      expect(remoteState).toEqual(golden);
    });
  }, { scope: 'worker' }],
});

it.skip(({ mode }) => mode !== 'default');
it.skip(({ video }) => video === 'on', 'Extra video artifacts in the objects list');

it('should scope context handles', async ({ browserType, server, expectScopeState }) => {
  const browser = await browserType.launch();
  const GOLDEN_PRECONDITION = {
    _guid: '',
    objects: [
      { _guid: 'android', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [
        { _guid: 'browser', objects: [] }
      ] },
      { _guid: 'electron', objects: [] },
      { _guid: 'localUtils', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'selectors', objects: [] },
    ]
  };
  expectScopeState(browser, GOLDEN_PRECONDITION);

  const context = await browser.newContext();
  const page = await context.newPage();
  // Firefox Beta 96 yields a console warning for the pages that
  // don't use `<!DOCTYPE HTML> tag.
  await page.goto(server.PREFIX + '/empty-standard-mode.html');
  expectScopeState(browser, {
    _guid: '',
    objects: [
      { _guid: 'android', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [
        { _guid: 'browser', objects: [
          { _guid: 'browser-context', objects: [
            { _guid: 'page', objects: [
              { _guid: 'frame', objects: [] },
              { _guid: 'request', objects: [
                { _guid: 'response', objects: [] },
              ] },
            ] },
            { _guid: 'request-context', objects: [] },
            { _guid: 'tracing', objects: [] }
          ] },
        ] },
      ] },
      { _guid: 'electron', objects: [] },
      { _guid: 'localUtils', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'selectors', objects: [] },
    ]
  });

  await context.close();
  expectScopeState(browser, GOLDEN_PRECONDITION);
  await browser.close();
});

it('should scope CDPSession handles', async ({ browserType, browserName, expectScopeState }) => {
  it.skip(browserName !== 'chromium');

  const browser = await browserType.launch();
  const GOLDEN_PRECONDITION = {
    _guid: '',
    objects: [
      { _guid: 'android', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [
        { _guid: 'browser', objects: [] }
      ] },
      { _guid: 'electron', objects: [] },
      { _guid: 'localUtils', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'selectors', objects: [] },
    ]
  };
  expectScopeState(browserType, GOLDEN_PRECONDITION);

  const session = await browser.newBrowserCDPSession();
  expectScopeState(browserType, {
    _guid: '',
    objects: [
      { _guid: 'android', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [
        { _guid: 'browser', objects: [
          { _guid: 'cdp-session', objects: [] },
        ] },
      ] },
      { _guid: 'electron', objects: [] },
      { _guid: 'localUtils', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'selectors', objects: [] },
    ]
  });

  await session.detach();
  expectScopeState(browserType, GOLDEN_PRECONDITION);

  await browser.close();
});

it('should scope browser handles', async ({ browserType, expectScopeState }) => {
  const GOLDEN_PRECONDITION = {
    _guid: '',
    objects: [
      { _guid: 'android', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'electron', objects: [] },
      { _guid: 'localUtils', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'selectors', objects: [] },
    ]
  };
  expectScopeState(browserType, GOLDEN_PRECONDITION);

  const browser = await browserType.launch();
  await browser.newContext();
  expectScopeState(browserType, {
    _guid: '',
    objects: [
      { _guid: 'android', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [
        {
          _guid: 'browser', objects: [
            { _guid: 'browser-context', objects: [
              { _guid: 'request-context', objects: [] },
              { _guid: 'tracing', objects: [] },
            ] },
          ]
        },
      ]
      },
      { _guid: 'electron', objects: [] },
      { _guid: 'localUtils', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'selectors', objects: [] },
    ]
  });

  await browser.close();
  expectScopeState(browserType, GOLDEN_PRECONDITION);
});

it('should not generate dispatchers for subresources w/o listeners', async ({ page, server, browserType, expectScopeState }) => {
  server.setRedirect('/one-style.css', '/two-style.css');
  server.setRedirect('/two-style.css', '/three-style.css');
  server.setRedirect('/three-style.css', '/four-style.css');
  server.setRoute('/four-style.css', (req, res) => res.end('body {box-sizing: border-box; }'));

  await page.goto(server.PREFIX + '/one-style.html');

  expectScopeState(browserType, {
    _guid: '',
    objects: [
      { _guid: 'android', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [
        {
          _guid: 'browser', objects: [
            { _guid: 'browser-context', objects: [
              {
                _guid: 'page', objects: [
                  { _guid: 'frame', objects: [] },
                  { _guid: 'request', objects: [
                    { _guid: 'response', objects: [] },
                  ] },
                ]
              },
              { _guid: 'request-context', objects: [] },
              { _guid: 'tracing', objects: [] }
            ] },
          ]
        }],
      },
      { _guid: 'electron', objects: [] },
      { _guid: 'localUtils', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'selectors', objects: [] },
    ]
  });
});

it('should work with the domain module', async ({ browserType, server, browserName }) => {
  const local = domain.create();
  local.run(() => { });
  let err;
  local.on('error', e => err = e);

  const browser = await browserType.launch();
  const page = await browser.newPage();

  expect(await page.evaluate(() => 1 + 1)).toBe(2);

  // At the time of writing, we used to emit 'error' event for WebSockets,
  // which failed with 'domain' module.
  let callback;
  const result = new Promise(f => callback = f);
  page.on('websocket', ws => ws.on('socketerror', callback));
  void page.evaluate(port => {
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

it('exposeFunction should not leak', async ({ page, expectScopeState, server }) => {
  await page.goto(server.EMPTY_PAGE);
  let called = 0;
  await page.exposeFunction('myFunction', () => ++called);
  for (let i = 0; i < 10; ++i)
    await page.evaluate(() => (window as any).myFunction({ foo: 'bar' }));
  expect(called).toBe(10);
  expectScopeState(page, {
    '_guid': '',
    'objects': [
      {
        '_guid': 'android',
        'objects': [],
      },
      {
        '_guid': 'browser-type',
        'objects': [],
      },
      {
        '_guid': 'browser-type',
        'objects': [],
      },
      {
        '_guid': 'browser-type',
        'objects': [],
      },
      {
        '_guid': 'browser-type',
        'objects': [],
      },
      {
        '_guid': 'browser-type',
        'objects': [
          {
            '_guid': 'browser',
            'objects': [
              {
                '_guid': 'browser-context',
                'objects': [
                  {
                    '_guid': 'page',
                    'objects': [
                      {
                        '_guid': 'frame',
                        'objects': [],
                      },
                      {
                        '_guid': 'request',
                        'objects': [
                          {
                            '_guid': 'response',
                            'objects': [],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    '_guid': 'request-context',
                    'objects': [],
                  },
                  {
                    '_guid': 'tracing',
                    'objects': [],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        '_guid': 'electron',
        'objects': [],
      },
      {
        '_guid': 'localUtils',
        'objects': [],
      },
      {
        '_guid': 'Playwright',
        'objects': [],
      },
      {
        '_guid': 'selectors',
        'objects': [],
      },
    ],
  });
});

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
