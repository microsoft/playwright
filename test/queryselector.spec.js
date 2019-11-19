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

module.exports.addTests = function({testRunner, expect, product, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Page.$eval', function() {
    it('should work', async({page, server}) => {
      await page.setContent('<section id="testAttribute">43543</section>');
      const idAttribute = await page.$eval('section', e => e.id);
      expect(idAttribute).toBe('testAttribute');
    });
    it('should accept arguments', async({page, server}) => {
      await page.setContent('<section>hello</section>');
      const text = await page.$eval('section', (e, suffix) => e.textContent + suffix, ' world!');
      expect(text).toBe('hello world!');
    });
    it('should accept ElementHandles as arguments', async({page, server}) => {
      await page.setContent('<section>hello</section><div> world</div>');
      const divHandle = await page.$('div');
      const text = await page.$eval('section', (e, div) => e.textContent + div.textContent, divHandle);
      expect(text).toBe('hello world');
    });
    it('should throw error if no element is found', async({page, server}) => {
      let error = null;
      await page.$eval('section', e => e.id).catch(e => error = e);
      expect(error.message).toContain('failed to find element matching selector "section"');
    });
  });

  describe('Page.$$eval', function() {
    it('should work', async({page, server}) => {
      await page.setContent('<div>hello</div><div>beautiful</div><div>world!</div>');
      const divsCount = await page.$$eval('div', divs => divs.length);
      expect(divsCount).toBe(3);
    });
  });

  describe('Page.$', function() {
    it('should query existing element', async({page, server}) => {
      await page.setContent('<section>test</section>');
      const element = await page.$('section');
      expect(element).toBeTruthy();
    });
    it('should return null for non-existing element', async({page, server}) => {
      const element = await page.$('non-existing-element');
      expect(element).toBe(null);
    });
  });

  describe('Page.$$', function() {
    it('should query existing elements', async({page, server}) => {
      await page.setContent('<div>A</div><br/><div>B</div>');
      const elements = await page.$$('div');
      expect(elements.length).toBe(2);
      const promises = elements.map(element => page.evaluate(e => e.textContent, element));
      expect(await Promise.all(promises)).toEqual(['A', 'B']);
    });
    it('should return empty array if nothing is found', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      const elements = await page.$$('div');
      expect(elements.length).toBe(0);
    });
  });

  describe('Path.$x', function() {
    it('should query existing element', async({page, server}) => {
      await page.setContent('<section>test</section>');
      const elements = await page.$x('/html/body/section');
      expect(elements[0]).toBeTruthy();
      expect(elements.length).toBe(1);
    });
    it('should return empty array for non-existing element', async({page, server}) => {
      const element = await page.$x('/html/body/non-existing-element');
      expect(element).toEqual([]);
    });
    it('should return multiple elements', async({page, sever}) => {
      await page.setContent('<div></div><div></div>');
      const elements = await page.$x('/html/body/div');
      expect(elements.length).toBe(2);
    });
  });


  describe('ElementHandle.$', function() {
    it('should query existing element', async({page, server}) => {
      await page.goto(server.PREFIX + '/playground.html');
      await page.setContent('<html><body><div class="second"><div class="inner">A</div></div></body></html>');
      const html = await page.$('html');
      const second = await html.$('.second');
      const inner = await second.$('.inner');
      const content = await page.evaluate(e => e.textContent, inner);
      expect(content).toBe('A');
    });

    it('should return null for non-existing element', async({page, server}) => {
      await page.setContent('<html><body><div class="second"><div class="inner">B</div></div></body></html>');
      const html = await page.$('html');
      const second = await html.$('.third');
      expect(second).toBe(null);
    });
  });
  describe('ElementHandle.$eval', function() {
    it('should work', async({page, server}) => {
      await page.setContent('<html><body><div class="tweet"><div class="like">100</div><div class="retweets">10</div></div></body></html>');
      const tweet = await page.$('.tweet');
      const content = await tweet.$eval('.like', node => node.innerText);
      expect(content).toBe('100');
    });

    it('should retrieve content from subtree', async({page, server}) => {
      const htmlContent = '<div class="a">not-a-child-div</div><div id="myId"><div class="a">a-child-div</div></div>';
      await page.setContent(htmlContent);
      const elementHandle = await page.$('#myId');
      const content = await elementHandle.$eval('.a', node => node.innerText);
      expect(content).toBe('a-child-div');
    });

    it('should throw in case of missing selector', async({page, server}) => {
      const htmlContent = '<div class="a">not-a-child-div</div><div id="myId"></div>';
      await page.setContent(htmlContent);
      const elementHandle = await page.$('#myId');
      const errorMessage = await elementHandle.$eval('.a', node => node.innerText).catch(error => error.message);
      expect(errorMessage).toBe(`Error: failed to find element matching selector ".a"`);
    });
  });
  describe('ElementHandle.$$eval', function() {
    it('should work', async({page, server}) => {
      await page.setContent('<html><body><div class="tweet"><div class="like">100</div><div class="like">10</div></div></body></html>');
      const tweet = await page.$('.tweet');
      const content = await tweet.$$eval('.like', nodes => nodes.map(n => n.innerText));
      expect(content).toEqual(['100', '10']);
    });

    it('should retrieve content from subtree', async({page, server}) => {
      const htmlContent = '<div class="a">not-a-child-div</div><div id="myId"><div class="a">a1-child-div</div><div class="a">a2-child-div</div></div>';
      await page.setContent(htmlContent);
      const elementHandle = await page.$('#myId');
      const content = await elementHandle.$$eval('.a', nodes => nodes.map(n => n.innerText));
      expect(content).toEqual(['a1-child-div', 'a2-child-div']);
    });

    it('should not throw in case of missing selector', async({page, server}) => {
      const htmlContent = '<div class="a">not-a-child-div</div><div id="myId"></div>';
      await page.setContent(htmlContent);
      const elementHandle = await page.$('#myId');
      const nodesLength = await elementHandle.$$eval('.a', nodes => nodes.length);
      expect(nodesLength).toBe(0);
    });

  });

  describe('ElementHandle.$$', function() {
    it('should query existing elements', async({page, server}) => {
      await page.setContent('<html><body><div>A</div><br/><div>B</div></body></html>');
      const html = await page.$('html');
      const elements = await html.$$('div');
      expect(elements.length).toBe(2);
      const promises = elements.map(element => page.evaluate(e => e.textContent, element));
      expect(await Promise.all(promises)).toEqual(['A', 'B']);
    });

    it('should return empty array for non-existing elements', async({page, server}) => {
      await page.setContent('<html><body><span>A</span><br/><span>B</span></body></html>');
      const html = await page.$('html');
      const elements = await html.$$('div');
      expect(elements.length).toBe(0);
    });
  });


  describe('ElementHandle.$x', function() {
    it('should query existing element', async({page, server}) => {
      await page.goto(server.PREFIX + '/playground.html');
      await page.setContent('<html><body><div class="second"><div class="inner">A</div></div></body></html>');
      const html = await page.$('html');
      const second = await html.$x(`./body/div[contains(@class, 'second')]`);
      const inner = await second[0].$x(`./div[contains(@class, 'inner')]`);
      const content = await page.evaluate(e => e.textContent, inner[0]);
      expect(content).toBe('A');
    });

    it('should return null for non-existing element', async({page, server}) => {
      await page.setContent('<html><body><div class="second"><div class="inner">B</div></div></body></html>');
      const html = await page.$('html');
      const second = await html.$x(`/div[contains(@class, 'third')]`);
      expect(second).toEqual([]);
    });
  });
};
