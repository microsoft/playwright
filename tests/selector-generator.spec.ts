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

import { contextTest as it, expect } from './config/browserTest';
import type { Page, Frame } from 'playwright-core';

async function generate(pageOrFrame: Page | Frame, target: string): Promise<string> {
  return pageOrFrame.$eval(target, e => (window as any).playwright.selector(e));
}

it.describe('selector generator', () => {
  it.skip(({ mode }) => mode !== 'default');

  it.beforeEach(async ({ context }) => {
    await (context as any)._enableRecorder({ language: 'javascript' });
  });

  it('should prefer button over inner span', async ({ page }) => {
    await page.setContent(`<button id=clickme><span></span></button>`);
    expect(await generate(page, 'button')).toBe('#clickme');
  });

  it('should prefer role=button over inner span', async ({ page }) => {
    await page.setContent(`<div role=button><span></span></div>`);
    expect(await generate(page, 'div')).toBe('div[role="button"]');
  });

  it('should generate text and normalize whitespace', async ({ page }) => {
    await page.setContent(`<div>Text  some\n\n\n more \t text   </div>`);
    expect(await generate(page, 'div')).toBe('text=Text some more text');
  });

  it('should not escape spaces inside attribute selectors', async ({ page }) => {
    await page.setContent(`<input placeholder="Foo b ar"/>`);
    expect(await generate(page, 'input')).toBe('[placeholder="Foo b ar"]');
  });

  it('should generate text for <input type=button>', async ({ page }) => {
    await page.setContent(`<input type=button value="Click me">`);
    expect(await generate(page, 'input')).toBe('text=Click me');
  });

  it('should trim text', async ({ page }) => {
    await page.setContent(`<div>Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789</div>`);
    expect(await generate(page, 'div')).toBe('text=Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text012345');
  });

  it('should escape text with >>', async ({ page }) => {
    await page.setContent(`<div>text&gt;&gt;text</div>`);
    expect(await generate(page, 'div')).toBe('text=/.*text\\>\\>text.*/');
  });

  it('should escape text with quote', async ({ page }) => {
    await page.setContent(`<div>text"text</div>`);
    expect(await generate(page, 'div')).toBe('text=/.*text"text.*/');
  });

  it('should escape text with slash', async ({ page }) => {
    await page.setContent(`<div>/text</div>`);
    expect(await generate(page, 'div')).toBe('text=/.*\/text.*/');
  });

  it('should not use text for select', async ({ page }) => {
    await page.setContent(`
      <select><option>foo</option></select>
      <select mark=1><option>bar</option></select>
    `);
    expect(await generate(page, '[mark="1"]')).toBe('select >> nth=1');
  });

  it('should use ordinal for identical nodes', async ({ page }) => {
    await page.setContent(`<div>Text</div><div>Text</div><div mark=1>Text</div><div>Text</div>`);
    expect(await generate(page, 'div[mark="1"]')).toBe(`text=Text >> nth=2`);
  });

  it('should prefer data-testid', async ({ page }) => {
    await page.setContent(`<div>Text</div><div>Text</div><div data-testid=a>Text</div><div>Text</div>`);
    expect(await generate(page, '[data-testid="a"]')).toBe('[data-testid="a"]');
  });

  it('should handle first non-unique data-testid', async ({ page }) => {
    await page.setContent(`
      <div data-testid=a mark=1>
        Text
      </div>
      <div data-testid=a>
        Text
      </div>`);
    expect(await generate(page, 'div[mark="1"]')).toBe('[data-testid="a"] >> nth=0');
  });

  it('should handle second non-unique data-testid', async ({ page }) => {
    await page.setContent(`
      <div data-testid=a>
        Text
      </div>
      <div data-testid=a mark=1>
        Text
      </div>`);
    expect(await generate(page, 'div[mark="1"]')).toBe(`[data-testid="a"] >> nth=1`);
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

  it('should use has-text', async ({ page }) => {
    await page.setContent(`
      <div>Hello world</div>
      <a>Hello <span>world</span></a>
    `);
    expect(await generate(page, 'a')).toBe(`a:has-text("Hello world")`);
  });

  it('should chain text after parent', async ({ page }) => {
    await page.setContent(`
      <div>Hello <span>world</span></div>
      <a>Hello <span mark=1>world</span></a>
    `);
    expect(await generate(page, '[mark="1"]')).toBe(`a >> text=world`);
  });

  it('should use parent text', async ({ page }) => {
    await page.setContent(`
      <div>Hello <span>world</span></div>
      <div>Goodbye <span mark=1>world</span></div>
    `);
    expect(await generate(page, '[mark="1"]')).toBe(`text=Goodbye world >> span`);
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
    expect(await generate(page, '#id > div')).toBe('#id >> text=Text');
  });

  it('should trim long text', async ({ page }) => {
    await page.setContent(`
      <div>
        <div>Text that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on</div>
      </div>
      <div id="id">
      <div>Text that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on</div>
      </div>
    `);
    expect(await generate(page, '#id > div')).toBe(`#id >> text=Text that goes on and on and on and on and on and on and on and on and on and on`);
  });

  it('should use nested ordinals', async ({ page }) => {
    await page.setContent(`
      <a><c></c><c></c><c></c><c></c><c></c><b></b></a>
      <a>
        <b>
          <c>
          </c>
        </b>
        <b>
          <c mark=1></c>
        </b>
      </a>
      <a><b></b></a>
    `);
    expect(await generate(page, 'c[mark="1"]')).toBe('b:nth-child(2) c');
  });

  it('should not use input[value]', async ({ page }) => {
    await page.setContent(`
      <input value="one">
      <input value="two" mark="1">
      <input value="three">
    `);
    expect(await generate(page, 'input[mark="1"]')).toBe('input >> nth=1');
  });

  it.describe('should prioritise input element attributes correctly', () => {
    it('name', async ({ page }) => {
      await page.setContent(`<input name="foobar" type="text"/>`);
      expect(await generate(page, 'input')).toBe('input[name="foobar"]');
    });
    it('placeholder', async ({ page }) => {
      await page.setContent(`<input placeholder="foobar" type="text"/>`);
      expect(await generate(page, 'input')).toBe('[placeholder="foobar"]');
    });
    it('type', async ({ page }) => {
      await page.setContent(`<input type="text"/>`);
      expect(await generate(page, 'input')).toBe('input[type="text"]');
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
    expect(await generate(page, 'span')).toBe('text=Target');
  });

  it('should match in shadow dom', async ({ page }) => {
    await page.setContent(`<div></div>`);
    await page.$eval('div', div => {
      const shadowRoot = div.attachShadow({ mode: 'open' });
      const input = document.createElement('input');
      shadowRoot.appendChild(input);
    });
    expect(await generate(page, 'input')).toBe('input');
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
    expect(await generate(page, 'input[value=foo]')).toBe('input >> nth=2');
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
    expect(await generate(frame, 'div')).toBe('text=Target');
  });

  it('should use the name attributes for elements that can have it', async ({ page }) => {
    for (const tagName of ['button', 'input', 'textarea']) {
      await page.setContent(`<form><${tagName} name="foo"></${tagName}><${tagName} name="bar"></${tagName}></form>`);
      expect(await generate(page, '[name=bar]')).toBe(`${tagName}[name="bar"]`);
    }
  });

  it('should work with tricky attributes', async ({ page }) => {
    await page.setContent(`<button id="this:is-my-tricky.id"><span></span></button>`);
    expect(await generate(page, 'button')).toBe('[id="this\\:is-my-tricky\\.id"]');

    await page.setContent(`<ng:switch><span></span></ng:switch>`);
    expect(await generate(page, 'ng\\:switch')).toBe('ng\\:switch');

    await page.setContent(`<div><span></span></div>`);
    await page.$eval('div', div => div.setAttribute('aria-label', `!#'!?:`));
    expect(await generate(page, 'div')).toBe("[aria-label=\"\\!\\#\\'\\!\\?\\:\"]");

    await page.setContent(`<div><span></span></div>`);
    await page.$eval('div', div => div.id = `!#'!?:`);
    expect(await generate(page, 'div')).toBe("[id=\"\\!\\#\\'\\!\\?\\:\"]");
  });

  it('should work without CSS.escape', async ({ page }) => {
    await page.setContent(`<button></button>`);
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
    expect(await generate(page, 'button')).toBe('[aria-label="ariaLabel"]');
  });

  it('should ignore empty role for candidate consideration', async ({ page }) => {
    await page.setContent(`<button role="" id="buttonId"></button>`);
    expect(await generate(page, 'button')).toBe('#buttonId');
  });

  it('should accept valid role for candidate consideration', async ({ page }) => {
    await page.setContent(`<button role="roleDescription" id="buttonId"></button>`);
    expect(await generate(page, 'button')).toBe('button[role="roleDescription"]');
  });

  it('should ignore empty data-test-id for candidate consideration', async ({ page }) => {
    await page.setContent(`<button data-test-id="" id="buttonId"></button>`);
    expect(await generate(page, 'button')).toBe('#buttonId');
  });

  it('should accept valid data-test-id for candidate consideration', async ({ page }) => {
    await page.setContent(`<button data-test-id="testId" id="buttonId"></button>`);
    expect(await generate(page, 'button')).toBe('[data-test-id="testId"]');
  });

});
