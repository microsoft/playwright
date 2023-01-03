/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import { contextTest as it, expect } from '../config/browserTest';
import { asLocator } from '../../packages/playwright-core/lib/server/isomorphic/locatorGenerators';
import { locatorOrSelectorAsSelector as parseLocator } from '../../packages/playwright-core/lib/server/isomorphic/locatorParser';
import type { Page, Frame, Locator, FrameLocator } from 'playwright-core';

it.skip(({ mode }) => mode !== 'default');

function generate(locator: Locator | FrameLocator) {
  return generateForSelector((locator as any)._selector || (locator as any)._frameSelector);
}

function generateForSelector(selector: string) {
  const result: any = {};
  for (const lang of ['javascript', 'python', 'java', 'csharp']) {
    const locatorString = asLocator(lang, selector, false);
    expect.soft(parseLocator(lang, locatorString, 'data-testid'), lang + ' mismatch').toBe(selector);
    result[lang] = locatorString;
  }
  return result;
}

async function generateForNode(pageOrFrame: Page | Frame, target: string): Promise<string> {
  const selector = await pageOrFrame.locator(target).evaluate(e => (window as any).playwright.selector(e));
  const result: any = {};
  for (const lang of ['javascript', 'python', 'java', 'csharp']) {
    const locatorString = asLocator(lang, selector, false);
    expect.soft(parseLocator(lang, locatorString)).toBe(selector);
    result[lang] = locatorString;
  }
  return result;
}

