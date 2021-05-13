/**
 * Copyright 2018 Google Inc. All rights reserved.
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

import { contextTest as it, expect } from '../config/browserTest';
import { browserTest } from '../config/browserTest';

it('should work', async function({page}) {
  const client = await page.context().newCDPSession(page);

  await Promise.all([
    client.send('Runtime.enable'),
    client.send('Runtime.evaluate', { expression: 'window.foo = "bar"' })
  ]);
  const foo = await page.evaluate(() => window['foo']);
  expect(foo).toBe('bar');
});

it('should send events', async function({page, server}) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  const events = [];
  client.on('Network.requestWillBeSent', event => events.push(event));
  await page.goto(server.EMPTY_PAGE);
  expect(events.length).toBe(1);
});

it('should only accept a page', async function({page}) {
  // @ts-expect-error newCDPSession expects a Page
  const error = await page.context().newCDPSession(page.context()).catch(e => e);
  expect(error.message).toContain('page: expected Page');
});

it('should enable and disable domains independently', async function({page}) {
  const client = await page.context().newCDPSession(page);
  await client.send('Runtime.enable');
  await client.send('Debugger.enable');
  // JS coverage enables and then disables Debugger domain.
  await page.coverage.startJSCoverage();
  await page.coverage.stopJSCoverage();
  page.on('console', console.log);
  // generate a script in page and wait for the event.
  await Promise.all([
    new Promise<void>(f => client.on('Debugger.scriptParsed', event => {
      if (event.url === 'foo.js')
        f();
    })),
    page.evaluate('//# sourceURL=foo.js')
  ]);
});

it('should be able to detach session', async function({page}) {
  const client = await page.context().newCDPSession(page);
  await client.send('Runtime.enable');
  const evalResponse = await client.send('Runtime.evaluate', {expression: '1 + 2', returnByValue: true});
  expect(evalResponse.result.value).toBe(3);
  await client.detach();
  let error = null;
  try {
    await client.send('Runtime.evaluate', {expression: '3 + 1', returnByValue: true});
  } catch (e) {
    error = e;
  }
  expect(error.message).toContain('Target page, context or browser has been closed');
});

it('should throw nice errors', async function({page}) {
  const client = await page.context().newCDPSession(page);
  const error = await theSourceOfTheProblems().catch(error => error);
  expect(error.stack).toContain('theSourceOfTheProblems');
  expect(error.message).toContain('ThisCommand.DoesNotExist');

  async function theSourceOfTheProblems() {
    // @ts-expect-error invalid command
    await client.send('ThisCommand.DoesNotExist');
  }
});

browserTest('should not break page.close()', async function({browser}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const session = await page.context().newCDPSession(page);
  await session.detach();
  await page.close();
  await context.close();
});

browserTest('should detach when page closes', async function({browser}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await page.close();
  let error;
  await session.detach().catch(e => error = e);
  expect(error).toBeTruthy();
  await context.close();
});

browserTest('should work with newBrowserCDPSession', async function({browser}) {
  const session = await browser.newBrowserCDPSession();

  const version = await session.send('Browser.getVersion');
  expect(version.userAgent).toBeTruthy();

  let gotEvent = false;
  session.on('Target.targetCreated', () => gotEvent = true);
  await session.send('Target.setDiscoverTargets', { discover: true });
  expect(gotEvent).toBe(true);

  await session.detach();
});
