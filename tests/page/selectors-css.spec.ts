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

import type { ElementHandle } from '@playwright/test';
import { test as it, expect } from './pageTest';

it('should work with large DOM @smoke', async ({ page, server }) => {
  await page.evaluate(() => {
    let id = 0;
    const next = (tag: string) => {
      const e = document.createElement(tag);
      const eid = ++id;
      e.textContent = 'id' + eid;
      e.id = '' + eid;
      return e;
    };
    const generate = (depth: number) => {
      const div = next('div');
      const span1 = next('span');
      const span2 = next('span');
      div.appendChild(span1);
      div.appendChild(span2);
      if (depth > 0) {
        div.appendChild(generate(depth - 1));
        div.appendChild(generate(depth - 1));
      }
      return div;
    };
    document.body.appendChild(generate(12));
  });
  const selectors = [
    'div div div span',
    'div > div div > span',
    'div + div div div span + span',
    'div ~ div div > span ~ span',
    'div > div > div + div > div + div > span ~ span',
    'div div div div div div div div div div span',
    'div > div > div > div > div > div > div > div > div > div > span',
    'div ~ div div ~ div div ~ div div ~ div div ~ div span',
    'span',
  ];

  const measure = false;
  for (const selector of selectors) {
    const counts1 = [];
    const time1 = Date.now();
    for (let i = 0; i < (measure ? 10 : 1); i++)
      counts1.push(await page.$$eval(selector, els => els.length));
    if (measure)
      console.log('pw: ' + (Date.now() - time1));

    const time2 = Date.now();
    const counts2 = [];
    for (let i = 0; i < (measure ? 10 : 1); i++)
      counts2.push(await page.evaluate(selector => document.querySelectorAll(selector).length, selector));
    if (measure)
      console.log('qs: ' + (Date.now() - time2));

    expect(counts1).toEqual(counts2);
  }
});

it('should work for open shadow roots', async ({ page, server }) => {
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

  const root2 = (await page.$(`css=div div`))!;
  expect(await root2.$eval(`css=#target`, e => e.textContent)).toBe('Hello from root2');
  expect(await root2.$(`css:light=#target`)).toBe(null);
  const root2Shadow = (await root2.evaluateHandle(r => r.shadowRoot) as ElementHandle<ShadowRoot>)!;
  expect(await root2Shadow.$eval(`css:light=#target`, e => e.textContent)).toBe('Hello from root2');
  const root3 = (await page.$$(`css=div div`))[1];
  expect(await root3.$eval(`text=root3`, e => e.textContent)).toBe('Hello from root3');
  expect(await root3.$eval(`css=[attr*="value"]`, e => e.textContent)).toBe('Hello from root3 #2');
  expect(await root3.$(`css:light=[attr*="value"]`)).toBe(null);
});