it('reverse engineer locators', async ({ page }) => {
  expect.soft(generate(page.getByTestId('Hello'))).toEqual({
    javascript: "getByTestId('Hello')",
    python: 'get_by_test_id("Hello")',
    java: 'getByTestId("Hello")',
    csharp: 'GetByTestId("Hello")'
  });

  expect.soft(generate(page.getByTestId('He"llo'))).toEqual({
    javascript: 'getByTestId(\'He"llo\')',
    python: 'get_by_test_id("He\\"llo")',
    java: 'getByTestId("He\\"llo")',
    csharp: 'GetByTestId("He\\"llo")'
  });

  expect.soft(generate(page.getByText('Hello', { exact: true }))).toEqual({
    csharp: 'GetByText("Hello", new() { Exact = true })',
    java: 'getByText("Hello", new Page.GetByTextOptions().setExact(true))',
    javascript: 'getByText(\'Hello\', { exact: true })',
    python: 'get_by_text("Hello", exact=True)',
  });

  expect.soft(generate(page.getByText('Hello'))).toEqual({
    csharp: 'GetByText("Hello")',
    java: 'getByText("Hello")',
    javascript: 'getByText(\'Hello\')',
    python: 'get_by_text("Hello")',
  });
  expect.soft(generate(page.getByText(/Hello/))).toEqual({
    csharp: 'GetByText(new Regex("Hello"))',
    java: 'getByText(Pattern.compile("Hello"))',
    javascript: 'getByText(/Hello/)',
    python: 'get_by_text(re.compile(r"Hello"))',
  });
  expect.soft(generate(page.getByLabel('Name'))).toEqual({
    csharp: 'GetByLabel("Name")',
    java: 'getByLabel("Name")',
    javascript: 'getByLabel(\'Name\')',
    python: 'get_by_label("Name")',
  });
  expect.soft(generate(page.getByLabel('Last Name', { exact: true }))).toEqual({
    csharp: 'GetByLabel("Last Name", new() { Exact = true })',
    java: 'getByLabel("Last Name", new Page.GetByLabelOptions().setExact(true))',
    javascript: 'getByLabel(\'Last Name\', { exact: true })',
    python: 'get_by_label("Last Name", exact=True)',
  });
  expect.soft(generate(page.getByLabel(/Last\s+name/i))).toEqual({
    csharp: 'GetByLabel(new Regex("Last\\\\s+name", RegexOptions.IgnoreCase))',
    java: 'getByLabel(Pattern.compile("Last\\\\s+name", Pattern.CASE_INSENSITIVE))',
    javascript: 'getByLabel(/Last\\s+name/i)',
    python: 'get_by_label(re.compile(r"Last\\s+name", re.IGNORECASE))',
  });

  expect.soft(generate(page.getByPlaceholder('hello'))).toEqual({
    csharp: 'GetByPlaceholder("hello")',
    java: 'getByPlaceholder("hello")',
    javascript: 'getByPlaceholder(\'hello\')',
    python: 'get_by_placeholder("hello")',
  });
  expect.soft(generate(page.getByPlaceholder('Hello', { exact: true }))).toEqual({
    csharp: 'GetByPlaceholder("Hello", new() { Exact = true })',
    java: 'getByPlaceholder("Hello", new Page.GetByPlaceholderOptions().setExact(true))',
    javascript: 'getByPlaceholder(\'Hello\', { exact: true })',
    python: 'get_by_placeholder("Hello", exact=True)',
  });
  expect.soft(generate(page.getByPlaceholder(/wor/i))).toEqual({
    csharp: 'GetByPlaceholder(new Regex("wor", RegexOptions.IgnoreCase))',
    java: 'getByPlaceholder(Pattern.compile("wor", Pattern.CASE_INSENSITIVE))',
    javascript: 'getByPlaceholder(/wor/i)',
    python: 'get_by_placeholder(re.compile(r"wor", re.IGNORECASE))',
  });

  expect.soft(generate(page.getByAltText('hello'))).toEqual({
    csharp: 'GetByAltText("hello")',
    java: 'getByAltText("hello")',
    javascript: 'getByAltText(\'hello\')',
    python: 'get_by_alt_text("hello")',
  });
  expect.soft(generate(page.getByAltText('Hello', { exact: true }))).toEqual({
    csharp: 'GetByAltText("Hello", new() { Exact = true })',
    java: 'getByAltText("Hello", new Page.GetByAltTextOptions().setExact(true))',
    javascript: 'getByAltText(\'Hello\', { exact: true })',
    python: 'get_by_alt_text("Hello", exact=True)',
  });
  expect.soft(generate(page.getByAltText(/wor/i))).toEqual({
    csharp: 'GetByAltText(new Regex("wor", RegexOptions.IgnoreCase))',
    java: 'getByAltText(Pattern.compile("wor", Pattern.CASE_INSENSITIVE))',
    javascript: 'getByAltText(/wor/i)',
    python: 'get_by_alt_text(re.compile(r"wor", re.IGNORECASE))',
  });

  expect.soft(generate(page.getByTitle('hello'))).toEqual({
    csharp: 'GetByTitle("hello")',
    java: 'getByTitle("hello")',
    javascript: 'getByTitle(\'hello\')',
    python: 'get_by_title("hello")',
  });
  expect.soft(generate(page.getByTitle('Hello', { exact: true }))).toEqual({
    csharp: 'GetByTitle("Hello", new() { Exact = true })',
    java: 'getByTitle("Hello", new Page.GetByTitleOptions().setExact(true))',
    javascript: 'getByTitle(\'Hello\', { exact: true })',
    python: 'get_by_title("Hello", exact=True)',
  });
  expect.soft(generate(page.getByTitle(/wor/i))).toEqual({
    csharp: 'GetByTitle(new Regex("wor", RegexOptions.IgnoreCase))',
    java: 'getByTitle(Pattern.compile("wor", Pattern.CASE_INSENSITIVE))',
    javascript: 'getByTitle(/wor/i)',
    python: 'get_by_title(re.compile(r"wor", re.IGNORECASE))',
  });
  expect.soft(generate(page.getByPlaceholder('hello my\nwo"rld'))).toEqual({
    csharp: 'GetByPlaceholder("hello my\\nwo\\"rld")',
    java: 'getByPlaceholder("hello my\\nwo\\"rld")',
    javascript: 'getByPlaceholder(\'hello my\\nwo"rld\')',
    python: 'get_by_placeholder("hello my\\nwo\\"rld")',
  });
  expect.soft(generate(page.getByAltText('hello my\nwo"rld'))).toEqual({
    csharp: 'GetByAltText("hello my\\nwo\\"rld")',
    java: 'getByAltText("hello my\\nwo\\"rld")',
    javascript: 'getByAltText(\'hello my\\nwo"rld\')',
    python: 'get_by_alt_text("hello my\\nwo\\"rld")',
  });
  expect.soft(generate(page.getByTitle('hello my\nwo"rld'))).toEqual({
    csharp: 'GetByTitle("hello my\\nwo\\"rld")',
    java: 'getByTitle("hello my\\nwo\\"rld")',
    javascript: 'getByTitle(\'hello my\\nwo"rld\')',
    python: 'get_by_title("hello my\\nwo\\"rld")',
  });
});

