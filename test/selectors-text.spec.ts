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

it('query', async ({page, isWebKit}) => {
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
  expect(error.message).toContain(isWebKit ? 'SyntaxError' : 'querySelector');
  error = await page.$(`'`).catch(e => e);
  expect(error.message).toContain(isWebKit ? 'SyntaxError' : 'querySelector');

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

it('create', async ({page}) => {
  await page.setContent(`<div>yo</div><div>"ya</div><div>ye ye</div>`);
  expect(await (await page.$('div') as any)._createSelectorForTest('text')).toBe('yo');
  expect(await (await page.$('div:nth-child(2)') as any)._createSelectorForTest('text')).toBe('"\\"ya"');
  expect(await (await page.$('div:nth-child(3)') as any)._createSelectorForTest('text')).toBe('"ye ye"');

  await page.setContent(`<div>yo</div><div>yo<div>ya</div>hey</div>`);
  expect(await (await page.$('div:nth-child(2)') as any)._createSelectorForTest('text')).toBe('hey');

  await page.setContent(`<div> yo <div></div>ya</div>`);
  expect(await (await page.$('div') as any)._createSelectorForTest('text')).toBe('yo');

  await page.setContent(`<div> "yo <div></div>ya</div>`);
  expect(await (await page.$('div') as any)._createSelectorForTest('text')).toBe('" \\"yo "');
});

it('should be case sensitive if quotes are specified', async ({page}) => {
  await page.setContent(`<div>yo</div><div>ya</div><div>\nye  </div>`);
  expect(await page.$eval(`text=yA`, e => e.outerHTML)).toBe('<div>ya</div>');
  expect(await page.$(`text="yA"`)).toBe(null);
});

it('should search for a substring without quotes', async ({page}) => {
  await page.setContent(`<div>textwithsubstring</div>`);
  expect(await page.$eval(`text=with`, e => e.outerHTML)).toBe('<div>textwithsubstring</div>');
  expect(await page.$(`text="with"`)).toBe(null);
});

it('should skip head, script and style', async ({page}) => {
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

it('should match input[type=button|submit]', async ({page}) => {
  await page.setContent(`<input type="submit" value="hello"><input type="button" value="world">`);
  expect(await page.$eval(`text=hello`, e => e.outerHTML)).toBe('<input type="submit" value="hello">');
  expect(await page.$eval(`text=world`, e => e.outerHTML)).toBe('<input type="button" value="world">');
});

it('should work for open shadow roots', async ({page, server}) => {
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

it('should prioritize light dom over shadow dom in the same parent', async ({page, server}) => {
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

it('should waitForSelector with distributed elements', async ({page, server}) => {
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

it('should match root after >>', async ({page, server}) => {
  await page.setContent('<section>test</section>');
  const element = await page.$('css=section >> text=test');
  expect(element).toBeTruthy();
  const element2 = await page.$('text=test >> text=test');
  expect(element2).toBeTruthy();
});
