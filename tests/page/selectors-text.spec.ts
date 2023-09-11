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

it('should work @smoke', async ({ page }) => {
  await page.setContent(`<div>yo</div><div>ya</div><div>\nye  </div>`);
  expect(await page.$eval(`text=ya`, e => e.outerHTML)).toBe('<div>ya</div>');
  expect(await page.$eval(`text="ya"`, e => e.outerHTML)).toBe('<div>ya</div>');
  expect(await page.$eval(`text=/^[ay]+$/`, e => e.outerHTML)).toBe('<div>ya</div>');
  expect(await page.$eval(`text=/Ya/i`, e => e.outerHTML)).toBe('<div>ya</div>');
  expect(await page.$eval(`text=ye`, e => e.outerHTML)).toBe('<div>\nye  </div>');
  expect(await page.getByText('ye').evaluate(e => e.outerHTML)).toContain('>\nye  </div>');

  await page.setContent(`<div> ye </div><div>ye</div>`);
  expect(await page.$eval(`text="ye"`, e => e.outerHTML)).toBe('<div> ye </div>');
  expect(await page.getByText('ye', { exact: true }).first().evaluate(e => e.outerHTML)).toContain('> ye </div>');

  await page.setContent(`<div>yo</div><div>"ya</div><div> hello world! </div>`);
  expect(await page.$eval(`text="\\"ya"`, e => e.outerHTML)).toBe('<div>"ya</div>');
  expect(await page.$eval(`text=/hello/`, e => e.outerHTML)).toBe('<div> hello world! </div>');
  expect(await page.$eval(`text=/^\\s*heLLo/i`, e => e.outerHTML)).toBe('<div> hello world! </div>');

  await page.setContent(`<div>yo<div>ya</div>hey<div>hey</div></div>`);
  expect(await page.$eval(`text=hey`, e => e.outerHTML)).toBe('<div>hey</div>');
  expect(await page.$eval(`text=yo>>text="ya"`, e => e.outerHTML)).toBe('<div>ya</div>');
  expect(await page.$eval(`text=yo>> text="ya"`, e => e.outerHTML)).toBe('<div>ya</div>');
  expect(await page.$eval(`text=yo >>text='ya'`, e => e.outerHTML)).toBe('<div>ya</div>');
  expect(await page.$eval(`text=yo >> text='ya'`, e => e.outerHTML)).toBe('<div>ya</div>');
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
  expect(error).toBeInstanceOf(Error);
  error = await page.$(`'`).catch(e => e);
  expect(error).toBeInstanceOf(Error);

  await page.setContent(`<div> ' </div><div> " </div>`);
  expect(await page.$eval(`text="`, e => e.outerHTML)).toBe('<div> " </div>');
  expect(await page.$eval(`text='`, e => e.outerHTML)).toBe('<div> \' </div>');

  await page.setContent(`<div>Hi''&gt;&gt;foo=bar</div>`);
  expect(await page.$eval(`text="Hi''>>foo=bar"`, e => e.outerHTML)).toBe(`<div>Hi''&gt;&gt;foo=bar</div>`);
  await page.setContent(`<div>Hi'"&gt;&gt;foo=bar</div>`);
  expect(await page.$eval(`text="Hi'\\">>foo=bar"`, e => e.outerHTML)).toBe(`<div>Hi'"&gt;&gt;foo=bar</div>`);

  await page.setContent(`<div>Hi&gt;&gt;<span></span></div>`);
  expect(await page.$eval(`text="Hi>>">>span`, e => e.outerHTML)).toBe(`<span></span>`);
  expect(await page.$eval(`text=/Hi\\>\\>/ >> span`, e => e.outerHTML)).toBe(`<span></span>`);

  await page.setContent(`<div>a<br>b</div><div>a</div>`);
  expect(await page.$eval(`text=a`, e => e.outerHTML)).toBe('<div>a<br>b</div>');
  expect(await page.$eval(`text=b`, e => e.outerHTML)).toBe('<div>a<br>b</div>');
  expect(await page.$eval(`text=ab`, e => e.outerHTML)).toBe('<div>a<br>b</div>');
  expect(await page.$(`text=abc`)).toBe(null);
  expect(await page.$$eval(`text=a`, els => els.length)).toBe(2);
  expect(await page.$$eval(`text=b`, els => els.length)).toBe(1);
  expect(await page.$$eval(`text=ab`, els => els.length)).toBe(1);
  expect(await page.$$eval(`text=abc`, els => els.length)).toBe(0);

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

  await page.setContent(`<span>Sign&nbsp;in</span><span>Hello\n \nworld</span>`);
  expect(await page.$eval(`text=Sign in`, e => e.outerHTML)).toBe('<span>Sign&nbsp;in</span>');
  expect((await page.$$(`text=Sign \tin`)).length).toBe(1);
  expect((await page.$$(`text="Sign in"`)).length).toBe(1);
  expect(await page.$eval(`text=lo wo`, e => e.outerHTML)).toBe('<span>Hello\n \nworld</span>');
  expect(await page.$eval(`text="Hello world"`, e => e.outerHTML)).toBe('<span>Hello\n \nworld</span>');
  expect(await page.$(`text="lo wo"`)).toBe(null);
  expect((await page.$$(`text=lo \nwo`)).length).toBe(1);
  expect((await page.$$(`text="lo \nwo"`)).length).toBe(0);

  await page.setContent(`<div>let's<span>hello</span></div>`);
  expect(await page.$eval(`text=/let's/i >> span`, e => e.outerHTML)).toBe('<span>hello</span>');
  expect(await page.$eval(`text=/let\\'s/i >> span`, e => e.outerHTML)).toBe('<span>hello</span>');
});

