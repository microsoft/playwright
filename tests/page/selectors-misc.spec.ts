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

it('should work for open shadow roots', async ({page, server}) => {
  await page.goto(server.PREFIX + '/deep-shadow.html');
  expect(await page.$eval(`id=target`, e => e.textContent)).toBe('Hello from root2');
  expect(await page.$eval(`data-testid=foo`, e => e.textContent)).toBe('Hello from root1');
  expect(await page.$$eval(`data-testid=foo`, els => els.length)).toBe(3);
  expect(await page.$(`id:light=target`)).toBe(null);
  expect(await page.$(`data-testid:light=foo`)).toBe(null);
  expect(await page.$$(`data-testid:light=foo`)).toEqual([]);
});

it('should click on links in shadow dom', async ({page, server, browserName, browserMajorVersion, isElectron, isAndroid}) => {
  it.fixme(browserName === 'chromium' && browserMajorVersion < 91, 'Remove when crrev.com/864024 gets to the stable channel');
  it.fixme(isAndroid);
  it.fixme(isElectron);

  await page.goto(server.PREFIX + '/shadow-dom-link.html');
  expect(await page.evaluate(() => (window as any).clickCount)).toBe(0);
  await page.click('#inner-link');
  expect(await page.evaluate(() => (window as any).clickCount)).toBe(1);
});

it('should work with :visible', async ({page}) => {
  await page.setContent(`
    <section>
      <div id=target1></div>
      <div id=target2></div>
    </section>
  `);
  expect(await page.$('div:visible')).toBe(null);

  const error = await page.waitForSelector(`div:visible`, { timeout: 100 }).catch(e => e);
  expect(error.message).toContain('100ms');

  const promise = page.waitForSelector(`div:visible`, { state: 'attached' });
  await page.$eval('#target2', div => div.textContent = 'Now visible');
  const element = await promise;
  expect(await element.evaluate(e => e.id)).toBe('target2');

  expect(await page.$eval('div:visible', div => div.id)).toBe('target2');
});

it('should work with :nth-match', async ({page}) => {
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

it('should work with position selectors', async ({page}) => {
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
