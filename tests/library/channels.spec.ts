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

import fs from 'fs';
import domain from 'domain';
import { playwrightTest as it, expect } from '../config/browserTest';

// Use something worker-scoped (e.g. launch args) to force a new worker for this file.
// Otherwise, a browser launched for other tests in this worker will affect the expectations.
it.use({
  launchOptions: async ({ launchOptions }, use) => {
    await use({ ...launchOptions, args: [] });
  }
});

it.skip(({ mode }) => mode === 'service');

it('should scope context handles', async ({ browserType, server }) => {
  const browser = await browserType.launch();
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
      { _guid: 'localUtils', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'selectors', objects: [] },
    ]
  };
  await expectScopeState(browser, GOLDEN_PRECONDITION);

  const context = await browser.newContext();
  const page = await context.newPage();
  // Firefox Beta 96 yields a console warning for the pages that
  // don't use `<!DOCTYPE HTML> tag.
  await page.goto(server.PREFIX + '/empty-standard-mode.html');
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
            { _guid: 'page', objects: [] },
            { _guid: 'request', objects: [] },
            { _guid: 'response', objects: [] },
          ] },
          { _guid: 'fetchRequest', objects: [] },
          { _guid: 'Tracing', objects: [] }
        ] },
      ] },
      { _guid: 'electron', objects: [] },
      { _guid: 'localUtils', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'selectors', objects: [] },
    ]
  });

  await context.close();
  await expectScopeState(browser, GOLDEN_PRECONDITION);
  await browser.close();
});

it('should scope CDPSession handles', async ({ browserType, browserName }) => {
  it.skip(browserName !== 'chromium');

  const browser = await browserType.launch();
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
      { _guid: 'localUtils', objects: [] },
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
      { _guid: 'localUtils', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'selectors', objects: [] },
    ]
  });

  await session.detach();
  await expectScopeState(browserType, GOLDEN_PRECONDITION);

  await browser.close();
});

it('should scope browser handles', async ({ browserType }) => {
  const GOLDEN_PRECONDITION = {
    _guid: '',
    objects: [
      { _guid: 'android', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'browser-type', objects: [] },
      { _guid: 'electron', objects: [] },
      { _guid: 'localUtils', objects: [] },
      { _guid: 'Playwright', objects: [] },
      { _guid: 'selectors', objects: [] },
    ]
  };
  await expectScopeState(browserType, GOLDEN_PRECONDITION);

  const browser = await browserType.launch();
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
            { _guid: 'browser-context', objects: [] },
            { _guid: 'fetchRequest', objects: [] },
            { _guid: 'Tracing', objects: [] }
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
  await expectScopeState(browserType, GOLDEN_PRECONDITION);
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

it('make sure that the client/server side context, page, etc. objects were garbage collected', async ({ browserName, server, childProcess }, testInfo) => {
  // WeakRef was added in Node.js 14
  it.skip(parseInt(process.version.slice(1), 10) < 14);
  const scriptPath = testInfo.outputPath('test.js');
  const script = `
  const playwright = require(${JSON.stringify(require.resolve('playwright'))});
  const { kTestSdkObjects } = require(${JSON.stringify(require.resolve('../../packages/playwright-core/lib/server/instrumentation'))});
  const { existingDispatcher } = require(${JSON.stringify(require.resolve('../../packages/playwright-core/lib/server/dispatchers/dispatcher'))});
  
  const toImpl = playwright._toImpl;
  
  (async () => {
    const clientSideObjectsSizeBeforeLaunch = playwright._connection._objects.size;
    const browser = await playwright['${browserName}'].launch();
    const objectRefs = [];
    const dispatcherRefs = [];

    for (let i = 0; i < 5; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const response = await page.goto('${server.EMPTY_PAGE}');
      objectRefs.push(new WeakRef(toImpl(context)));
      objectRefs.push(new WeakRef(toImpl(page)));
      objectRefs.push(new WeakRef(toImpl(response)));
      dispatcherRefs.push(
        new WeakRef(existingDispatcher(toImpl(context))),
        new WeakRef(existingDispatcher(toImpl(page))),
        new WeakRef(existingDispatcher(toImpl(response))),
      );
    }

    assertServerSideObjectsExistance(true);
    assertServerSideDispatchersExistance(true);
    await browser.close();

    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      global.gc();
    }

    assertServerSideObjectsExistance(false);
    assertServerSideDispatchersExistance(false);
    
    assertClientSideObjects();

    function assertClientSideObjects() {
      if (playwright._connection._objects.size !== clientSideObjectsSizeBeforeLaunch)
        throw new Error('Client-side objects were not cleaned up');
    }

    function assertServerSideObjectsExistance(expected) {
      for (const ref of objectRefs) {
        if (kTestSdkObjects.has(ref.deref()) !== expected) {
          throw new Error('Unexpected SdkObject existence! (expected: ' + expected + ')');
        }
      }
    }

    function assertServerSideDispatchersExistance(expected) {
      for (const ref of dispatcherRefs) {
        const impl = ref.deref();
        if (!!impl !== expected)
          throw new Error('Dispatcher is still alive!');
      }
    }
  })();
  `;
  await fs.promises.writeFile(scriptPath, script);
  const testSdkObjectsProcess = childProcess({
    command: ['node', '--expose-gc', scriptPath],
    env: {
      ...process.env,
      _PW_INTERNAL_COUNT_SDK_OBJECTS: '1',
    }
  });
  const { exitCode } = await testSdkObjectsProcess.exited;
  expect(exitCode).toBe(0);
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
