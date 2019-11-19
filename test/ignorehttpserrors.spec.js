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

module.exports.addTests = function({testRunner, expect, defaultBrowserOptions, playwright, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;
  describe.skip(WEBKIT)('ignoreHTTPSErrors', function() {
    beforeAll(async state => {
      state.browser = await playwright.launch({...defaultBrowserOptions, ignoreHTTPSErrors: true});
    });
    afterAll(async state => {
      await state.browser.close();
      delete state.browser;
    });
    beforeEach(async state => {
      state.context = await state.browser.createIncognitoBrowserContext();
      state.page = await state.context.newPage();
    });
    afterEach(async state => {
      await state.context.close();
      delete state.context;
      delete state.page;
    });

    describe('Response.securityDetails', function() {
      it('should work', async({page, httpsServer}) => {
        const [serverRequest, response] = await Promise.all([
          httpsServer.waitForRequest('/empty.html'),
          page.goto(httpsServer.EMPTY_PAGE)
        ]);
        const securityDetails = response.securityDetails();
        expect(securityDetails.issuer()).toBe('playwright-tests');
        const protocol = serverRequest.socket.getProtocol().replace('v', ' ');
        expect(securityDetails.protocol()).toBe(protocol);
        expect(securityDetails.subjectName()).toBe('playwright-tests');
        expect(securityDetails.validFrom()).toBe(1550084863);
        expect(securityDetails.validTo()).toBe(33086084863);
      });
      it('should be |null| for non-secure requests', async({page, server}) => {
        const response = await page.goto(server.EMPTY_PAGE);
        expect(response.securityDetails()).toBe(null);
      });
      it('Network redirects should report SecurityDetails', async({page, httpsServer}) => {
        httpsServer.setRedirect('/plzredirect', '/empty.html');
        const responses =  [];
        page.on('response', response => responses.push(response));
        const [serverRequest, ] = await Promise.all([
          httpsServer.waitForRequest('/plzredirect'),
          page.goto(httpsServer.PREFIX + '/plzredirect')
        ]);
        expect(responses.length).toBe(2);
        expect(responses[0].status()).toBe(302);
        const securityDetails = responses[0].securityDetails();
        const protocol = serverRequest.socket.getProtocol().replace('v', ' ');
        expect(securityDetails.protocol()).toBe(protocol);
      });
    });

    it('should work', async({page, httpsServer}) => {
      let error = null;
      const response = await page.goto(httpsServer.EMPTY_PAGE).catch(e => error = e);
      expect(error).toBe(null);
      expect(response.ok()).toBe(true);
    });
    it('should work with request interception', async({page, server, httpsServer}) => {
      await page.setRequestInterception(true);
      page.on('request', request => request.continue());
      const response = await page.goto(httpsServer.EMPTY_PAGE);
      expect(response.status()).toBe(200);
    });
    it('should work with mixed content', async({page, server, httpsServer}) => {
      httpsServer.setRoute('/mixedcontent.html', (req, res) => {
        res.end(`<iframe src=${server.EMPTY_PAGE}></iframe>`);
      });
      await page.goto(httpsServer.PREFIX + '/mixedcontent.html', {waitUntil: 'load'});
      expect(page.frames().length).toBe(2);
      // Make sure blocked iframe has functional execution context
      // @see https://github.com/GoogleChrome/puppeteer/issues/2709
      expect(await page.frames()[0].evaluate('1 + 2')).toBe(3);
      expect(await page.frames()[1].evaluate('2 + 3')).toBe(5);
    });
  });
};
