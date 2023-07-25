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

import { test as it, expect } from './pageTest';

it('should work for open shadow roots', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/deep-shadow.html');
  expect(await page.$eval(`id=target`, e => e.textContent)).toBe('Hello from root2');
  expect(await page.$eval(`data-testid=foo`, e => e.textContent)).toBe('Hello from root1');
  expect(await page.$$eval(`data-testid=foo`, els => els.length)).toBe(3);
  expect(await page.$(`id:light=target`)).toBe(null);
  expect(await page.$(`data-testid:light=foo`)).toBe(null);
  expect(await page.$$(`data-testid:light=foo`)).toEqual([]);
});

it('should click on links in shadow dom', async ({ page, server, browserName, browserMajorVersion }) => {
  await page.goto(server.PREFIX + '/shadow-dom-link.html');
  expect(await page.evaluate(() => (window as any).clickCount)).toBe(0);
  await page.click('#inner-link');
  expect(await page.evaluate(() => (window as any).clickCount)).toBe(1);
});

it('should work with :visible', async ({ page }) => {
  await page.setContent(`
    <section>
      <div id=target1></div>
      <div id=target2></div>
    </section>
  `);
  expect(await page.$('div:visible')).toBe(null);

  const error = await page.waitForSelector(`div:visible`, { timeout: 1000 }).catch(e => e);
  expect(error.message).toContain('1000ms');

  const promise = page.waitForSelector(`div:visible`, { state: 'attached' });
  await page.$eval('#target2', div => div.textContent = 'Now visible');
  const element = await promise;
  expect(await element.evaluate(e => e.id)).toBe('target2');

  expect(await page.$eval('div:visible', div => div.id)).toBe('target2');
});

it('should work with >> visible=', async ({ page }) => {
  await page.setContent(`
    <section>
      <div id=target1></div>
      <div id=target2></div>
    </section>
  `);
  expect(await page.$('div >> visible=true')).toBe(null);

  const error = await page.waitForSelector(`div >> visible=true`, { timeout: 1000 }).catch(e => e);
  expect(error.message).toContain('1000ms');

  const promise = page.waitForSelector(`div >> visible=true`, { state: 'attached' });
  await page.$eval('#target2', div => div.textContent = 'Now visible');
  const element = await promise;
  expect(await element.evaluate(e => e.id)).toBe('target2');

  expect(await page.$eval('div >> visible=true', div => div.id)).toBe('target2');
});

it('should work with :nth-match', async ({ page }) => {
  await page.setContent(`
    <section>
      <div id=target1></div>
      <div id=target2></div>
    </section>
  `);
  expect(await page.$(':nth-match(div, 3)')).toBe(null);
  expect(await page.$eval(':nth-match(div, 1)', e => e.id)).toBe('target1');
  expect(await page.$eval(':nth-match(div, 2)', e => e.id)).toBe('target2');
  expect(await page.$eval(':nth-match(section > div, 2)', e => e.id)).toBe('target2');
  expect(await page.$eval(':nth-match(section, div, 2)', e => e.id)).toBe('target1');
  expect(await page.$eval(':nth-match(div, section, 3)', e => e.id)).toBe('target2');
  expect(await page.$$eval(':is(:nth-match(div, 1), :nth-match(div, 2))', els => els.length)).toBe(2);

  let error;
  error = await page.$(':nth-match(div, bar, 0)').catch(e => e);
  expect(error.message).toContain(`"nth-match" engine expects a one-based index as the last argument`);

  error = await page.$(':nth-match(2)').catch(e => e);
  expect(error.message).toContain(`"nth-match" engine expects non-empty selector list and an index argument`);

  error = await page.$(':nth-match(div, bar, foo)').catch(e => e);
  expect(error.message).toContain(`"nth-match" engine expects a one-based index as the last argument`);

  const promise = page.waitForSelector(`:nth-match(div, 3)`, { state: 'attached' });
  await page.$eval('section', section => {
    const div = document.createElement('div');
    div.setAttribute('id', 'target3');
    section.appendChild(div);
  });
  const element = await promise;
  expect(await element.evaluate(e => e.id)).toBe('target3');
});