it('reverse engineer getByRole', async ({ page }) => {
  expect.soft(generate(page.getByRole('button'))).toEqual({
    javascript: `getByRole('button')`,
    python: `get_by_role("button")`,
    java: `getByRole(AriaRole.BUTTON)`,
    csharp: `GetByRole(AriaRole.Button)`,
  });
  expect.soft(generate(page.getByRole('button', { name: 'Hello' }))).toEqual({
    javascript: `getByRole('button', { name: 'Hello' })`,
    python: `get_by_role("button", name="Hello")`,
    java: `getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Hello"))`,
    csharp: `GetByRole(AriaRole.Button, new() { Name = "Hello" })`,
  });
  expect.soft(generate(page.getByRole('button', { name: /Hello/ }))).toEqual({
    javascript: `getByRole('button', { name: /Hello/ })`,
    python: `get_by_role("button", name=re.compile(r"Hello"))`,
    java: `getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName(Pattern.compile("Hello")))`,
    csharp: `GetByRole(AriaRole.Button, new() { NameRegex = new Regex("Hello") })`,
  });
  expect.soft(generate(page.getByRole('button', { name: 'He"llo', exact: true }))).toEqual({
    javascript: `getByRole('button', { name: 'He"llo', exact: true })`,
    python: `get_by_role("button", name="He\\"llo", exact=True)`,
    java: `getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("He\\"llo").setExact(true))`,
    csharp: `GetByRole(AriaRole.Button, new() { Name = "He\\"llo", Exact = true })`,
  });
  expect.soft(generate(page.getByRole('button', { checked: true, pressed: false, level: 3 }))).toEqual({
    javascript: `getByRole('button', { checked: true, level: 3, pressed: false })`,
    python: `get_by_role("button", checked=True, level=3, pressed=False)`,
    java: `getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setChecked(true).setLevel(3).setPressed(false))`,
    csharp: `GetByRole(AriaRole.Button, new() { Checked = true, Level = 3, Pressed = false })`,
  });
});

it('reverse engineer ignore-case locators', async ({ page }) => {
  expect.soft(generate(page.getByText('hello my\nwo"rld'))).toEqual({
    csharp: 'GetByText("hello my\\nwo\\"rld")',
    java: 'getByText("hello my\\nwo\\"rld")',
    javascript: 'getByText(\'hello my\\nwo"rld\')',
    python: 'get_by_text("hello my\\nwo\\"rld")',
  });
  expect.soft(generate(page.getByText('hello       my     wo"rld'))).toEqual({
    csharp: 'GetByText("hello       my     wo\\"rld")',
    java: 'getByText("hello       my     wo\\"rld")',
    javascript: 'getByText(\'hello       my     wo"rld\')',
    python: 'get_by_text("hello       my     wo\\"rld")',
  });
  expect.soft(generate(page.getByLabel('hello my\nwo"rld'))).toEqual({
    csharp: 'GetByLabel("hello my\\nwo\\"rld")',
    java: 'getByLabel("hello my\\nwo\\"rld")',
    javascript: 'getByLabel(\'hello my\\nwo"rld\')',
    python: 'get_by_label("hello my\\nwo\\"rld")',
  });
});

it('reverse engineer ordered locators', async ({ page }) => {
  expect.soft(generate(page.locator('div').nth(3).first().last())).toEqual({
    csharp: `Locator(\"div\").Nth(3).First.Last`,
    java: `locator(\"div\").nth(3).first().last()`,
    javascript: `locator('div').nth(3).first().last()`,
    python: `locator(\"div\").nth(3).first.last`,
  });
});