it('should work with :text', async ({ page }) => {
  await page.setContent(`<div>yo</div><div>ya</div><div>\nHELLO   \n world  </div>`);
  expect(await page.$eval(`:text("ya")`, e => e.outerHTML)).toBe('<div>ya</div>');
  expect(await page.$eval(`:text-is("ya")`, e => e.outerHTML)).toBe('<div>ya</div>');
  expect(await page.$eval(`:text("y")`, e => e.outerHTML)).toBe('<div>yo</div>');
  expect(await page.$(`:text-is("Y")`)).toBe(null);
  expect(await page.$eval(`:text("hello world")`, e => e.outerHTML)).toBe('<div>\nHELLO   \n world  </div>');
  expect(await page.$eval(`:text-is("HELLO world")`, e => e.outerHTML)).toBe('<div>\nHELLO   \n world  </div>');
  expect(await page.$eval(`:text("lo wo")`, e => e.outerHTML)).toBe('<div>\nHELLO   \n world  </div>');
  expect(await page.$(`:text-is("lo wo")`)).toBe(null);
  expect(await page.$eval(`:text-matches("^[ay]+$")`, e => e.outerHTML)).toBe('<div>ya</div>');
  expect(await page.$eval(`:text-matches("y", "g")`, e => e.outerHTML)).toBe('<div>yo</div>');
  expect(await page.$eval(`:text-matches("Y", "i")`, e => e.outerHTML)).toBe('<div>yo</div>');
  expect(await page.$(`:text-matches("^y$")`)).toBe(null);

  const error1 = await page.$(`:text("foo", "bar")`).catch(e => e);
  expect(error1.message).toContain(`"text" engine expects a single string`);
  const error2 = await page.$(`:text(foo > bar)`).catch(e => e);
  expect(error2.message).toContain(`"text" engine expects a single string`);
});

it('should support empty string', async ({ page }) => {
  await page.setContent(`<div></div><div>ya</div><div>\nHELLO   \n world  </div>`);
  expect(await page.$eval(`div:text-is("")`, e => e.outerHTML)).toBe('<div></div>');
  expect(await page.$$eval(`div:text-is("")`, els => els.length)).toBe(1);
  expect(await page.$eval(`div:text("")`, e => e.outerHTML)).toBe('<div></div>');
  expect(await page.$$eval(`div:text("")`, els => els.length)).toBe(3);
  expect(await page.$eval(`div >> text=""`, e => e.outerHTML)).toBe('<div></div>');
  expect(await page.$$eval(`div >> text=""`, els => els.length)).toBe(1);
  expect(await page.$eval(`div >> text=/^$/`, e => e.outerHTML)).toBe('<div></div>');
  expect(await page.$$eval(`div >> text=/^$/`, els => els.length)).toBe(1);
  expect(await page.$eval(`div:text-matches("")`, e => e.outerHTML)).toBe('<div></div>');
  expect(await page.$$eval(`div:text-matches("")`, els => els.length)).toBe(3);
});