it('should work with nth=', async ({ page }) => {
  await page.setContent(`
    <section>
      <div id=target1></div>
      <div id=target2></div>
    </section>
  `);
  expect(await page.$('div >> nth=2')).toBe(null);
  expect(await page.$eval('div >> nth=0', e => e.id)).toBe('target1');
  expect(await page.$eval('div >> nth=1', e => e.id)).toBe('target2');
  expect(await page.$eval('section > div >> nth=1', e => e.id)).toBe('target2');
  expect(await page.$eval('section, div >> nth=1', e => e.id)).toBe('target1');
  expect(await page.$eval('div, section >> nth=2', e => e.id)).toBe('target2');

  const promise = page.waitForSelector(`div >> nth=2`, { state: 'attached' });
  await page.$eval('section', section => {
    const div = document.createElement('div');
    div.setAttribute('id', 'target3');
    section.appendChild(div);
  });
  const element = await promise;
  expect(await element.evaluate(e => e.id)).toBe('target3');

  await page.setContent(`
    <div>
      <div>
        <div>
          <span>hi</span>
          <span>hello</span>
        </div>
      </div>
    </div>
  `);
  expect(await page.locator('div >> div >> span >> nth=1').textContent()).toBe('hello');
});

it('should work with strict mode and chaining', async ({ page }) => {
  await page.setContent(`
    <div>
      <div>
        <div>
          <span>hi</span>
        </div>
      </div>
    </div>
  `);
  expect(await page.locator('div >> div >> span').textContent()).toBe('hi');
});

it('should work with layout selectors', async ({ page, trace }) => {
  it.skip(trace === 'on');

  /*

       +--+  +--+
       | 1|  | 2|
       +--+  ++-++
       | 3|   | 4|
  +-------+  ++-++
  |   0   |  | 5|
  | +--+  +--+--+
  | | 6|  | 7|
  | +--+  +--+
  |       |
  O-------+
          +--+
          | 8|
          +--++--+
              | 9|
              +--+

  */

  const boxes = [
    // x, y, width, height
    [0, 0, 150, 150],
    [100, 200, 50, 50],
    [200, 200, 50, 50],
    [100, 150, 50, 50],
    [201, 150, 50, 50],
    [200, 100, 50, 50],
    [50, 50, 50, 50],
    [150, 50, 50, 50],
    [150, -51, 50, 50],
    [201, -101, 50, 50],
  ];
  await page.setContent(`<container style="width: 500px; height: 500px; position: relative;"></container>`);
  await page.$eval('container', (container, boxes) => {
    for (let i = 0; i < boxes.length; i++) {
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.overflow = 'hidden';
      div.style.boxSizing = 'border-box';
      div.style.border = '1px solid black';
      div.id = 'id' + i;
      div.textContent = 'id' + i;
      const box = boxes[i];
      div.style.left = box[0] + 'px';
      // Note that top is a flipped y coordinate.
      div.style.top = (250 - box[1] - box[3]) + 'px';
      div.style.width = box[2] + 'px';
      div.style.height = box[3] + 'px';
      container.appendChild(div);
      const span = document.createElement('span');
      span.textContent = '' + i;
      div.appendChild(span);
    }
  }, boxes);

  expect(await page.$eval('div:right-of(#id6)', e => e.id)).toBe('id7');
  expect(await page.$eval('div:right-of(#id1)', e => e.id)).toBe('id2');
  expect(await page.$eval('div:right-of(#id3)', e => e.id)).toBe('id4');
  expect(await page.$('div:right-of(#id4)')).toBe(null);
  expect(await page.$eval('div:right-of(#id0)', e => e.id)).toBe('id7');
  expect(await page.$eval('div:right-of(#id8)', e => e.id)).toBe('id9');
  expect(await page.$$eval('div:right-of(#id3)', els => els.map(e => e.id).join(','))).toBe('id4,id2,id5,id7,id8,id9');
  expect(await page.$$eval('div:right-of(#id3, 50)', els => els.map(e => e.id).join(','))).toBe('id2,id5,id7,id8');
  expect(await page.$$eval('div:right-of(#id3, 49)', els => els.map(e => e.id).join(','))).toBe('id7,id8');

  expect(await page.$eval('div:left-of(#id2)', e => e.id)).toBe('id1');
  expect(await page.$('div:left-of(#id0)')).toBe(null);
  expect(await page.$eval('div:left-of(#id5)', e => e.id)).toBe('id0');
  expect(await page.$eval('div:left-of(#id9)', e => e.id)).toBe('id8');
  expect(await page.$eval('div:left-of(#id4)', e => e.id)).toBe('id3');
  expect(await page.$$eval('div:left-of(#id5)', els => els.map(e => e.id).join(','))).toBe('id0,id7,id3,id1,id6,id8');
  expect(await page.$$eval('div:left-of(#id5, 3)', els => els.map(e => e.id).join(','))).toBe('id7,id8');

  expect(await page.$eval('div:above(#id0)', e => e.id)).toBe('id3');
  expect(await page.$eval('div:above(#id5)', e => e.id)).toBe('id4');
  expect(await page.$eval('div:above(#id7)', e => e.id)).toBe('id5');
  expect(await page.$eval('div:above(#id8)', e => e.id)).toBe('id0');
  expect(await page.$eval('div:above(#id9)', e => e.id)).toBe('id8');
  expect(await page.$('div:above(#id2)')).toBe(null);
  expect(await page.$$eval('div:above(#id5)', els => els.map(e => e.id).join(','))).toBe('id4,id2,id3,id1');
  expect(await page.$$eval('div:above(#id5, 20)', els => els.map(e => e.id).join(','))).toBe('id4,id3');

  expect(await page.$eval('div:below(#id4)', e => e.id)).toBe('id5');
  expect(await page.$eval('div:below(#id3)', e => e.id)).toBe('id0');
  expect(await page.$eval('div:below(#id2)', e => e.id)).toBe('id4');
  expect(await page.$eval('div:below(#id6)', e => e.id)).toBe('id8');
  expect(await page.$eval('div:below(#id7)', e => e.id)).toBe('id8');
  expect(await page.$eval('div:below(#id8)', e => e.id)).toBe('id9');
  expect(await page.$('div:below(#id9)')).toBe(null);
  expect(await page.$$eval('div:below(#id3)', els => els.map(e => e.id).join(','))).toBe('id0,id5,id6,id7,id8,id9');
  expect(await page.$$eval('div:below(#id3, 105)', els => els.map(e => e.id).join(','))).toBe('id0,id5,id6,id7');

  expect(await page.$eval('div:near(#id0)', e => e.id)).toBe('id3');
  expect(await page.$$eval('div:near(#id7)', els => els.map(e => e.id).join(','))).toBe('id0,id5,id3,id6');
  expect(await page.$$eval('div:near(#id0)', els => els.map(e => e.id).join(','))).toBe('id3,id6,id7,id8,id1,id5');
  expect(await page.$$eval('div:near(#id6)', els => els.map(e => e.id).join(','))).toBe('id0,id3,id7');
  expect(await page.$$eval('div:near(#id6, 10)', els => els.map(e => e.id).join(','))).toBe('id0');
  expect(await page.$$eval('div:near(#id0, 100)', els => els.map(e => e.id).join(','))).toBe('id3,id6,id7,id8,id1,id5,id4,id2');

  expect(await page.$$eval('div:below(#id5):above(#id8)', els => els.map(e => e.id).join(','))).toBe('id7,id6');
  expect(await page.$eval('div:below(#id5):above(#id8)', e => e.id)).toBe('id7');

  expect(await page.$$eval('div:right-of(#id0) + div:above(#id8)', els => els.map(e => e.id).join(','))).toBe('id5,id6,id3');

  const error = await page.$(':near(50)').catch(e => e);
  expect(error.message).toContain('"near" engine expects a selector list and optional maximum distance in pixels');
});

