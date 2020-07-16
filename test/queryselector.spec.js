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

const path = require('path');
const {WIN, LINUX, MAC, HEADLESS, USES_HOOKS} = utils = require('./utils');
const {FIREFOX, CHROMIUM, WEBKIT} = require('playwright-runner');
const {it} = require('./environments/server');
const playwright = require('playwright');

describe('Page.$eval', function() {
  it('should work with css selector', async({page, server}) => {
    await page.setContent('<section id="testAttribute">43543</section>');
    const idAttribute = await page.$eval('css=section', e => e.id);
    expect(idAttribute).toBe('testAttribute');
  });
  it('should work with id selector', async({page, server}) => {
    await page.setContent('<section id="testAttribute">43543</section>');
    const idAttribute = await page.$eval('id=testAttribute', e => e.id);
    expect(idAttribute).toBe('testAttribute');
  });
  it('should work with data-test selector', async({page, server}) => {
    await page.setContent('<section data-test=foo id="testAttribute">43543</section>');
    const idAttribute = await page.$eval('data-test=foo', e => e.id);
    expect(idAttribute).toBe('testAttribute');
  });
  it('should work with data-testid selector', async({page, server}) => {
    await page.setContent('<section data-testid=foo id="testAttribute">43543</section>');
    const idAttribute = await page.$eval('data-testid=foo', e => e.id);
    expect(idAttribute).toBe('testAttribute');
  });
  it('should work with data-test-id selector', async({page, server}) => {
    await page.setContent('<section data-test-id=foo id="testAttribute">43543</section>');
    const idAttribute = await page.$eval('data-test-id=foo', e => e.id);
    expect(idAttribute).toBe('testAttribute');
  });
  it('should work with text selector', async({page, server}) => {
    await page.setContent('<section id="testAttribute">43543</section>');
    const idAttribute = await page.$eval('text="43543"', e => e.id);
    expect(idAttribute).toBe('testAttribute');
  });
  it('should work with xpath selector', async({page, server}) => {
    await page.setContent('<section id="testAttribute">43543</section>');
    const idAttribute = await page.$eval('xpath=/html/body/section', e => e.id);
    expect(idAttribute).toBe('testAttribute');
  });
  it('should work with text selector', async({page, server}) => {
    await page.setContent('<section id="testAttribute">43543</section>');
    const idAttribute = await page.$eval('text=43543', e => e.id);
    expect(idAttribute).toBe('testAttribute');
  });
  it('should auto-detect css selector', async({page, server}) => {
    await page.setContent('<section id="testAttribute">43543</section>');
    const idAttribute = await page.$eval('section', e => e.id);
    expect(idAttribute).toBe('testAttribute');
  });
  it('should auto-detect css selector with attributes', async({page, server}) => {
    await page.setContent('<section id="testAttribute">43543</section>');
    const idAttribute = await page.$eval('section[id="testAttribute"]', e => e.id);
    expect(idAttribute).toBe('testAttribute');
  });
  it('should auto-detect nested selectors', async({page, server}) => {
    await page.setContent('<div foo=bar><section>43543<span>Hello<div id=target></div></span></section></div>');
    const idAttribute = await page.$eval('div[foo=bar] > section >> "Hello" >> div', e => e.id);
    expect(idAttribute).toBe('target');
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
  it('should support >> syntax', async({page, server}) => {
    await page.setContent('<section><div>hello</div></section>');
    const text = await page.$eval('css=section >> css=div', (e, suffix) => e.textContent + suffix, ' world!');
    expect(text).toBe('hello world!');
  });
  it('should support >> syntax with different engines', async({page, server}) => {
    await page.setContent('<section><div><span>hello</span></div></section>');
    const text = await page.$eval('xpath=/html/body/section >> css=div >> text="hello"', (e, suffix) => e.textContent + suffix, ' world!');
    expect(text).toBe('hello world!');
  });
  it('should support spaces with >> syntax', async({page, server}) => {
    await page.goto(server.PREFIX + '/deep-shadow.html');
    const text = await page.$eval(' css = div >>css=div>>css   = span  ', e => e.textContent);
    expect(text).toBe('Hello from root2');
  });
  it('should not stop at first failure with >> syntax', async({page, server}) => {
    await page.setContent('<div><span>Next</span><button>Previous</button><button>Next</button></div>');
    const html = await page.$eval('button >> "Next"', e => e.outerHTML);
    expect(html).toBe('<button>Next</button>');
  });
  it('should support * capture', async({page, server}) => {
    await page.setContent('<section><div><span>a</span></div></section><section><div><span>b</span></div></section>');
    expect(await page.$eval('*css=div >> "b"', e => e.outerHTML)).toBe('<div><span>b</span></div>');
    expect(await page.$eval('section >> *css=div >> "b"', e => e.outerHTML)).toBe('<div><span>b</span></div>');
    expect(await page.$eval('css=div >> *text="b"', e => e.outerHTML)).toBe('<span>b</span>');
    expect(await page.$('*')).toBeTruthy();
  });
  it('should throw on multiple * captures', async({page, server}) => {
    const error = await page.$eval('*css=div >> *css=span', e => e.outerHTML).catch(e => e);
    expect(error.message).toBe('Only one of the selectors can capture using * modifier');
  });
  it('should throw on malformed * capture', async({page, server}) => {
    const error = await page.$eval('*=div', e => e.outerHTML).catch(e => e);
    expect(error.message).toBe('Unknown engine "" while parsing selector *=div');
  });
  it('should work with spaces in css attributes', async({page, server}) => {
    await page.setContent('<div><input placeholder="Select date"></div>');
    expect(await page.waitForSelector(`[placeholder="Select date"]`)).toBeTruthy();
    expect(await page.waitForSelector(`[placeholder='Select date']`)).toBeTruthy();
    expect(await page.waitForSelector(`input[placeholder="Select date"]`)).toBeTruthy();
    expect(await page.waitForSelector(`input[placeholder='Select date']`)).toBeTruthy();
    expect(await page.$(`[placeholder="Select date"]`)).toBeTruthy();
    expect(await page.$(`[placeholder='Select date']`)).toBeTruthy();
    expect(await page.$(`input[placeholder="Select date"]`)).toBeTruthy();
    expect(await page.$(`input[placeholder='Select date']`)).toBeTruthy();
    expect(await page.$eval(`[placeholder="Select date"]`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
    expect(await page.$eval(`[placeholder='Select date']`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
    expect(await page.$eval(`input[placeholder="Select date"]`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
    expect(await page.$eval(`input[placeholder='Select date']`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
    expect(await page.$eval(`css=[placeholder="Select date"]`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
    expect(await page.$eval(`css=[placeholder='Select date']`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
    expect(await page.$eval(`css=input[placeholder="Select date"]`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
    expect(await page.$eval(`css=input[placeholder='Select date']`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
    expect(await page.$eval(`div >> [placeholder="Select date"]`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
    expect(await page.$eval(`div >> [placeholder='Select date']`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
  });
  it('should work with quotes in css attributes', async({page, server}) => {
    await page.setContent('<div><input placeholder="Select&quot;date"></div>');
    expect(await page.$(`[placeholder="Select\\"date"]`)).toBeTruthy();
    expect(await page.$(`[placeholder='Select"date']`)).toBeTruthy();
    await page.setContent('<div><input placeholder="Select &quot; date"></div>');
    expect(await page.$(`[placeholder="Select \\" date"]`)).toBeTruthy();
    expect(await page.$(`[placeholder='Select " date']`)).toBeTruthy();
    await page.setContent('<div><input placeholder="Select&apos;date"></div>');
    expect(await page.$(`[placeholder="Select'date"]`)).toBeTruthy();
    expect(await page.$(`[placeholder='Select\\'date']`)).toBeTruthy();
    await page.setContent('<div><input placeholder="Select &apos; date"></div>');
    expect(await page.$(`[placeholder="Select ' date"]`)).toBeTruthy();
    expect(await page.$(`[placeholder='Select \\' date']`)).toBeTruthy();
  });
  it('should work with spaces in css attributes when missing', async({page, server}) => {
    const inputPromise = page.waitForSelector(`[placeholder="Select date"]`);
    expect(await page.$(`[placeholder="Select date"]`)).toBe(null);
    await page.setContent('<div><input placeholder="Select date"></div>');
    await inputPromise;
  });
  it('should work with quotes in css attributes when missing', async({page, server}) => {
    const inputPromise = page.waitForSelector(`[placeholder="Select\\"date"]`);
    expect(await page.$(`[placeholder="Select\\"date"]`)).toBe(null);
    await page.setContent('<div><input placeholder="Select&quot;date"></div>');
    await inputPromise;
  });
});

describe('Page.$$eval', function() {
  it('should work with css selector', async({page, server}) => {
    await page.setContent('<div>hello</div><div>beautiful</div><div>world!</div>');
    const divsCount = await page.$$eval('css=div', divs => divs.length);
    expect(divsCount).toBe(3);
  });
  it('should work with text selector', async({page, server}) => {
    await page.setContent('<div>hello</div><div>beautiful</div><div>beautiful</div><div>world!</div>');
    const divsCount = await page.$$eval('text="beautiful"', divs => divs.length);
    expect(divsCount).toBe(2);
  });
  it('should work with xpath selector', async({page, server}) => {
    await page.setContent('<div>hello</div><div>beautiful</div><div>world!</div>');
    const divsCount = await page.$$eval('xpath=/html/body/div', divs => divs.length);
    expect(divsCount).toBe(3);
  });
  it('should auto-detect css selector', async({page, server}) => {
    await page.setContent('<div>hello</div><div>beautiful</div><div>world!</div>');
    const divsCount = await page.$$eval('div', divs => divs.length);
    expect(divsCount).toBe(3);
  });
  it('should support >> syntax', async({page, server}) => {
    await page.setContent('<div><span>hello</span></div><div>beautiful</div><div><span>wo</span><span>rld!</span></div><span>Not this one</span>');
    const spansCount = await page.$$eval('css=div >> css=span', spans => spans.length);
    expect(spansCount).toBe(3);
  });
  it('should support * capture', async({page, server}) => {
    await page.setContent('<section><div><span>a</span></div></section><section><div><span>b</span></div></section>');
    expect(await page.$$eval('*css=div >> "b"', els => els.length)).toBe(1);
    expect(await page.$$eval('section >> *css=div >> "b"', els => els.length)).toBe(1);
    expect(await page.$$eval('section >> *', els => els.length)).toBe(4);

    await page.setContent('<section><div><span>a</span><span>a</span></div></section>');
    expect(await page.$$eval('*css=div >> "a"', els => els.length)).toBe(1);
    expect(await page.$$eval('section >> *css=div >> "a"', els => els.length)).toBe(1);

    await page.setContent('<div><span>a</span></div><div><span>a</span></div><section><div><span>a</span></div></section>');
    expect(await page.$$eval('*css=div >> "a"', els => els.length)).toBe(3);
    expect(await page.$$eval('section >> *css=div >> "a"', els => els.length)).toBe(1);
  });
  it('should support * capture when multiple paths match', async({page, server}) => {
    await page.setContent('<div><div><span></span></div></div><div></div>');
    expect(await page.$$eval('*css=div >> span', els => els.length)).toBe(2);
    await page.setContent('<div><div><span></span></div><span></span><span></span></div><div></div>');
    expect(await page.$$eval('*css=div >> span', els => els.length)).toBe(2);
  });
});

describe('Page.$', function() {
  it('should query existing element with css selector', async({page, server}) => {
    await page.setContent('<section>test</section>');
    const element = await page.$('css=section');
    expect(element).toBeTruthy();
  });
  it('should query existing element with text selector', async({page, server}) => {
    await page.setContent('<section>test</section>');
    const element = await page.$('text="test"');
    expect(element).toBeTruthy();
  });
  it('should query existing element with xpath selector', async({page, server}) => {
    await page.setContent('<section>test</section>');
    const element = await page.$('xpath=/html/body/section');
    expect(element).toBeTruthy();
  });
  it('should return null for non-existing element', async({page, server}) => {
    const element = await page.$('non-existing-element');
    expect(element).toBe(null);
  });
  it('should auto-detect xpath selector', async({page, server}) => {
    await page.setContent('<section>test</section>');
    const element = await page.$('//html/body/section');
    expect(element).toBeTruthy();
  });
  it('should auto-detect xpath selector with starting parenthesis', async({page, server}) => {
    await page.setContent('<section>test</section>');
    const element = await page.$('(//section)[1]');
    expect(element).toBeTruthy();
  });
  it('should auto-detect text selector', async({page, server}) => {
    await page.setContent('<section>test</section>');
    const element = await page.$('"test"');
    expect(element).toBeTruthy();
  });
  it('should auto-detect css selector', async({page, server}) => {
    await page.setContent('<section>test</section>');
    const element = await page.$('section');
    expect(element).toBeTruthy();
  });
  it('should support >> syntax', async({page, server}) => {
    await page.setContent('<section><div>test</div></section>');
    const element = await page.$('css=section >> css=div');
    expect(element).toBeTruthy();
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

describe('Page.$$ xpath', function() {
  it('should query existing element', async({page, server}) => {
    await page.setContent('<section>test</section>');
    const elements = await page.$$('xpath=/html/body/section');
    expect(elements[0]).toBeTruthy();
    expect(elements.length).toBe(1);
  });
  it('should return empty array for non-existing element', async({page, server}) => {
    const element = await page.$$('//html/body/non-existing-element');
    expect(element).toEqual([]);
  });
  it('should return multiple elements', async({page, server}) => {
    await page.setContent('<div></div><div></div>');
    const elements = await page.$$('xpath=/html/body/div');
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
  it('should work for adopted elements', async({page,server}) => {
    await page.goto(server.EMPTY_PAGE);
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(url => window.__popup = window.open(url), server.EMPTY_PAGE),
    ]);
    const divHandle = await page.evaluateHandle(() => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      const span = document.createElement('span');
      span.textContent = 'hello';
      div.appendChild(span);
      return div;
    });
    expect(await divHandle.$('span')).toBeTruthy();
    expect(await divHandle.$eval('span', e => e.textContent)).toBe('hello');

    await popup.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      const div = document.querySelector('div');
      window.__popup.document.body.appendChild(div);
    });
    expect(await divHandle.$('span')).toBeTruthy();
    expect(await divHandle.$eval('span', e => e.textContent)).toBe('hello');
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


describe('ElementHandle.$$ xpath', function() {
  it('should query existing element', async({page, server}) => {
    await page.goto(server.PREFIX + '/playground.html');
    await page.setContent('<html><body><div class="second"><div class="inner">A</div></div></body></html>');
    const html = await page.$('html');
    const second = await html.$$(`xpath=./body/div[contains(@class, 'second')]`);
    const inner = await second[0].$$(`xpath=./div[contains(@class, 'inner')]`);
    const content = await page.evaluate(e => e.textContent, inner[0]);
    expect(content).toBe('A');
  });

  it('should return null for non-existing element', async({page, server}) => {
    await page.setContent('<html><body><div class="second"><div class="inner">B</div></div></body></html>');
    const html = await page.$('html');
    const second = await html.$$(`xpath=/div[contains(@class, 'third')]`);
    expect(second).toEqual([]);
  });
});

describe('text selector', () => {
  it('query', async ({page}) => {
    await page.setContent(`<div>yo</div><div>ya</div><div>\nye  </div>`);
    expect(await page.$eval(`text=ya`, e => e.outerHTML)).toBe('<div>ya</div>');
    expect(await page.$eval(`text="ya"`, e => e.outerHTML)).toBe('<div>ya</div>');
    expect(await page.$eval(`text=/^[ay]+$/`, e => e.outerHTML)).toBe('<div>ya</div>');
    expect(await page.$eval(`text=/Ya/i`, e => e.outerHTML)).toBe('<div>ya</div>');
    expect(await page.$eval(`text=ye`, e => e.outerHTML)).toBe('<div>\nye  </div>');

    await page.setContent(`<div> ye </div><div>ye</div>`);
    expect(await page.$eval(`text="ye"`, e => e.outerHTML)).toBe('<div>ye</div>');

    await page.setContent(`<div>yo</div><div>"ya</div><div> hello world! </div>`);
    expect(await page.$eval(`text="\\"ya"`, e => e.outerHTML)).toBe('<div>"ya</div>');
    expect(await page.$eval(`text=/hello/`, e => e.outerHTML)).toBe('<div> hello world! </div>');
    expect(await page.$eval(`text=/^\\s*heLLo/i`, e => e.outerHTML)).toBe('<div> hello world! </div>');

    await page.setContent(`<div>yo<div>ya</div>hey<div>hey</div></div>`);
    expect(await page.$eval(`text=hey`, e => e.outerHTML)).toBe('<div>yo<div>ya</div>hey<div>hey</div></div>');
    expect(await page.$eval(`text="yo">>text="ya"`, e => e.outerHTML)).toBe('<div>ya</div>');
    expect(await page.$eval(`text='yo'>> text="ya"`, e => e.outerHTML)).toBe('<div>ya</div>');
    expect(await page.$eval(`text="yo" >>text='ya'`, e => e.outerHTML)).toBe('<div>ya</div>');
    expect(await page.$eval(`text='yo' >> text='ya'`, e => e.outerHTML)).toBe('<div>ya</div>');
    expect(await page.$eval(`'yo'>>"ya"`, e => e.outerHTML)).toBe('<div>ya</div>');
    expect(await page.$eval(`"yo" >> 'ya'`, e => e.outerHTML)).toBe('<div>ya</div>');

    await page.setContent(`<div>yo<span id="s1"></span></div><div>yo<span id="s2"></span><span id="s3"></span></div>`);
    expect(await page.$$eval(`text=yo`, es => es.map(e => e.outerHTML).join('\n'))).toBe('<div>yo<span id="s1"></span></div>\n<div>yo<span id="s2"></span><span id="s3"></span></div>');

    await page.setContent(`<div>'</div><div>"</div><div>\\</div><div>x</div>`);
    expect(await page.$eval(`text='\\''`, e => e.outerHTML)).toBe('<div>\'</div>');
    expect(await page.$eval(`text='"'`, e => e.outerHTML)).toBe('<div>"</div>');
    expect(await page.$eval(`text="\\""`, e => e.outerHTML)).toBe('<div>"</div>');
    expect(await page.$eval(`text="'"`, e => e.outerHTML)).toBe('<div>\'</div>');
    expect(await page.$eval(`text="\\x"`, e => e.outerHTML)).toBe('<div>x</div>');
    expect(await page.$eval(`text='\\x'`, e => e.outerHTML)).toBe('<div>x</div>');
    expect(await page.$eval(`text='\\\\'`, e => e.outerHTML)).toBe('<div>\\</div>');
    expect(await page.$eval(`text="\\\\"`, e => e.outerHTML)).toBe('<div>\\</div>');
    expect(await page.$eval(`text="`, e => e.outerHTML)).toBe('<div>"</div>');
    expect(await page.$eval(`text='`, e => e.outerHTML)).toBe('<div>\'</div>');
    expect(await page.$eval(`"x"`, e => e.outerHTML)).toBe('<div>x</div>');
    expect(await page.$eval(`'x'`, e => e.outerHTML)).toBe('<div>x</div>');
    let error = await page.$(`"`).catch(e => e);
    expect(error.message).toContain(WEBKIT ? 'SyntaxError' : 'querySelector');
    error = await page.$(`'`).catch(e => e);
    expect(error.message).toContain(WEBKIT ? 'SyntaxError' : 'querySelector');

    await page.setContent(`<div> ' </div><div> " </div>`);
    expect(await page.$eval(`text="`, e => e.outerHTML)).toBe('<div> " </div>');
    expect(await page.$eval(`text='`, e => e.outerHTML)).toBe('<div> \' </div>');

    await page.setContent(`<div>Hi''&gt;&gt;foo=bar</div>`);
    expect(await page.$eval(`text="Hi''>>foo=bar"`, e => e.outerHTML)).toBe(`<div>Hi''&gt;&gt;foo=bar</div>`);
    await page.setContent(`<div>Hi'"&gt;&gt;foo=bar</div>`);
    expect(await page.$eval(`text="Hi'\\">>foo=bar"`, e => e.outerHTML)).toBe(`<div>Hi'"&gt;&gt;foo=bar</div>`);

    await page.setContent(`<div>Hi&gt;&gt;<span></span></div>`);
    expect(await page.$eval(`text="Hi>>">>span`, e => e.outerHTML)).toBe(`<span></span>`);

    await page.setContent(`<div>a<br>b</div><div>a</div>`);
    expect(await page.$eval(`text=a`, e => e.outerHTML)).toBe('<div>a<br>b</div>');
    expect(await page.$eval(`text=b`, e => e.outerHTML)).toBe('<div>a<br>b</div>');
    expect(await page.$(`text=ab`)).toBe(null);
    expect(await page.$$eval(`text=a`, els => els.length)).toBe(2);
    expect(await page.$$eval(`text=b`, els => els.length)).toBe(1);
    expect(await page.$$eval(`text=ab`, els => els.length)).toBe(0);

    await page.setContent(`<div></div><span></span>`);
    await page.$eval('div', div => {
      div.appendChild(document.createTextNode('hello'));
      div.appendChild(document.createTextNode('world'));
    });
    await page.$eval('span', span => {
      span.appendChild(document.createTextNode('hello'));
      span.appendChild(document.createTextNode('world'));
    });
    expect(await page.$eval(`text=lowo`, e => e.outerHTML)).toBe('<div>helloworld</div>');
    expect(await page.$$eval(`text=lowo`, els => els.map(e => e.outerHTML).join(''))).toBe('<div>helloworld</div><span>helloworld</span>');
  });

  it.skip(USES_HOOKS)('create', async ({page}) => {
    await page.setContent(`<div>yo</div><div>"ya</div><div>ye ye</div>`);
    expect(await playwright.selectors._createSelector('text', await page.$('div'))).toBe('yo');
    expect(await playwright.selectors._createSelector('text', await page.$('div:nth-child(2)'))).toBe('"\\"ya"');
    expect(await playwright.selectors._createSelector('text', await page.$('div:nth-child(3)'))).toBe('"ye ye"');

    await page.setContent(`<div>yo</div><div>yo<div>ya</div>hey</div>`);
    expect(await playwright.selectors._createSelector('text', await page.$('div:nth-child(2)'))).toBe('hey');

    await page.setContent(`<div> yo <div></div>ya</div>`);
    expect(await playwright.selectors._createSelector('text', await page.$('div'))).toBe('yo');

    await page.setContent(`<div> "yo <div></div>ya</div>`);
    expect(await playwright.selectors._createSelector('text', await page.$('div'))).toBe('" \\"yo "');
  });

  it('should be case sensitive if quotes are specified', async({page}) => {
    await page.setContent(`<div>yo</div><div>ya</div><div>\nye  </div>`);
    expect(await page.$eval(`text=yA`, e => e.outerHTML)).toBe('<div>ya</div>');
    expect(await page.$(`text="yA"`)).toBe(null);
  });

  it('should search for a substring without quotes', async({page}) => {
    await page.setContent(`<div>textwithsubstring</div>`);
    expect(await page.$eval(`text=with`, e => e.outerHTML)).toBe('<div>textwithsubstring</div>');
    expect(await page.$(`text="with"`)).toBe(null);
  });

  it('should skip head, script and style', async({page}) => {
    await page.setContent(`
      <head>
        <title>title</title>
        <script>var script</script>
        <style>.style {}</style>
      </head>
      <body>
        <script>var script</script>
        <style>.style {}</style>
        <div>title script style</div>
      </body>`);
    const head = await page.$('head');
    const title = await page.$('title');
    const script = await page.$('body script');
    const style = await page.$('body style');
    for (const text of ['title', 'script', 'style']) {
      expect(await page.$eval(`text=${text}`, e => e.nodeName)).toBe('DIV');
      expect(await page.$$eval(`text=${text}`, els => els.map(e => e.nodeName).join('|'))).toBe('DIV');
      for (const root of [head, title, script, style]) {
        expect(await root.$(`text=${text}`)).toBe(null);
        expect(await root.$$eval(`text=${text}`, els => els.length)).toBe(0);
      }
    }
  });

  it('should match input[type=button|submit]', async({page}) => {
    await page.setContent(`<input type="submit" value="hello"><input type="button" value="world">`);
    expect(await page.$eval(`text=hello`, e => e.outerHTML)).toBe('<input type="submit" value="hello">');
    expect(await page.$eval(`text=world`, e => e.outerHTML)).toBe('<input type="button" value="world">');
  });

  it('should work for open shadow roots', async({page, server}) => {
    await page.goto(server.PREFIX + '/deep-shadow.html');
    expect(await page.$eval(`text=root1`, e => e.textContent)).toBe('Hello from root1');
    expect(await page.$eval(`text=root2`, e => e.textContent)).toBe('Hello from root2');
    expect(await page.$eval(`text=root3`, e => e.textContent)).toBe('Hello from root3');
    expect(await page.$eval(`#root1 >> text=from root3`, e => e.textContent)).toBe('Hello from root3');
    expect(await page.$eval(`#target >> text=from root2`, e => e.textContent)).toBe('Hello from root2');
    expect(await page.$(`text:light=root1`)).toBe(null);
    expect(await page.$(`text:light=root2`)).toBe(null);
    expect(await page.$(`text:light=root3`)).toBe(null);
  });

  it('should prioritize light dom over shadow dom in the same parent', async({page, server}) => {
    await page.evaluate(() => {
      const div = document.createElement('div');
      document.body.appendChild(div);

      div.attachShadow({ mode: 'open' });
      const shadowSpan = document.createElement('span');
      shadowSpan.textContent = 'Hello from shadow';
      div.shadowRoot.appendChild(shadowSpan);

      const lightSpan = document.createElement('span');
      lightSpan.textContent = 'Hello from light';
      div.appendChild(lightSpan);
    });
    expect(await page.$eval(`div >> text=Hello`, e => e.textContent)).toBe('Hello from light');
  });

  it('should waitForSelector with distributed elements', async({page, server}) => {
    const promise = page.waitForSelector(`div >> text=Hello`);
    await page.evaluate(() => {
      const div = document.createElement('div');
      document.body.appendChild(div);

      div.attachShadow({ mode: 'open' });
      const shadowSpan = document.createElement('span');
      shadowSpan.textContent = 'Hello from shadow';
      div.shadowRoot.appendChild(shadowSpan);
      div.shadowRoot.appendChild(document.createElement('slot'));

      const lightSpan = document.createElement('span');
      lightSpan.textContent = 'Hello from light';
      div.appendChild(lightSpan);
    });
    const handle = await promise;
    expect(await handle.textContent()).toBe('Hello from light');
  });
});

describe('css selector', () => {
  it('should work for open shadow roots', async({page, server}) => {
    await page.goto(server.PREFIX + '/deep-shadow.html');
    expect(await page.$eval(`css=span`, e => e.textContent)).toBe('Hello from root1');
    expect(await page.$eval(`css=[attr="value\\ space"]`, e => e.textContent)).toBe('Hello from root3 #2');
    expect(await page.$eval(`css=[attr='value\\ \\space']`, e => e.textContent)).toBe('Hello from root3 #2');
    expect(await page.$eval(`css=div div span`, e => e.textContent)).toBe('Hello from root2');
    expect(await page.$eval(`css=div span + span`, e => e.textContent)).toBe('Hello from root3 #2');
    expect(await page.$eval(`css=span + [attr*="value"]`, e => e.textContent)).toBe('Hello from root3 #2');
    expect(await page.$eval(`css=[data-testid="foo"] + [attr*="value"]`, e => e.textContent)).toBe('Hello from root3 #2');
    expect(await page.$eval(`css=#target`, e => e.textContent)).toBe('Hello from root2');
    expect(await page.$eval(`css=div #target`, e => e.textContent)).toBe('Hello from root2');
    expect(await page.$eval(`css=div div #target`, e => e.textContent)).toBe('Hello from root2');
    expect(await page.$(`css=div div div #target`)).toBe(null);
    expect(await page.$eval(`css=section > div div span`, e => e.textContent)).toBe('Hello from root2');
    expect(await page.$eval(`css=section > div div span:nth-child(2)`, e => e.textContent)).toBe('Hello from root3 #2');
    expect(await page.$(`css=section div div div div`)).toBe(null);

    const root2 = await page.$(`css=div div`);
    expect(await root2.$eval(`css=#target`, e => e.textContent)).toBe('Hello from root2');
    expect(await root2.$(`css:light=#target`)).toBe(null);
    const root2Shadow = await root2.evaluateHandle(r => r.shadowRoot);
    expect(await root2Shadow.$eval(`css:light=#target`, e => e.textContent)).toBe('Hello from root2');
    const root3 = (await page.$$(`css=div div`))[1];
    expect(await root3.$eval(`text=root3`, e => e.textContent)).toBe('Hello from root3');
    expect(await root3.$eval(`css=[attr*="value"]`, e => e.textContent)).toBe('Hello from root3 #2');
    expect(await root3.$(`css:light=[attr*="value"]`)).toBe(null);
  });

  it('should work with > combinator and spaces', async({page, server}) => {
    await page.setContent(`<div foo="bar" bar="baz"><span></span></div>`);
    expect(await page.$eval(`div[foo="bar"] > span`, e => e.outerHTML)).toBe(`<span></span>`);
    expect(await page.$eval(`div[foo="bar"]> span`, e => e.outerHTML)).toBe(`<span></span>`);
    expect(await page.$eval(`div[foo="bar"] >span`, e => e.outerHTML)).toBe(`<span></span>`);
    expect(await page.$eval(`div[foo="bar"]>span`, e => e.outerHTML)).toBe(`<span></span>`);
    expect(await page.$eval(`div[foo="bar"]   >    span`, e => e.outerHTML)).toBe(`<span></span>`);
    expect(await page.$eval(`div[foo="bar"]>    span`, e => e.outerHTML)).toBe(`<span></span>`);
    expect(await page.$eval(`div[foo="bar"]     >span`, e => e.outerHTML)).toBe(`<span></span>`);
    expect(await page.$eval(`div[foo="bar"][bar="baz"] > span`, e => e.outerHTML)).toBe(`<span></span>`);
    expect(await page.$eval(`div[foo="bar"][bar="baz"]> span`, e => e.outerHTML)).toBe(`<span></span>`);
    expect(await page.$eval(`div[foo="bar"][bar="baz"] >span`, e => e.outerHTML)).toBe(`<span></span>`);
    expect(await page.$eval(`div[foo="bar"][bar="baz"]>span`, e => e.outerHTML)).toBe(`<span></span>`);
    expect(await page.$eval(`div[foo="bar"][bar="baz"]   >    span`, e => e.outerHTML)).toBe(`<span></span>`);
    expect(await page.$eval(`div[foo="bar"][bar="baz"]>    span`, e => e.outerHTML)).toBe(`<span></span>`);
    expect(await page.$eval(`div[foo="bar"][bar="baz"]     >span`, e => e.outerHTML)).toBe(`<span></span>`);
  });

  it('should work with comma separated list', async({page, server}) => {
    await page.goto(server.PREFIX + '/deep-shadow.html');
    expect(await page.$$eval(`css=span,section #root1`, els => els.length)).toBe(5);
    expect(await page.$$eval(`css=section #root1, div span`, els => els.length)).toBe(5);
    expect(await page.$eval(`css=doesnotexist , section #root1`, e => e.id)).toBe('root1');
    expect(await page.$$eval(`css=doesnotexist ,section #root1`, els => els.length)).toBe(1);
    expect(await page.$$eval(`css=span,div span`, els => els.length)).toBe(4);
    expect(await page.$$eval(`css=span,div span`, els => els.length)).toBe(4);
    expect(await page.$$eval(`css=span,div span,div div span`, els => els.length)).toBe(4);
    expect(await page.$$eval(`css=#target,[attr="value\\ space"]`, els => els.length)).toBe(2);
    expect(await page.$$eval(`css=#target,[data-testid="foo"],[attr="value\\ space"]`, els => els.length)).toBe(4);
    expect(await page.$$eval(`css=#target,[data-testid="foo"],[attr="value\\ space"],span`, els => els.length)).toBe(4);
  });

  it('should keep dom order with comma separated list', async({page}) => {
    await page.setContent(`<section><span><div><x></x><y></y></div></span></section>`);
    expect(await page.$$eval(`css=span,div`, els => els.map(e => e.nodeName).join(','))).toBe('SPAN,DIV');
    expect(await page.$$eval(`css=div,span`, els => els.map(e => e.nodeName).join(','))).toBe('SPAN,DIV');
    expect(await page.$$eval(`css=span div, div`, els => els.map(e => e.nodeName).join(','))).toBe('DIV');
    expect(await page.$$eval(`*css=section >> css=div,span`, els => els.map(e => e.nodeName).join(','))).toBe('SECTION');
    expect(await page.$$eval(`css=section >> *css=div >> css=x,y`, els => els.map(e => e.nodeName).join(','))).toBe('DIV');
    expect(await page.$$eval(`css=section >> *css=div,span >> css=x,y`, els => els.map(e => e.nodeName).join(','))).toBe('SPAN,DIV');
    expect(await page.$$eval(`css=section >> *css=div,span >> css=y`, els => els.map(e => e.nodeName).join(','))).toBe('SPAN,DIV');
  });

  it('should work with comma inside text', async({page}) => {
    await page.setContent(`<span></span><div attr="hello,world!"></div>`);
    expect(await page.$eval(`css=div[attr="hello,world!"]`, e => e.outerHTML)).toBe('<div attr="hello,world!"></div>');
    expect(await page.$eval(`css=[attr="hello,world!"]`, e => e.outerHTML)).toBe('<div attr="hello,world!"></div>');
    expect(await page.$eval(`css=div[attr='hello,world!']`, e => e.outerHTML)).toBe('<div attr="hello,world!"></div>');
    expect(await page.$eval(`css=[attr='hello,world!']`, e => e.outerHTML)).toBe('<div attr="hello,world!"></div>');
    expect(await page.$eval(`css=div[attr="hello,world!"],span`, e => e.outerHTML)).toBe('<span></span>');
  });

  it('should work with attribute selectors', async({page}) => {
    await page.setContent(`<div attr="hello world" attr2="hello-''>>foo=bar[]" attr3="] span"><span></span></div>`);
    await page.evaluate(() => window.div = document.querySelector('div'));
    const selectors = [
      `[attr="hello world"]`,
      `[attr = "hello world"]`,
      `[attr ~= world]`,
      `[attr ^=hello ]`,
      `[attr $= world ]`,
      `[attr *= "llo wor" ]`,
      `[attr2 |= hello]`,
      `[attr = "Hello World" i ]`,
      `[attr *= "llo WOR"i]`,
      `[attr $= woRLD i]`,
      `[attr2 = "hello-''>>foo=bar[]"]`,
      `[attr2 $="foo=bar[]"]`,
    ];
    for (const selector of selectors)
      expect(await page.$eval(selector, e => e === div)).toBe(true);
    expect(await page.$eval(`[attr*=hello] span`, e => e.parentNode === div)).toBe(true);
    expect(await page.$eval(`[attr*=hello] >> span`, e => e.parentNode === div)).toBe(true);
    expect(await page.$eval(`[attr3="] span"] >> span`, e => e.parentNode === div)).toBe(true);
  });
});

describe('attribute selector', () => {
  it('should work for open shadow roots', async({page, server}) => {
    await page.goto(server.PREFIX + '/deep-shadow.html');
    expect(await page.$eval(`id=target`, e => e.textContent)).toBe('Hello from root2');
    expect(await page.$eval(`data-testid=foo`, e => e.textContent)).toBe('Hello from root1');
    expect(await page.$$eval(`data-testid=foo`, els => els.length)).toBe(3);
    expect(await page.$(`id:light=target`)).toBe(null);
    expect(await page.$(`data-testid:light=foo`)).toBe(null);
    expect(await page.$$(`data-testid:light=foo`)).toEqual([]);
  });
});

describe('selectors.register', () => {
  it.skip(USES_HOOKS)('should work', async ({page}) => {
    const createTagSelector = () => ({
      create(root, target) {
        return target.nodeName;
      },
      query(root, selector) {
        return root.querySelector(selector);
      },
      queryAll(root, selector) {
        return Array.from(root.querySelectorAll(selector));
      }
    });
    await utils.registerEngine('tag', `(${createTagSelector.toString()})()`);
    await page.setContent('<div><span></span></div><div></div>');
    expect(await playwright.selectors._createSelector('tag', await page.$('div'))).toBe('DIV');
    expect(await page.$eval('tag=DIV', e => e.nodeName)).toBe('DIV');
    expect(await page.$eval('tag=SPAN', e => e.nodeName)).toBe('SPAN');
    expect(await page.$$eval('tag=DIV', es => es.length)).toBe(2);

    // Selector names are case-sensitive.
    const error = await page.$('tAG=DIV').catch(e => e);
    expect(error.message).toBe('Unknown engine "tAG" while parsing selector tAG=DIV');
  });
  it('should work with path', async ({page}) => {
    await utils.registerEngine('foo', { path: path.join(__dirname, 'assets/sectionselectorengine.js') });
    await page.setContent('<section></section>');
    expect(await page.$eval('foo=whatever', e => e.nodeName)).toBe('SECTION');
  });
  it('should work in main and isolated world', async ({page}) => {
    const createDummySelector = () => ({
      create(root, target) { },
      query(root, selector) {
        return window.__answer;
      },
      queryAll(root, selector) {
        return [document.body, document.documentElement, window.__answer];
      }
    });
    await utils.registerEngine('main', createDummySelector);
    await utils.registerEngine('isolated', createDummySelector, { contentScript: true });
    await page.setContent('<div><span><section></section></span></div>');
    await page.evaluate(() => window.__answer = document.querySelector('span'));
    // Works in main if asked.
    expect(await page.$eval('main=ignored', e => e.nodeName)).toBe('SPAN');
    expect(await page.$eval('css=div >> main=ignored', e => e.nodeName)).toBe('SPAN');
    expect(await page.$$eval('main=ignored', es => window.__answer !== undefined)).toBe(true);
    expect(await page.$$eval('main=ignored', es => es.filter(e => e).length)).toBe(3);
    // Works in isolated by default.
    expect(await page.$('isolated=ignored')).toBe(null);
    expect(await page.$('css=div >> isolated=ignored')).toBe(null);
    // $$eval always works in main, to avoid adopting nodes one by one.
    expect(await page.$$eval('isolated=ignored', es => window.__answer !== undefined)).toBe(true);
    expect(await page.$$eval('isolated=ignored', es => es.filter(e => e).length)).toBe(3);
    // At least one engine in main forces all to be in main.
    expect(await page.$eval('main=ignored >> isolated=ignored', e => e.nodeName)).toBe('SPAN');
    expect(await page.$eval('isolated=ignored >> main=ignored', e => e.nodeName)).toBe('SPAN');
    // Can be chained to css.
    expect(await page.$eval('main=ignored >> css=section', e => e.nodeName)).toBe('SECTION');
  });
  it('should handle errors', async ({page}) => {
    let error = await page.$('neverregister=ignored').catch(e => e);
    expect(error.message).toBe('Unknown engine "neverregister" while parsing selector neverregister=ignored');

    const createDummySelector = () => ({
      create(root, target) {
        return target.nodeName;
      },
      query(root, selector) {
        return root.querySelector('dummy');
      },
      queryAll(root, selector) {
        return Array.from(root.querySelectorAll('dummy'));
      }
    });

    error = await playwright.selectors.register('$', createDummySelector).catch(e => e);
    expect(error.message).toBe('Selector engine name may only contain [a-zA-Z0-9_] characters');

    // Selector names are case-sensitive.
    await utils.registerEngine('dummy', createDummySelector);
    await utils.registerEngine('duMMy', createDummySelector);

    error = await playwright.selectors.register('dummy', createDummySelector).catch(e => e);
    expect(error.message).toBe('"dummy" selector engine has been already registered');

    error = await playwright.selectors.register('css', createDummySelector).catch(e => e);
    expect(error.message).toBe('"css" is a predefined selector engine');
  });
});