it('should work across nodes', async ({ page }) => {
  await page.setContent(`<div id=target1>Hello<i>,</i> <span id=target2>world</span><b>!</b></div>`);

  expect(await page.$eval(`:text("Hello, world!")`, e => e.id)).toBe('target1');
  expect(await page.$eval(`:text("Hello")`, e => e.id)).toBe('target1');
  expect(await page.$eval(`:text("world")`, e => e.id)).toBe('target2');
  expect(await page.$$eval(`:text("world")`, els => els.length)).toBe(1);
  expect(await page.$(`:text("hello world")`)).toBe(null);
  expect(await page.$(`div:text("world")`)).toBe(null);
  expect(await page.$eval(`text=Hello, world!`, e => e.id)).toBe('target1');
  expect(await page.$eval(`text=Hello`, e => e.id)).toBe('target1');
  expect(await page.$eval(`text=world`, e => e.id)).toBe('target2');
  expect(await page.$$eval(`text=world`, els => els.length)).toBe(1);
  expect(await page.$(`text=hello world`)).toBe(null);

  expect(await page.$(`:text-is("Hello, world!")`)).toBe(null);
  expect(await page.$eval(`:text-is("Hello")`, e => e.id)).toBe('target1');
  expect(await page.$eval(`:text-is("world")`, e => e.id)).toBe('target2');
  expect(await page.$$eval(`:text-is("world")`, els => els.length)).toBe(1);
  expect(await page.$(`text="Hello, world!"`)).toBe(null);
  expect(await page.$eval(`text="Hello"`, e => e.id)).toBe('target1');
  expect(await page.$eval(`text="world"`, e => e.id)).toBe('target2');
  expect(await page.$$eval(`text="world"`, els => els.length)).toBe(1);

  expect(await page.$eval(`:text-matches(".*")`, e => e.nodeName)).toBe('I');
  expect(await page.$eval(`:text-matches("world?")`, e => e.id)).toBe('target2');
  expect(await page.$$eval(`:text-matches("world")`, els => els.length)).toBe(1);
  expect(await page.$(`div:text(".*")`)).toBe(null);
  expect(await page.$eval(`text=/.*/`, e => e.nodeName)).toBe('I');
  expect(await page.$eval(`text=/world?/`, e => e.id)).toBe('target2');
  expect(await page.$$eval(`text=/world/`, els => els.length)).toBe(1);
});

it('should work with text nodes in quoted mode', async ({ page }) => {
  await page.setContent(`<div id=target1>Hello<span id=target2>wo  rld  </span>  Hi again  </div>`);
  expect(await page.$eval(`text="Hello"`, e => e.id)).toBe('target1');
  expect(await page.$eval(`text="Hi again"`, e => e.id)).toBe('target1');
  expect(await page.$eval(`text="wo rld"`, e => e.id)).toBe('target2');
  expect(await page.$(`text="Hellowo rld Hi again"`)).toBe(null);
  expect(await page.$(`text="Hellowo"`)).toBe(null);
  expect(await page.$(`text="Hellowo rld"`)).toBe(null);
  expect(await page.$(`text="wo rld Hi ag"`)).toBe(null);
  expect(await page.$(`text="again"`)).toBe(null);
  expect(await page.$(`text="hi again"`)).toBe(null);
  expect(await page.$eval(`text=hi again`, e => e.id)).toBe('target1');
});

it('should clear caches', async ({ page }) => {
  await page.setContent(`<div id=target1>text</div><div id=target2>text</div>`);
  const div = await page.$('#target1');

  await div.evaluate(div => div.textContent = 'text');
  expect(await page.$eval(`text=text`, e => e.id)).toBe('target1');
  await div.evaluate(div => div.textContent = 'foo');
  expect(await page.$eval(`text=text`, e => e.id)).toBe('target2');

  await div.evaluate(div => div.textContent = 'text');
  expect(await page.$eval(`:text("text")`, e => e.id)).toBe('target1');
  await div.evaluate(div => div.textContent = 'foo');
  expect(await page.$eval(`:text("text")`, e => e.id)).toBe('target2');

  await div.evaluate(div => div.textContent = 'text');
  expect(await page.$$eval(`text=text`, els => els.length)).toBe(2);
  await div.evaluate(div => div.textContent = 'foo');
  expect(await page.$$eval(`text=text`, els => els.length)).toBe(1);

  await div.evaluate(div => div.textContent = 'text');
  expect(await page.$$eval(`:text("text")`, els => els.length)).toBe(2);
  await div.evaluate(div => div.textContent = 'foo');
  expect(await page.$$eval(`:text("text")`, els => els.length)).toBe(1);
});

