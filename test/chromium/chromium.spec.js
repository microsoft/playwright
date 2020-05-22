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

describe('ChromiumBrowserContext', function() {
  it('should create a worker from a service worker', async({browser, page, server, context}) => {
    const [worker] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/serviceworkers/empty/sw.html')
    ]);
    expect(await worker.evaluate(() => self.toString())).toBe('[object ServiceWorkerGlobalScope]');
  });
  it('serviceWorkers() should return current workers', async({browser, page, server, context}) => {
    const [worker1] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/serviceworkers/empty/sw.html')
    ]);
    let workers = context.serviceWorkers();
    expect(workers.length).toBe(1);

    const [worker2] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.CROSS_PROCESS_PREFIX + '/serviceworkers/empty/sw.html')
    ]);
    workers = context.serviceWorkers();
    expect(workers.length).toBe(2);
    expect(workers).toContain(worker1);
    expect(workers).toContain(worker2);
  });
  it('should not create a worker from a shared worker', async({browser, page, server, context}) => {
    await page.goto(server.EMPTY_PAGE);
    let serviceWorkerCreated;
    context.once('serviceworker', () => serviceWorkerCreated = true);
    await page.evaluate(() => {
      new SharedWorker('data:text/javascript,console.log("hi")');
    });
    expect(serviceWorkerCreated).not.toBeTruthy();
  });
});

describe('Chromium-Specific Page Tests', function() {
  it('Page.route should work with intervention headers', async({server, page}) => {
    server.setRoute('/intervention', (req, res) => res.end(`
      <script>
        document.write('<script src="${server.CROSS_PROCESS_PREFIX}/intervention.js">' + '</scr' + 'ipt>');
      </script>
    `));
    server.setRedirect('/intervention.js', '/redirect.js');
    let serverRequest = null;
    server.setRoute('/redirect.js', (req, res) => {
      serverRequest = req;
      res.end('console.log(1);');
    });

    await page.route('*', route => route.continue());
    await page.goto(server.PREFIX + '/intervention');
    // Check for feature URL substring rather than https://www.chromestatus.com to
    // make it work with Edgium.
    expect(serverRequest.headers.intervention).toContain('feature/5718547946799104');
  });
  it.fail().skip(HEADLESS)('Discarded tabs should still exist as pages post-discard', async({browser, server}) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);

    const pageToDiscard = await context.newPage();
    await pageToDiscard.goto(server.EMPTY_PAGE);

    const pageDiscardUI = await context.newPage();
    await pageDiscardUI.goto("chrome://discards");
    const pagesBeforeDiscard = await context.pages();

    await pageDiscardUI.click(`css=#tab-discards-info-table-body > tr:nth-child(2) > td.actions-cell > div:nth-child(3)`);
    await new Promise(res => setTimeout(res, 1_000));

    const pagesAfterDiscard = await context.pages();
    expect(pagesAfterDiscard.length).toBe(pagesBeforeDiscard.length);
  });
});