it('should escape the scope with >>', async ({ page }) => {
  await page.setContent(`<div><label>Test</label><input id='myinput'></div>`);
  expect(await page.$eval(`label >> xpath=.. >> input`, e => e.id)).toBe('myinput');
});

it('xpath should be relative', async ({ page }) => {
  await page.setContent(`
    <span class="find-me" id=target1>1</span>
    <div>
      <span class="find-me" id=target2>2</span>
    </div>
  `);
  expect(await page.$eval(`//*[@class="find-me"]`, e => e.id)).toBe('target1');

  const div = await page.$('div');
  expect(await div.$eval(`xpath=./*[@class="find-me"]`, e => e.id)).toBe('target2');
  expect(await div.$eval(`xpath=.//*[@class="find-me"]`, e => e.id)).toBe('target2');
  expect(await div.$eval(`//*[@class="find-me"]`, e => e.id)).toBe('target2');
  expect(await div.$eval(`xpath=/*[@class="find-me"]`, e => e.id)).toBe('target2');

  expect(await page.$eval(`div >> xpath=./*[@class="find-me"]`, e => e.id)).toBe('target2');
  expect(await page.$eval(`div >> xpath=.//*[@class="find-me"]`, e => e.id)).toBe('target2');
  expect(await page.$eval(`div >> //*[@class="find-me"]`, e => e.id)).toBe('target2');
  expect(await page.$eval(`div >> xpath=/*[@class="find-me"]`, e => e.id)).toBe('target2');
});

