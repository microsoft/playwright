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
import { asLocator, asLocators, asLocatorDescription } from '../../packages/playwright-core/lib/utils/isomorphic/locatorGenerators';
import { locatorOrSelectorAsSelector as parseLocator } from '../../packages/playwright-core/lib/utils/isomorphic/locatorParser';
import type { Page, Frame, Locator, FrameLocator } from 'playwright-core';

it.skip(({ mode }) => mode !== 'default');

function generate(locator: Locator | FrameLocator) {
  return generateForSelector((locator as any)._selector || (locator as any)._frameSelector);
}

function generateForSelector(selector: string) {
  const result: any = {};
  for (const lang of ['javascript', 'python', 'java', 'csharp']) {
    const locatorString = asLocator(lang, selector);
    expect.soft(parseLocator(lang, locatorString, 'data-testid'), lang + ' mismatch').toBe(selector);
    result[lang] = locatorString;
  }
  return result;
}

async function generateForNode(pageOrFrame: Page | Frame, target: string): Promise<string> {
  const selector = await pageOrFrame.locator(target).evaluate(e => (window as any).playwright.selector(e));
  const result: any = {};
  for (const lang of ['javascript', 'python', 'java', 'csharp']) {
    const locatorString = asLocator(lang, selector);
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

  expect.soft(generate(page.getByTestId(/He"llo/))).toEqual({
    javascript: 'getByTestId(/He"llo/)',
    python: 'get_by_test_id(re.compile(r"He\\"llo"))',
    java: 'getByTestId(Pattern.compile("He\\"llo"))',
    csharp: 'GetByTestId(new Regex("He\\"llo"))'
  });

  expect.soft(generate(page.getByTestId(/He\\"llo/))).toEqual({
    javascript: 'getByTestId(/He\\\\"llo/)',
    python: 'get_by_test_id(re.compile(r"He\\\\\\"llo"))',
    java: 'getByTestId(Pattern.compile("He\\\\\\\\\\"llo"))',
    csharp: 'GetByTestId(new Regex("He\\\\\\\\\\"llo"))'
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
  expect.soft(generate(page.getByRole('heading', {}))).toEqual({
    javascript: "getByRole('heading')",
    python: 'get_by_role("heading")',
    java: 'getByRole(AriaRole.HEADING)',
    csharp: 'GetByRole(AriaRole.Heading)'
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

it('reverse engineer hasNotText', async ({ page }) => {
  expect.soft(generate(page.getByText('Hello').filter({ hasNotText: 'wo"rld\n' }))).toEqual({
    csharp: `GetByText("Hello").Filter(new() { HasNotText = "wo\\"rld\\n" })`,
    java: `getByText("Hello").filter(new Locator.FilterOptions().setHasNotText("wo\\"rld\\n"))`,
    javascript: `getByText('Hello').filter({ hasNotText: 'wo"rld\\n' })`,
    python: `get_by_text("Hello").filter(has_not_text="wo\\"rld\\n")`,
  });
});

it('reverse engineer visible', async ({ page }) => {
  expect.soft(generate(page.getByText('Hello').filter({ visible: true }).locator('div'))).toEqual({
    csharp: `GetByText("Hello").Filter(new() { Visible = true }).Locator("div")`,
    java: `getByText("Hello").filter(new Locator.FilterOptions().setVisible(true)).locator("div")`,
    javascript: `getByText('Hello').filter({ visible: true }).locator('div')`,
    python: `get_by_text("Hello").filter(visible=True).locator("div")`,
  });
  expect.soft(generate(page.getByText('Hello').filter({ visible: false }).locator('div'))).toEqual({
    csharp: `GetByText("Hello").Filter(new() { Visible = false }).Locator("div")`,
    java: `getByText("Hello").filter(new Locator.FilterOptions().setVisible(false)).locator("div")`,
    javascript: `getByText('Hello').filter({ visible: false }).locator('div')`,
    python: `get_by_text("Hello").filter(visible=False).locator("div")`,
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

it('reverse engineer hasNot', async ({ page }) => {
  expect.soft(generate(page.getByText('Hello').filter({ hasNot: page.locator('div').getByText('bye') }))).toEqual({
    csharp: `GetByText("Hello").Filter(new() { HasNot = Locator("div").GetByText("bye") })`,
    java: `getByText("Hello").filter(new Locator.FilterOptions().setHasNot(locator("div").getByText("bye")))`,
    javascript: `getByText('Hello').filter({ hasNot: locator('div').getByText('bye') })`,
    python: `get_by_text("Hello").filter(has_not=locator("div").get_by_text("bye"))`,
  });

  const locator = page
      .locator('section')
      .filter({ has: page.locator('div').filter({ hasNot: page.locator('span') }) })
      .filter({ hasText: 'foo' })
      .filter({ hasNot: page.locator('a') });
  expect.soft(generate(locator)).toEqual({
    csharp: `Locator("section").Filter(new() { Has = Locator("div").Filter(new() { HasNot = Locator("span") }) }).Filter(new() { HasText = "foo" }).Filter(new() { HasNot = Locator("a") })`,
    java: `locator("section").filter(new Locator.FilterOptions().setHas(locator("div").filter(new Locator.FilterOptions().setHasNot(locator("span"))))).filter(new Locator.FilterOptions().setHasText("foo")).filter(new Locator.FilterOptions().setHasNot(locator("a")))`,
    javascript: `locator('section').filter({ has: locator('div').filter({ hasNot: locator('span') }) }).filter({ hasText: 'foo' }).filter({ hasNot: locator('a') })`,
    python: `locator("section").filter(has=locator("div").filter(has_not=locator("span"))).filter(has_text="foo").filter(has_not=locator("a"))`,
  });
});

it('reverse engineer has + hasText', async ({ page }) => {
  const locator = page.locator('section').filter({ hasText: 'foo', has: page.locator('div') }).locator('a');
  expect.soft(generate(locator)).toEqual({
    csharp: `Locator("section").Filter(new() { HasText = "foo" }).Filter(new() { Has = Locator("div") }).Locator("a")`,
    java: `locator("section").filter(new Locator.FilterOptions().setHasText("foo")).filter(new Locator.FilterOptions().setHas(locator("div"))).locator("a")`,
    javascript: `locator('section').filter({ hasText: 'foo' }).filter({ has: locator('div') }).locator('a')`,
    python: `locator("section").filter(has_text="foo").filter(has=locator("div")).locator("a")`,
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
    csharp: `Locator("iframe").ContentFrame.GetByText("foo", new() { Exact = true }).Locator("frame").First.ContentFrame.Locator("iframe").ContentFrame.Locator("span")`,
    java: `locator("iframe").contentFrame().getByText("foo", new FrameLocator.GetByTextOptions().setExact(true)).locator("frame").first().contentFrame().locator("iframe").contentFrame().locator("span")`,
    javascript: `locator('iframe').contentFrame().getByText('foo', { exact: true }).locator('frame').first().contentFrame().locator('iframe').contentFrame().locator('span')`,
    python: `locator("iframe").content_frame.get_by_text("foo", exact=True).locator("frame").first.content_frame.locator("iframe").content_frame.locator("span")`,
  });

  // Note that frame locators with ">>" are not restored back due to ambiguity.
  const selector = (page.frameLocator('div >> iframe').locator('span') as any)._selector;
  expect.soft(asLocator('javascript', selector)).toBe(`locator('div').locator('iframe').contentFrame().locator('span')`);
});

it('generate multiple locators', async ({ page }) => {
  const selector = (page.locator('div', { hasText: 'foo' }).nth(0).filter({ has: page.locator('span', { hasNotText: 'bar' }).nth(-1) }) as any)._selector;
  const locators = {
    javascript: [
      `locator('div').filter({ hasText: 'foo' }).first().filter({ has: locator('span').filter({ hasNotText: 'bar' }).last() })`,
      `locator('div').filter({ hasText: 'foo' }).first().filter({ has: locator('span').filter({ hasNotText: 'bar' }).nth(-1) })`,
      `locator('div').filter({ hasText: 'foo' }).first().filter({ has: locator('span', { hasNotText: 'bar' }).last() })`,
      `locator('div').filter({ hasText: 'foo' }).first().filter({ has: locator('span', { hasNotText: 'bar' }).nth(-1) })`,
      `locator('div').filter({ hasText: 'foo' }).nth(0).filter({ has: locator('span').filter({ hasNotText: 'bar' }).last() })`,
      `locator('div').filter({ hasText: 'foo' }).nth(0).filter({ has: locator('span').filter({ hasNotText: 'bar' }).nth(-1) })`,
      `locator('div').filter({ hasText: 'foo' }).nth(0).filter({ has: locator('span', { hasNotText: 'bar' }).last() })`,
      `locator('div').filter({ hasText: 'foo' }).nth(0).filter({ has: locator('span', { hasNotText: 'bar' }).nth(-1) })`,
      `locator('div', { hasText: 'foo' }).first().filter({ has: locator('span').filter({ hasNotText: 'bar' }).last() })`,
      `locator('div', { hasText: 'foo' }).first().filter({ has: locator('span').filter({ hasNotText: 'bar' }).nth(-1) })`,
      `locator('div', { hasText: 'foo' }).first().filter({ has: locator('span', { hasNotText: 'bar' }).last() })`,
      `locator('div', { hasText: 'foo' }).first().filter({ has: locator('span', { hasNotText: 'bar' }).nth(-1) })`,
      `locator('div', { hasText: 'foo' }).nth(0).filter({ has: locator('span').filter({ hasNotText: 'bar' }).last() })`,
      `locator('div', { hasText: 'foo' }).nth(0).filter({ has: locator('span').filter({ hasNotText: 'bar' }).nth(-1) })`,
      `locator('div', { hasText: 'foo' }).nth(0).filter({ has: locator('span', { hasNotText: 'bar' }).last() })`,
      `locator('div', { hasText: 'foo' }).nth(0).filter({ has: locator('span', { hasNotText: 'bar' }).nth(-1) })`,
    ],
    java: [
      `locator("div").filter(new Locator.FilterOptions().setHasText("foo")).first().filter(new Locator.FilterOptions().setHas(locator("span").filter(new Locator.FilterOptions().setHasNotText("bar")).last()))`,
      `locator("div").filter(new Locator.FilterOptions().setHasText("foo")).first().filter(new Locator.FilterOptions().setHas(locator("span").filter(new Locator.FilterOptions().setHasNotText("bar")).nth(-1)))`,
      `locator("div").filter(new Locator.FilterOptions().setHasText("foo")).first().filter(new Locator.FilterOptions().setHas(locator("span", new Page.LocatorOptions().setHasNotText("bar")).last()))`,
      `locator("div").filter(new Locator.FilterOptions().setHasText("foo")).first().filter(new Locator.FilterOptions().setHas(locator("span", new Page.LocatorOptions().setHasNotText("bar")).nth(-1)))`,
      `locator("div").filter(new Locator.FilterOptions().setHasText("foo")).nth(0).filter(new Locator.FilterOptions().setHas(locator("span").filter(new Locator.FilterOptions().setHasNotText("bar")).last()))`,
      `locator("div").filter(new Locator.FilterOptions().setHasText("foo")).nth(0).filter(new Locator.FilterOptions().setHas(locator("span").filter(new Locator.FilterOptions().setHasNotText("bar")).nth(-1)))`,
      `locator("div").filter(new Locator.FilterOptions().setHasText("foo")).nth(0).filter(new Locator.FilterOptions().setHas(locator("span", new Page.LocatorOptions().setHasNotText("bar")).last()))`,
      `locator("div").filter(new Locator.FilterOptions().setHasText("foo")).nth(0).filter(new Locator.FilterOptions().setHas(locator("span", new Page.LocatorOptions().setHasNotText("bar")).nth(-1)))`,
      `locator("div", new Page.LocatorOptions().setHasText("foo")).first().filter(new Locator.FilterOptions().setHas(locator("span").filter(new Locator.FilterOptions().setHasNotText("bar")).last()))`,
      `locator("div", new Page.LocatorOptions().setHasText("foo")).first().filter(new Locator.FilterOptions().setHas(locator("span").filter(new Locator.FilterOptions().setHasNotText("bar")).nth(-1)))`,
      `locator("div", new Page.LocatorOptions().setHasText("foo")).first().filter(new Locator.FilterOptions().setHas(locator("span", new Page.LocatorOptions().setHasNotText("bar")).last()))`,
      `locator("div", new Page.LocatorOptions().setHasText("foo")).first().filter(new Locator.FilterOptions().setHas(locator("span", new Page.LocatorOptions().setHasNotText("bar")).nth(-1)))`,
      `locator("div", new Page.LocatorOptions().setHasText("foo")).nth(0).filter(new Locator.FilterOptions().setHas(locator("span").filter(new Locator.FilterOptions().setHasNotText("bar")).last()))`,
      `locator("div", new Page.LocatorOptions().setHasText("foo")).nth(0).filter(new Locator.FilterOptions().setHas(locator("span").filter(new Locator.FilterOptions().setHasNotText("bar")).nth(-1)))`,
      `locator("div", new Page.LocatorOptions().setHasText("foo")).nth(0).filter(new Locator.FilterOptions().setHas(locator("span", new Page.LocatorOptions().setHasNotText("bar")).last()))`,
      `locator("div", new Page.LocatorOptions().setHasText("foo")).nth(0).filter(new Locator.FilterOptions().setHas(locator("span", new Page.LocatorOptions().setHasNotText("bar")).nth(-1)))`,
    ],
    python: [
      `locator("div").filter(has_text="foo").first.filter(has=locator("span").filter(has_not_text="bar").last)`,
      `locator("div").filter(has_text="foo").first.filter(has=locator("span").filter(has_not_text="bar").nth(-1))`,
      `locator("div").filter(has_text="foo").first.filter(has=locator("span", has_not_text="bar").last)`,
      `locator("div").filter(has_text="foo").first.filter(has=locator("span", has_not_text="bar").nth(-1))`,
      `locator("div").filter(has_text="foo").nth(0).filter(has=locator("span").filter(has_not_text="bar").last)`,
      `locator("div").filter(has_text="foo").nth(0).filter(has=locator("span").filter(has_not_text="bar").nth(-1))`,
      `locator("div").filter(has_text="foo").nth(0).filter(has=locator("span", has_not_text="bar").last)`,
      `locator("div").filter(has_text="foo").nth(0).filter(has=locator("span", has_not_text="bar").nth(-1))`,
      `locator("div", has_text="foo").first.filter(has=locator("span").filter(has_not_text="bar").last)`,
      `locator("div", has_text="foo").first.filter(has=locator("span").filter(has_not_text="bar").nth(-1))`,
      `locator("div", has_text="foo").first.filter(has=locator("span", has_not_text="bar").last)`,
      `locator("div", has_text="foo").first.filter(has=locator("span", has_not_text="bar").nth(-1))`,
      `locator("div", has_text="foo").nth(0).filter(has=locator("span").filter(has_not_text="bar").last)`,
      `locator("div", has_text="foo").nth(0).filter(has=locator("span").filter(has_not_text="bar").nth(-1))`,
      `locator("div", has_text="foo").nth(0).filter(has=locator("span", has_not_text="bar").last)`,
      `locator("div", has_text="foo").nth(0).filter(has=locator("span", has_not_text="bar").nth(-1))`,
    ],
    csharp: [
      `Locator("div").Filter(new() { HasText = "foo" }).First.Filter(new() { Has = Locator("span").Filter(new() { HasNotText = "bar" }).Last })`,
      `Locator("div").Filter(new() { HasText = "foo" }).First.Filter(new() { Has = Locator("span").Filter(new() { HasNotText = "bar" }).Nth(-1) })`,
      `Locator("div").Filter(new() { HasText = "foo" }).First.Filter(new() { Has = Locator("span", new() { HasNotText = "bar" }).Last })`,
      `Locator("div").Filter(new() { HasText = "foo" }).First.Filter(new() { Has = Locator("span", new() { HasNotText = "bar" }).Nth(-1) })`,
      `Locator("div").Filter(new() { HasText = "foo" }).Nth(0).Filter(new() { Has = Locator("span").Filter(new() { HasNotText = "bar" }).Last })`,
      `Locator("div").Filter(new() { HasText = "foo" }).Nth(0).Filter(new() { Has = Locator("span").Filter(new() { HasNotText = "bar" }).Nth(-1) })`,
      `Locator("div").Filter(new() { HasText = "foo" }).Nth(0).Filter(new() { Has = Locator("span", new() { HasNotText = "bar" }).Last })`,
      `Locator("div").Filter(new() { HasText = "foo" }).Nth(0).Filter(new() { Has = Locator("span", new() { HasNotText = "bar" }).Nth(-1) })`,
      `Locator("div", new() { HasText = "foo" }).First.Filter(new() { Has = Locator("span").Filter(new() { HasNotText = "bar" }).Last })`,
      `Locator("div", new() { HasText = "foo" }).First.Filter(new() { Has = Locator("span").Filter(new() { HasNotText = "bar" }).Nth(-1) })`,
      `Locator("div", new() { HasText = "foo" }).First.Filter(new() { Has = Locator("span", new() { HasNotText = "bar" }).Last })`,
      `Locator("div", new() { HasText = "foo" }).First.Filter(new() { Has = Locator("span", new() { HasNotText = "bar" }).Nth(-1) })`,
      `Locator("div", new() { HasText = "foo" }).Nth(0).Filter(new() { Has = Locator("span").Filter(new() { HasNotText = "bar" }).Last })`,
      `Locator("div", new() { HasText = "foo" }).Nth(0).Filter(new() { Has = Locator("span").Filter(new() { HasNotText = "bar" }).Nth(-1) })`,
      `Locator("div", new() { HasText = "foo" }).Nth(0).Filter(new() { Has = Locator("span", new() { HasNotText = "bar" }).Last })`,
      `Locator("div", new() { HasText = "foo" }).Nth(0).Filter(new() { Has = Locator("span", new() { HasNotText = "bar" }).Nth(-1) })`,
    ],
  };
  for (const lang of ['javascript', 'java', 'python', 'csharp'] as const) {
    expect.soft(asLocators(lang, selector)).toEqual(locators[lang]);
    for (const locator of locators[lang])
      expect.soft(parseLocator(lang, locator, 'data-testid'), `parse(${lang}): ${locator}`).toBe(selector);
  }
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

    expect.soft(asLocator('javascript', 'div >> internal:has-text="foo"s')).toBe(`locator('div').locator('internal:has-text="foo"s')`);
    expect.soft(asLocator('javascript', 'div >> internal:has-not-text="foo"s')).toBe(`locator('div').locator('internal:has-not-text="foo"s')`);
  });
});

it('asLocator internal:and', async () => {
  expect.soft(asLocator('javascript', 'div >> internal:and="span >> article"')).toBe(`locator('div').and(locator('span').locator('article'))`);
  expect.soft(asLocator('python', 'div >> internal:and="span >> article"')).toBe(`locator("div").and_(locator("span").locator("article"))`);
  expect.soft(asLocator('java', 'div >> internal:and="span >> article"')).toBe(`locator("div").and(locator("span").locator("article"))`);
  expect.soft(asLocator('csharp', 'div >> internal:and="span >> article"')).toBe(`Locator("div").And(Locator("span").Locator("article"))`);
});

it('asLocator internal:or', async () => {
  expect.soft(asLocator('javascript', 'div >> internal:or="span >> article"')).toBe(`locator('div').or(locator('span').locator('article'))`);
  expect.soft(asLocator('python', 'div >> internal:or="span >> article"')).toBe(`locator("div").or_(locator("span").locator("article"))`);
  expect.soft(asLocator('java', 'div >> internal:or="span >> article"')).toBe(`locator("div").or(locator("span").locator("article"))`);
  expect.soft(asLocator('csharp', 'div >> internal:or="span >> article"')).toBe(`Locator("div").Or(Locator("span").Locator("article"))`);
});

it('asLocator internal:chain', async () => {
  expect.soft(asLocator('javascript', 'div >> internal:chain="span >> article"')).toBe(`locator('div').locator(locator('span').locator('article'))`);
  expect.soft(asLocator('python', 'div >> internal:chain="span >> article"')).toBe(`locator("div").locator(locator("span").locator("article"))`);
  expect.soft(asLocator('java', 'div >> internal:chain="span >> article"')).toBe(`locator("div").locator(locator("span").locator("article"))`);
  expect.soft(asLocator('csharp', 'div >> internal:chain="span >> article"')).toBe(`Locator("div").Locator(Locator("span").Locator("article"))`);
});

it('asLocator xpath', async () => {
  const selector = `//*[contains(normalizer-text(), 'foo']`;
  expect.soft(asLocator('javascript', selector)).toBe(`locator('//*[contains(normalizer-text(), \\'foo\\']')`);
  expect.soft(asLocator('python', selector)).toBe(`locator(\"//*[contains(normalizer-text(), 'foo']\")`);
  expect.soft(asLocator('java', selector)).toBe(`locator(\"//*[contains(normalizer-text(), 'foo']\")`);
  expect.soft(asLocator('csharp', selector)).toBe(`Locator(\"//*[contains(normalizer-text(), 'foo']\")`);
  expect.soft(parseLocator('javascript', `locator('//*[contains(normalizer-text(), \\'foo\\']')`, 'data-testid')).toBe("//*[contains(normalizer-text(), 'foo']");
  expect.soft(parseLocator('javascript', `locator("//*[contains(normalizer-text(), 'foo']")`, 'data-testid')).toBe("//*[contains(normalizer-text(), 'foo']");
  expect.soft(parseLocator('javascript', `locator('xpath=//*[contains(normalizer-text(), \\'foo\\']')`, 'data-testid')).toBe("xpath=//*[contains(normalizer-text(), 'foo']");
  expect.soft(parseLocator('javascript', `locator("xpath=//*[contains(normalizer-text(), 'foo']")`, 'data-testid')).toBe("xpath=//*[contains(normalizer-text(), 'foo']");
  expect.soft(parseLocator('python', `locator("//*[contains(normalizer-text(), 'foo']")`, 'data-testid')).toBe("//*[contains(normalizer-text(), 'foo']");
  expect.soft(parseLocator('python', `locator("xpath=//*[contains(normalizer-text(), 'foo']")`, 'data-testid')).toBe("xpath=//*[contains(normalizer-text(), 'foo']");
  expect.soft(parseLocator('java', `locator("//*[contains(normalizer-text(), 'foo']")`, 'data-testid')).toBe("//*[contains(normalizer-text(), 'foo']");
  expect.soft(parseLocator('java', `locator("xpath=//*[contains(normalizer-text(), 'foo']")`, 'data-testid')).toBe("xpath=//*[contains(normalizer-text(), 'foo']");
  expect.soft(parseLocator('csharp', `Locator("//*[contains(normalizer-text(), 'foo']")`, 'data-testid')).toBe("//*[contains(normalizer-text(), 'foo']");
  expect.soft(parseLocator('csharp', `Locator("xpath=//*[contains(normalizer-text(), 'foo']")`, 'data-testid')).toBe("xpath=//*[contains(normalizer-text(), 'foo']");
});

it('parseLocator quotes', async () => {
  expect.soft(parseLocator('javascript', `locator('text="bar"')`, '')).toBe(`text="bar"`);
  expect.soft(parseLocator('javascript', `locator("text='bar'")`, '')).toBe(`text='bar'`);
  expect.soft(parseLocator('javascript', "locator(`text='bar'`)", '')).toBe(`text='bar'`);
  expect.soft(parseLocator('python', `locator("text='bar'")`, '')).toBe(`text='bar'`);
  expect.soft(parseLocator('python', `locator('text="bar"')`, '')).toBe(``);
  expect.soft(parseLocator('java', `locator("text='bar'")`, '')).toBe(`text='bar'`);
  expect.soft(parseLocator('java', `locator('text="bar"')`, '')).toBe(``);
  expect.soft(parseLocator('csharp', `Locator("text='bar'")`, '')).toBe(`text='bar'`);
  expect.soft(parseLocator('csharp', `Locator('text="bar"')`, '')).toBe(``);

  const mixedQuotes = `
    locator("[id*=freetext-field]")
        .locator('input:below(:text("Assigned Number:"))')
        .locator("visible=true")
  `;
  expect.soft(parseLocator('javascript', mixedQuotes, '')).toBe(`[id*=freetext-field] >> input:below(:text("Assigned Number:")) >> visible=true`);
});

it('parseLocator css', async () => {
  expect.soft(parseLocator('javascript', `locator('.foo')`, '')).toBe(`.foo`);
  expect.soft(parseLocator('javascript', `locator('css=.foo')`, '')).toBe(`css=.foo`);
  expect.soft(parseLocator('python', `locator(".foo")`, '')).toBe(`.foo`);
  expect.soft(parseLocator('python', `locator("css=.foo")`, '')).toBe(`css=.foo`);
  expect.soft(parseLocator('java', `locator(".foo")`, '')).toBe(`.foo`);
  expect.soft(parseLocator('java', `locator("css=.foo")`, '')).toBe(`css=.foo`);
  expect.soft(parseLocator('csharp', `Locator(".foo")`, '')).toBe(`.foo`);
  expect.soft(parseLocator('csharp', `Locator("css=.foo")`, '')).toBe(`css=.foo`);
});


it('parseLocator options', async () => {
  expect.soft(parseLocator('javascript', `getByRole('heading', {})`, '')).toBe(`internal:role=heading`);
  expect.soft(parseLocator('javascript', `getByRole('checkbox', { checked:false, includeHidden: true })`, '')).toBe(`internal:role=checkbox[checked=false][include-hidden=true]`);
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
  expect.soft(parseLocator('python', `locator('div').filter(has_text='Goodbye world').locator('span')`)).not.toBe(selector);

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

it('parseLocator frames', async () => {
  expect.soft(parseLocator('javascript', `locator('iframe').contentFrame().getByText('foo')`, '')).toBe(`iframe >> internal:control=enter-frame >> internal:text=\"foo\"i`);
  expect.soft(parseLocator('javascript', `frameLocator('iframe').getByText('foo')`, '')).toBe(`iframe >> internal:control=enter-frame >> internal:text=\"foo\"i`);
  expect.soft(parseLocator('javascript', `frameLocator('css=iframe').getByText('foo')`, '')).toBe(`css=iframe >> internal:control=enter-frame >> internal:text=\"foo\"i`);
  expect.soft(parseLocator('javascript', `getByTitle('iframe title').contentFrame()`)).toBe(`internal:attr=[title=\"iframe title\"i] >> internal:control=enter-frame`);

  expect.soft(asLocators('javascript', 'internal:attr=[title=\"iframe title\"i] >> internal:control=enter-frame')).toEqual([`getByTitle('iframe title').contentFrame()`]);

  expect.soft(parseLocator('python', `locator("iframe").content_frame.get_by_text("foo")`, '')).toBe(`iframe >> internal:control=enter-frame >> internal:text=\"foo\"i`);
  expect.soft(parseLocator('python', `frame_locator("iframe").get_by_text("foo")`, '')).toBe(`iframe >> internal:control=enter-frame >> internal:text=\"foo\"i`);
  expect.soft(parseLocator('python', `frame_locator("css=iframe").get_by_text("foo")`, '')).toBe(`css=iframe >> internal:control=enter-frame >> internal:text=\"foo\"i`);

  expect.soft(parseLocator('csharp', `Locator("iframe").ContentFrame.GetByText("foo")`, '')).toBe(`iframe >> internal:control=enter-frame >> internal:text=\"foo\"i`);
  expect.soft(parseLocator('csharp', `FrameLocator("iframe").GetByText("foo")`, '')).toBe(`iframe >> internal:control=enter-frame >> internal:text=\"foo\"i`);

  expect.soft(parseLocator('java', `locator("iframe").contentFrame().getByText("foo")`, '')).toBe(`iframe >> internal:control=enter-frame >> internal:text=\"foo\"i`);
  expect.soft(parseLocator('java', `frameLocator("iframe").getByText("foo")`, '')).toBe(`iframe >> internal:control=enter-frame >> internal:text=\"foo\"i`);
});

it('should not oom in locator parser', async ({ page }) => {
  const l = page.locator.bind(page);
  const locator = page.locator('text=L1').or(l('text=L2').or(l('text=L3').or(l('text=L4')).or(l('#f0')
      .contentFrame().locator('#f0_mid_0')
      .contentFrame().locator('text=L5').or(l('text=L6'))).or(l('#f0')
      .contentFrame().locator('#f0_mid_0')
      .contentFrame().locator('text=L7')
      .or(l('text=L8'))))).or(l('text=L9').or(l('text=L10').or(l('text=L11')).or(l('#f0')
      .contentFrame().locator('#f0_mid_0')
      .contentFrame().locator('text=L12').or(l('text=L13'))).or(l('#f0')
      .contentFrame().locator('#f0_mid_0')
      .contentFrame().locator('text=L14').or(l('text=L15'))))).or(l('text=L16').or(l('text=L17').or(l('text=L18')).or(l('#f0')
      .contentFrame().locator('#f0_mid_0')
      .contentFrame().locator('text=L19').or(l('text=L20'))).or(l('#f0')
      .contentFrame().locator('#f0_mid_0')
      .contentFrame().locator('text=L21').or(l('text=L22'))))).or(l('text=L23').or(l('text=L24').or(l('text=L25')).or(l('#f0')
      .contentFrame().locator('#f0_mid_0')
      .contentFrame().locator('text=L26').or(l('text=L27'))).or(l('#f0')
      .contentFrame().locator('#f0_mid_0')
      .contentFrame().locator('text=L28').or(l('text=L29')))));
  const error = await locator.count().catch(e => e);
  expect(error.message).toContain('Frame locators are not allowed inside composite locators');
});

it('asLocatorDescription invalid input', async () => {
  expect.soft(asLocatorDescription('javascript', `body >> internal:describe="desc"`)).toBe(`desc`);
  expect.soft(asLocatorDescription('javascript', `body >> internal:describe=12`)).toBe(`locator('body')`);
  expect.soft(asLocatorDescription('javascript', `following-sibling::*[1]`)).toBe(`following-sibling::*[1]`);
  expect.soft(asLocatorDescription('javascript', `body >> internal:describe="desc" >> div`)).toBe(`locator('body').locator('div')`);
});
