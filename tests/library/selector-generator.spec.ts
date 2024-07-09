/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { contextTest as it, expect } from '../config/browserTest';
import type { Page, Frame } from 'playwright-core';

async function generate(pageOrFrame: Page | Frame, target: string): Promise<string> {
  return pageOrFrame.$eval(target, e => (window as any).playwright.selector(e));
}

async function generateMultiple(pageOrFrame: Page | Frame, target: string): Promise<string> {
  return pageOrFrame.$eval(target, e => (window as any).__injectedScript.generateSelector(e, { multiple: true, testIdAttributeName: 'data-testid' }).selectors);
}

it.describe('selector generator', () => {
  it.skip(({ mode }) => mode !== 'default');

  it.beforeEach(async ({ context }) => {
    await (context as any)._enableRecorder({ language: 'javascript' });
  });

  it('should prefer button over inner span', async ({ page }) => {
    await page.setContent(`<button><span>text</span></button>`);
    expect(await generate(page, 'span')).toBe('internal:role=button[name="text"i]');
  });

  it('should prefer role=button over inner span', async ({ page }) => {
    await page.setContent(`<div role=button><span>text</span></div>`);
    expect(await generate(page, 'span')).toBe('internal:role=button[name="text"i]');
  });

  it('should not prefer zero-sized button over inner span', async ({ page }) => {
    await page.setContent(`
      <button style="width:0;height:0;padding:0;border:0;overflow:visible;">
        <span style="width:100px;height:100px;">text</span>
      </button>
    `);
    expect(await generate(page, 'span')).toBe('internal:text="text"i');
  });

  it('should generate text and normalize whitespace', async ({ page }) => {
    await page.setContent(`<div>Text  some\n\n\n more \t text   </div>`);
    expect(await generate(page, 'div')).toBe('internal:text="Text some more text"i');
  });

  it('should not escape spaces inside named attr selectors', async ({ page }) => {
    await page.setContent(`<input placeholder="Foo b ar"/>`);
    expect(await generate(page, 'input')).toBe('internal:attr=[placeholder=\"Foo b ar\"i]');
  });

  it('should generate text for <input type=button>', async ({ page }) => {
    await page.setContent(`<input type=button value="Click me">`);
    expect(await generate(page, 'input')).toBe('internal:role=button[name=\"Click me\"i]');
  });

  it('should trim text', async ({ page }) => {
    await page.setContent(`
      <div>Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789</div>
      <div>Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789!Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789</div>
    `);
    expect(await generate(page, 'div')).toBe('internal:text="Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text012345"i');
  });

  it('should try to improve role name', async ({ page }) => {
    await page.setContent(`<div role=button>Issues 23</div>`);
    expect(await generate(page, 'div')).toBe('internal:role=button[name="Issues"i]');
  });

  it('should try to improve text', async ({ page }) => {
    await page.setContent(`<div>23 Issues</div>`);
    expect(await generate(page, 'div')).toBe('internal:text="Issues"i');
  });

  it('should try to improve text by shortening', async ({ page }) => {
    await page.setContent(`<div>Longest verbose description of the item</div>`);
    expect(await generate(page, 'div')).toBe('internal:text="Longest verbose description"i');
  });

  it('should try to improve label text by shortening', async ({ page }) => {
    await page.setContent(`<label>Longest verbose description of the item<input></label>`);
    expect(await generate(page, 'input')).toBe('internal:label="Longest verbose description"i');
  });

  it('should not improve guid text', async ({ page }) => {
    await page.setContent(`<div>91b1b23</div>`);
    expect(await generate(page, 'div')).toBe('internal:text="91b1b23"i');
  });

  it('should not escape text with >>', async ({ page }) => {
    await page.setContent(`<div>text&gt;&gt;text</div>`);
    expect(await generate(page, 'div')).toBe('internal:text="text>>text"i');
  });

  it('should escape text with quote', async ({ page }) => {
    await page.setContent(`<div>text"text</div>`);
    expect(await generate(page, 'div')).toBe('internal:text="text\\\"text"i');
  });

  it('should escape text with slash', async ({ page }) => {
    await page.setContent(`<div>/text</div>`);
    expect(await generate(page, 'div')).toBe('internal:text="\/text"i');
  });

  it('should not use text for select', async ({ page }) => {
    await page.setContent(`
      <select><option>foo</option></select>
      <select mark=1><option>bar</option></select>
    `);
    expect(await generate(page, '[mark="1"]')).toBe('internal:role=combobox >> nth=1');
  });

  it('should use ordinal for identical nodes', async ({ page }) => {
    await page.setContent(`<div>Text</div><div>Text</div><div mark=1>Text</div><div>Text</div>`);
    expect(await generate(page, 'div[mark="1"]')).toBe(`internal:text="Text"i >> nth=2`);
  });

  it('should prefer data-testid', async ({ page }) => {
    await page.setContent(`<div>Text</div><div>Text</div><div data-testid=a>Text</div><div>Text</div>`);
    expect(await generate(page, '[data-testid="a"]')).toBe('internal:testid=[data-testid=\"a\"s]');
  });

  it('should use data-testid in strict errors', async ({ page, playwright }) => {
    playwright.selectors.setTestIdAttribute('data-custom-id');
    await page.setContent(`
      <div>
        <div></div>
        <div>
          <div></div>
          <div></div>
        </div>
      </div>
      <div>
        <div class='foo bar:0' data-custom-id='One'>
        </div>
        <div class='foo bar:1' data-custom-id='Two'>
        </div>
      </div>`);
    const error = await page.locator('.foo').hover().catch(e => e);
    expect(error.message).toContain('strict mode violation');
    expect(error.message).toContain('<div class=\"foo bar:0');
    expect(error.message).toContain('<div class=\"foo bar:1');
    expect(error.message).toContain(`aka getByTestId('One')`);
    expect(error.message).toContain(`aka getByTestId('Two')`);
  });

  it('should handle first non-unique data-testid', async ({ page }) => {
    await page.setContent(`
      <div data-testid=a mark=1>
        Text
      </div>
      <div data-testid=a>
        Text
      </div>`);
    expect(await generate(page, 'div[mark="1"]')).toBe('internal:testid=[data-testid=\"a\"s] >> nth=0');
  });

  it('should handle second non-unique data-testid', async ({ page }) => {
    await page.setContent(`
      <div data-testid=a>
        Text
      </div>
      <div data-testid=a mark=1>
        Text
      </div>`);
    expect(await generate(page, 'div[mark="1"]')).toBe(`internal:testid=[data-testid=\"a\"s] >> nth=1`);
  });

  it('should use readable id', async ({ page }) => {
    await page.setContent(`
      <div></div>
      <div id=first-item mark=1></div>
    `);
    expect(await generate(page, 'div[mark="1"]')).toBe('#first-item');
  });

  it('should not use generated id', async ({ page }) => {
    await page.setContent(`
      <div></div>
      <div id=aAbBcCdDeE mark=1></div>
    `);
    expect(await generate(page, 'div[mark="1"]')).toBe(`div >> nth=1`);
  });

  it('should use internal:has-text', async ({ page }) => {
    await page.setContent(`
      <div>Hello world</div>
      <a>Hello <span>world</span></a>
      <a>Goodbye <span>world</span></a>
    `);
    expect(await generate(page, 'a:has-text("Hello")')).toBe(`a >> internal:has-text="Hello world"i`);
  });

  it('should use internal:has-text with regexp', async ({ page }) => {
    await page.setContent(`
      <span>Hello world</span>
      <div><div>Hello <span>world</span></div>extra</div>
      <a>Goodbye <span>world</span></a>
    `);
    expect(await generate(page, 'div div')).toBe(`div >> internal:has-text=/^Hello world$/`);
  });

  it('should use internal:has-text with regexp with a quote', async ({ page }) => {
    await page.setContent(`
      <span>Hello'world</span>
      <div><div>Hello'<span>world</span></div>extra</div>
      <a>Goodbye'<span>world</span></a>
    `);
    expect(await generate(page, 'div div')).toBe(`div >> internal:has-text=/^Hello\\'world$/`);
  });

  it('should chain text after parent', async ({ page }) => {
    await page.setContent(`
      <div>Hello <span>world</span></div>
      <b>Hello <span mark=1>world</span></b>
    `);
    expect(await generate(page, '[mark="1"]')).toBe(`b >> internal:text="world"i`);
  });

  it('should use parent text', async ({ page }) => {
    await page.setContent(`
      <div>Hello <span>world</span></div>
      <div>Goodbye <span mark=1>world</span></div>
    `);
    expect(await generate(page, '[mark="1"]')).toBe(`div >> internal:has-text="Goodbye world"i >> span`);
  });

  it('should separate selectors by >>', async ({ page }) => {
    await page.setContent(`
      <div>
        <div>Text</div>
      </div>
      <div id="id">
        <div>Text</div>
      </div>
    `);
    expect(await generate(page, '#id > div')).toBe('#id >> internal:text="Text"i');
  });

  it('should trim long text', async ({ page }) => {
    await page.setContent(`
      <div>
        <div>Text that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on</div>
      </div>
      <div id="id">
      <div>Text that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on</div>
      <div>Text that goes on and on and on and on and on and on and on and on and X on and on and on and on and on and on and on</div>
      </div>
    `);
    expect(await generate(page, '#id > div')).toBe(`#id >> internal:text="Text that goes on and on and on and on and on and on and on and on and on and"i`);
  });

  it('should use nested ordinals', async ({ page }) => {
    await page.setContent(`
      <div><c></c><c></c><c></c><c></c><c></c><b></b></div>
      <div>
        <b>
          <c>
          </c>
        </b>
        <b>
          <c mark=1></c>
        </b>
      </div>
      <div><b></b></div>
    `);
    expect(await generate(page, 'c[mark="1"]')).toBe('b:nth-child(2) > c');
  });

  it('should properly join child selectors under nested ordinals', async ({ page }) => {
    await page.setContent(`
      <div><c></c><c></c><c></c><c></c><c></c><b></b></div>
      <div>
        <b>
          <div>
            <c>
            </c>
          </div>
        </b>
        <b>
          <div>
            <c mark=1></c>
          </div>
        </b>
      </div>
      <div><b></b></div>
    `);
    expect(await generate(page, 'c[mark="1"]')).toBe('b:nth-child(2) > div > c');
  });

  it('should not use input[value]', async ({ page }) => {
    await page.setContent(`
      <input value="one">
      <input value="two" mark="1">
      <input value="three">
    `);
    expect(await generate(page, 'input[mark="1"]')).toBe('internal:role=textbox >> nth=1');
  });

  it.describe('should prioritise attributes correctly', () => {
    it('role', async ({ page }) => {
      await page.setContent(`<input name="foobar" type="text"/>`);
      expect(await generate(page, 'input')).toBe('internal:role=textbox');
    });
    it('placeholder', async ({ page }) => {
      await page.setContent(`<input placeholder="foobar" type="text"/>`);
      expect(await generate(page, 'input')).toBe('internal:attr=[placeholder=\"foobar\"i]');
    });
    it('name', async ({ page }) => {
      await page.setContent(`
        <input aria-hidden="false" name="foobar" type="date"/>
        <div role="textbox"/>content</div>
      `);
      expect(await generate(page, 'input')).toBe('input[name="foobar"]');
    });
    it('type', async ({ page }) => {
      await page.setContent(`
        <input aria-hidden="false" type="checkbox"/>
        <div role="checkbox"/>content</div>
      `);
      expect(await generate(page, 'input')).toBe('input[type="checkbox"]');
    });
  });

  it('should find text in shadow dom', async ({ page }) => {
    await page.setContent(`<div></div>`);
    await page.$eval('div', div => {
      const shadowRoot = div.attachShadow({ mode: 'open' });
      const span = document.createElement('span');
      span.textContent = 'Target';
      shadowRoot.appendChild(span);
    });
    expect(await generate(page, 'span')).toBe('internal:text="Target"i');
  });

  it('should match in shadow dom', async ({ page }) => {
    await page.setContent(`<div></div>`);
    await page.$eval('div', div => {
      const shadowRoot = div.attachShadow({ mode: 'open' });
      const input = document.createElement('input');
      shadowRoot.appendChild(input);
    });
    expect(await generate(page, 'input')).toBe('internal:role=textbox');
  });

  it('should match in deep shadow dom', async ({ page }) => {
    await page.setContent(`<div></div><div></div><div><input></div>`);
    await page.$eval('div', div1 => {
      const shadowRoot1 = div1.attachShadow({ mode: 'open' });
      const input1 = document.createElement('input');
      shadowRoot1.appendChild(input1);
      const divExtra3 = document.createElement('div');
      shadowRoot1.append(divExtra3);
      const div2 = document.createElement('div');
      shadowRoot1.append(div2);
      const shadowRoot2 = div2.attachShadow({ mode: 'open' });
      const input2 = document.createElement('input');
      input2.setAttribute('value', 'foo');
      shadowRoot2.appendChild(input2);
    });
    expect(await generate(page, 'input[value=foo]')).toBe('internal:role=textbox >> nth=2');
  });

  it('should work in dynamic iframes without navigation', async ({ page }) => {
    await page.setContent(`<div></div>`);
    const [frame] = await Promise.all([
      page.waitForEvent('frameattached'),
      page.evaluate(() => {
        return new Promise<void>(f => {
          const iframe = document.createElement('iframe');
          iframe.onload = () => {
            iframe.contentDocument.body.innerHTML = '<div>Target</div>';
            f();
          };
          document.body.appendChild(iframe);
        });
      }),
    ]);
    expect(await generate(frame, 'div')).toBe('internal:text="Target"i');
  });

  it('should use the name attributes for elements that can have it', async ({ page }) => {
    for (const tagName of ['button', 'input', 'textarea']) {
      await page.setContent(`<form><${tagName} name="foo"></${tagName}><${tagName} name="bar"></${tagName}></form>`);
      expect(await generate(page, '[name=bar]')).toBe(`${tagName}[name="bar"]`);
    }

    await page.setContent(`<iframe name="foo"></iframe><iframe name="bar"></iframe>`);
    expect(await generate(page, '[name=bar]')).toBe(`iframe[name="bar"]`);

    await page.setContent(`<frameset><frame name="foo"></frame><frame name="bar"></frame></frameset>`);
    expect(await generate(page, '[name=bar]')).toBe(`frame[name="bar"]`);
  });

  it('should work with tricky attributes', async ({ page }) => {
    await page.setContent(`<button id="this:is-my-tricky.id"><span></span></button>`);
    expect(await generate(page, 'button')).toBe('[id="this\\:is-my-tricky\\.id"]');

    await page.setContent(`<ng:switch><span></span></ng:switch>`);
    expect(await generate(page, 'ng\\:switch')).toBe('ng\\:switch');

    await page.setContent(`<button><span></span></button><button></button>`);
    await page.$eval('span', span => span.textContent = `!#'!?:`);
    expect(await generate(page, 'button')).toBe(`internal:role=button[name="!#'!?:"i]`);
    expect(await page.$(`role=button[name="!#'!?:"]`)).toBeTruthy();

    await page.setContent(`<div><span></span></div>`);
    await page.$eval('div', div => div.id = `!#'!?:`);
    expect(await generate(page, 'div')).toBe("[id=\"\\!\\#\\'\\!\\?\\:\"]");
  });

  it('should work without CSS.escape', async ({ page }) => {
    await page.setContent(`<button aria-hidden="false"></button><div role="button"></div>`);
    await page.$eval('button', button => {
      delete window.CSS.escape;
      button.setAttribute('name', '-tricky\u0001name');
    });
    expect(await generate(page, 'button')).toBe(`button[name="-tricky\\1 name"]`);
  });

  it('should ignore empty aria-label for candidate consideration', async ({ page }) => {
    await page.setContent(`<button aria-label="" id="buttonId"></button>`);
    expect(await generate(page, 'button')).toBe('#buttonId');
  });

  it('should accept valid aria-label for candidate consideration', async ({ page }) => {
    await page.setContent(`<button aria-label="ariaLabel" id="buttonId"></button>`);
    expect(await generate(page, 'button')).toBe('internal:label="ariaLabel"i');
  });

  it('should ignore empty role for candidate consideration', async ({ page }) => {
    await page.setContent(`<button role="" id="buttonId"></button>`);
    expect(await generate(page, 'button')).toBe('#buttonId');
  });

  it('should not accept invalid role for candidate consideration', async ({ page }) => {
    await page.setContent(`<button role="roleDescription" id="buttonId"></button>`);
    expect(await generate(page, 'button')).toBe('#buttonId');
  });

  it('should ignore empty data-test-id for candidate consideration', async ({ page }) => {
    await page.setContent(`<button data-test-id="" id="buttonId"></button>`);
    expect(await generate(page, 'button')).toBe('#buttonId');
  });

  it('should accept valid data-test-id for candidate consideration', async ({ page }) => {
    await page.setContent(`<button data-test-id="testId" id="buttonId"></button>`);
    expect(await generate(page, 'button')).toBe('[data-test-id="testId"]');
  });

  it('should generate label selector', async ({ page }) => {
    await page.setContent(`
      <label for=target1>Target1</label><input id=target1>
      <label for=target2>Target2</label><button id=target2>??</button>
      <label for=target3>Target3</label><select id=target3><option>hey</option></select>
      <label for=target4>Target4</label><progress id=target4 value=70 max=100>70%</progress>
      <label for=target5>Target5</label><input id=target5 type=hidden>
      <label for=target6>Target6</label><div id=target6>text</div>
    `);
    expect(await generate(page, '#target1')).toBe('internal:label="Target1"i');
    expect(await generate(page, '#target2')).toBe('internal:label="Target2"i');
    expect(await generate(page, '#target3')).toBe('internal:label="Target3"i');
    expect(await generate(page, '#target4')).toBe('internal:label="Target4"i');
    expect(await generate(page, '#target5')).toBe('#target5');
    expect(await generate(page, '#target6')).toBe('internal:text="text"i');

    await page.setContent(`<label for=target>Coun"try</label><input id=target>`);
    expect(await generate(page, 'input')).toBe('internal:label="Coun\\\"try"i');
  });

  it('should prefer role other input[type]', async ({ page }) => {
    await page.setContent(`<input type=checkbox><div data-testid=wrapper><input type=checkbox></div>`);
    expect(await generate(page, '[data-testid=wrapper] > input')).toBe('internal:testid=[data-testid="wrapper"s] >> internal:role=checkbox');
  });

  it('should generate title selector', async ({ page }) => {
    await page.setContent(`<div>
      <button title="Send to">Send</button>
      <button>Send</button>
    </div>`);
    expect(await generate(page, 'button')).toBe('internal:attr=[title=\"Send to\"i]');
  });

  it('should generate exact text when necessary', async ({ page }) => {
    await page.setContent(`
      <span>Text</span>
      <span>Text and more</span>
    `);
    expect(await generate(page, 'span')).toBe('internal:text=\"Text\"s');
  });

  it('should generate exact title when necessary', async ({ page }) => {
    await page.setContent(`
      <span title="Text"></span>
      <span title="Text and more"></span>
    `);
    expect(await generate(page, 'span')).toBe('internal:attr=[title=\"Text\"s]');
  });

  it('should generate exact placeholder when necessary', async ({ page }) => {
    await page.setContent(`
      <input placeholder="Text"></input>
      <input placeholder="Text and more"></input>
    `);
    expect(await generate(page, 'input')).toBe('internal:attr=[placeholder=\"Text\"s]');
  });

  it('should generate exact role when necessary', async ({ page }) => {
    await page.setContent(`
      <img alt="Text"></img>
      <img alt="Text and more"></img>
    `);
    expect(await generate(page, 'img')).toBe('internal:role=img[name=\"Text\"s]');
  });

  it('should generate exact label when necessary', async ({ page }) => {
    await page.setContent(`
      <label>Text <input></input></label>
      <label>Text and more <input></input></label>
    `);
    expect(await generate(page, 'input')).toBe('internal:label=\"Text\"s');
  });

  it('should generate relative selector', async ({ page }) => {
    await page.setContent(`
      <div>
        <span>Hello</span>
        <span>World</span>
      </div>
      <section>
        <span>Hello</span>
        <span>World</span>
      </section>
    `);
    const selectors = await page.evaluate(() => {
      const target = document.querySelector('section > span');
      const root = document.querySelector('section');
      const relative = (window as any).__injectedScript.generateSelectorSimple(target, { root });
      const absolute = (window as any).__injectedScript.generateSelectorSimple(target);
      return { relative, absolute };
    });
    expect(selectors).toEqual({
      relative: `internal:text="Hello"i`,
      absolute: `section >> internal:text="Hello"i`,
    });
  });

  it('should generate multiple: noText in role', async ({ page }) => {
    await page.setContent(`
      <button>Click me</button>
    `);
    expect(await generateMultiple(page, 'button')).toEqual([`internal:role=button[name="Click me"i]`, `internal:role=button`]);
  });

  it('should generate multiple: noText in text', async ({ page }) => {
    await page.setContent(`
      <div>Some div</div>
    `);
    expect(await generateMultiple(page, 'div')).toEqual([`internal:text="Some div"i`, `div`]);
  });

  it('should generate multiple: noId', async ({ page }) => {
    await page.setContent(`
      <div id=first><button>Click me</button></div>
      <div id=second><button>Click me</button></div>
    `);
    expect(await generateMultiple(page, '#second button')).toEqual([
      `#second >> internal:role=button[name="Click me"i]`,
      `#second >> internal:role=button`,
      `internal:role=button[name="Click me"i] >> nth=1`,
      `internal:role=button >> nth=1`,
    ]);
  });

  it('should generate multiple: noId noText', async ({ page }) => {
    await page.setContent(`
      <div id=first><span>Some span</span></div>
      <div id=second><span>Some span</span></div>
    `);
    expect(await generateMultiple(page, '#second span')).toEqual([
      `#second >> internal:text="Some span"i`,
      `#second span`,
      `internal:text="Some span"i >> nth=1`,
      `span >> nth=1`,
    ]);
  });
});