it('should work with pipe in xpath', async ({ page, server }) => {
  await page.setContent(`
    <span class="find-me" id=t1>1</span>
    <div>
      <span class="find-me" id=t2>2</span>
    </div>
    <div id=t3>3</span>
  `);
  expect(await page.$$eval(`//*[@id="t1"]|//*[@id="t3"]`, els => els.length)).toBe(2);

  const e1 = await page.waitForSelector(`//*[@id="t1"]|//*[@id="t3"]`);
  expect(e1).toBeTruthy();
  expect(await e1.evaluate(e => e.id)).toBe('t1');

  const e2 = await page.waitForSelector(`//*[@id="unknown"]|//*[@id="t2"]`);
  expect(e2).toBeTruthy();
  expect(await e2.evaluate(e => e.id)).toBe('t2');

  await page.click(`//code|//span[@id="t2"]`);
});

it('should print original xpath in error', async ({ page, browserName }) => {
  const error = await page.locator(`//*[contains(@Class, 'foo']`).isVisible().catch(e => e);
  expect(error.message).toContain('//*[contains(@Class, \\\'foo\\\']');
  expect(error.message).not.toContain('.//*[contains(@Class, \'foo\']');
});

it('data-testid on the handle should be relative', async ({ page }) => {
  await page.setContent(`
    <span data-testid="find-me" id=target1>1</span>
    <div>
      <span data-testid="find-me" id=target2>2</span>
    </div>
  `);
  expect(await page.$eval(`data-testid=find-me`, e => e.id)).toBe('target1');

  const div = await page.$('div');
  expect(await div.$eval(`data-testid=find-me`, e => e.id)).toBe('target2');
  expect(await page.$eval(`div >> data-testid=find-me`, e => e.id)).toBe('target2');
});

it('should properly determine visibility of display:contents elements', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/11202' });

  await page.setContent(`
    <div>
      <p style="display:contents">DISPLAY CONTENTS</p>
    </div>`);
  await page.waitForSelector('"DISPLAY CONTENTS"');

  await page.setContent(`
    <div>
      <article style="display:contents"><div>DISPLAY CONTENTS</div></article>
    </div>`);
  await page.waitForSelector('article');

  await page.setContent(`
    <div>
      <article style="display:contents"><div style="display:contents">DISPLAY CONTENTS</div></article>
    </div>`);
  await page.waitForSelector('article');

  await page.setContent(`
    <div>
      <article style="display:contents"><div></div>DISPLAY CONTENTS<span></span></article>
    </div>`);
  await page.waitForSelector('article');

  await page.setContent(`
    <div>
      <article style="display:contents"><div></div></article>
    </div>`);
  await page.waitForSelector('article', { state: 'hidden' });
});

it('should work with internal:has=', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/deep-shadow.html');
  expect(await page.$$eval(`div >> internal:has="#target"`, els => els.length)).toBe(2);
  expect(await page.$$eval(`div >> internal:has="[data-testid=foo]"`, els => els.length)).toBe(3);
  expect(await page.$$eval(`div >> internal:has="[attr*=value]"`, els => els.length)).toBe(2);

  await page.setContent(`<section><span></span><div></div></section><section><br></section>`);
  expect(await page.$$eval(`section >> internal:has="span, div"`, els => els.length)).toBe(1);
  expect(await page.$$eval(`section >> internal:has="span, div"`, els => els.length)).toBe(1);
  expect(await page.$$eval(`section >> internal:has="br"`, els => els.length)).toBe(1);
  expect(await page.$$eval(`section >> internal:has="span, br"`, els => els.length)).toBe(2);
  expect(await page.$$eval(`section >> internal:has="span, br, div"`, els => els.length)).toBe(2);

  await page.setContent(`<div><span>hello</span></div><div><span>world</span></div>`);
  expect(await page.$$eval(`div >> internal:has="text=world"`, els => els.length)).toBe(1);
  expect(await page.$eval(`div >> internal:has="text=world"`, e => e.outerHTML)).toBe(`<div><span>world</span></div>`);
  expect(await page.$$eval(`div >> internal:has="text=\\"hello\\""`, els => els.length)).toBe(1);
  expect(await page.$eval(`div >> internal:has="text=\\"hello\\""`, e => e.outerHTML)).toBe(`<div><span>hello</span></div>`);
  expect(await page.$$eval(`div >> internal:has="xpath=./span"`, els => els.length)).toBe(2);
  expect(await page.$$eval(`div >> internal:has="span"`, els => els.length)).toBe(2);
  expect(await page.$$eval(`div >> internal:has="span >> text=wor"`, els => els.length)).toBe(1);
  expect(await page.$eval(`div >> internal:has="span >> text=wor"`, e => e.outerHTML)).toBe(`<div><span>world</span></div>`);
  expect(await page.$eval(`div >> internal:has="span >> text=wor" >> span`, e => e.outerHTML)).toBe(`<span>world</span>`);

  const error1 = await page.$(`div >> internal:has=abc`).catch(e => e);
  expect(error1.message).toContain('Malformed selector: internal:has=abc');
  const error2 = await page.$(`internal:has="div"`).catch(e => e);
  expect(error2.message).toContain('"internal:has" selector cannot be first');
  const error3 = await page.$(`div >> internal:has=33`).catch(e => e);
  expect(error3.message).toContain('Malformed selector: internal:has=33');
  const error4 = await page.$(`div >> internal:has="span!"`).catch(e => e);
  expect(error4.message).toContain('Unexpected token "!" while parsing selector "span!"');
});