it('should work with > combinator and spaces', async ({ page, server }) => {
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

it('should work with comma separated list', async ({ page, server }) => {
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

it('should keep dom order with comma separated list', async ({ page }) => {
  await page.setContent(`<section><span><div><x></x><y></y></div></span></section>`);
  expect(await page.$$eval(`css=span,div`, els => els.map(e => e.nodeName).join(','))).toBe('SPAN,DIV');
  expect(await page.$$eval(`css=div,span`, els => els.map(e => e.nodeName).join(','))).toBe('SPAN,DIV');
  expect(await page.$$eval(`css=span div, div`, els => els.map(e => e.nodeName).join(','))).toBe('DIV');
  expect(await page.$$eval(`*css=section >> css=div,span`, els => els.map(e => e.nodeName).join(','))).toBe('SECTION');
  expect(await page.$$eval(`css=section >> *css=div >> css=x,y`, els => els.map(e => e.nodeName).join(','))).toBe('DIV');
  expect(await page.$$eval(`css=section >> *css=div,span >> css=x,y`, els => els.map(e => e.nodeName).join(','))).toBe('SPAN,DIV');
  expect(await page.$$eval(`css=section >> *css=div,span >> css=y`, els => els.map(e => e.nodeName).join(','))).toBe('SPAN,DIV');
});

it('should return multiple captures for the same node', async ({ page }) => {
  await page.setContent(`<div><div><div><span></span></div></div></div>`);
  expect(await page.$$eval(`*css=div >> span`, els => els.map(e => e.nodeName).join(','))).toBe('DIV,DIV,DIV');
});

it('should return multiple captures when going up the hierarchy', async ({ page }) => {
  await page.setContent(`<section>Hello<ul><li></li><li></li></ul></section>`);
  expect(await page.$$eval(`*css=li >> ../.. >> text=Hello`, els => els.map(e => e.nodeName).join(','))).toBe('LI,LI');
});

it('should work with comma separated list in various positions', async ({ page }) => {
  await page.setContent(`<section><span><div><x></x><y></y></div></span></section>`);
  expect(await page.$$eval(`css=span,div >> css=x,y`, els => els.map(e => e.nodeName).join(','))).toBe('X,Y');
  expect(await page.$$eval(`css=span,div >> css=x`, els => els.map(e => e.nodeName).join(','))).toBe('X');
  expect(await page.$$eval(`css=div >> css=x,y`, els => els.map(e => e.nodeName).join(','))).toBe('X,Y');
  expect(await page.$$eval(`css=div >> css=x`, els => els.map(e => e.nodeName).join(','))).toBe('X');

  expect(await page.$$eval(`css=section >> css=div >> css=x`, els => els.map(e => e.nodeName).join(','))).toBe('X');
  expect(await page.$$eval(`css=section >> css=span >> css=div >> css=y`, els => els.map(e => e.nodeName).join(','))).toBe('Y');
  expect(await page.$$eval(`css=section >> css=div >> css=x,y`, els => els.map(e => e.nodeName).join(','))).toBe('X,Y');
  expect(await page.$$eval(`css=section >> css=div,span >> css=x,y`, els => els.map(e => e.nodeName).join(','))).toBe('X,Y');
  expect(await page.$$eval(`css=section >> css=span >> css=x,y`, els => els.map(e => e.nodeName).join(','))).toBe('X,Y');
});

it('should work with comma inside text', async ({ page }) => {
  await page.setContent(`<span></span><div attr="hello,world!"></div>`);
  expect(await page.$eval(`css=div[attr="hello,world!"]`, e => e.outerHTML)).toBe('<div attr="hello,world!"></div>');
  expect(await page.$eval(`css=[attr="hello,world!"]`, e => e.outerHTML)).toBe('<div attr="hello,world!"></div>');
  expect(await page.$eval(`css=div[attr='hello,world!']`, e => e.outerHTML)).toBe('<div attr="hello,world!"></div>');
  expect(await page.$eval(`css=[attr='hello,world!']`, e => e.outerHTML)).toBe('<div attr="hello,world!"></div>');
  expect(await page.$eval(`css=div[attr="hello,world!"],span`, e => e.outerHTML)).toBe('<span></span>');
});

it('should work with attribute selectors', async ({ page }) => {
  await page.setContent(`<div attr="hello world" attr2="hello-''>>foo=bar[]" attr3="] span"><span></span></div>`);
  await page.evaluate(() => (window as any)['div'] = document.querySelector('div'));
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
    expect(await page.$eval(selector, e => e === (window as any)['div'])).toBe(true);
  expect(await page.$eval(`[attr*=hello] span`, e => e.parentNode === (window as any)['div'])).toBe(true);
  expect(await page.$eval(`[attr*=hello] >> span`, e => e.parentNode === (window as any)['div'])).toBe(true);
  expect(await page.$eval(`[attr3="] span"] >> span`, e => e.parentNode === (window as any)['div'])).toBe(true);
});

it('should not match root after >>', async ({ page, server }) => {
  await page.setContent('<section><div>test</div></section>');
  const element = await page.$('css=section >> css=section');
  expect(element).toBe(null);
});

it('should work with numerical id', async ({ page, server }) => {
  await page.setContent('<section id="123"></section>');
  const element = await page.$('#\\31\\32\\33');
  expect(element).toBeTruthy();
});

it('should work with wrong-case id', async ({ page }) => {
  await page.setContent('<section id="Hello"></section>');
  expect(await page.$eval('#Hello', e => e.tagName)).toBe('SECTION');
  expect(await page.$eval('#hello', e => e.tagName)).toBe('SECTION');
  expect(await page.$eval('#HELLO', e => e.tagName)).toBe('SECTION');
  expect(await page.$eval('#helLO', e => e.tagName)).toBe('SECTION');
});

it('should work with *', async ({ page }) => {
  await page.setContent('<div id=div1></div><div id=div2><span><span></span></span></div>');
  // Includes html, head and body.
  expect(await page.$$eval('*', els => els.length)).toBe(7);
  expect(await page.$$eval('*#div1', els => els.length)).toBe(1);
  expect(await page.$$eval('*:not(#div1)', els => els.length)).toBe(6);
  expect(await page.$$eval('*:not(div)', els => els.length)).toBe(5);
  expect(await page.$$eval('*:not(span)', els => els.length)).toBe(5);
  expect(await page.$$eval('*:not(*)', els => els.length)).toBe(0);
  expect(await page.$$eval('*:is(*)', els => els.length)).toBe(7);
  expect(await page.$$eval('* *', els => els.length)).toBe(6);
  expect(await page.$$eval('* *:not(span)', els => els.length)).toBe(4);
  expect(await page.$$eval('div > *', els => els.length)).toBe(1);
  expect(await page.$$eval('div *', els => els.length)).toBe(2);
  expect(await page.$$eval('* > *', els => els.length)).toBe(6);

  const body = (await page.$('body')) as ElementHandle<HTMLBodyElement>;
  // Does not include html, head or body.
  expect(await body.$$eval('*', els => els.length)).toBe(4);
  expect(await body.$$eval('*#div1', els => els.length)).toBe(1);
  expect(await body.$$eval('*:not(#div1)', els => els.length)).toBe(3);
  expect(await body.$$eval('*:not(div)', els => els.length)).toBe(2);
  expect(await body.$$eval('*:not(span)', els => els.length)).toBe(2);
  expect(await body.$$eval('*:not(*)', els => els.length)).toBe(0);
  expect(await body.$$eval('*:is(*)', els => els.length)).toBe(4);
  expect(await body.$$eval('div > *', els => els.length)).toBe(1);
  expect(await body.$$eval('div *', els => els.length)).toBe(2);
  // Selectors v2 matches jquery in the sense that matching starts with the element scope,
  // not the document scope.
  expect(await body.$$eval('* > *', els => els.length)).toBe(2);
  // Adding scope makes querySelectorAll work like jquery.
  expect(await body.$$eval(':scope * > *', els => els.length)).toBe(2);
  // Note that the following two selectors are following jquery logic even
  // with selectors v1. Just running `body.querySelectorAll` returns 4 and 2 respectively.
  // That's probably a bug in v1, but oh well.
  expect(await body.$$eval('* *', els => els.length)).toBe(2);
  expect(await body.$$eval('* *:not(span)', els => els.length)).toBe(0);
});

it('should work with :nth-child', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/deep-shadow.html');
  expect(await page.$$eval(`css=span:nth-child(odd)`, els => els.length)).toBe(3);
  expect(await page.$$eval(`css=span:nth-child(even)`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=span:nth-child(n+1)`, els => els.length)).toBe(4);
  expect(await page.$$eval(`css=span:nth-child(n+2)`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=span:nth-child(2n)`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=span:nth-child(2n+1)`, els => els.length)).toBe(3);
  expect(await page.$$eval(`css=span:nth-child(-n)`, els => els.length)).toBe(0);
  expect(await page.$$eval(`css=span:nth-child(-n+1)`, els => els.length)).toBe(3);
  expect(await page.$$eval(`css=span:nth-child(-n+2)`, els => els.length)).toBe(4);
  expect(await page.$$eval(`css=span:nth-child(23n+2)`, els => els.length)).toBe(1);
});

it('should work with :nth-child(of) notation with nested functions', async ({ page, browserName, browserMajorVersion }) => {
  it.fixme(browserName === 'firefox', 'Should enable once Firefox supports this syntax');
  it.skip(browserName === 'chromium' && browserMajorVersion < 111, 'https://caniuse.com/css-nth-child-of');

  await page.setContent(`
    <div>
      <span>span1</span>
      <span class=foo>span2<dd></dd></span>
      <span class=foo>span3<dd class=marker></dd></span>
      <span class=foo>span4<dd class=marker></dd></span>
      <span class=foo>span5<dd></dd></span>
      <span>span6</span>
    </div>
  `);
  expect(await page.$$eval(`css=span:nth-child(1)`, els => els.map(e => e.textContent))).toEqual(['span1']);
  expect(await page.$$eval(`css=span:nth-child(1 of .foo)`, els => els.map(e => e.textContent))).toEqual(['span2']);
  expect(await page.$$eval(`css=span:nth-child(1 of .foo:has(dd.marker))`, els => els.map(e => e.textContent))).toEqual(['span3']);
  expect(await page.$$eval(`css=span:nth-last-child(1 of .foo:has(dd.marker))`, els => els.map(e => e.textContent))).toEqual(['span4']);
  expect(await page.$$eval(`css=span:nth-last-child(1 of .foo)`, els => els.map(e => e.textContent))).toEqual(['span5']);
  expect(await page.$$eval(`css=span:nth-last-child(  1  )`, els => els.map(e => e.textContent))).toEqual(['span6']);

  expect(await page.$$eval(`css=span:nth-child(1 of .foo:nth-child(3))`, els => els.map(e => e.textContent))).toEqual(['span3']);
  expect(await page.$$eval(`css=span:nth-child(1 of .foo:nth-child(6))`, els => els.map(e => e.textContent))).toEqual([]);
});

it('should work with :not', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/deep-shadow.html');
  expect(await page.$$eval(`css=div:not(#root1)`, els => els.length)).toBe(2);
  expect(await page.$$eval(`css=body :not(span)`, els => els.length)).toBe(4);
  expect(await page.$$eval(`css=div > :not(span):not(div)`, els => els.length)).toBe(0);
});

it('should work with ~', async ({ page }) => {
  await page.setContent(`
    <div id=div1></div>
    <div id=div2></div>
    <div id=div3></div>
    <div id=div4></div>
    <div id=div5></div>
    <div id=div6></div>
  `);
  expect(await page.$$eval(`#div3 >> :scope ~ div`, els => els.map(e => e.id))).toEqual(['div4', 'div5', 'div6']);
  expect(await page.$$eval(`#div3 >> :scope ~ *`, els => els.map(e => e.id))).toEqual(['div4', 'div5', 'div6']);
  expect(await page.$$eval(`#div3 >> ~ div`, els => els.map(e => e.id))).toEqual(['div4', 'div5', 'div6']);
  expect(await page.$$eval(`#div3 >> ~ *`, els => els.map(e => e.id))).toEqual(['div4', 'div5', 'div6']);
  expect(await page.$$eval(`#div3 >> #div1 ~ :scope`, els => els.map(e => e.id))).toEqual(['div3']);
  expect(await page.$$eval(`#div3 >> #div4 ~ :scope`, els => els.map(e => e.id))).toEqual([]);
  expect(await page.$$eval(`css=#div1 ~ div ~ #div6`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=#div1 ~ div ~ div`, els => els.length)).toBe(4);
  expect(await page.$$eval(`css=#div3 ~ div ~ div`, els => els.length)).toBe(2);
  expect(await page.$$eval(`css=#div4 ~ div ~ div`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=#div5 ~ div ~ div`, els => els.length)).toBe(0);
  expect(await page.$$eval(`css=#div3 ~ #div2 ~ #div6`, els => els.length)).toBe(0);
  expect(await page.$$eval(`css=#div3 ~ #div4 ~ #div5`, els => els.length)).toBe(1);
});

it('should work with +', async ({ page }) => {
  await page.setContent(`
    <section>
      <div id=div1></div>
      <div id=div2></div>
      <div id=div3></div>
      <div id=div4></div>
      <div id=div5></div>
      <div id=div6></div>
    </section>
  `);
  expect(await page.$$eval(`#div1 >> :scope+div`, els => els.map(e => e.id))).toEqual(['div2']);
  expect(await page.$$eval(`#div1 >> :scope+*`, els => els.map(e => e.id))).toEqual(['div2']);
  expect(await page.$$eval(`#div1 >> + div`, els => els.map(e => e.id))).toEqual(['div2']);
  expect(await page.$$eval(`#div1 >> + *`, els => els.map(e => e.id))).toEqual(['div2']);
  expect(await page.$$eval(`#div3 >> div + :scope`, els => els.map(e => e.id))).toEqual(['div3']);
  expect(await page.$$eval(`#div3 >> #div1 + :scope`, els => els.map(e => e.id))).toEqual([]);
  expect(await page.$$eval(`css=#div1 ~ div + #div6`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=#div1 ~ div + div`, els => els.length)).toBe(4);
  expect(await page.$$eval(`css=#div3 + div + div`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=#div4 ~ #div5 + div`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=#div5 + div + div`, els => els.length)).toBe(0);
  expect(await page.$$eval(`css=#div3 ~ #div2 + #div6`, els => els.length)).toBe(0);
  expect(await page.$$eval(`css=#div3 + #div4 + #div5`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=div + #div1`, els => els.length)).toBe(0);
  expect(await page.$$eval(`css=section > div + div ~ div`, els => els.length)).toBe(4);
  expect(await page.$$eval(`css=section > div + #div4 ~ div`, els => els.length)).toBe(2);
  expect(await page.$$eval(`css=section:has(:scope > div + #div2)`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=section:has(:scope > div + #div1)`, els => els.length)).toBe(0);
  expect(await page.$eval(`css=div:has(:scope + #div5)`, e => e.id)).toBe('div4');
});

it('should work with spaces in :nth-child and :not', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/deep-shadow.html');
  expect(await page.$$eval(`css=span:nth-child(23n +2)`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=span:nth-child(23n+ 2)`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=span:nth-child( 23n + 2 )`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=span:not(#root1 #target)`, els => els.length)).toBe(3);
  expect(await page.$$eval(`css=span:not(:not(#root1 #target))`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=span:not(span:not(#root1 #target))`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=div > :not(span)`, els => els.length)).toBe(2);
  expect(await page.$$eval(`css=body :not(span, div)`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=span, section:not(span, div)`, els => els.length)).toBe(5);
  expect(await page.$$eval(`span:nth-child(23n+ 2) >> xpath=.`, els => els.length)).toBe(1);
});

it('should work with :is', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/deep-shadow.html');
  expect(await page.$$eval(`css=div:is(#root1)`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=div:is(#root1, #target)`, els => els.length)).toBe(1);
  expect(await page.$$eval(`css=div:is(span, #target)`, els => els.length)).toBe(0);
  expect(await page.$$eval(`css=div:is(span, #root1 > *)`, els => els.length)).toBe(2);
  expect(await page.$$eval(`css=div:is(section div)`, els => els.length)).toBe(3);
  expect(await page.$$eval(`css=:is(div, span)`, els => els.length)).toBe(7);
  expect(await page.$$eval(`css=section:is(section) div:is(section div)`, els => els.length)).toBe(3);
  expect(await page.$$eval(`css=:is(div, span) > *`, els => els.length)).toBe(6);
  expect(await page.$$eval(`css=#root1:has(:is(#root1))`, els => els.length)).toBe(0);
  expect(await page.$$eval(`css=#root1:has(:is(:scope, #root1))`, els => els.length)).toBe(1);
});

it('should work with :has', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/deep-shadow.html');
  expect(await page.$$eval(`css=div:has(#target)`, els => els.length)).toBe(2);
  expect(await page.$$eval(`css=div:has([data-testid=foo])`, els => els.length)).toBe(3);
  expect(await page.$$eval(`css=div:has([attr*=value])`, els => els.length)).toBe(2);

  await page.setContent(`<section><span></span><div></div></section><section><br></section>`);
  expect(await page.$$eval(`section:has(span, div)`, els => els.length)).toBe(1);
  expect(await page.$$eval(`section:has(span, div)`, els => els.length)).toBe(1);
  expect(await page.$$eval(`section:has(br)`, els => els.length)).toBe(1);
  expect(await page.$$eval(`section:has(span, br)`, els => els.length)).toBe(2);
  expect(await page.$$eval(`section:has(span, br, div)`, els => els.length)).toBe(2);
});

it('should work with :scope', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/deep-shadow.html');
  // 'is' does not change the scope, so it remains 'html'.
  expect(await page.$$eval(`css=div:is(:scope#root1)`, els => els.length)).toBe(0);
  expect(await page.$$eval(`css=div:is(:scope #root1)`, els => els.length)).toBe(1);
  // 'has' does change the scope, so it becomes the 'div' we are querying.
  expect(await page.$$eval(`css=div:has(:scope > #target)`, els => els.length)).toBe(1);

  const handle = await page.$(`css=span`) as ElementHandle;
  for (const scope of [page, handle]) {
    expect(await scope.$$eval(`css=:scope`, els => els.length)).toBe(1);
    expect(await scope.$$eval(`css=* :scope`, els => els.length)).toBe(0);
    expect(await scope.$$eval(`css=* + :scope`, els => els.length)).toBe(0);
    expect(await scope.$$eval(`css=* > :scope`, els => els.length)).toBe(0);
    expect(await scope.$$eval(`css=* ~ :scope`, els => els.length)).toBe(0);
  }

  await page.setContent(`<article><div class=target>hello<span></span></div></article>`);
  // 'scope' should allow additional native css modifiers
  expect(await page.$eval(`div >> :scope.target`, e => e.textContent)).toBe('hello');
  expect(await page.$eval(`div >> :scope:nth-child(1)`, e => e.textContent)).toBe('hello');
  expect(await page.$eval(`div >> :scope.target:has(span)`, e => e.textContent)).toBe('hello');
  expect(await page.$eval(`html:scope`, e => e.nodeName)).toBe('HTML');

  await page.setContent(`<section><span id=span1><span id=inner></span></span><span id=span2></span></section>`);
  expect(await page.$$eval(`#span1 >> span:not(:has(:scope > div))`, els => els.map(e => e.id))).toEqual(['inner']);
  expect(await page.$$eval(`#span1 >> #inner,:scope`, els => els.map(e => e.id))).toEqual(['span1', 'inner']);
  expect(await page.$$eval(`#span1 >> span,:scope`, els => els.map(e => e.id))).toEqual(['span1', 'inner']);
  expect(await page.$$eval(`#span1 >> span:not(:scope)`, els => els.map(e => e.id))).toEqual(['inner']);
  // TODO: the following two do not work. We do not expand the context for the inner :scope,
  // because we should only expand for one clause of :is() that contains :scope, but not the other.
  // expect(await page.$$eval(`#span1 >> span:is(:scope)`, els => els.map(e => e.id))).toEqual(['span1']);
  // expect(await page.$$eval(`#span1 >> span:is(:scope,#inner)`, els => els.map(e => e.id))).toEqual(['span1', 'inner']);
});

it('should work with :scope and class', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/17824' });
  await page.setContent(`<div class="apple"></div>
                         <div class="apple selected"></div>`);
  const apples = page.locator('.apple');
  const selectedApples = apples.locator(':scope.selected');
  await expect(selectedApples).toHaveCount(1);
});

it('should absolutize relative selectors', async ({ page, server }) => {
  await page.setContent(`<div><span>Hi</span></div>`);
  expect(await page.$eval('div >> >span', e => e.textContent)).toBe('Hi');
  expect(await page.locator('div').locator('>span').textContent()).toBe('Hi');
  expect(await page.$eval('div:has(> span)', e => e.outerHTML)).toBe('<div><span>Hi</span></div>');
  expect(await page.$('div:has(> div)')).toBe(null);
});

it('css on the handle should be relative', async ({ page }) => {
  await page.setContent(`
    <span class="find-me" id=target1>1</span>
    <div>
      <span class="find-me" id=target2>2</span>
    </div>
  `);
  expect(await page.$eval(`.find-me`, e => e.id)).toBe('target1');

  const div = await page.$('div') as ElementHandle;
  expect(await div.$eval(`.find-me`, e => e.id)).toBe('target2');
  expect(await page.$eval(`div >> .find-me`, e => e.id)).toBe('target2');
});