it('should work with :has-text', async ({ page }) => {
  await page.setContent(`
    <input id=input2>
    <div id=div1>
      <span>  Find me  </span>
      or
      <wrap><span id=span2>maybe me  </span></wrap>
      <div><input id=input1></div>
    </div>
  `);
  expect(await page.$eval(`:has-text("find me")`, e => e.tagName)).toBe('HTML');
  expect(await page.$eval(`span:has-text("find me")`, e => e.outerHTML)).toBe('<span>  Find me  </span>');
  expect(await page.$eval(`div:has-text("find me")`, e => e.id)).toBe('div1');
  expect(await page.$eval(`div:has-text("find me") input`, e => e.id)).toBe('input1');
  expect(await page.$eval(`:has-text("find me") input`, e => e.id)).toBe('input2');
  expect(await page.$eval(`div:has-text("find me or maybe me")`, e => e.id)).toBe('div1');
  expect(await page.$(`div:has-text("find noone")`)).toBe(null);
  expect(await page.$$eval(`:is(div,span):has-text("maybe")`, els => els.map(e => e.id).join(';'))).toBe('div1;span2');
  expect(await page.$eval(`div:has-text("find me") :has-text("maybe me")`, e => e.tagName)).toBe('WRAP');
  expect(await page.$eval(`div:has-text("find me") span:has-text("maybe me")`, e => e.id)).toBe('span2');

  await page.setContent(`<div id=me>hello
  wo"r>>ld</div>`);
  expect(await page.$eval(`div:has-text("hello wo\\"r>>ld")`, e => e.id)).toBe('me');
  expect(await page.$eval(`div:has-text("hello\\a wo\\"r>>ld")`, e => e.id)).toBe('me');
  expect(await page.locator('div', { hasText: 'hello\nwo"r>>ld' }).getAttribute('id')).toBe('me');

  const error1 = await page.$(`:has-text("foo", "bar")`).catch(e => e);
  expect(error1.message).toContain(`"has-text" engine expects a single string`);
  const error2 = await page.$(`:has-text(foo > bar)`).catch(e => e);
  expect(error2.message).toContain(`"has-text" engine expects a single string`);
});