it('should work with internal:has-not=', async ({ page }) => {
  await page.setContent(`<section><span></span><div></div></section><section><br></section>`);
  expect(await page.$$eval(`section >> internal:has-not="span"`, els => els.length)).toBe(1);
  expect(await page.$$eval(`section >> internal:has-not="span, div, br"`, els => els.length)).toBe(0);
  expect(await page.$$eval(`section >> internal:has-not="br"`, els => els.length)).toBe(1);
  expect(await page.$$eval(`section >> internal:has-not="span, div"`, els => els.length)).toBe(1);
  expect(await page.$$eval(`section >> internal:has-not="article"`, els => els.length)).toBe(2);
});

it('should work with internal:and=', async ({ page, server }) => {
  await page.setContent(`
    <div class=foo>hello</div><div class=bar>world</div>
    <span class=foo>hello2</span><span class=bar>world2</span>
  `);
  expect(await page.$$eval(`div >> internal:and="span"`, els => els.map(e => e.textContent))).toEqual([]);
  expect(await page.$$eval(`div >> internal:and=".foo"`, els => els.map(e => e.textContent))).toEqual(['hello']);
  expect(await page.$$eval(`div >> internal:and=".bar"`, els => els.map(e => e.textContent))).toEqual(['world']);
  expect(await page.$$eval(`span >> internal:and="span"`, els => els.map(e => e.textContent))).toEqual(['hello2', 'world2']);
  expect(await page.$$eval(`.foo >> internal:and="div"`, els => els.map(e => e.textContent))).toEqual(['hello']);
  expect(await page.$$eval(`.bar >> internal:and="span"`, els => els.map(e => e.textContent))).toEqual(['world2']);
});

it('should work with internal:or=', async ({ page, server }) => {
  await page.setContent(`
    <div>hello</div>
    <span>world</span>
  `);
  expect(await page.$$eval(`div >> internal:or="span"`, els => els.map(e => e.textContent))).toEqual(['hello', 'world']);
  expect(await page.$$eval(`span >> internal:or="div"`, els => els.map(e => e.textContent))).toEqual(['hello', 'world']);
  expect(await page.$$eval(`article >> internal:or="something"`, els => els.length)).toBe(0);
  expect(await page.locator(`article >> internal:or="div"`).textContent()).toBe('hello');
  expect(await page.locator(`article >> internal:or="span"`).textContent()).toBe('world');
  expect(await page.locator(`div >> internal:or="article"`).textContent()).toBe('hello');
  expect(await page.locator(`span >> internal:or="article"`).textContent()).toBe('world');
});

it('should work with internal:chain=', async ({ page, server }) => {
  await page.setContent(`
    <div>one <span>two</span> <button>three</button> </div>
    <span>four</span>
    <button>five</button>
  `);
  expect(await page.$$eval(`div >> internal:chain="button"`, els => els.map(e => e.textContent))).toEqual(['three']);
  expect(await page.$$eval(`div >> internal:chain="span >> internal:or=\\"button\\""`, els => els.map(e => e.textContent))).toEqual(['two', 'three']);
});

it('chaining should work with large DOM @smoke', async ({ page, server }) => {
  await page.evaluate(() => {
    let last = document.body;
    for (let i = 0; i < 100; i++) {
      const e = document.createElement('div');
      last.appendChild(e);
      last = e;
    }
    const target = document.createElement('span');
    target.textContent = 'Found me!';
    last.appendChild(target);
  });

  // Naive implementation generates C(100, 9) ~= 1.9*10^12 entries.
  const selectors = [
    'div >> div >> div >> div >> div >> div >> div >> div >> span',
    'div div div div div div div div span',
    'div div >> div div >> div div >> div div >> span',
  ];

  const counts = [];
  const times = [];
  for (const selector of selectors) {
    const time = Date.now();
    counts.push(await page.$$eval(selector, els => els.length));
    times.push({ selector, time: Date.now() - time });
  }
  expect(counts).toEqual([1, 1, 1]);
  // Uncomment to see performance results.
  // console.log(times);
});
