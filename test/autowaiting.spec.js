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

const {FFOX, CHROMIUM, WEBKIT} = require('./utils').testOptions(browserType);

describe('Auto waiting', () => {
  it('should await navigation when clicking anchor', async({page, server}) => {
    const messages = [];
    server.setRoute('/empty.html', async (req, res) => {
      messages.push('route');
      res.setHeader('Content-Type', 'text/html');
      res.end(`<link rel='stylesheet' href='./one-style.css'>`);
    });

    await page.setContent(`<a href="${server.EMPTY_PAGE}">empty.html</a>`);

    await Promise.all([
      page.click('a').then(() => messages.push('click')),
      page.waitForEvent('framenavigated').then(() => messages.push('navigated')),
    ]);
    expect(messages.join('|')).toBe('route|navigated|click');
  });
  it('should await popup when clicking anchor', async function({page, server}) {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent('<a target=_blank rel=opener href="/empty.html">link</a>');
    const messages = [];
    await Promise.all([
      page.waitForEvent('popup').then(() => messages.push('popup')),
      page.click('a').then(() => messages.push('click')),
    ]);
    expect(messages.join('|')).toBe('popup|click');
  });
  it('should await popup when clicking anchor with noopener', async function({page, server}) {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent('<a target=_blank rel=noopener href="/empty.html">link</a>');
    const messages = [];
    await Promise.all([
      page.waitForEvent('popup').then(() => messages.push('popup')),
      page.click('a').then(() => messages.push('click')),
    ]);
    expect(messages.join('|')).toBe('popup|click');
  });
  it('should await cross-process navigation when clicking anchor', async({page, server}) => {
    const messages = [];
    server.setRoute('/empty.html', async (req, res) => {
      messages.push('route');
      res.setHeader('Content-Type', 'text/html');
      res.end(`<link rel='stylesheet' href='./one-style.css'>`);
    });

    await page.setContent(`<a href="${server.CROSS_PROCESS_PREFIX + '/empty.html'}">empty.html</a>`);

    await Promise.all([
      page.click('a').then(() => messages.push('click')),
      page.waitForEvent('framenavigated').then(() => messages.push('navigated')),
    ]);
    expect(messages.join('|')).toBe('route|navigated|click');
  });
  it('should await form-get on click', async({page, server}) => {
    const messages = [];
    server.setRoute('/empty.html?foo=bar', async (req, res) => {
      messages.push('route');
      res.setHeader('Content-Type', 'text/html');
      res.end(`<link rel='stylesheet' href='./one-style.css'>`);
    });

    await page.setContent(`
      <form action="${server.EMPTY_PAGE}" method="get">
        <input name="foo" value="bar">
        <input type="submit" value="Submit">
      </form>`);

    await Promise.all([
      page.click('input[type=submit]').then(() => messages.push('click')),
      page.waitForEvent('framenavigated').then(() => messages.push('navigated')),
    ]);
    expect(messages.join('|')).toBe('route|navigated|click');
  });
  it('should await form-post on click', async({page, server}) => {
    const messages = [];
    server.setRoute('/empty.html', async (req, res) => {
      messages.push('route');
      res.setHeader('Content-Type', 'text/html');
      res.end(`<link rel='stylesheet' href='./one-style.css'>`);
    });

    await page.setContent(`
      <form action="${server.EMPTY_PAGE}" method="post">
        <input name="foo" value="bar">
        <input type="submit" value="Submit">
      </form>`);

    await Promise.all([
      page.click('input[type=submit]').then(() => messages.push('click')),
      page.waitForEvent('framenavigated').then(() => messages.push('navigated')),
    ]);
    expect(messages.join('|')).toBe('route|navigated|click');
  });
  it('should await navigation when assigning location', async({page, server}) => {
    const messages = [];
    server.setRoute('/empty.html', async (req, res) => {
      messages.push('route');
      res.setHeader('Content-Type', 'text/html');
      res.end(`<link rel='stylesheet' href='./one-style.css'>`);
    });
    await Promise.all([
      page.evaluate(`window.location.href = "${server.EMPTY_PAGE}"`).then(() => messages.push('evaluate')),
      page.waitForEvent('framenavigated').then(() => messages.push('navigated')),
    ]);
    expect(messages.join('|')).toBe('route|navigated|evaluate');
  });
  it('should await navigation when assigning location twice', async({page, server}) => {
    const messages = [];
    server.setRoute('/empty.html?cancel', async (req, res) => { res.end('done'); });
    server.setRoute('/empty.html?override', async (req, res) => { messages.push('routeoverride'); res.end('done'); });
    await Promise.all([
      page.evaluate(`
        window.location.href = "${server.EMPTY_PAGE}?cancel";
        window.location.href = "${server.EMPTY_PAGE}?override";
      `).then(() => messages.push('evaluate')),
    ]);
    expect(messages.join('|')).toBe('routeoverride|evaluate');
  });
  it('should await navigation when evaluating reload', async({page, server}) => {
    const messages = [];
    await page.goto(server.EMPTY_PAGE);
    server.setRoute('/empty.html', async (req, res) => {
      messages.push('route');
      res.setHeader('Content-Type', 'text/html');
      res.end(`<link rel='stylesheet' href='./one-style.css'>`);
    });

    await Promise.all([
      page.evaluate(`window.location.reload()`).then(() => messages.push('evaluate')),
      page.waitForEvent('framenavigated').then(() => messages.push('navigated')),
    ]);
    expect(messages.join('|')).toBe('route|navigated|evaluate');
  });
  it('should await new popup when evaluating', async function({page, server}) {
    await page.goto(server.EMPTY_PAGE);
    const messages = [];
    await Promise.all([
      page.waitForEvent('popup').then(() => messages.push('popup')),
      page.evaluate(() => window._popup = window.open(window.location.href)).then(() => messages.push('evaluate')),
    ]);
    expect(messages.join('|')).toBe('popup|evaluate');
  });
  it('should await navigating specified target', async({page, server}) => {
    const messages = [];
    server.setRoute('/empty.html', async (req, res) => {
      messages.push('route');
      res.setHeader('Content-Type', 'text/html');
      res.end(`<link rel='stylesheet' href='./one-style.css'>`);
    });

    await page.setContent(`
      <a href="${server.EMPTY_PAGE}" target=target>empty.html</a>
      <iframe name=target></iframe>
    `);
    const frame = page.frame({ name: 'target' });
    await Promise.all([
      page.click('a').then(() => messages.push('click')),
      page.waitForEvent('framenavigated').then(() => messages.push('navigated')),
    ]);
    expect(frame.url()).toBe(server.EMPTY_PAGE);
    expect(messages.join('|')).toBe('route|navigated|click');
  });
  it('should work with noWaitAfter: true', async({page, server}) => {
    server.setRoute('/empty.html', async () => {});
    await page.setContent(`<a href="${server.EMPTY_PAGE}">empty.html</a>`);
    await page.click('a', { noWaitAfter: true });
  });
  it('should work with waitForLoadState(load)', async({page, server}) => {
    const messages = [];
    server.setRoute('/empty.html', async (req, res) => {
      messages.push('route');
      res.setHeader('Content-Type', 'text/html');
      res.end(`<link rel='stylesheet' href='./one-style.css'>`);
    });

    await page.setContent(`<a href="${server.EMPTY_PAGE}">empty.html</a>`);
    await Promise.all([
      page.click('a').then(() => page.waitForLoadState('load')).then(() => messages.push('clickload')),
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }).then(() => messages.push('domcontentloaded')),
    ]);
    expect(messages.join('|')).toBe('route|domcontentloaded|clickload');
  });
  it('should work with goto following click', async({page, server}) => {
    server.setRoute('/login.html', async (req, res) => {
      messages.push('route');
      res.setHeader('Content-Type', 'text/html');
      res.end(`You are logged in`);
    });

    await page.setContent(`
      <form action="${server.PREFIX}/login.html" method="get">
        <input type="text">
        <input type="submit" value="Submit">
      </form>`);

    await page.fill('input[type=text]', 'admin');
    await page.click('input[type=submit]');
    await page.goto(server.EMPTY_PAGE);
  });
});

