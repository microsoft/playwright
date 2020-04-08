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

const {FFOX, CHROMIUM, WEBKIT} = require('../utils').testOptions(browserType);

describe('ChromiumBrowserContext.createSession', function() {
  it('should work', async function({page, browser, server}) {
    const client = await page.context().newCDPSession(page);

    await Promise.all([
      client.send('Runtime.enable'),
      client.send('Runtime.evaluate', { expression: 'window.foo = "bar"' })
    ]);
    const foo = await page.evaluate(() => window.foo);
    expect(foo).toBe('bar');
  });
  it('should send events', async function({page, browser, server}) {
    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');
    const events = [];
    client.on('Network.requestWillBeSent', event => events.push(event));
    await page.goto(server.EMPTY_PAGE);
    expect(events.length).toBe(1);
  });
  it('should enable and disable domains independently', async function({page, browser, server}) {
    const client = await page.context().newCDPSession(page);
    await client.send('Runtime.enable');
    await client.send('Debugger.enable');
    // JS coverage enables and then disables Debugger domain.
    await page.coverage.startJSCoverage();
    await page.coverage.stopJSCoverage();
    // generate a script in page and wait for the event.
    const [event] = await Promise.all([
      new Promise(f => client.on('Debugger.scriptParsed', f)),
      page.evaluate('//# sourceURL=foo.js')
    ]);
    // expect events to be dispatched.
    expect(event.url).toBe('foo.js');
  });
  it('should be able to detach session', async function({page, browser, server}) {
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
    expect(error.message).toContain('Session closed.');
  });
  it('should throw nice errors', async function({page, browser}) {
    const client = await page.context().newCDPSession(page);
    const error = await theSourceOfTheProblems().catch(error => error);
    expect(error.stack).toContain('theSourceOfTheProblems');
    expect(error.message).toContain('ThisCommand.DoesNotExist');

    async function theSourceOfTheProblems() {
      await client.send('ThisCommand.DoesNotExist');
    }
  });
  it('should not break page.close()', async function({browser, server}) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const session = await page.context().newCDPSession(page);
    await session.detach();
    await page.close();
    await context.close();
  });
  it('should detach when page closes', async function({browser, server}) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await page.close();
    let error;
    await session.detach().catch(e => error = e);
    expect(error).toBeTruthy('Calling detach on a closed page\'s session should throw');
    await context.close();
  });
});
describe('ChromiumBrowser.newBrowserCDPSession', function() {
  it('should work', async function({page, browser, server}) {
    const session = await browser.newBrowserCDPSession();
    const version = await session.send('Browser.getVersion');
    expect(version.userAgent).toBeTruthy();
    await session.detach();
  });
});
