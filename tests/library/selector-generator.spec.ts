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

async function generate(pageOrFrame: Page | Frame, target: string, expected?: string): Promise<string> {
  return pageOrFrame.$eval(target, (e, expected) => {
    const playwright = (window as any).playwright;
    const selector = playwright.selector(e);
    const expectedTarget = expected ? playwright.$(expected) : e;
    if (playwright.$(selector) === expectedTarget)
      return selector;
    return 'FAILED: ' + selector;
  }, expected);
}

async function generateNoText(pageOrFrame: Page | Frame, target: string): Promise<string> {
  return pageOrFrame.$eval(target, e => (window as any).__injectedScript.generateSelector(e, { noText: true, testIdAttributeName: 'data-testid' }).selector);
}

it.describe('selector generator', () => {
  it.skip(({ mode }) => mode !== 'default');

  it.beforeEach(async ({ context, page }) => {
    // Make sure `page`(fixture) is created before enabling recorder, so that
    // we properly wait for `extendInjectedScript` call to finish. Otherwise
    // if the page is created later, there is a race between ConsoleAPI
    // initialization and playwright.selector(e) call in `generate()` function above.
    await (context as any)._showRecorder({ language: 'javascript' });
  });

  it('GN-028 should prefer button over inner span', async ({ page }) => {
    await page.setContent(`<button><span>text</span></button>`);
    expect(await generate(page, 'span', 'button')).toBe('internal:role=button[name="text"i]');
  });

  it('GN-029 should prefer role=button over inner span', async ({ page }) => {
    await page.setContent(`<div role=button><span>text</span></div>`);
    expect(await generate(page, 'span', 'div')).toBe('internal:role=button[name="text"i]');
  });

  it('GN-030 should not prefer zero-sized button over inner span', async ({ page }) => {
    await page.setContent(`
      <button style="width:0;height:0;padding:0;border:0;overflow:visible;">
        <span style="width:100px;height:100px;">text</span>
      </button>
    `);
    expect(await generate(page, 'span')).toBe('internal:text="text"i');
  });

  it('GN-031 should generate text and normalize whitespace', async ({ page }) => {
    await page.setContent(`<div>Text  some\n\n\n more \t text   </div>`);
    expect(await generate(page, 'div')).toBe('internal:text="Text some more text"i');
  });

  it('GN-032 should not escape spaces inside named attr selectors', async ({ page }) => {
    await page.setContent(`<input placeholder="Foo b ar"/>`);
    expect(await generate(page, 'input')).toBe('internal:role=textbox[name=\"Foo b ar\"i]');
  });

  it('GN-033 should generate text for <input type=button>', async ({ page }) => {
    await page.setContent(`<input type=button value="Click me">`);
    expect(await generate(page, 'input')).toBe('internal:role=button[name=\"Click me\"i]');
  });

  it('GN-034 should trim text', async ({ page }) => {
    await page.setContent(`
      <div>Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789</div>
      <div>Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789!Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789</div>
    `);
    expect(await generate(page, 'div')).toBe('internal:text="Text0123456789Text0123456789Text0123456789Text0123456789Text0123456789Text012345"i');
  });

  it('GN-035 should try to improve role name', async ({ page }) => {
    await page.setContent(`<div role=button>Issues 23</div>`);
    expect(await generate(page, 'div')).toBe('internal:role=button[name="Issues"i]');
  });

  it('GN-036 should use description when name is not unique', async ({ page }) => {
    await page.setContent(`
      <button aria-description="Upload report">Submit</button>
      <button aria-description="Upload photo">Submit</button>
    `);
    expect(await generate(page, 'button[aria-description="Upload report"]')).toBe('internal:role=button[name="Submit"i][description="Upload report"i]');
    expect(await generate(page, 'button[aria-description="Upload photo"]')).toBe('internal:role=button[name="Submit"i][description="Upload photo"i]');
  });

  it('GN-037 should not use description when name is unique', async ({ page }) => {
    await page.setContent(`
      <button aria-description="Some description">Submit</button>
      <button aria-description="Other description">Cancel</button>
    `);
    expect(await generate(page, 'button[aria-description="Some description"]')).toBe('internal:role=button[name="Submit"i]');
  });

  it('GN-038 should use description from aria-describedby', async ({ page }) => {
    await page.setContent(`
      <span id="desc1">Save form data</span>
      <span id="desc2">Save as draft</span>
      <button aria-describedby="desc1">Submit</button>
      <button aria-describedby="desc2">Submit</button>
    `);
    expect(await generate(page, 'button[aria-describedby="desc1"]')).toBe('internal:role=button[name="Submit"i][description="Save form data"i]');
    expect(await generate(page, 'button[aria-describedby="desc2"]')).toBe('internal:role=button[name="Submit"i][description="Save as draft"i]');
  });

  it('GN-039 should fall back to nth when name and description are both not unique', async ({ page }) => {
    await page.setContent(`
      <button aria-description="Same desc">Submit</button>
      <button aria-description="Same desc">Submit</button>
    `);
    expect(await generate(page, 'button:first-of-type')).toBe('internal:role=button[name="Submit"i] >> nth=0');
  });

  it('GN-040 should use consistent exactness for name and description', {
    annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41032' }
  }, async ({ page }) => {
    // The public getByRole API has a single `exact` flag that covers both
    // `name` and `description`, so the producer must not emit a candidate
    // that mixes substring name with exact description (or vice versa).
    await page.setContent(`
      <table>
        <tr title="table row 1">
          <td>foo</td><td>bar</td><td>baz</td><td>foo</td><td>bar</td><td>baz</td><td>foo</td><td>bar</td><td>baz</td>
        </tr>
        <tr title="table row 2">
          <td>foo</td><td>bar</td><td>baz</td><td>foo</td><td>bar</td><td>baz</td><td>foo</td><td>bar</td><td>baz</td>
        </tr>
      </table>
    `);
    const selector = await generate(page, 'tr[title="table row 1"]');
    // Both name and description must share the same case-sensitivity flag.
    expect(selector).not.toMatch(/\[name="[^"]*"i\]\[description="[^"]*"s\]/);
    expect(selector).not.toMatch(/\[name="[^"]*"s\]\[description="[^"]*"i\]/);
  });

  it('GN-041 should use description when role has no name', async ({ page }) => {
    await page.setContent(`
      <div role="alert" aria-description="Error in field A"></div>
      <div role="alert" aria-description="Error in field B"></div>
    `);
    expect(await generate(page, 'div[aria-description="Error in field A"]')).toBe('internal:role=alert[description="Error in field A"s]');
    expect(await generate(page, 'div[aria-description="Error in field B"]')).toBe('internal:role=alert[description="Error in field B"s]');
  });

  it('GN-042 should try to improve text', async ({ page }) => {
    await page.setContent(`<div>23 Issues</div>`);
    expect(await generate(page, 'div')).toBe('internal:text="Issues"i');
  });

  it('GN-043 should try to improve text by shortening', async ({ page }) => {
    await page.setContent(`<div>Longest verbose description of the item</div>`);
    expect(await generate(page, 'div')).toBe('internal:text="Longest verbose description"i');
  });

  it('GN-044 should try to improve label text by shortening', async ({ page }) => {
    await page.setContent(`<label>Longest verbose description of the item<input></label>`);
    expect(await generate(page, 'input')).toBe('internal:role=textbox[name=\"Longest verbose description\"i]');
  });

  it('GN-045 should not improve guid text', async ({ page }) => {
    await page.setContent(`<div>91b1b23</div>`);
    expect(await generate(page, 'div')).toBe('internal:text="91b1b23"i');
  });

  it('GN-046 should not escape text with >>', async ({ page }) => {
    await page.setContent(`<div>text&gt;&gt;text</div>`);
    expect(await generate(page, 'div')).toBe('internal:text="text>>text"i');
  });

  it('GN-047 should escape text with quote', async ({ page }) => {
    await page.setContent(`<div>text"text</div>`);
    expect(await generate(page, 'div')).toBe('internal:text="text\\\"text"i');
  });

  it('GN-048 should escape text with slash', async ({ page }) => {
    await page.setContent(`<div>/text</div>`);
    expect(await generate(page, 'div')).toBe('internal:text="\/text"i');
  });

  it('GN-049 should not use text for select', async ({ page }) => {
    await page.setContent(`
      <select><option>foo</option></select>
      <select mark=1><option>bar</option></select>
    `);
    expect(await generate(page, '[mark="1"]')).toBe('internal:role=combobox >> nth=1');
  });

  it('GN-050 should use ordinal for identical nodes', async ({ page }) => {
    await page.setContent(`<div>Text</div><div>Text</div><div mark=1>Text</div><div>Text</div>`);
    expect(await generate(page, 'div[mark="1"]')).toBe(`internal:text="Text"i >> nth=2`);
  });

  it('GN-051 should prefer data-testid', async ({ page }) => {
    await page.setContent(`<div>Text</div><div>Text</div><div data-testid=a>Text</div><div>Text</div>`);
    expect(await generate(page, '[data-testid="a"]')).toBe('internal:testid=[data-testid=\"a\"s]');
  });

  it('GN-052 should use data-testid in strict errors', async ({ contextFactory, page, playwright }) => {
    const content = `
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
      </div>
    `;

    const checkPage = async (page: Page) => {
      await page.setContent(content);
      const error = await page.locator('.foo').hover().catch(e => e);
      expect(error.message).toContain('strict mode violation');
      expect(error.message).toContain('<div class=\"foo bar:0');
      expect(error.message).toContain('<div class=\"foo bar:1');
      expect(error.message).toContain(`aka getByTestId('One')`);
      expect(error.message).toContain(`aka getByTestId('Two')`);
    };

    playwright.selectors.setTestIdAttribute('data-custom-id');
    // Check page and context that were created before setting the attribute.
    await checkPage(page);

    const context2 = await contextFactory();
    const page2 = await context2.newPage();
    // Check page and context that were created after setting the attribute.
    await checkPage(page2);
  });

  it('GN-053 should handle first non-unique data-testid', async ({ page }) => {
    await page.setContent(`
      <div data-testid=a mark=1>
        Text
      </div>
      <div data-testid=a>
        Text
      </div>`);
    expect(await generate(page, 'div[mark="1"]')).toBe('internal:testid=[data-testid=\"a\"s] >> nth=0');
  });

  it('GN-054 should handle second non-unique data-testid', async ({ page }) => {
    await page.setContent(`
      <div data-testid=a>
        Text
      </div>
      <div data-testid=a mark=1>
        Text
      </div>`);
    expect(await generate(page, 'div[mark="1"]')).toBe(`internal:testid=[data-testid=\"a\"s] >> nth=1`);
  });

  it('GN-055 should use readable id', async ({ page }) => {
    await page.setContent(`
      <div></div>
      <div id=first-item mark=1></div>
    `);
    expect(await generate(page, 'div[mark="1"]')).toBe('#first-item');
  });

  it('GN-056 should not use generated id', async ({ page }) => {
    await page.setContent(`
      <div></div>
      <div id=aAbBcCdDeE mark=1></div>
    `);
    expect(await generate(page, 'div[mark="1"]')).toBe(`div >> nth=1`);
  });

  it('GN-057 should use internal:has-text', async ({ page }) => {
    await page.setContent(`
      <div>Hello world</div>
      <a>Hello <span>world</span></a>
      <a>Goodbye <span>world</span></a>
    `);
    expect(await generate(page, 'a:has-text("Hello")')).toBe(`a >> internal:has-text="Hello world"i`);
  });

  it('GN-058 should use internal:has-text with regexp', async ({ page }) => {
    await page.setContent(`
      <span>Hello world</span>
      <div><div>Hello <span>world</span></div>extra</div>
      <a>Goodbye <span>world</span></a>
    `);
    expect(await generate(page, 'div div')).toBe(`div >> internal:has-text=/^Hello world$/`);
  });

  it('GN-059 should use internal:has-text with regexp with a quote', async ({ page }) => {
    await page.setContent(`
      <span>Hello'world</span>
      <div><div>Hello'<span>world</span></div>extra</div>
      <a>Goodbye'<span>world</span></a>
    `);
    expect(await generate(page, 'div div')).toBe(`div >> internal:has-text=/^Hello\\'world$/`);
  });

  it('GN-060 should chain text after parent', async ({ page }) => {
    await page.setContent(`
      <div>Hello <span>world</span></div>
      <b>Hello <span mark=1>world</span></b>
    `);
    expect(await generate(page, '[mark="1"]')).toBe(`b >> internal:text="world"i`);
  });

  it('GN-061 should use parent text', async ({ page }) => {
    await page.setContent(`
      <div>Hello <span>world</span></div>
      <div>Goodbye <span mark=1>world</span></div>
    `);
    expect(await generate(page, '[mark="1"]')).toBe(`div >> internal:has-text="Goodbye world"i >> span`);
  });

  it('GN-062 should separate selectors by >>', async ({ page }) => {
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

  it('GN-063 should trim long text', async ({ page }) => {
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

  it('GN-064 should use nested ordinals', async ({ page }) => {
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

  it('GN-065 should prefer class to ordinal', async ({ page }) => {
    await page.setContent(`
      <div><c></c><c></c><c></c><c></c><c></c><b></b></div>
      <div>
        <b class="foo">
          <c>
          </c>
        </b>
        <b>
          <c mark=1></c>
        </b>
      </div>
      <div><b class="foo"></b></div>
    `);
    await page.$eval('[mark="1"]', c => c.parentElement.className = 'foo 12.bar.baz[&x]-_?"\'');
    expect(await generate(page, 'c[mark="1"]')).toBe(`.foo.\\31 2\\.bar\\.baz\\[\\&x\\]-_\\?\\"\\' > c`);
  });

  it('GN-066 should properly join child selectors under nested ordinals', async ({ page }) => {
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

  it('GN-067 should not use input[value]', async ({ page }) => {
    await page.setContent(`
      <input value="one">
      <input value="two" mark="1">
      <input value="three">
    `);
    expect(await generate(page, 'input[mark="1"]')).toBe('internal:role=textbox >> nth=1');
  });

  it.describe('should prioritize attributes correctly', () => {
    it('GN-068 role', async ({ page }) => {
      await page.setContent(`<input name="foobar" type="text"/>`);
      expect(await generate(page, 'input')).toBe('internal:role=textbox');
    });
    it('GN-069 placeholder', async ({ page }) => {
      await page.setContent(`<input placeholder="foobar" type="text"/>`);
      expect(await generate(page, 'input')).toBe('internal:role=textbox[name=\"foobar\"i]');
    });
    it('GN-070 name', async ({ page }) => {
      await page.setContent(`
        <input aria-hidden="false" name="foobar" type="date"/>
        <div role="textbox"/>content</div>
      `);
      expect(await generate(page, 'input')).toBe('input[name="foobar"]');
    });
    it('GN-071 type', async ({ page }) => {
      await page.setContent(`
        <input aria-hidden="false" type="checkbox"/>
        <div role="checkbox"/>content</div>
      `);
      expect(await generate(page, 'input')).toBe('input[type="checkbox"]');
    });
  });

  it('GN-072 should find text in shadow dom', async ({ page }) => {
    await page.setContent(`<div></div>`);
    await page.$eval('div', div => {
      const shadowRoot = div.attachShadow({ mode: 'open' });
      const span = document.createElement('span');
      span.textContent = 'Target';
      shadowRoot.appendChild(span);
    });
    expect(await generate(page, 'span')).toBe('internal:text="Target"i');
  });

  it('GN-073 should match in shadow dom', async ({ page }) => {
    await page.setContent(`<div></div>`);
    await page.$eval('div', div => {
      const shadowRoot = div.attachShadow({ mode: 'open' });
      const input = document.createElement('input');
      shadowRoot.appendChild(input);
    });
    expect(await generate(page, 'input')).toBe('internal:role=textbox');
  });

  it('GN-074 should match in deep shadow dom', async ({ page }) => {
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

  it('GN-075 should work in dynamic iframes without navigation', async ({ page }) => {
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

  it('GN-076 should use the name attributes for elements that can have it', async ({ page }) => {
    for (const tagName of ['button', 'input', 'textarea']) {
      await page.setContent(`<form><${tagName} name="foo"></${tagName}><${tagName} name="bar"></${tagName}></form>`);
      expect(await generate(page, '[name=bar]')).toBe(`${tagName}[name="bar"]`);
    }

    await page.setContent(`<iframe name="foo"></iframe><iframe name="bar"></iframe>`);
    expect(await generate(page, '[name=bar]')).toBe(`iframe[name="bar"]`);

    await page.setContent(`<frameset><frame name="foo"></frame><frame name="bar"></frame></frameset>`);
    expect(await generate(page, '[name=bar]')).toBe(`frame[name="bar"]`);
  });

  it('GN-077 should work with tricky attributes', async ({ page }) => {
    await page.setContent(`<button id="this:is-my-tricky.id"><span></span></button>`);
    expect(await generate(page, 'button')).toBe('[id="this:is-my-tricky.id"]');

    await page.setContent(`<ng:switch><span></span></ng:switch>`);
    expect(await generate(page, 'ng\\:switch')).toBe('ng\\:switch');

    await page.setContent(`<button><span></span></button><button></button>`);
    await page.$eval('span', span => span.textContent = `!#'!?"\\:`);
    expect(await generate(page, 'button')).toBe(`internal:role=button[name="!#'!?\\"\\\\:"i]`);

    await page.setContent(`<div><span></span></div>`);
    await page.$eval('div', div => div.id = `!#'!?"\\:`);
    expect(await generate(page, 'div')).toBe(`[id="!#'!?\\"\\\\:"]`);
  });

  it('GN-078 should work without CSS.escape', async ({ page }) => {
    await page.setContent(`<button aria-hidden="false"></button><div role="button"></div>`);
    await page.$eval('button', button => {
      delete window.CSS.escape;
      button.setAttribute('name', '-tricky\u0001name');
    });
    expect(await generate(page, 'button')).toBe(`button[name="-tricky\u0001name"]`);
  });

  it('GN-079 should not over-escape for CSS syntax', async ({ page }) => {
    await page.setContent(`<button aria-hidden="false" name="123"></button><div role="button"></div>`);
    expect(await generate(page, 'button')).toBe(`button[name="123"]`);
  });

  it('GN-080 should ignore empty aria-label for candidate consideration', async ({ page }) => {
    await page.setContent(`<button aria-label="" id="buttonId"></button>`);
    expect(await generate(page, 'button')).toBe('#buttonId');
  });

  it('GN-081 should accept valid aria-label for candidate consideration', async ({ page }) => {
    await page.setContent(`<button aria-label="ariaLabel" id="buttonId"></button>`);
    expect(await generate(page, 'button')).toBe('internal:role=button[name=\"ariaLabel\"i]');
  });

  it('GN-082 should generate title selector', async ({ page }) => {
    await page.setContent(`<div>
      <button title="Send to" aria-description="High-Speed Parcel Delivery">Send</button>
      <button aria-description="High-Speed Parcel Delivery">Send</button>
    </div>`);
    expect(await generate(page, 'button')).toBe('internal:attr=[title=\"Send to\"i]');
  });

  it('GN-083 should ignore empty role for candidate consideration', async ({ page }) => {
    await page.setContent(`<button role="" id="buttonId"></button>`);
    expect(await generate(page, 'button')).toBe('#buttonId');
  });

  it('GN-084 should not accept invalid role for candidate consideration', async ({ page }) => {
    await page.setContent(`<button role="roleDescription" id="buttonId"></button>`);
    expect(await generate(page, 'button')).toBe('#buttonId');
  });

  it('GN-085 should ignore empty data-test-id for candidate consideration', async ({ page }) => {
    await page.setContent(`<button data-test-id="" id="buttonId"></button>`);
    expect(await generate(page, 'button')).toBe('#buttonId');
  });

  it('GN-086 should accept valid data-test-id for candidate consideration', async ({ page }) => {
    await page.setContent(`<button data-test-id="testId" id="buttonId"></button>`);
    expect(await generate(page, 'button')).toBe('[data-test-id="testId"]');
  });

  it('GN-087 should generate label selector', async ({ page }) => {
    await page.setContent(`
      <label for=target1>Target1</label><input id=target1>
      <label for=target2>Target2</label><button id=target2>??</button>
      <label for=target3>Target3</label><select id=target3><option>hey</option></select>
      <label for=target4>Target4</label><progress id=target4 value=70 max=100>70%</progress>
      <label for=target5>Target5</label><input id=target5 type=hidden>
      <label for=target6>Target6</label><div id=target6>text</div>
    `);
    expect.soft(await generate(page, '#target1')).toBe('internal:role=textbox[name=\"Target1\"i]');
    expect.soft(await generate(page, '#target2')).toBe('internal:role=button[name=\"Target2\"i]');
    expect.soft(await generate(page, '#target3')).toBe('internal:label=\"Target3\"i');
    expect.soft(await generate(page, '#target4')).toBe('internal:role=progressbar[name=\"Target4\"i]');
    expect.soft(await generate(page, '#target5')).toBe('#target5');
    expect.soft(await generate(page, '#target6')).toBe('internal:text="text"i');

    await page.setContent(`<label for=target>Coun"try</label><input id=target>`);
    expect(await generate(page, 'input')).toBe('internal:role=textbox[name=\"Coun\\\"try\"i]');
  });

  it('GN-088 should prefer role other input[type]', async ({ page }) => {
    await page.setContent(`<input type=checkbox><div data-testid=wrapper><input type=checkbox></div>`);
    expect(await generate(page, '[data-testid=wrapper] > input')).toBe('internal:testid=[data-testid="wrapper"s] >> internal:role=checkbox');
  });

  it('GN-089 should generate exact text when necessary', async ({ page }) => {
    await page.setContent(`
      <span>Text</span>
      <span>Text and more</span>
    `);
    expect(await generate(page, 'span')).toBe('internal:text=\"Text\"s');
  });

  it('GN-090 should generate exact title when necessary', async ({ page }) => {
    await page.setContent(`
      <span title="Text"></span>
      <span title="Text and more"></span>
    `);
    expect(await generate(page, 'span')).toBe('internal:attr=[title=\"Text\"s]');
  });

  it('GN-091 should generate exact placeholder when necessary', async ({ page }) => {
    await page.setContent(`
      <input placeholder="Text"></input>
      <input placeholder="Text and more"></input>
    `);
    expect(await generate(page, 'input')).toBe('internal:role=textbox[name=\"Text\"s]');
  });

  it('GN-092 should generate exact role when necessary', async ({ page }) => {
    await page.setContent(`
      <img alt="Text"></img>
      <img alt="Text and more"></img>
    `);
    expect(await generate(page, 'img')).toBe('internal:role=img[name=\"Text\"s]');
  });

  it('GN-093 should generate exact label when necessary', async ({ page }) => {
    await page.setContent(`
      <label>Text <input></input></label>
      <label>Text and more <input></input></label>
    `);
    expect(await generate(page, 'input')).toBe('internal:role=textbox[name=\"Text\"s]');
  });

  it('GN-094 should generate relative selector', async ({ page }) => {
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

  it('GN-095 should generate noText: no text engine', async ({ page }) => {
    await page.setContent(`<div>Some text</div>`);
    expect(await generateNoText(page, 'div')).toBe(`div`);
  });

  it('GN-096 should generate noText: no name from content', async ({ page }) => {
    await page.setContent(`<button><span>Send</span></button>`);
    expect(await generateNoText(page, 'button')).toBe(`internal:role=button`);
  });

  it('GN-097 should generate noText: name from aria-label', async ({ page }) => {
    await page.setContent(`<button aria-label="Send message"><span>Send</span></button>`);
    expect(await generateNoText(page, 'button')).toBe(`internal:role=button[name="Send message"i]`);
  });

  it('GN-098 should generate noText: name from external aria-labelledby', async ({ page }) => {
    await page.setContent(`<span id="label">Editor</span><div role="textbox" aria-labelledby="label" contenteditable>Text</div>`);
    expect(await generateNoText(page, 'div[role=textbox]')).toBe(`internal:role=textbox[name="Editor"i]`);
  });

  it('GN-099 should generate noText: ignore aria-labelledby pointing inside the element', async ({ page }) => {
    await page.setContent(`<div role="textbox" aria-labelledby="child" contenteditable><p id="child">Title</p><p>Text</p></div>`);
    expect(await generateNoText(page, 'div[role=textbox]')).toBe(`internal:role=textbox`);
  });

  it('GN-100 should generate noText: contenteditable heading', async ({ page }) => {
    await page.setContent(`<h1 contenteditable>Page title</h1>`);
    expect(await generateNoText(page, 'h1')).toBe(`internal:role=heading`);
  });

  it('GN-101 should generate noText: description from external aria-describedby', async ({ page }) => {
    await page.setContent(`
      <span id="desc1">First</span><span id="desc2">Second</span>
      <div role="textbox" aria-label="Editor" aria-describedby="desc1" contenteditable>foo</div>
      <div role="textbox" aria-label="Editor" aria-describedby="desc2" contenteditable>bar</div>
    `);
    expect(await generateNoText(page, 'div[aria-describedby=desc1]')).toBe(`internal:role=textbox[name="Editor"i][description="First"i]`);
  });

  it('GN-102 should generate noText: ignore aria-describedby pointing inside the element', async ({ page }) => {
    await page.setContent(`
      <div role="textbox" aria-label="Editor" aria-describedby="child" contenteditable><p id="child">First</p></div>
      <div role="textbox" aria-label="Editor" contenteditable>Second</div>
    `);
    expect(await generateNoText(page, 'div[aria-describedby=child]')).toBe(`internal:role=textbox[name="Editor"i] >> nth=0`);
  });

  it('GN-103 should prefer role with hasText to css with hasText', async ({ page }) => {
    await page.setContent(`
      <ul>
        <li>
          <input aria-label="Toggle Todo" type="checkbox">
          buy flowers
        </li>
        <li>
          <input aria-label="Toggle Todo" type="checkbox">
          sell milk
        </li>
      </ul>
    `);
    expect(await generate(page, 'input')).toBe(`internal:role=listitem >> internal:has-text=\"buy flowers\"i >> internal:label=\"Toggle Todo\"i`);
  });

  it('GN-104 should not use icon fonts aria name', async ({ page }) => {
    await page.setContent(`
      <style>
        .icon-foo:before {
          content: "\\F1D4";
        }
        .icon-bar:before {
          content: "\\F0000";
        }
      </style>
      <div>
        <button><i class="icon-foo"></i></button>
        <button><i class="icon-bar"></i></button>
      </div>
    `);
    expect.soft(await generate(page, 'button:first-child')).toBe('internal:role=button >> nth=0');
    expect.soft(await generate(page, 'button:last-child')).toBe('internal:role=button >> nth=1');
  });

  it('GN-105 should not throw for slotted element when host shadow root has a twin', async ({ page }) => {
    await page.setContent(`
      <span>Target</span>
      <div></div><div></div><div></div><div></div><div></div><div></div><div></div>
      <x-host><x-item class="c" data-text="Target"></x-item></x-host>
      <script>
        customElements.define('x-item', class extends HTMLElement {
          connectedCallback() {
            this.attachShadow({ mode: 'open' }).innerHTML = '<div class="k"><span>' + (this.dataset.text || '') + '</span></div>';
          }
        });
        customElements.define('x-host', class extends HTMLElement {
          connectedCallback() {
            this.attachShadow({ mode: 'open' }).innerHTML = '<x-item class="c"></x-item><slot></slot>';
          }
        });
      </script>
    `);
    expect(await generate(page, 'x-item[data-text] span')).toBe('x-host >> internal:text="Target"i');
  });
});
