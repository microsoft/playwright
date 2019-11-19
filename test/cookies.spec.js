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

module.exports.addTests = function({testRunner, expect, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Page.cookies', function() {
    it('should return no cookies in pristine browser context', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      expect(await page.cookies()).toEqual([]);
    });
    it('should get a cookie', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.evaluate(() => {
        document.cookie = 'username=John Doe';
      });
      expect(await page.cookies()).toEqual([{
        name: 'username',
        value: 'John Doe',
        domain: 'localhost',
        path: '/',
        expires: -1,
        size: 16,
        httpOnly: false,
        secure: false,
        session: true,
        sameSite: 'None',
      }]);
    });
    it('should properly report httpOnly cookie', async({page, server}) => {
      server.setRoute('/empty.html', (req, res) => {
        res.setHeader('Set-Cookie', ';HttpOnly; Path=/');
        res.end();
      });
      await page.goto(server.EMPTY_PAGE);
      const cookies = await page.cookies();
      expect(cookies.length).toBe(1);
      expect(cookies[0].httpOnly).toBe(true);
    });
    it.skip(FFOX || WEBKIT)('should properly report "Strict" sameSite cookie', async({page, server}) => {
      server.setRoute('/empty.html', (req, res) => {
        res.setHeader('Set-Cookie', ';SameSite=Strict');
        res.end();
      });
      await page.goto(server.EMPTY_PAGE);
      const cookies = await page.cookies();
      expect(cookies.length).toBe(1);
      expect(cookies[0].sameSite).toBe('Strict');
    });
    it.skip(FFOX || WEBKIT)('should properly report "Lax" sameSite cookie', async({page, server}) => {
      server.setRoute('/empty.html', (req, res) => {
        res.setHeader('Set-Cookie', ';SameSite=Lax');
        res.end();
      });
      await page.goto(server.EMPTY_PAGE);
      const cookies = await page.cookies();
      expect(cookies.length).toBe(1);
      expect(cookies[0].sameSite).toBe('Lax');
    });
    it('should get multiple cookies', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.evaluate(() => {
        document.cookie = 'username=John Doe';
        document.cookie = 'password=1234';
      });
      const cookies = await page.cookies();
      cookies.sort((a, b) => a.name.localeCompare(b.name));
      expect(cookies).toEqual([
        {
          name: 'password',
          value: '1234',
          domain: 'localhost',
          path: '/',
          expires: -1,
          size: 12,
          httpOnly: false,
          secure: false,
          session: true,
          sameSite: 'None',
        },
        {
          name: 'username',
          value: 'John Doe',
          domain: 'localhost',
          path: '/',
          expires: -1,
          size: 16,
          httpOnly: false,
          secure: false,
          session: true,
          sameSite: 'None',
        },
      ]);
    });
    it.skip(WEBKIT)('should get cookies from multiple urls', async({page, server}) => {
      await page.setCookie({
        url: 'https://foo.com',
        name: 'doggo',
        value: 'woofs',
      }, {
        url: 'https://bar.com',
        name: 'catto',
        value: 'purrs',
      }, {
        url: 'https://baz.com',
        name: 'birdo',
        value: 'tweets',
      });
      const cookies = await page.cookies('https://foo.com', 'https://baz.com');
      cookies.sort((a, b) => a.name.localeCompare(b.name));
      expect(cookies).toEqual([{
        name: 'birdo',
        value: 'tweets',
        domain: 'baz.com',
        path: '/',
        expires: -1,
        size: 11,
        httpOnly: false,
        secure: true,
        session: true,
        sameSite: 'None',
      }, {
        name: 'doggo',
        value: 'woofs',
        domain: 'foo.com',
        path: '/',
        expires: -1,
        size: 10,
        httpOnly: false,
        secure: true,
        session: true,
        sameSite: 'None',
      }]);
    });
  });

  describe.skip(WEBKIT)('Page.setCookie', function() {
    it('should work', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setCookie({
        name: 'password',
        value: '123456'
      });
      expect(await page.evaluate(() => document.cookie)).toEqual('password=123456');
    });
    it('should isolate cookies in browser contexts', async({page, server, browser}) => {
      const anotherContext = await browser.createIncognitoBrowserContext();
      const anotherPage = await anotherContext.newPage();

      await page.goto(server.EMPTY_PAGE);
      await anotherPage.goto(server.EMPTY_PAGE);

      await page.setCookie({name: 'page1cookie', value: 'page1value'});
      await anotherPage.setCookie({name: 'page2cookie', value: 'page2value'});

      const cookies1 = await page.cookies();
      const cookies2 = await anotherPage.cookies();
      expect(cookies1.length).toBe(1);
      expect(cookies2.length).toBe(1);
      expect(cookies1[0].name).toBe('page1cookie');
      expect(cookies1[0].value).toBe('page1value');
      expect(cookies2[0].name).toBe('page2cookie');
      expect(cookies2[0].value).toBe('page2value');
      await anotherContext.close();
    });
    it('should set multiple cookies', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setCookie({
        name: 'password',
        value: '123456'
      }, {
        name: 'foo',
        value: 'bar'
      });
      expect(await page.evaluate(() => {
        const cookies = document.cookie.split(';');
        return cookies.map(cookie => cookie.trim()).sort();
      })).toEqual([
        'foo=bar',
        'password=123456',
      ]);
    });
    it('should have |expires| set to |-1| for session cookies', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setCookie({
        name: 'password',
        value: '123456'
      });
      const cookies = await page.cookies();
      expect(cookies[0].session).toBe(true);
      expect(cookies[0].expires).toBe(-1);
    });
    it('should set cookie with reasonable defaults', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setCookie({
        name: 'password',
        value: '123456'
      });
      const cookies = await page.cookies();
      expect(cookies.sort((a, b) => a.name.localeCompare(b.name))).toEqual([{
        name: 'password',
        value: '123456',
        domain: 'localhost',
        path: '/',
        expires: -1,
        size: 14,
        httpOnly: false,
        secure: false,
        session: true,
        sameSite: 'None',
      }]);
    });
    it('should set a cookie with a path', async({page, server}) => {
      await page.goto(server.PREFIX + '/grid.html');
      await page.setCookie({
        name: 'gridcookie',
        value: 'GRID',
        path: '/grid.html'
      });
      expect(await page.cookies()).toEqual([{
        name: 'gridcookie',
        value: 'GRID',
        domain: 'localhost',
        path: '/grid.html',
        expires: -1,
        size: 14,
        httpOnly: false,
        secure: false,
        session: true,
        sameSite: 'None',
      }]);
      expect(await page.evaluate('document.cookie')).toBe('gridcookie=GRID');
      await page.goto(server.EMPTY_PAGE);
      expect(await page.cookies()).toEqual([]);
      expect(await page.evaluate('document.cookie')).toBe('');
      await page.goto(server.PREFIX + '/grid.html');
      expect(await page.evaluate('document.cookie')).toBe('gridcookie=GRID');
    });
    it('should not set a cookie on a blank page', async function({page}) {
      await page.goto('about:blank');
      let error = null;
      try {
        await page.setCookie({name: 'example-cookie', value: 'best'});
      } catch (e) {
        error = e;
      }
      expect(error.message).toContain('At least one of the url and domain needs to be specified');
    });
    it('should not set a cookie with blank page URL', async function({page, server}) {
      let error = null;
      await page.goto(server.EMPTY_PAGE);
      try {
        await page.setCookie(
            {name: 'example-cookie', value: 'best'},
            {url: 'about:blank', name: 'example-cookie-blank', value: 'best'}
        );
      } catch (e) {
        error = e;
      }
      expect(error.message).toEqual(
          `Blank page can not have cookie "example-cookie-blank"`
      );
    });
    it('should not set a cookie on a data URL page', async function({page}) {
      let error = null;
      await page.goto('data:,Hello%2C%20World!');
      try {
        await page.setCookie({name: 'example-cookie', value: 'best'});
      } catch (e) {
        error = e;
      }
      expect(error.message).toContain('At least one of the url and domain needs to be specified');
    });
    it('should default to setting secure cookie for HTTPS websites', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      const SECURE_URL = 'https://example.com';
      await page.setCookie({
        url: SECURE_URL,
        name: 'foo',
        value: 'bar',
      });
      const [cookie] = await page.cookies(SECURE_URL);
      expect(cookie.secure).toBe(true);
    });
    it('should be able to set unsecure cookie for HTTP website', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      const HTTP_URL = 'http://example.com';
      await page.setCookie({
        url: HTTP_URL,
        name: 'foo',
        value: 'bar',
      });
      const [cookie] = await page.cookies(HTTP_URL);
      expect(cookie.secure).toBe(false);
    });
    it('should set a cookie on a different domain', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setCookie({
        url: 'https://www.example.com',
        name: 'example-cookie',
        value: 'best',
      });
      expect(await page.evaluate('document.cookie')).toBe('');
      expect(await page.cookies()).toEqual([]);
      expect(await page.cookies('https://www.example.com')).toEqual([{
        name: 'example-cookie',
        value: 'best',
        domain: 'www.example.com',
        path: '/',
        expires: -1,
        size: 18,
        httpOnly: false,
        secure: true,
        session: true,
        sameSite: 'None',
      }]);
    });
    it('should set cookies from a frame', async({page, server}) => {
      await page.goto(server.PREFIX + '/grid.html');
      await page.setCookie({name: 'localhost-cookie', value: 'best'});
      await page.evaluate(src => {
        let fulfill;
        const promise = new Promise(x => fulfill = x);
        const iframe = document.createElement('iframe');
        document.body.appendChild(iframe);
        iframe.onload = fulfill;
        iframe.src = src;
        return promise;
      }, server.CROSS_PROCESS_PREFIX);
      await page.setCookie({name: '127-cookie', value: 'worst', url: server.CROSS_PROCESS_PREFIX});
      expect(await page.evaluate('document.cookie')).toBe('localhost-cookie=best');
      expect(await page.frames()[1].evaluate('document.cookie')).toBe('127-cookie=worst');

      expect(await page.cookies()).toEqual([{
        name: 'localhost-cookie',
        value: 'best',
        domain: 'localhost',
        path: '/',
        expires: -1,
        size: 20,
        httpOnly: false,
        secure: false,
        session: true,
        sameSite: 'None',
      }]);

      expect(await page.cookies(server.CROSS_PROCESS_PREFIX)).toEqual([{
        name: '127-cookie',
        value: 'worst',
        domain: '127.0.0.1',
        path: '/',
        expires: -1,
        size: 15,
        httpOnly: false,
        secure: false,
        session: true,
        sameSite: 'None',
      }]);
    });
  });

  describe('Page.deleteCookie', function() {
    it.skip(WEBKIT)('should work', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setCookie({
        name: 'cookie1',
        value: '1'
      }, {
        name: 'cookie2',
        value: '2'
      }, {
        name: 'cookie3',
        value: '3'
      });
      expect(await page.evaluate('document.cookie')).toBe('cookie1=1; cookie2=2; cookie3=3');
      await page.deleteCookie({name: 'cookie2'});
      expect(await page.evaluate('document.cookie')).toBe('cookie1=1; cookie3=3');
    });
  });
};
