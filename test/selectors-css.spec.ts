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

import { it, expect } from './fixtures';

it('should work for open shadow roots', async ({page, server}) => {
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

it('should work with > combinator and spaces', async ({page, server}) => {
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

it('should work with comma separated list', async ({page, server}) => {
  await page.goto(server.PREFIX + '/deep-shadow.html');
  expect(await page.$$eval(`css=span,section #root1`, els => els.length)).toBe(5);
  expect(await page.$$eval(`css=section #root1, div span`, els => els.length)).toBe(5);
  expect(await page.$eval(`css=doesnotexist , section #root1`, e => e.id)).toBe('root1');
  expect(await page.$$eval(`css=doesnotexist ,section #root1`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=span,div span`, els => els.length)).toBe(4);
  expect(await page.$$eval(`css=span,div span,div div span`, els => els.length)).toBe(4);
  expect(await page.$$eval(`css=#target,[attr="value\\ space"]`, els => els.length)).toBe(2);
  expect(await page.$$eval(`css=#target,[data-testid="foo"],[attr="value\\ space"]`, els => els.length)).toBe(4);
  expect(await page.$$eval(`css=#target,[data-testid="foo"],[attr="value\\ space"],span`, els => els.length)).toBe(4);
});

it('should keep dom order with comma separated list', async ({page}) => {
  await page.setContent(`<section><span><div><x></x><y></y></div></span></section>`);
  expect(await page.$$eval(`css=span,div`, els => els.map(e => e.nodeName).join(','))).toBe('SPAN,DIV');
  expect(await page.$$eval(`css=div,span`, els => els.map(e => e.nodeName).join(','))).toBe('SPAN,DIV');
  expect(await page.$$eval(`css=span div, div`, els => els.map(e => e.nodeName).join(','))).toBe('DIV');
  expect(await page.$$eval(`*css=section >> css=div,span`, els => els.map(e => e.nodeName).join(','))).toBe('SECTION');
  expect(await page.$$eval(`css=section >> *css=div >> css=x,y`, els => els.map(e => e.nodeName).join(','))).toBe('DIV');
  expect(await page.$$eval(`css=section >> *css=div,span >> css=x,y`, els => els.map(e => e.nodeName).join(','))).toBe('SPAN,DIV');
  expect(await page.$$eval(`css=section >> *css=div,span >> css=y`, els => els.map(e => e.nodeName).join(','))).toBe('SPAN,DIV');
});

it('should work with comma inside text', async ({page}) => {
  await page.setContent(`<span></span><div attr="hello,world!"></div>`);
  expect(await page.$eval(`css=div[attr="hello,world!"]`, e => e.outerHTML)).toBe('<div attr="hello,world!"></div>');
  expect(await page.$eval(`css=[attr="hello,world!"]`, e => e.outerHTML)).toBe('<div attr="hello,world!"></div>');
  expect(await page.$eval(`css=div[attr='hello,world!']`, e => e.outerHTML)).toBe('<div attr="hello,world!"></div>');
  expect(await page.$eval(`css=[attr='hello,world!']`, e => e.outerHTML)).toBe('<div attr="hello,world!"></div>');
  expect(await page.$eval(`css=div[attr="hello,world!"],span`, e => e.outerHTML)).toBe('<span></span>');
});

it('should work with attribute selectors', async ({page}) => {
  await page.setContent(`<div attr="hello world" attr2="hello-''>>foo=bar[]" attr3="] span"><span></span></div>`);
  await page.evaluate(() => window['div'] = document.querySelector('div'));
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
    expect(await page.$eval(selector, e => e === window['div'])).toBe(true);
  expect(await page.$eval(`[attr*=hello] span`, e => e.parentNode === window['div'])).toBe(true);
  expect(await page.$eval(`[attr*=hello] >> span`, e => e.parentNode === window['div'])).toBe(true);
  expect(await page.$eval(`[attr3="] span"] >> span`, e => e.parentNode === window['div'])).toBe(true);
});

it('should not match root after >>', async ({page, server}) => {
  await page.setContent('<section><div>test</div></section>');
  const element = await page.$('css=section >> css=section');
  expect(element).toBe(null);
});