it('should work with large DOM', async ({ page }) => {
  await page.evaluate(() => {
    let id = 0;
    const next = (tag: string) => {
      const e = document.createElement(tag);
      const eid = ++id;
      e.textContent = 'id' + eid;
      e.id = 'id' + eid;
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
    ':has-text("id18")',
    ':has-text("id12345")',
    ':has-text("id")',
    ':text("id18")',
    ':text("id12345")',
    ':text("id")',
    ':text-matches("id12345", "i")',
    'text=id18',
    'text=id12345',
    'text=id',
    '#id18',
    '#id12345',
    '*',
  ];

  const measure = false;
  for (const selector of selectors) {
    const time1 = Date.now();
    for (let i = 0; i < (measure ? 10 : 1); i++)
      await page.$$eval(selector, els => els.length);
    if (measure)
      console.log(`pw("${selector}"): ` + (Date.now() - time1));

    if (measure && !selector.includes('text')) {
      const time2 = Date.now();
      for (let i = 0; i < (measure ? 10 : 1); i++)
        await page.evaluate(selector => document.querySelectorAll(selector).length, selector);
      console.log(`qs("${selector}"): ` + (Date.now() - time2));
    }
  }
});

it('should be case sensitive if quotes are specified', async ({ page }) => {
  await page.setContent(`<div>yo</div><div>ya</div><div>\nye  </div>`);
  expect(await page.$eval(`text=yA`, e => e.outerHTML)).toBe('<div>ya</div>');
  expect(await page.$(`text="yA"`)).toBe(null);
  expect(await page.$(`text= "ya"`)).toBe(null);
});

it('should search for a substring without quotes', async ({ page }) => {
  await page.setContent(`<div>textwithsubstring</div>`);
  expect(await page.$eval(`text=with`, e => e.outerHTML)).toBe('<div>textwithsubstring</div>');
  expect(await page.$(`text="with"`)).toBe(null);
});

it('should skip head, script and style', async ({ page }) => {
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

it('should match input[type=button|submit]', async ({ page }) => {
  await page.setContent(`<input type="submit" value="hello"><input type="button" value="world">`);
  expect(await page.$eval(`text=hello`, e => e.outerHTML)).toBe('<input type="submit" value="hello">');
  expect(await page.$eval(`text=world`, e => e.outerHTML)).toBe('<input type="button" value="world">');
});

it('should work for open shadow roots', async ({ page, server }) => {
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

it('should prioritize light dom over shadow dom in the same parent', async ({ page, server }) => {
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

it('should waitForSelector with distributed elements', async ({ page, server }) => {
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

it('should match root after >>', async ({ page, server }) => {
  await page.setContent('<section>test</section>');
  const element = await page.$('css=section >> text=test');
  expect(element).toBeTruthy();
  const element2 = await page.$('text=test >> text=test');
  expect(element2).toBeTruthy();
});

it('should match root after >> with *', async ({ page }) => {
  await page.setContent(`<button> hello world </button> <button> hellow <span> world </span> </button>`);
  expect(await page.$$eval('*css=button >> text=hello >> text=world', els => els.length)).toBe(2);
});

it('should work with leading and trailing spaces', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/10997' });
  await page.setContent(`<button> Add widget </button>`);
  await expect(page.locator('text=Add widget')).toBeVisible();
  await expect(page.locator('text= Add widget ')).toBeVisible();
});

it('should work with unpaired quotes when not at the start', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/12719' });
  await page.setContent(`
    <div>hello"world<span>yay</span></div>
    <div>hello'world<span>nay</span></div>
    <div>hello\`world<span>oh</span></div>
    <div>hello\`world<span>oh2</span></div>
  `);
  expect(await page.$eval('text=lo" >> span', e => e.outerHTML)).toBe('<span>yay</span>');
  expect(await page.$eval('  text=lo" >> span', e => e.outerHTML)).toBe('<span>yay</span>');
  expect(await page.$eval('text  =lo" >> span', e => e.outerHTML)).toBe('<span>yay</span>');
  expect(await page.$eval('text=  lo" >> span', e => e.outerHTML)).toBe('<span>yay</span>');
  expect(await page.$eval(' text = lo" >> span', e => e.outerHTML)).toBe('<span>yay</span>');
  expect(await page.$eval('text=o"wor >> span', e => e.outerHTML)).toBe('<span>yay</span>');

  expect(await page.$eval(`text=lo'wor >> span`, e => e.outerHTML)).toBe('<span>nay</span>');
  expect(await page.$eval(`text=o' >> span`, e => e.outerHTML)).toBe('<span>nay</span>');

  expect(await page.$eval(`text=ello\`wor >> span`, e => e.outerHTML)).toBe('<span>oh</span>');
  await expect(page.locator(`text=ello\`wor`).locator('span').first()).toHaveText('oh');
  await expect(page.locator(`text=ello\`wor`).locator('span').nth(1)).toHaveText('oh2');

  expect(await page.$(`text='wor >> span`)).toBe(null);
  expect(await page.$(`text=" >> span`)).toBe(null);
  expect(await page.$(`text=\` >> span`)).toBe(null);
});

it('should work with paired quotes in the middle of selector', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/16858' });
  await page.setContent(`<div>pattern "^-?\\d+$"</div>`);
  expect(await page.locator(`div >> text=pattern "^-?\\d+$`).isVisible());
  expect(await page.locator(`div >> text=pattern "^-?\\d+$"`).isVisible());
  // Should double escape inside quoted text.
  expect(await page.locator(`div >> text='pattern "^-?\\\\d+$"'`).isVisible());
  await expect(page.locator(`div >> text=pattern "^-?\\d+$`)).toBeVisible();
  await expect(page.locator(`div >> text=pattern "^-?\\d+$"`)).toBeVisible();
  // Should double escape inside quoted text.
  await expect(page.locator(`div >> text='pattern "^-?\\\\d+$"'`)).toBeVisible();
});

it('hasText and internal:text should match full node text in strict mode', async ({ page }) => {
  await page.setContent(`
    <div id=div1>hello<span>world</span></div>
    <div id=div2>hello</div>
  `);
  await expect(page.getByText('helloworld', { exact: true })).toHaveId('div1');
  await expect(page.getByText('hello', { exact: true })).toHaveId('div2');
  await expect(page.locator('div', { hasText: /^helloworld$/ })).toHaveId('div1');
  await expect(page.locator('div', { hasText: /^hello$/ })).toHaveId('div2');

  await page.setContent(`
    <div id=div1><span id=span1>hello</span>world</div>
    <div id=div2><span id=span2>hello</span></div>
  `);
  await expect(page.getByText('helloworld', { exact: true })).toHaveId('div1');
  expect(await page.getByText('hello', { exact: true }).evaluateAll(els => els.map(e => e.id))).toEqual(['span1', 'span2']);
  await expect(page.locator('div', { hasText: /^helloworld$/ })).toHaveId('div1');
  await expect(page.locator('div', { hasText: /^hello$/ })).toHaveId('div2');
});
