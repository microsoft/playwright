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

import { folio } from './fixtures';
import type { Page, Frame } from '..';
import { source } from '../src/generated/consoleApiSource';

const fixtures = folio.extend();
fixtures.context.override(async ({ context }, run) => {
  await (context as any)._extendInjectedScript(source);
  await run(context);
});
const { describe, it, expect } = fixtures.build();

async function generate(pageOrFrame: Page | Frame, target: string): Promise<string> {
  return pageOrFrame.$eval(target, e => (window as any).playwright.selector(e));
}

describe('selector generator', (suite, { mode }) => {
  suite.skip(mode !== 'default');
}, () => {
  it('should generate for text', async ({ page }) => {
    await page.setContent(`<div>Text</div>`);
    expect(await generate(page, 'div')).toBe('text="Text"');
  });

  it('should use ordinal for identical nodes', async ({ page }) => {
    await page.setContent(`<div>Text</div><div>Text</div><div mark=1>Text</div><div>Text</div>`);
    expect(await generate(page, 'div[mark="1"]')).toBe('//div[3][normalize-space(.)=\'Text\']');
  });

  it('should prefer data-testid', async ({ page }) => {
    await page.setContent(`<div>Text</div><div>Text</div><div data-testid=a>Text</div><div>Text</div>`);
    expect(await generate(page, 'div[data-testid="a"]')).toBe('div[data-testid="a"]');
  });

  it('should handle first non-unique data-testid', async ({ page }) => {
    await page.setContent(`
      <div data-testid=a mark=1>
        Text
      </div>
      <div data-testid=a>
        Text
      </div>`);
    expect(await generate(page, 'div[mark="1"]')).toBe('div[data-testid="a"]');
  });

  it('should handle second non-unique data-testid', async ({ page }) => {
    await page.setContent(`
      <div data-testid=a>
        Text
      </div>
      <div data-testid=a mark=1>
        Text
      </div>`);
    expect(await generate(page, 'div[mark="1"]')).toBe('//div[2][normalize-space(.)=\'Text\']');
  });

  it('should use readable id', async ({ page }) => {
    await page.setContent(`
      <div></div>
      <div id=first-item mark=1></div>
    `);
    expect(await generate(page, 'div[mark="1"]')).toBe('div[id="first-item"]');
  });

  it('should not use generated id', async ({ page }) => {
    await page.setContent(`
      <div></div>
      <div id=aAbBcCdDeE mark=1></div>
    `);
    expect(await generate(page, 'div[mark="1"]')).toBe('//div[2]');
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
    expect(await generate(page, '#id > div')).toBe('div[id=\"id\"] >> text=\"Text\"');
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
    expect(await generate(page, '#id > div')).toBe('div[id=\"id\"] >> text=/.*Text that goes on and on and o.*/');
  });

  it('should use nested ordinals', async ({ page }) => {
    await page.setContent(`
      <a><b></b></a>
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
    expect(await generate(page, 'c[mark="1"]')).toBe('//b[2]/c');
  });

  it('should not use input[value]', async ({ page }) => {
    await page.setContent(`
      <input value="one">
      <input value="two" mark="1">
      <input value="three">
    `);
    expect(await generate(page, 'input[mark="1"]')).toBe('//input[2]');
  });

  describe('should prioritise input element attributes correctly', () => {
    it('name', async ({ page }) => {
      await page.setContent(`<input name="foobar" type="text"/>`);
      expect(await generate(page, 'input')).toBe('input[name="foobar"]');
    });
    it('placeholder', async ({ page }) => {
      await page.setContent(`<input placeholder="foobar" type="text"/>`);
      expect(await generate(page, 'input')).toBe('input[placeholder="foobar"]');
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
    expect(await generate(page, 'span')).toBe('text="Target"');
  });

  it('should fallback to css in shadow dom', async ({ page }) => {
    await page.setContent(`<div></div>`);
    await page.$eval('div', div => {
      const shadowRoot = div.attachShadow({ mode: 'open' });
      const input = document.createElement('input');
      shadowRoot.appendChild(input);
    });
    expect(await generate(page, 'input')).toBe('input');
  });

  it('should fallback to css in deep shadow dom', async ({ page }) => {
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
    expect(await generate(page, 'input[value=foo]')).toBe('div div:nth-child(3) input');
  });

  it('should work in dynamic iframes without navigation', async ({ page }) => {
    await page.setContent(`<div></div>`);
    const [frame] = await Promise.all([
      page.waitForEvent('frameattached'),
      page.evaluate(() => {
        return new Promise(f => {
          const iframe = document.createElement('iframe');
          iframe.onload = () => {
            iframe.contentDocument.body.innerHTML = '<div>Target</div>';
            f();
          };
          document.body.appendChild(iframe);
        });
      }),
    ]);
    expect(await generate(frame, 'div')).toBe('text="Target"');
  });
});