describe('Auto waiting should not hang when', () => {
  it('clicking on links which do not commit navigation', async({page, server, httpsServer}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent(`<a href='${httpsServer.EMPTY_PAGE}'>foobar</a>`);
    await page.click('a');
  });
  it('calling window.stop async', async({page, server, httpsServer}) => {
    server.setRoute('/empty.html', async (req, res) => {});
    await page.evaluate((url) => {
        window.location.href = url;
        setTimeout(() => window.stop(), 100);
      }, server.EMPTY_PAGE);
  });
  it('calling window.stop sync', async({page, server, httpsServer}) => {
    await page.evaluate((url) => {
        window.location.href = url;
        window.stop();
      }, server.EMPTY_PAGE);
  });
  it('assigning location to about:blank', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.evaluate(`window.location.href = "about:blank";`);
  });
  it('assigning location to about:blank after non-about:blank', async({page, server}) => {
    server.setRoute('/empty.html', async (req, res) => {});
    await page.evaluate(`
        window.location.href = "${server.EMPTY_PAGE}";
        window.location.href = "about:blank";`);
  });
  it('calling window.open and window.close', async function({page, server}) {
    await page.goto(server.EMPTY_PAGE);
    await page.evaluate(() => {
      const popup = window.open(window.location.href);
      popup.close();
    });
  });
});