it('reverse engineer locators with regex', async ({ page }) => {
  expect.soft(generate(page.getByText(/he\/\sl\nlo/))).toEqual({
    csharp: `GetByText(new Regex(\"he\\\\/\\\\sl\\\\nlo\"))`,
    java: `getByText(Pattern.compile(\"he\\\\/\\\\sl\\\\nlo\"))`,
    javascript: `getByText(/he\\/\\sl\\nlo/)`,
    python: `get_by_text(re.compile(r"he/\\sl\\nlo"))`,
  });

  expect.soft(generate(page.getByPlaceholder(/he\/\sl\nlo/))).toEqual({
    csharp: `GetByPlaceholder(new Regex(\"he\\\\/\\\\sl\\\\nlo\"))`,
    java: `getByPlaceholder(Pattern.compile(\"he\\\\/\\\\sl\\\\nlo\"))`,
    javascript: `getByPlaceholder(/he\\/\\sl\\nlo/)`,
    python: `get_by_placeholder(re.compile(r"he/\\sl\\nlo"))`,
  });

  expect.soft(generate(page.getByText(/hel"lo/))).toEqual({
    csharp: `GetByText(new Regex("hel\\"lo"))`,
    java: `getByText(Pattern.compile("hel\\"lo"))`,
    javascript: `getByText(/hel\"lo/)`,
    python: `get_by_text(re.compile(r"hel\\"lo"))`,
  });

  expect.soft(generate(page.getByPlaceholder(/hel"lo/))).toEqual({
    csharp: `GetByPlaceholder(new Regex("hel\\"lo"))`,
    java: `getByPlaceholder(Pattern.compile("hel\\"lo"))`,
    javascript: `getByPlaceholder(/hel"lo/)`,
    python: `get_by_placeholder(re.compile(r"hel\\"lo"))`,
  });
});

it('reverse engineer hasText', async ({ page }) => {
  expect.soft(generate(page.getByText('Hello').filter({ hasText: 'wo"rld\n' }))).toEqual({
    csharp: `GetByText("Hello").Filter(new() { HasText = "wo\\"rld\\n" })`,
    java: `getByText("Hello").filter(new Locator.FilterOptions().setHasText("wo\\"rld\\n"))`,
    javascript: `getByText('Hello').filter({ hasText: 'wo"rld\\n' })`,
    python: `get_by_text("Hello").filter(has_text="wo\\"rld\\n")`,
  });

  expect.soft(generate(page.getByText('Hello').filter({ hasText: /wo\/\srld\n/ }))).toEqual({
    csharp: `GetByText("Hello").Filter(new() { HasTextRegex = new Regex("wo\\\\/\\\\srld\\\\n") })`,
    java: `getByText("Hello").filter(new Locator.FilterOptions().setHasText(Pattern.compile("wo\\\\/\\\\srld\\\\n")))`,
    javascript: `getByText('Hello').filter({ hasText: /wo\\/\\srld\\n/ })`,
    python: `get_by_text("Hello").filter(has_text=re.compile(r"wo/\\srld\\n"))`,
  });

  expect.soft(generate(page.getByText('Hello').filter({ hasText: /wor"ld/ }))).toEqual({
    csharp: `GetByText("Hello").Filter(new() { HasTextRegex = new Regex("wor\\"ld") })`,
    java: `getByText("Hello").filter(new Locator.FilterOptions().setHasText(Pattern.compile("wor\\"ld")))`,
    javascript: `getByText('Hello').filter({ hasText: /wor"ld/ })`,
    python: `get_by_text("Hello").filter(has_text=re.compile(r"wor\\"ld"))`,
  });
});

it('reverse engineer has', async ({ page }) => {
  expect.soft(generate(page.getByText('Hello').filter({ has: page.locator('div').getByText('bye') }))).toEqual({
    csharp: `GetByText("Hello").Filter(new() { Has = Locator("div").GetByText("bye") })`,
    java: `getByText("Hello").filter(new Locator.FilterOptions().setHas(locator("div").getByText("bye")))`,
    javascript: `getByText('Hello').filter({ has: locator('div').getByText('bye') })`,
    python: `get_by_text("Hello").filter(has=locator("div").get_by_text("bye"))`,
  });

  const locator = page
      .locator('section')
      .filter({ has: page.locator('div').filter({ has: page.locator('span') }) })
      .filter({ hasText: 'foo' })
      .filter({ has: page.locator('a') });
  expect.soft(generate(locator)).toEqual({
    csharp: `Locator("section").Filter(new() { Has = Locator("div").Filter(new() { Has = Locator("span") }) }).Filter(new() { HasText = "foo" }).Filter(new() { Has = Locator("a") })`,
    java: `locator("section").filter(new Locator.FilterOptions().setHas(locator("div").filter(new Locator.FilterOptions().setHas(locator("span"))))).filter(new Locator.FilterOptions().setHasText("foo")).filter(new Locator.FilterOptions().setHas(locator("a")))`,
    javascript: `locator('section').filter({ has: locator('div').filter({ has: locator('span') }) }).filter({ hasText: 'foo' }).filter({ has: locator('a') })`,
    python: `locator("section").filter(has=locator("div").filter(has=locator("span"))).filter(has_text="foo").filter(has=locator("a"))`,
  });
});

it('reverse engineer frameLocator', async ({ page }) => {
  const locator = page
      .frameLocator('iframe')
      .getByText('foo', { exact: true })
      .frameLocator('frame').first()
      .frameLocator('iframe')
      .locator('span');
  expect.soft(generate(locator)).toEqual({
    csharp: `FrameLocator("iframe").GetByText("foo", new() { Exact = true }).FrameLocator("frame").First.FrameLocator("iframe").Locator("span")`,
    java: `frameLocator("iframe").getByText("foo", new FrameLocator.GetByTextOptions().setExact(true)).frameLocator("frame").first().frameLocator("iframe").locator("span")`,
    javascript: `frameLocator('iframe').getByText('foo', { exact: true }).frameLocator('frame').first().frameLocator('iframe').locator('span')`,
    python: `frame_locator("iframe").get_by_text("foo", exact=True).frame_locator("frame").first.frame_locator("iframe").locator("span")`,
  });

  // Note that frame locators with ">>" are not restored back due to ambiguity.
  const selector = (page.frameLocator('div >> iframe').locator('span') as any)._selector;
  expect.soft(asLocator('javascript', selector, false)).toBe(`locator('div').frameLocator('iframe').locator('span')`);
});

it.describe(() => {
  it.beforeEach(async ({ context }) => {
    await (context as any)._enableRecorder({ language: 'javascript' });
  });

  it('reverse engineer internal:has-text locators', async ({ page }) => {
    await page.setContent(`
      <div>Hello <span>world</span></div>
      <div>Goodbye <span mark=1>world</span></div>
    `);
    expect.soft(await generateForNode(page, '[mark="1"]')).toEqual({
      csharp: 'Locator("div").Filter(new() { HasText = "Goodbye world" }).Locator("span")',
      java: 'locator("div").filter(new Locator.FilterOptions().setHasText("Goodbye world")).locator("span")',
      javascript: `locator('div').filter({ hasText: 'Goodbye world' }).locator('span')`,
      python: 'locator("div").filter(has_text="Goodbye world").locator("span")',
    });
  });
});

it('parse locators strictly', () => {
  const selector = 'div >> internal:has-text=\"Goodbye world\"i >> span';

  // Exact
  expect.soft(parseLocator('csharp', `Locator("div").Filter(new() { HasText = "Goodbye world" }).Locator("span")`)).toBe(selector);
  expect.soft(parseLocator('java', `locator("div").filter(new Locator.FilterOptions().setHasText("Goodbye world")).locator("span")`)).toBe(selector);
  expect.soft(parseLocator('javascript', `locator('div').filter({ hasText: 'Goodbye world' }).locator('span')`)).toBe(selector);
  expect.soft(parseLocator('python', `locator("div").filter(has_text="Goodbye world").locator("span")`)).toBe(selector);

  // Quotes
  expect.soft(parseLocator('javascript', `locator("div").filter({ hasText: "Goodbye world" }).locator("span")`)).toBe(selector);
  expect.soft(parseLocator('python', `locator('div').filter(has_text='Goodbye world').locator('span')`)).toBe(selector);

  // Whitespace
  expect.soft(parseLocator('csharp', `Locator("div")  .  Filter (new ( ) {  HasText =    "Goodbye world" }).Locator(  "span"   )`)).toBe(selector);
  expect.soft(parseLocator('java', `  locator("div"  ).  filter(  new    Locator. FilterOptions    ( ) .setHasText(   "Goodbye world" ) ).locator(   "span")`)).toBe(selector);
  expect.soft(parseLocator('javascript', `locator\n('div')\n\n.filter({ hasText  : 'Goodbye world'\n }\n).locator('span')\n`)).toBe(selector);
  expect.soft(parseLocator('python', `\tlocator(\t"div").filter(\thas_text="Goodbye world"\t).locator\t("span")`)).toBe(selector);

  // Extra symbols
  expect.soft(parseLocator('csharp', `Locator("div").Filter(new() { HasText = "Goodbye world" }).Locator("span"))`)).not.toBe(selector);
  expect.soft(parseLocator('java', `locator("div").filter(new Locator.FilterOptions().setHasText("Goodbye world"))..locator("span")`)).not.toBe(selector);
  expect.soft(parseLocator('javascript', `locator('div').filter({ hasText: 'Goodbye world' }}).locator('span')`)).not.toBe(selector);
  expect.soft(parseLocator('python', `locator("div").filter(has_text=="Goodbye world").locator("span")`)).not.toBe(selector);
});
