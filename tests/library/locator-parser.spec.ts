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

import { test as it, expect as baseExpect } from '@playwright/test';
import { iso } from '../../packages/playwright-core/lib/coreBundle';
import { getByAltTextSelector, getByLabelSelector, getByPlaceholderSelector, getByRoleSelector, getByTestIdSelector, getByTextSelector, getByTitleSelector } from '../../packages/isomorphic/locatorUtils';
import type { FrameLocator, Locator, Page } from 'playwright-core';

const { asLocators, kAnyFrameSelector, parseSelector, stringifySelector, unsafeLocatorOrSelectorAsSelector } = iso;

// Client sources only type-check with the packages tsconfig, so they are loaded at runtime.
const client: {
  Locator: new (frame: null, selector: string, options?: object) => Locator & { _selector: string };
  FrameLocator: new (frame: null, selector: string) => FrameLocator & { _frameSelector: string };
  setTestIdAttribute: (testIdAttributeName: string) => void;
  testIdAttributeName: () => string;
} = require('../../packages/playwright-core/src/client/locator');

type Language = 'javascript' | 'python' | 'java' | 'csharp';
type AriaRole = Parameters<Page['getByRole']>[0];
type Built = Locator | FrameLocator;
type Receiver = 'Page' | 'Locator' | 'FrameLocator';
type Call = { method: string, args: any[] };

// One of the ways a user may format a locator in a given language.
type Style = {
  name: string;
  quote: string;
  multiline?: boolean;
  compact?: boolean;
  trailingCommas?: boolean;
  rawRegex?: boolean;
  regexFlagAliases?: boolean;
  verbatimRegex?: boolean;
  optionsType?: 'typed' | 'typed()';
};

type Styles = Partial<Record<Language, Style[]>>;

const kLanguages: Language[] = ['javascript', 'python', 'java', 'csharp'];

// The most common way to write a locator in each language.
const kDefaultStyles: Styles = {
  javascript: [{ name: 'single quotes', quote: `'` }],
  python: [{ name: 'double quotes', quote: '"', rawRegex: true }],
  java: [{ name: 'default', quote: '"' }],
  csharp: [{ name: 'default', quote: '"' }],
};

// Quotes and formatting that matter for string escaping and tokenizing.
const kAllStyles: Styles = {
  javascript: [
    { name: 'single quotes', quote: `'` },
    { name: 'double quotes', quote: '"' },
    { name: 'template literals', quote: '`' },
    { name: 'multiline', quote: `'`, multiline: true },
    { name: 'compact', quote: `'`, compact: true },
  ],
  python: [
    { name: 'double quotes', quote: '"', rawRegex: true },
    { name: 'single quotes', quote: `'` },
    { name: 'multiline', quote: '"', rawRegex: true, multiline: true },
  ],
  java: [
    { name: 'default', quote: '"' },
    { name: 'multiline', quote: '"', multiline: true },
    { name: 'compact', quote: '"', compact: true },
  ],
  csharp: [
    { name: 'default', quote: '"' },
    { name: 'multiline', quote: '"', multiline: true },
    { name: 'compact', quote: '"', compact: true },
  ],
};

const kTexts = [
  'Hello',
  'Hello World',
  '',
  `It's`,
  'Say "hi"',
  'back`tick',
  'C:\\path\\file',
  'line1\nline2',
  'tab\there',
  'café ✓ 😀',
  'a >> b',
  '$' + '{name}',
  '(a), {b}: c=d | e.f',
  '  padded  ',
  '/not a regex/i',
];

const kRegexes = [
  /Hello/,
  /hello/i,
  /^Sub.*mit$/,
  /a.b/ims,
  /\d+ items?/,
  /\bword\b/,
  /a\/b/,
  /[/]/,
  /say "hi"/,
  /it's/,
  /a\\b/,
  /\(x\), \{y\}/,
  /x{2,3}|y/,
  /café/,
  /a>>b/,
];

const kSelectors = [
  'div',
  '#main',
  '.btn.primary',
  'div > span',
  'ul li:nth-child(2)',
  '[data-test="submit"]',
  `[aria-label='Close']`,
  'input[name=q]',
  'button:has-text("Save")',
  'div:has(> span)',
  '#foo\\:bar',
  '//div[@id="main"]',
  `//*[contains(normalize-space(), 'foo')]`,
  `xpath=//span[@class='x']`,
  '[id*=freetext-field]',
  'input:below(:text("Assigned Number:"))',
  '..',
  'text=Hello',
  'text="Hello World"',
  `text='Hello'`,
  'id=main',
  'data-testid=submit',
  'role=button[name="Save"]',
  'css=div',
  'div >> span',
  'div >> nth=1',
  'div >> visible=true',
];

const kRoles: AriaRole[] = [
  'alert', 'alertdialog', 'application', 'article', 'banner', 'blockquote', 'button', 'caption', 'cell', 'checkbox',
  'code', 'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition', 'deletion', 'dialog', 'directory',
  'document', 'emphasis', 'feed', 'figure', 'form', 'generic', 'grid', 'gridcell', 'group', 'heading', 'img', 'insertion',
  'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee', 'math', 'meter', 'menu', 'menubar', 'menuitem',
  'menuitemcheckbox', 'menuitemradio', 'navigation', 'none', 'note', 'option', 'paragraph', 'presentation', 'progressbar',
  'radio', 'radiogroup', 'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox', 'separator',
  'slider', 'spinbutton', 'status', 'strong', 'subscript', 'superscript', 'switch', 'tab', 'table', 'tablist', 'tabpanel',
  'term', 'textbox', 'time', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem',
];

const kTextMethods = ['getByText', 'getByLabel', 'getByPlaceholder', 'getByAltText', 'getByTitle'] as const;

const recordedCalls = new WeakMap<object, Call[]>();

function record(calls: Call[]): any {
  const recorder = new Proxy({}, {
    get: (_, method) => typeof method === 'string' && method !== 'then' ? (...args: any[]) => record([...calls, { method, args }]) : undefined,
  });
  recordedCalls.set(recorder, calls);
  return recorder;
}

// Records API calls instead of building selectors. Each recorded locator is replayed
// on client locators for the expected selector, and rendered as code in every language.
const $: Page = record([]);

// Page methods that start a locator chain.
const kPageSelectors: Record<string, (...args: any[]) => string> = {
  getByAltText: getByAltTextSelector,
  getByLabel: getByLabelSelector,
  getByPlaceholder: getByPlaceholderSelector,
  getByRef: ref => `aria-ref=${ref}`,
  getByRole: getByRoleSelector,
  getByTestId: testId => getByTestIdSelector(client.testIdAttributeName(), testId),
  getByText: getByTextSelector,
  getByTitle: getByTitleSelector,
};

const javascript = (code: string) => parse('javascript', code);
const python = (code: string) => parse('python', code);
const java = (code: string) => parse('java', code);
const csharp = (code: string) => parse('csharp', code);

const expect = baseExpect.extend({
  // The locator parses in every language and style into the selector that the API builds.
  toParse(built: Built, styles: Styles = kDefaultStyles, testIdAttributeName = 'data-testid') {
    const expected = selectorOf(built);
    const failures: string[] = [];
    for (const lang of kLanguages) {
      for (const style of styles[lang] ?? []) {
        const code = render(lang, built, style);
        const received = parse(lang, code, testIdAttributeName);
        if (received !== expected)
          failures.push(`${lang} (${style.name}): ${code.replace(/\s*\n\s*/g, ' ')}\nReceived: ${received}`);
      }
    }
    return { name: 'toParse', pass: !failures.length, message: () => `Expected: ${expected}\n\n${failures.join('\n\n')}` };
  },

  // The locator cannot be parsed in any language.
  toBeRejected(built: Built) {
    const failures: string[] = [];
    for (const lang of kLanguages) {
      const code = render(lang, built, kDefaultStyles[lang][0]);
      const received = parse(lang, code);
      if (!received.startsWith('Error'))
        failures.push(`${lang}: ${code}\nReceived: ${received}`);
    }
    return { name: 'toBeRejected', pass: !failures.length, message: () => `Expected: Error\n\n${failures.join('\n\n')}` };
  },

  // Every locator that the generator produces for the selector parses back into the selector.
  toRoundTrip(value: Built | string, languages: Language[] = kLanguages) {
    const selector = typeof value === 'string' ? value : selectorOf(value);
    const expected = canonicalSelector(selector);
    const failures: string[] = [];
    for (const lang of languages) {
      for (const code of asLocators(lang, selector)) {
        const received = parse(lang, code);
        if (received !== expected)
          failures.push(`${lang}: ${code}\nReceived: ${received}`);
      }
    }
    return { name: 'toRoundTrip', pass: !failures.length, message: () => `Expected: ${expected}\n\n${failures.join('\n\n')}` };
  },
});

it.beforeEach(() => {
  client.setTestIdAttribute('data-testid');
});

it('should parse getByText, getByLabel, getByPlaceholder, getByAltText and getByTitle', () => {
  for (const method of kTextMethods) {
    for (const text of kTexts) {
      expect.soft($[method](text)).toParse(kAllStyles);
      expect.soft($[method](text, { exact: true })).toParse(kAllStyles);
      expect.soft($[method](text, { exact: false })).toParse(kAllStyles);
    }
    for (const regex of kRegexes)
      expect.soft($[method](regex)).toParse(kAllStyles);
    expect.soft($[method]('Hello', {})).toParse();
    expect.soft($[method](/hello/i, { exact: true })).toParse();
    expect.soft($.locator('div')[method]('Hello')).toParse();
    expect.soft($.getByRole('dialog')[method]('Hello', { exact: true })).toParse();
    expect.soft($.frameLocator('iframe')[method](/hello/i)).toParse();
  }
});

it('should parse getByTestId', () => {
  for (const text of kTexts)
    expect.soft($.getByTestId(text)).toParse(kAllStyles);
  for (const regex of kRegexes)
    expect.soft($.getByTestId(regex)).toParse(kAllStyles);
  expect.soft($.locator('form').getByTestId('submit')).toParse();
  expect.soft($.frameLocator('iframe').getByTestId('submit')).toParse();
});

it('should parse getByTestId with a custom test id attribute', () => {
  for (const testIdAttributeName of ['data-pw', 'data-test-id', 'data-pw,data-qa']) {
    client.setTestIdAttribute(testIdAttributeName);
    expect.soft($.getByTestId('submit')).toParse(kDefaultStyles, testIdAttributeName);
    expect.soft($.getByTestId(/sub/i)).toParse(kDefaultStyles, testIdAttributeName);
    expect.soft($.locator('form').getByTestId('Say "hi"')).toParse(kDefaultStyles, testIdAttributeName);
    expect.soft($.frameLocator('iframe').getByTestId('submit')).toParse(kDefaultStyles, testIdAttributeName);
  }
});

it('should parse getByRef', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43159' },
}, () => {
  expect.soft($.getByRef('e5')).toParse();
  expect.soft($.getByRef('f1e3')).toParse();
  expect.soft($.getByRef('e5').first()).toParse();
  expect.soft($.getByRef('e5').locator('span')).toParse();
  expect.soft($.getByRef('e5').contentFrame().getByRole('button')).toParse();
  expect.soft($.locator('div').filter({ has: $.getByRef('e3') })).toParse();
  expect.soft($.locator('div').and($.getByRef('e3'))).toParse();
});

it('should parse getByRole with every role', () => {
  for (const role of kRoles) {
    expect.soft($.getByRole(role)).toParse();
    expect.soft($.getByRole(role, { name: 'Hello' })).toParse();
  }
});

it('should parse getByRole options', () => {
  expect.soft($.getByRole('heading', {})).toParse();
  expect.soft($.getByRole('checkbox', { checked: true })).toParse();
  expect.soft($.getByRole('checkbox', { checked: false })).toParse();
  expect.soft($.getByRole('button', { disabled: true })).toParse();
  expect.soft($.getByRole('button', { disabled: false })).toParse();
  expect.soft($.getByRole('option', { selected: true })).toParse();
  expect.soft($.getByRole('option', { selected: false })).toParse();
  expect.soft($.getByRole('treeitem', { expanded: true })).toParse();
  expect.soft($.getByRole('treeitem', { expanded: false })).toParse();
  expect.soft($.getByRole('button', { includeHidden: true })).toParse();
  expect.soft($.getByRole('button', { includeHidden: false })).toParse();
  expect.soft($.getByRole('heading', { level: 1 })).toParse();
  expect.soft($.getByRole('heading', { level: 6 })).toParse();
  expect.soft($.getByRole('button', { pressed: true })).toParse();
  expect.soft($.getByRole('button', { pressed: false })).toParse();
  expect.soft($.getByRole('button', { exact: true })).toParse();
  expect.soft($.getByRole('button', { exact: false })).toParse();
  expect.soft($.getByRole('button', { name: /submit/i, exact: true })).toParse();
  expect.soft($.getByRole('alert', { name: /upload/i, description: 'doc.pdf' })).toParse();
  expect.soft($.getByRole('alert', { name: 'Upload', description: /doc\.pdf/, exact: true })).toParse();
  expect.soft($.getByRole('checkbox', { checked: true, disabled: false, selected: true, expanded: false, includeHidden: true, level: 2, name: 'Agree', description: 'Terms', pressed: false, exact: true })).toParse();
});

it('should parse getByRole name and description', () => {
  for (const text of kTexts) {
    expect.soft($.getByRole('button', { name: text })).toParse(kAllStyles);
    expect.soft($.getByRole('button', { name: text, exact: true })).toParse(kAllStyles);
    expect.soft($.getByRole('button', { name: text, exact: false })).toParse(kAllStyles);
    expect.soft($.getByRole('alert', { description: text })).toParse(kAllStyles);
    expect.soft($.getByRole('alert', { description: text, exact: true })).toParse(kAllStyles);
    expect.soft($.getByRole('alert', { name: 'Upload', description: text, exact: true })).toParse(kAllStyles);
  }
  for (const regex of kRegexes) {
    expect.soft($.getByRole('button', { name: regex })).toParse(kAllStyles);
    expect.soft($.getByRole('alert', { description: regex })).toParse(kAllStyles);
  }
});

it('should parse getByRole options in any order', () => {
  expect.soft($.getByRole('button', { exact: true, name: 'Submit' })).toParse();
  expect.soft($.getByRole('alert', { description: 'doc.pdf', name: 'Upload' })).toParse();
  expect.soft($.getByRole('heading', { name: 'Title', level: 2 })).toParse();
  expect.soft($.getByRole('button', { pressed: true, name: 'Bold' })).toParse();
  expect.soft($.getByRole('checkbox', { name: 'Agree', checked: true })).toParse();
  expect.soft($.getByRole('treeitem', { expanded: true, selected: false, disabled: true })).toParse();
  expect.soft($.getByRole('button', { includeHidden: true, checked: false })).toParse();
  expect.soft($.getByRole('checkbox', { pressed: false, description: 'Terms', name: 'Agree', level: 2, includeHidden: true, expanded: false, selected: true, disabled: false, checked: true, exact: true })).toParse();
});

it('should parse locator with a selector', () => {
  for (const selector of kSelectors) {
    expect.soft($.locator(selector)).toParse(kAllStyles);
    expect.soft($.locator('section').locator(selector)).toParse(kAllStyles);
    expect.soft($.getByRole('main').locator(selector)).toParse(kAllStyles);
  }
});

it('should parse locator and filter options', () => {
  expect.soft($.locator('div').filter()).toParse();
  expect.soft($.locator('div').filter({})).toParse();
  expect.soft($.locator('div', {})).toParse();
  expect.soft($.locator('section').locator($.getByRole('button'), { hasText: 'Hello' })).toParse();
  expect.soft($.locator('div').filter({ visible: true, hasNot: $.locator('a'), has: $.locator('b'), hasNotText: 'x', hasText: 'y' })).toParse();
  expect.soft($.locator('div', { hasNot: $.locator('a'), hasText: 'y' })).toParse();
  expect.soft($.locator('div').filter({ hasText: 'a' }).filter({ hasText: 'b' }).filter({ has: $.locator('c') })).toParse();

  const values = [
    { hasText: 'Hello', hasNotText: 'Bye', has: $.getByRole('button'), hasNot: $.getByText('Sold out'), visible: true },
    { hasText: /hello/i, hasNotText: /bye\s+now/, has: $.locator('span').first(), hasNot: $.locator('a', { hasText: 'x' }), visible: false },
    { hasText: 'Say "hi"', hasNotText: `It's`, has: $.getByText('a >> b'), hasNot: $.getByTestId('Say "hi"'), visible: true },
  ];
  const keys = ['hasText', 'hasNotText', 'has', 'hasNot', 'visible'] as const;
  for (const value of values) {
    for (let mask = 1; mask < 1 << keys.length; ++mask) {
      const options: any = {};
      keys.forEach((key, index) => {
        if (mask & (1 << index))
          options[key] = value[key];
      });
      expect.soft($.locator('div').filter(options)).toParse(kAllStyles);
      if ('visible' in options)
        continue;
      expect.soft($.locator('div', options)).toParse(kAllStyles);
      expect.soft($.frameLocator('iframe').locator('div', options)).toParse(kAllStyles);
    }
  }
});

it('should parse first, last, nth and visible', () => {
  expect.soft($.locator('li').first()).toParse();
  expect.soft($.locator('li').last()).toParse();
  for (const index of [0, 1, 2, 10, -1, -2])
    expect.soft($.locator('li').nth(index)).toParse();
  expect.soft($.locator('li').visible()).toParse();
  expect.soft($.locator('li').visible().first()).toParse();
  expect.soft($.locator('li').first().visible()).toParse();
  expect.soft($.locator('li').nth(1).nth(0).last()).toParse();
  expect.soft($.getByRole('listitem').nth(2).getByRole('button')).toParse();
  expect.soft($.getByRole('row').last().getByRole('cell').first()).toParse();
  expect.soft($.getByText('Item').visible().nth(-1)).toParse();
});

it('should parse and, or, locator and within with a locator argument', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43159' },
}, () => {
  const inners = [
    $.locator('span'),
    $.getByRole('button', { name: 'OK' }),
    $.getByText('Say "hi"', { exact: true }),
    $.getByTitle(/it's/i),
    $.locator('div').first(),
    $.getByTestId('x').filter({ hasText: 'y' }),
    $.locator('a').and($.locator('.b')).or($.locator('.c')),
    $.getByRole('cell').within($.getByRole('row')),
  ];
  for (const inner of inners) {
    expect.soft($.locator('div').and(inner)).toParse();
    expect.soft($.locator('div').or(inner)).toParse();
    expect.soft($.locator('div').locator(inner)).toParse();
    expect.soft($.locator('div').within(inner)).toParse();
    expect.soft(inner.within($.locator('table'))).toParse();
    expect.soft(inner.and($.locator('div')).first()).toParse();
  }
  expect.soft($.getByRole('cell').nth(2).within($.getByRole('row'))).toParse();
  expect.soft($.getByRole('cell').within($.getByRole('row')).first()).toParse();
  expect.soft($.getByRole('cell').within($.getByRole('row').within($.getByRole('table')))).toParse();
  expect.soft($.frameLocator('iframe').getByRole('cell').within($.locator('tr'))).toParse();
  expect.soft($.locator('a').or($.locator('b')).or($.locator('c'))).toParse();
  expect.soft($.locator('a').and($.locator('b').and($.locator('c')))).toParse();
});

it('should parse chained refinements', () => {
  const atoms: Locator[] = [
    $.locator('div'),
    $.getByRole('button', { name: 'Submit' }),
    $.getByText('Hello'),
    $.getByLabel(/name/i),
    $.getByPlaceholder('Search', { exact: true }),
    $.getByAltText('logo'),
    $.getByTitle('Close'),
    $.getByTestId('submit'),
    $.getByRef('e5'),
  ];
  const refinements: ((locator: Locator) => Locator)[] = [
    locator => locator.first(),
    locator => locator.last(),
    locator => locator.nth(2),
    locator => locator.visible(),
    locator => locator.filter({ hasText: 'x', visible: false }),
    locator => locator.locator('span'),
    locator => locator.locator($.getByText('x')),
    locator => locator.getByRole('link', { name: 'More' }),
    locator => locator.getByText('x', { exact: true }),
    locator => locator.getByTestId('id'),
    locator => locator.and($.getByTitle('t')),
    locator => locator.or($.getByTitle('t')),
    locator => locator.within($.locator('section')),
    locator => locator.describe('My element'),
    locator => locator.contentFrame().locator('body'),
    locator => locator.frameLocator('iframe').getByText('y'),
  ];
  for (const atom of atoms) {
    for (const refine of refinements)
      expect.soft(refine(atom)).toParse();
  }
  for (const first of refinements) {
    for (const second of refinements)
      expect.soft(second(first($.locator('div')))).toParse();
  }
});

it('should parse frame locators', () => {
  const frames: FrameLocator[] = [
    $.frameLocator('iframe'),
    $.frameLocator('css=iframe'),
    $.frameLocator('#frame1'),
    $.frameLocator('iframe[name="embedded"]'),
    $.frameLocator('iframe').first(),
    $.frameLocator('iframe').last(),
    $.frameLocator('iframe').nth(1),
    $.locator('iframe').contentFrame(),
    $.locator('iframe').first().contentFrame(),
    $.locator('iframe').contentFrame().nth(-1),
    $.getByTitle('Embedded').contentFrame(),
    $.getByTestId('frame').nth(2).contentFrame(),
    $.locator('div').frameLocator('iframe'),
    $.frameLocator('#outer').frameLocator('#inner'),
    $.locator('#outer').contentFrame().locator('#inner').contentFrame(),
    $.frameLocator('#outer').getByTitle('Inner').contentFrame(),
    $.frameLocator('#outer').locator('#inner').contentFrame().first(),
  ];
  for (const frame of frames) {
    expect.soft(frame).toParse();
    expect.soft(frame.locator('button')).toParse();
    expect.soft(frame.locator('div', { hasText: 'Hello' })).toParse();
    expect.soft(frame.getByRole('button', { name: 'OK' })).toParse();
    expect.soft(frame.getByText('Hello', { exact: true })).toParse();
    expect.soft(frame.getByLabel('Name')).toParse();
    expect.soft(frame.getByPlaceholder(/search/i)).toParse();
    expect.soft(frame.getByAltText('logo')).toParse();
    expect.soft(frame.getByTitle('Close')).toParse();
    expect.soft(frame.getByTestId('submit')).toParse();
    expect.soft(frame.frameLocator('iframe').locator('span')).toParse();
    expect.soft(frame.locator('li').first()).toParse();
    expect.soft(frame.locator('li').nth(1).contentFrame().locator('body')).toParse();
  }
  expect.soft($.frameLocator()).toParse();
  expect.soft($.frameLocator().locator('button')).toParse();
  expect.soft($.frameLocator().getByText('Hello')).toParse();
  expect.soft($.frameLocator().getByRole('button').first()).toParse();
  expect.soft($.frameLocator().frameLocator('iframe').locator('span')).toParse();
});

it('should parse FrameLocator.locator with a locator argument', () => {
  expect.soft($.frameLocator('iframe').locator($.getByRole('button'))).toParse();
  expect.soft($.frameLocator('iframe').locator($.locator('span'))).toParse();
  expect.soft($.frameLocator('iframe').locator($.getByText('Say "hi"', { exact: true }))).toParse();
  expect.soft($.frameLocator('iframe').locator($.locator('div').first())).toParse();
  expect.soft($.frameLocator('iframe').locator($.getByTestId('x').filter({ hasText: 'y' }))).toParse();
  expect.soft($.frameLocator('iframe').locator($.locator('a').and($.locator('.b')).or($.locator('.c')))).toParse();
  expect.soft($.frameLocator('iframe').locator($.getByRole('cell').within($.getByRole('row')))).toParse();
  expect.soft($.frameLocator('iframe').first().locator($.getByRole('button'))).toParse();
  expect.soft($.locator('iframe').contentFrame().locator($.getByRole('button'))).toParse();
  expect.soft($.frameLocator().locator($.getByRole('button'))).toParse();
});

it('should parse owner', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43183' },
}, () => {
  expect.soft($.frameLocator('iframe').owner()).toParse();
  expect.soft($.locator('iframe').contentFrame().owner()).toParse();
  expect.soft($.frameLocator('iframe').first().owner()).toParse();
  expect.soft($.frameLocator('iframe').nth(2).owner()).toParse();
  expect.soft($.frameLocator('#outer').frameLocator('#inner').owner()).toParse();
  expect.soft($.frameLocator('iframe').owner().locator('..')).toParse();
  expect.soft($.frameLocator('iframe').owner().first()).toParse();
  expect.soft($.frameLocator('iframe').owner().contentFrame().locator('body')).toParse();
  expect.soft($.locator('div').filter({ has: $.frameLocator('iframe').owner() })).toParse();
});

it('should parse describe', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43181' },
}, () => {
  expect.soft($.getByTestId('btn-sub').describe('Subscribe button')).toParse();
  expect.soft($.locator('div').describe('Say "hi"')).toParse();
  expect.soft($.locator('div').describe(`It's here`)).toParse();
  expect.soft($.getByRole('button').describe('Submit').first()).toParse();
  expect.soft($.getByRole('button').describe('Submit').locator('span')).toParse();
  expect.soft($.locator('div').filter({ has: $.getByText('x').describe('Inner') })).toParse();
  expect.soft($.frameLocator('iframe').locator('div').describe('In frame')).toParse();
  expect.soft($.locator('a').describe('A').or($.locator('b').describe('B'))).toParse();
});

it('should parse deeply nested locators', () => {
  expect.soft($.locator('section').filter({ has: $.locator('div').filter({ has: $.getByText('Say "hi"').and($.getByRole('link', { name: /a"b/ })) }) })).toParse(kAllStyles);
  expect.soft($.getByRole('row').filter({ hasNot: $.getByRole('cell').or($.getByText(`It's`)) }).within($.getByRole('table').filter({ has: $.getByText('line1\nline2') }))).toParse(kAllStyles);
  expect.soft($.locator('a').and($.locator('b').or($.locator('c').and($.locator('d').or($.getByText('C:\\path')))))).toParse(kAllStyles);
  expect.soft($.locator('ul').locator($.locator('li').filter({ has: $.locator('span').locator($.getByText('x >> y')) }))).toParse(kAllStyles);
  expect.soft($.locator('div', { has: $.locator('p', { has: $.locator('span', { hasText: '"quoted"' }) }) })).toParse(kAllStyles);
});

it('should parse generated locators', {
  annotation: [
    { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42891' },
    { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43158' },
  ],
}, () => {
  expect.soft($.getByTestId('Hello')).toRoundTrip();
  expect.soft($.getByTestId('He"llo')).toRoundTrip();
  expect.soft($.getByTestId(/He"llo/)).toRoundTrip();
  expect.soft($.getByTestId(/He\\"llo/)).toRoundTrip();
  expect.soft($.getByText('Hello', { exact: true })).toRoundTrip();
  expect.soft($.getByText('Hello')).toRoundTrip();
  expect.soft($.getByText(/Hello/)).toRoundTrip();
  expect.soft($.getByText('hello my\nwo"rld')).toRoundTrip();
  expect.soft($.getByText('hello       my     wo"rld')).toRoundTrip();
  expect.soft($.getByText(/he\/\sl\nlo/)).toRoundTrip();
  expect.soft($.getByText(/hel"lo/)).toRoundTrip();
  expect.soft($.getByLabel('Name')).toRoundTrip();
  expect.soft($.getByLabel('Last Name', { exact: true })).toRoundTrip();
  expect.soft($.getByLabel(/Last\s+name/i)).toRoundTrip();
  expect.soft($.getByLabel('hello my\nwo"rld')).toRoundTrip();
  expect.soft($.getByPlaceholder('hello')).toRoundTrip();
  expect.soft($.getByPlaceholder('Hello', { exact: true })).toRoundTrip();
  expect.soft($.getByPlaceholder(/wor/i)).toRoundTrip();
  expect.soft($.getByPlaceholder('hello my\nwo"rld')).toRoundTrip();
  expect.soft($.getByPlaceholder(/he\/\sl\nlo/)).toRoundTrip();
  expect.soft($.getByPlaceholder(/hel"lo/)).toRoundTrip();
  expect.soft($.getByAltText('hello')).toRoundTrip();
  expect.soft($.getByAltText('Hello', { exact: true })).toRoundTrip();
  expect.soft($.getByAltText(/wor/i)).toRoundTrip();
  expect.soft($.getByAltText('hello my\nwo"rld')).toRoundTrip();
  expect.soft($.getByTitle('hello')).toRoundTrip();
  expect.soft($.getByTitle('Hello', { exact: true })).toRoundTrip();
  expect.soft($.getByTitle(/wor/i)).toRoundTrip();
  expect.soft($.getByTitle('hello my\nwo"rld')).toRoundTrip();
  expect.soft($.getByRole('button')).toRoundTrip();
  expect.soft($.getByRole('heading', {})).toRoundTrip();
  expect.soft($.getByRole('button', { name: 'Hello' })).toRoundTrip();
  expect.soft($.getByRole('button', { name: /Hello/ })).toRoundTrip();
  expect.soft($.getByRole('button', { name: 'He"llo', exact: true })).toRoundTrip();
  expect.soft($.getByRole('button', { checked: true, pressed: false, level: 3 })).toRoundTrip();
  expect.soft($.getByRole('alert', { name: 'Upload', description: 'doc.pdf' })).toRoundTrip();
  expect.soft($.getByRole('alert', { description: 'doc.pdf' })).toRoundTrip();
  expect.soft($.getByRole('alert', { description: /doc\.pdf/ })).toRoundTrip();
  expect.soft($.getByRole('alert', { name: 'Upload', description: 'doc.pdf', exact: true })).toRoundTrip();
  expect.soft($.locator('div').nth(3).first().last()).toRoundTrip();
  expect.soft($.getByText('Hello').filter({ hasText: 'wo"rld\n' })).toRoundTrip();
  expect.soft($.getByText('Hello').filter({ hasText: /wo\/\srld\n/ })).toRoundTrip();
  expect.soft($.getByText('Hello').filter({ hasText: /wor"ld/ })).toRoundTrip();
  expect.soft($.getByText('Hello').filter({ hasNotText: 'wo"rld\n' })).toRoundTrip();
  expect.soft($.getByText('Hello').visible().locator('div')).toRoundTrip();
  expect.soft($.getByText('Hello').filter({ visible: false }).locator('div')).toRoundTrip();
  expect.soft($.getByText('Hello').filter({ has: $.locator('div').getByText('bye') })).toRoundTrip();
  expect.soft($.getByText('Hello').filter({ hasNot: $.locator('div').getByText('bye') })).toRoundTrip();
  expect.soft($.locator('section').filter({ has: $.locator('div').filter({ has: $.locator('span') }) }).filter({ hasText: 'foo' }).filter({ has: $.locator('a') })).toRoundTrip();
  expect.soft($.locator('section').filter({ has: $.locator('div').filter({ hasNot: $.locator('span') }) }).filter({ hasText: 'foo' }).filter({ hasNot: $.locator('a') })).toRoundTrip();
  expect.soft($.locator('section').filter({ hasText: 'foo', has: $.locator('div') }).locator('a')).toRoundTrip();
  expect.soft($.locator('div', { hasText: 'foo' }).nth(0).filter({ has: $.locator('span', { hasNotText: 'bar' }).nth(-1) })).toRoundTrip();
  expect.soft($.frameLocator('iframe').getByText('foo', { exact: true }).frameLocator('frame').first().frameLocator('iframe').locator('span')).toRoundTrip();
  expect.soft($.frameLocator().getByText('foo').locator('span')).toRoundTrip();
  expect.soft($.getByTitle('iframe title').contentFrame()).toRoundTrip();
  expect.soft($.getByRole('row').locator($.getByRole('cell').nth(2))).toRoundTrip();
  expect.soft($.locator('div').and($.getByText('foo')).or($.locator('span').locator($.locator('a'))).first()).toRoundTrip();

  expect.soft('div').toRoundTrip();
  expect.soft('.foo').toRoundTrip();
  expect.soft('//div').toRoundTrip();
  expect.soft('internal:text="hello"i').toRoundTrip();
  expect.soft('internal:text="hello"s').toRoundTrip();
  expect.soft('internal:text=/he\\"llo/i').toRoundTrip();
  expect.soft('internal:text=/a\\/b/').toRoundTrip();
  expect.soft('internal:text=/a.b/ims').toRoundTrip();
  expect.soft('internal:role=button[name=/a.b/ms]').toRoundTrip();
  expect.soft('internal:role=button[name=/a.b/s]').toRoundTrip();
  expect.soft('internal:text="a\'b\\"c`d"i').toRoundTrip();
  expect.soft('internal:text="a\\\\b"i').toRoundTrip();
  expect.soft('internal:text="tab\\there\\nnewline"i').toRoundTrip();
  expect.soft('internal:text="\\u0001"i').toRoundTrip();
  expect.soft('internal:label="x"s').toRoundTrip();
  expect.soft('internal:label=/x/').toRoundTrip();
  expect.soft('internal:attr=[placeholder="p"i]').toRoundTrip();
  expect.soft('internal:attr=[alt="a"s]').toRoundTrip();
  expect.soft('internal:attr=[title=/t/i]').toRoundTrip();
  expect.soft('internal:testid=[data-testid="id"s]').toRoundTrip();
  expect.soft('internal:testid=[data-testid=/id/]').toRoundTrip();
  expect.soft('internal:role=button').toRoundTrip();
  expect.soft('internal:role=button[name="ok"s]').toRoundTrip();
  expect.soft('internal:role=button[name=/ok/i]').toRoundTrip();
  expect.soft('internal:role=checkbox[checked=true][include-hidden=true]').toRoundTrip();
  expect.soft('internal:role=checkbox[checked=mixed]').toRoundTrip();
  expect.soft('internal:role=button[pressed=mixed]').toRoundTrip();
  expect.soft('internal:role=heading[level=2][name="h"s]').toRoundTrip();
  expect.soft('internal:role=alert[name="Upload"s][description="doc.pdf"s]').toRoundTrip();
  expect.soft('internal:role=alert[name=/U/][description="d"i]').toRoundTrip();
  expect.soft('internal:role=alert[name=/Upload/][description="doc.pdf"i]').toRoundTrip();
  expect.soft('internal:role=alert[name="Upload"i][description=/doc\\.pdf/]').toRoundTrip();
  expect.soft('internal:role=button[disabled=true][selected=true][expanded=true][pressed=false]').toRoundTrip();
  expect.soft('div >> nth=0').toRoundTrip();
  expect.soft('div >> nth=-1').toRoundTrip();
  expect.soft('div >> nth=3').toRoundTrip();
  expect.soft('div >> visible=true').toRoundTrip();
  expect.soft('div >> visible=false').toRoundTrip();
  expect.soft('div >> internal:has-text="foo"i >> span').toRoundTrip();
  expect.soft('div >> internal:has-text="Goodbye world"i >> span').toRoundTrip();
  expect.soft('div >> internal:has-not-text=/foo/').toRoundTrip();
  expect.soft('div >> internal:has="span >> internal:has=\\"b\\""').toRoundTrip();
  expect.soft('div >> internal:has-not="internal:role=button[name=\\"x\\"i]"').toRoundTrip();
  expect.soft('iframe >> internal:control=enter-frame >> div').toRoundTrip();
  expect.soft('iframe >> nth=0 >> internal:control=enter-frame >> div').toRoundTrip();
  expect.soft('internal:attr=[title="t"i] >> internal:control=enter-frame').toRoundTrip();
  expect.soft('internal:control=any-frame >> div').toRoundTrip();
  expect.soft('div >> internal:and="span >> nth=0"').toRoundTrip();
  expect.soft('div >> internal:and="span >> article"').toRoundTrip();
  expect.soft('div >> internal:or="span"').toRoundTrip();
  expect.soft('div >> internal:or="span >> article"').toRoundTrip();
  expect.soft('div >> internal:chain="span >> article"').toRoundTrip();
  expect.soft('div >> internal:chain="span >> internal:has-text=\\"x\\"i"').toRoundTrip();

  // Python, Java and C# drop the regular expression flags they cannot express.
  for (const flags of ['u', 'y', 'd', 'v', 'gm']) {
    expect.soft(`internal:text=/Hello/${flags}`).toRoundTrip(['javascript']);
    expect.soft(`internal:label=/Hello/${flags}`).toRoundTrip(['javascript']);
  }
});

it('should parse javascript string escapes', () => {
  expect.soft(javascript(String.raw`getByText('It\'s')`)).toBe(selectorOf($.getByText(`It's`)));
  expect.soft(javascript(String.raw`getByText("Say \"hi\"")`)).toBe(selectorOf($.getByText('Say "hi"')));
  expect.soft(javascript('getByText(`back\\`tick`)')).toBe(selectorOf($.getByText('back`tick')));
  expect.soft(javascript(String.raw`getByText('C:\\path')`)).toBe(selectorOf($.getByText('C:\\path')));
  expect.soft(javascript(String.raw`getByText('line1\nline2\r\n\ttab')`)).toBe(selectorOf($.getByText('line1\nline2\r\n\ttab')));
  expect.soft(javascript(String.raw`getByText('\x41')`)).toBe(selectorOf($.getByText('A')));
  expect.soft(javascript(String.raw`getByText('\u0041')`)).toBe(selectorOf($.getByText('A')));
  expect.soft(javascript(String.raw`getByText('\u{1F600}')`)).toBe(selectorOf($.getByText('😀')));
  expect.soft(javascript(String.raw`getByText('a\u00a0b')`)).toBe(selectorOf($.getByText('a\u00a0b')));
  expect.soft(javascript(String.raw`getByText('\/\d')`)).toBe(selectorOf($.getByText('/d')));
});

it('should parse python string escapes', () => {
  expect.soft(python(String.raw`get_by_text('It\'s')`)).toBe(selectorOf($.getByText(`It's`)));
  expect.soft(python(String.raw`get_by_text("Say \"hi\"")`)).toBe(selectorOf($.getByText('Say "hi"')));
  expect.soft(python(String.raw`get_by_text("C:\\path")`)).toBe(selectorOf($.getByText('C:\\path')));
  expect.soft(python(String.raw`get_by_text(r"C:\path")`)).toBe(selectorOf($.getByText('C:\\path')));
  expect.soft(python(String.raw`get_by_text(r'C:\path')`)).toBe(selectorOf($.getByText('C:\\path')));
  expect.soft(python(String.raw`get_by_text("line1\nline2\ttab")`)).toBe(selectorOf($.getByText('line1\nline2\ttab')));
  expect.soft(python(String.raw`get_by_text("\x41")`)).toBe(selectorOf($.getByText('A')));
  expect.soft(python(String.raw`get_by_text("\u0041")`)).toBe(selectorOf($.getByText('A')));
  expect.soft(python(String.raw`get_by_text("\U0001F600")`)).toBe(selectorOf($.getByText('😀')));
  expect.soft(python(String.raw`get_by_text("a\xa0b")`)).toBe(selectorOf($.getByText('a\u00a0b')));
  // Python keeps the backslash of unknown escape sequences.
  expect.soft(python(String.raw`get_by_text("\d")`)).toBe(selectorOf($.getByText('\\d')));
});

it('should parse java string escapes', () => {
  expect.soft(java(String.raw`getByText("Say \"hi\"")`)).toBe(selectorOf($.getByText('Say "hi"')));
  expect.soft(java(String.raw`getByText("C:\\path")`)).toBe(selectorOf($.getByText('C:\\path')));
  expect.soft(java(String.raw`getByText("line1\nline2\ttab")`)).toBe(selectorOf($.getByText('line1\nline2\ttab')));
  expect.soft(java(String.raw`getByText("\u0041")`)).toBe(selectorOf($.getByText('A')));
  expect.soft(java(String.raw`getByText("a\u00a0b")`)).toBe(selectorOf($.getByText('a\u00a0b')));
  expect.soft(java(String.raw`getByText("\uD83D\uDE00")`)).toBe(selectorOf($.getByText('😀')));
});

it('should parse csharp string escapes', () => {
  expect.soft(csharp(String.raw`GetByText("Say \"hi\"")`)).toBe(selectorOf($.getByText('Say "hi"')));
  expect.soft(csharp(String.raw`GetByText("C:\\path")`)).toBe(selectorOf($.getByText('C:\\path')));
  expect.soft(csharp(String.raw`GetByText("line1\nline2\ttab")`)).toBe(selectorOf($.getByText('line1\nline2\ttab')));
  expect.soft(csharp(String.raw`GetByText("\u0041")`)).toBe(selectorOf($.getByText('A')));
  expect.soft(csharp(String.raw`GetByText("a\u00a0b")`)).toBe(selectorOf($.getByText('a\u00a0b')));
  expect.soft(csharp(String.raw`GetByText("\U0001F600")`)).toBe(selectorOf($.getByText('😀')));
  expect.soft(csharp(String.raw`GetByText(@"C:\path")`)).toBe(selectorOf($.getByText('C:\\path')));
  expect.soft(csharp(String.raw`GetByText(@"Say ""hi""")`)).toBe(selectorOf($.getByText('Say "hi"')));
});

it('should parse javascript regular expressions', () => {
  expect.soft(javascript(String.raw`getByText(/hello/i)`)).toBe(selectorOf($.getByText(/hello/i)));
  expect.soft(javascript(String.raw`getByText(/a\/b/)`)).toBe(selectorOf($.getByText(/a\/b/)));
  expect.soft(javascript(String.raw`getByText(/[/]/)`)).toBe(selectorOf($.getByText(/[/]/)));
  expect.soft(javascript(String.raw`getByText(/[\]/]/)`)).toBe(selectorOf($.getByText(/[\]/]/)));
  expect.soft(javascript(String.raw`getByText(/a,b\)/)`)).toBe(selectorOf($.getByText(/a,b\)/)));
  expect.soft(javascript(String.raw`getByText(/\p{L}+/u)`)).toBe(selectorOf($.getByText(/\p{L}+/u)));
  expect.soft(javascript(String.raw`getByText(new RegExp('hello', 'i'))`)).toBe(selectorOf($.getByText(/hello/i)));
  expect.soft(javascript(String.raw`getByText(new RegExp("a\\.b"))`)).toBe(selectorOf($.getByText(/a\.b/)));
});

it('should parse python regular expressions', () => {
  expect.soft(python(String.raw`get_by_text(re.compile(r"hello", re.IGNORECASE))`)).toBe(selectorOf($.getByText(/hello/i)));
  expect.soft(python(String.raw`get_by_text(re.compile(r'hello', re.I))`)).toBe(selectorOf($.getByText(/hello/i)));
  expect.soft(python(String.raw`get_by_text(re.compile("hello", re.I | re.M | re.S))`)).toBe(selectorOf($.getByText(/hello/ims)));
  expect.soft(python(String.raw`get_by_text(re.compile(r"\d+"))`)).toBe(selectorOf($.getByText(/\d+/)));
  expect.soft(python(String.raw`get_by_text(re.compile("\\d+"))`)).toBe(selectorOf($.getByText(/\d+/)));
  expect.soft(python(String.raw`get_by_text(re.compile("\d+"))`)).toBe(selectorOf($.getByText(/\d+/)));
  expect.soft(python(String.raw`get_by_text(re.compile(r"a.b", flags=re.DOTALL))`)).toBe(selectorOf($.getByText(/a.b/s)));
  expect.soft(python(String.raw`get_by_text(re.compile(r'say "hi"'))`)).toBe(selectorOf($.getByText(/say "hi"/)));
  expect.soft(python(String.raw`get_by_role("button", name=re.compile(r"^submit$", re.IGNORECASE))`)).toBe(selectorOf($.getByRole('button', { name: /^submit$/i })));

  const flagAliases: Styles = { python: [{ name: 'flag aliases', quote: '"', rawRegex: true, regexFlagAliases: true }] };
  expect.soft($.getByText(/hello/i)).toParse(flagAliases);
  expect.soft($.getByText(/a.b/ims)).toParse(flagAliases);
  expect.soft($.getByRole('button', { name: /submit/i })).toParse(flagAliases);
  expect.soft($.locator('div').filter({ hasText: /hello/m })).toParse(flagAliases);
});

it('should parse java regular expressions', () => {
  expect.soft(java(String.raw`getByText(Pattern.compile("hello", Pattern.CASE_INSENSITIVE))`)).toBe(selectorOf($.getByText(/hello/i)));
  expect.soft(java(String.raw`getByText(Pattern.compile("\\d+"))`)).toBe(selectorOf($.getByText(/\d+/)));
  expect.soft(java(String.raw`getByText(Pattern.compile("a.b", Pattern.CASE_INSENSITIVE | Pattern.MULTILINE | Pattern.DOTALL))`)).toBe(selectorOf($.getByText(/a.b/ims)));
  expect.soft(java(String.raw`getByText(Pattern.compile("say \"hi\""))`)).toBe(selectorOf($.getByText(/say "hi"/)));
});

it('should parse csharp regular expressions', () => {
  expect.soft(csharp(String.raw`GetByText(new Regex("hello", RegexOptions.IgnoreCase))`)).toBe(selectorOf($.getByText(/hello/i)));
  expect.soft(csharp(String.raw`GetByText(new Regex("\\d+"))`)).toBe(selectorOf($.getByText(/\d+/)));
  expect.soft(csharp(String.raw`GetByText(new Regex(@"\d+"))`)).toBe(selectorOf($.getByText(/\d+/)));
  expect.soft(csharp(String.raw`GetByText(new Regex(@"say ""hi"""))`)).toBe(selectorOf($.getByText(/say "hi"/)));
  expect.soft(csharp(String.raw`GetByText(new Regex("a.b", RegexOptions.IgnoreCase | RegexOptions.Multiline | RegexOptions.Singleline))`)).toBe(selectorOf($.getByText(/a.b/ims)));

  const verbatimStrings: Styles = { csharp: [{ name: 'verbatim strings', quote: '"', verbatimRegex: true }] };
  for (const regex of kRegexes)
    expect.soft($.getByText(regex)).toParse(verbatimStrings);
  expect.soft($.getByRole('button', { name: /submit/i })).toParse(verbatimStrings);
  expect.soft($.locator('div').filter({ hasText: /hello/ })).toParse(verbatimStrings);
});

it('should parse csharp options with an explicit type', () => {
  const typedOptions: Styles = {
    csharp: [
      { name: 'typed options', quote: '"', optionsType: 'typed' },
      { name: 'typed options with parentheses', quote: '"', optionsType: 'typed()' },
    ],
  };
  expect.soft($.getByRole('button', { name: 'Submit', exact: true })).toParse(typedOptions);
  expect.soft($.getByRole('button', { name: /submit/i })).toParse(typedOptions);
  expect.soft($.getByText('Hello', { exact: true })).toParse(typedOptions);
  expect.soft($.locator('div', { hasText: 'Hello' })).toParse(typedOptions);
  expect.soft($.locator('div').filter({ hasText: /hello/, has: $.getByRole('button') })).toParse(typedOptions);
  expect.soft($.locator('div').getByLabel('Name', { exact: true })).toParse(typedOptions);
  expect.soft($.frameLocator('iframe').getByTitle('Close', { exact: true })).toParse(typedOptions);
});

it('should parse trailing commas', () => {
  const trailingCommas: Styles = {
    javascript: [{ name: 'trailing commas', quote: `'`, multiline: true, trailingCommas: true }],
    python: [{ name: 'trailing commas', quote: '"', rawRegex: true, multiline: true, trailingCommas: true }],
    csharp: [{ name: 'trailing commas', quote: '"', multiline: true, trailingCommas: true }],
  };
  expect.soft($.getByRole('button', { name: 'Submit', exact: true })).toParse(trailingCommas);
  expect.soft($.locator('div', { hasText: 'Hello' }).filter({ has: $.getByRole('button') }).first()).toParse(trailingCommas);
  expect.soft($.getByText(/hello/i).nth(1)).toParse(trailingCommas);
  expect.soft($.frameLocator('iframe').getByLabel('Name', { exact: true })).toParse(trailingCommas);
});

it('should parse unusual whitespace', () => {
  const goodbye = selectorOf($.locator('div').filter({ hasText: 'Goodbye world' }).locator('span'));
  expect.soft(javascript(`getByRole ( 'button' , { name : 'Submit' } ) . first ( )`)).toBe(selectorOf($.getByRole('button', { name: 'Submit' }).first()));
  expect.soft(javascript(`\n\tgetByRole('button')\n\t\t.first()\n`)).toBe(selectorOf($.getByRole('button').first()));
  expect.soft(javascript(`locator\n('div')\n\n.filter({ hasText  : 'Goodbye world'\n }\n).locator('span')\n`)).toBe(goodbye);
  expect.soft(javascript(`\n    locator("[id*=freetext-field]")\n        .locator('input:below(:text("Assigned Number:"))')\n        .locator(\`visible=true\`)\n  `)).toBe(selectorOf($.locator('[id*=freetext-field]').locator('input:below(:text("Assigned Number:"))').locator('visible=true')));
  expect.soft(python(`get_by_role ( "button" , name = "Submit" ) . first`)).toBe(selectorOf($.getByRole('button', { name: 'Submit' }).first()));
  expect.soft(python(`get_by_text(re . compile ( r"hello" , re . IGNORECASE ))`)).toBe(selectorOf($.getByText(/hello/i)));
  expect.soft(python(`\tlocator(\t"div").filter(\thas_text="Goodbye world"\t).locator\t("span")`)).toBe(goodbye);
  expect.soft(python(`locator("div").filter(has_text='Goodbye world').locator('span')`)).toBe(goodbye);
  expect.soft(java(`getByRole ( AriaRole . BUTTON , new Page . GetByRoleOptions ( ) . setName ( "Submit" ) ) . first ( )`)).toBe(selectorOf($.getByRole('button', { name: 'Submit' }).first()));
  expect.soft(java(`getByText(Pattern . compile ( "hello" , Pattern . CASE_INSENSITIVE ))`)).toBe(selectorOf($.getByText(/hello/i)));
  expect.soft(java(`  locator("div"  ).  filter(  new    Locator. FilterOptions    ( ) .setHasText(   "Goodbye world" ) ).locator(   "span")`)).toBe(goodbye);
  expect.soft(csharp(`GetByRole ( AriaRole . Button , new ( ) { Name = "Submit" } ) . First`)).toBe(selectorOf($.getByRole('button', { name: 'Submit' }).first()));
  expect.soft(csharp(`GetByText(new Regex ( "hello" , RegexOptions . IgnoreCase ))`)).toBe(selectorOf($.getByText(/hello/i)));
  expect.soft(csharp(`Locator("div")  .  Filter (new ( ) {  HasText =    "Goodbye world" }).Locator(  "span"   )`)).toBe(goodbye);
});

it('should return selectors as is', () => {
  for (const selector of [
    'div',
    '#main',
    'text=Hello',
    '//div',
    'xpath=//div',
    'css=div',
    'div >> nth=0',
    'role=button[name="Submit"]',
    'internal:role=button[name="Submit"i]',
    'iframe >> internal:control=enter-frame >> div',
  ]) {
    for (const lang of kLanguages)
      expect.soft(parse(lang, selector), `${lang}: ${selector}`).toBe(selector);
  }
});

it('should reject malformed javascript locators', () => {
  expect.soft(javascript(`getByRole('button'`)).toMatch(/^Error/);
  expect.soft(javascript(`getByRole('button'))`)).toMatch(/^Error/);
  expect.soft(javascript(`getByRole('button', { name: 'Submit' )`)).toMatch(/^Error/);
  expect.soft(javascript(`getByRole('button' { name: 'Submit' })`)).toMatch(/^Error/);
  expect.soft(javascript(`getByRole('button', { name 'Submit' })`)).toMatch(/^Error/);
  expect.soft(javascript(`getByRole('button', { name: 'Submit', exact })`)).toMatch(/^Error/);
  expect.soft(javascript(`getByRole('button', { ...options })`)).toMatch(/^Error/);
  expect.soft(javascript(`getByRole('button', { name: 'Submit' }, { exact: true })`)).toMatch(/^Error/);
  expect.soft(javascript(`getByRole({ name: 'Submit' }, 'button')`)).toMatch(/^Error/);
  expect.soft(javascript(`getByRole('button', { name: 'ok', exct: true })`)).toMatch(/^Error/);
  expect.soft(javascript(`getByText('unterminated)`)).toMatch(/^Error/);
  expect.soft(javascript(`getByText(/unterminated)`)).toMatch(/^Error/);
  expect.soft(javascript(`getByText('a' 'b')`)).toMatch(/^Error/);
  expect.soft(javascript(`getByText('a' + 'b')`)).toMatch(/^Error/);
  expect.soft(javascript(`getByText(text)`)).toMatch(/^Error/);
  expect.soft(javascript('getByText(`Hello ${name}`)')).toMatch(/^Error/);
  expect.soft(javascript(`getByText('Hello', { exact: True })`)).toMatch(/^Error/);
  expect.soft(javascript(`getByText(re.compile('hello'))`)).toMatch(/^Error/);
  expect.soft(javascript(String.raw`getByText("\x4")`)).toMatch(/^Error/);
  expect.soft(javascript(String.raw`getByText("\u{}")`)).toMatch(/^Error/);
  expect.soft(javascript(String.raw`getByText("\u{110000}")`)).toMatch(/^Error/);
  expect.soft(javascript(`locator('div')..first()`)).toMatch(/^Error/);
  expect.soft(javascript(`locator('div')..locator('span')`)).toMatch(/^Error/);
  expect.soft(javascript(`locator('div').`)).toMatch(/^Error/);
  expect.soft(javascript(`.locator('div')`)).toMatch(/^Error/);
  expect.soft(javascript(`locator('div') locator('span')`)).toMatch(/^Error/);
  expect.soft(javascript(`locator('div').nth(0))`)).toMatch(/^Error/);
  expect.soft(javascript(`locator('div').nth(-)`)).toMatch(/^Error/);
  expect.soft(javascript(`locator('div').filter({ hasText: 'x' }})`)).toMatch(/^Error/);
  expect.soft(javascript(`locator('div').filter({ hasText: 'Goodbye world' }}).locator('span')`)).toMatch(/^Error/);
  expect.soft(javascript(`get_by_role('button')`)).toMatch(/^Error/);
  expect.soft(javascript(`GetByRole('button')`)).toMatch(/^Error/);
});

it('should reject malformed python locators', () => {
  expect.soft(python(`get_by_role("button"`)).toMatch(/^Error/);
  expect.soft(python(`get_by_role("button", name="Submit"))`)).toMatch(/^Error/);
  expect.soft(python(`get_by_role("button", name=="Submit")`)).toMatch(/^Error/);
  expect.soft(python(`get_by_role("button", name: "Submit")`)).toMatch(/^Error/);
  expect.soft(python(`get_by_role("button", {"name": "Submit"})`)).toMatch(/^Error/);
  expect.soft(python(`get_by_role(name="Submit", "button")`)).toMatch(/^Error/);
  expect.soft(python(`get_by_role("checkbox", cheked=True)`)).toMatch(/^Error/);
  expect.soft(python(`get_by_text("Hello", exact=true)`)).toMatch(/^Error/);
  expect.soft(python(`get_by_text("Hello", True)`)).toMatch(/^Error/);
  expect.soft(python(`get_by_text(f"Hello {name}")`)).toMatch(/^Error/);
  expect.soft(python(`get_by_text(text)`)).toMatch(/^Error/);
  expect.soft(python(`get_by_text(re.compile(r"hello", re.VERBOSE))`)).toMatch(/^Error/);
  expect.soft(python(`get_by_text(re.compile(r"hello", "i"))`)).toMatch(/^Error/);
  expect.soft(python(`get_by_text(/hello/)`)).toMatch(/^Error/);
  expect.soft(python(`locator("div").and(locator("span"))`)).toMatch(/^Error/);
  expect.soft(python(`locator("div").filter(has_text=="Goodbye world").locator("span")`)).toMatch(/^Error/);
  expect.soft(python(`locator("div").nth(0))`)).toMatch(/^Error/);
  expect.soft(python(`getByRole("button")`)).toMatch(/^Error/);
  expect.soft(python(`GetByRole("button")`)).toMatch(/^Error/);
});

it('should reject malformed java locators', () => {
  expect.soft(java(`locator('div')`)).toMatch(/^Error/);
  expect.soft(java(`locator('text="bar"')`)).toMatch(/^Error/);
  expect.soft(java(`getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Submit")`)).toMatch(/^Error/);
  expect.soft(java(`getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions.setName("Submit"))`)).toMatch(/^Error/);
  expect.soft(java(`getByRole(AriaRole.BUTTON, Page.GetByRoleOptions().setName("Submit"))`)).toMatch(/^Error/);
  expect.soft(java(`getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setNme("Submit"))`)).toMatch(/^Error/);
  expect.soft(java(`getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().name("Submit"))`)).toMatch(/^Error/);
  expect.soft(java(`getByText("Hello", true)`)).toMatch(/^Error/);
  expect.soft(java(`getByText("Hello", new Page.GetByTextOptions().setExact(True))`)).toMatch(/^Error/);
  expect.soft(java(`getByText(Pattern.compile("hello", Pattern.COMMENTS))`)).toMatch(/^Error/);
  expect.soft(java(`getByText("Hello"),`)).toMatch(/^Error/);
  expect.soft(java(`locator("div").filter(newLocator.FilterOptions().setHasText("foo"))`)).toMatch(/^Error/);
  expect.soft(java(`locator("div").filter(new Locator.FilterOptions().setHasText("Goodbye world"))..locator("span")`)).toMatch(/^Error/);
  expect.soft(java(`get_by_text("Hello")`)).toMatch(/^Error/);
  expect.soft(java(`GetByText("Hello")`)).toMatch(/^Error/);
});

it('should reject malformed csharp locators', () => {
  expect.soft(csharp(`Locator('div')`)).toMatch(/^Error/);
  expect.soft(csharp(`Locator('text="bar"')`)).toMatch(/^Error/);
  expect.soft(csharp(`GetByRole(AriaRole.Button, new() { Name = "Submit" )`)).toMatch(/^Error/);
  expect.soft(csharp(`GetByRole(AriaRole.Button, new() { Nme = "Submit" })`)).toMatch(/^Error/);
  expect.soft(csharp(`GetByRole(AriaRole.Button, new() { Name: "Submit" })`)).toMatch(/^Error/);
  expect.soft(csharp(`GetByRole(AriaRole.Button, new { Name = "Submit" })`)).toMatch(/^Error/);
  expect.soft(csharp(`GetByText("Hello", new() { Exact = True })`)).toMatch(/^Error/);
  expect.soft(csharp(`GetByText(new Regex("hello", RegexOptions.ECMAScript))`)).toMatch(/^Error/);
  expect.soft(csharp(`GetByText($"Hello {name}")`)).toMatch(/^Error/);
  expect.soft(csharp(`GetByTestId(newRegex("id"))`)).toMatch(/^Error/);
  expect.soft(csharp(`Locator("div").Nth(0))`)).toMatch(/^Error/);
  expect.soft(csharp(`Locator("div").Filter(new() { HasText = "Goodbye world" }).Locator("span"))`)).toMatch(/^Error/);
  expect.soft(csharp(`getByText("Hello")`)).toMatch(/^Error/);
  expect.soft(csharp(`get_by_text("Hello")`)).toMatch(/^Error/);
});

it('should reject methods that the receiver does not have', () => {
  const page = untyped($);
  const frame = untyped($.frameLocator('iframe'));
  const anyFrame = untyped($.frameLocator());
  const locator = untyped($.locator('div'));
  expect.soft(frame.filter({ hasText: 'x' })).toBeRejected();
  expect.soft(frame.and($.locator('a'))).toBeRejected();
  expect.soft(frame.or($.locator('a'))).toBeRejected();
  expect.soft(frame.within($.locator('a'))).toBeRejected();
  expect.soft(frame.visible()).toBeRejected();
  expect.soft(frame.describe('x')).toBeRejected();
  expect.soft(frame.contentFrame()).toBeRejected();
  expect.soft(frame.getByRef('e1')).toBeRejected();
  expect.soft(frame.frameLocator()).toBeRejected();
  // frameLocator() matches any frame, so there is no frame element to pick.
  expect.soft(anyFrame.first()).toBeRejected();
  expect.soft(anyFrame.nth(1)).toBeRejected();
  expect.soft(locator.owner()).toBeRejected();
  expect.soft(locator.getByRef('e1')).toBeRejected();
  expect.soft(locator.frameLocator()).toBeRejected();
  expect.soft(page.nth(1)).toBeRejected();
  expect.soft(page.filter({ hasText: 'x' })).toBeRejected();
  expect.soft(page.and($.locator('a'))).toBeRejected();
  expect.soft(page.or($.locator('a'))).toBeRejected();
  expect.soft(page.within($.locator('a'))).toBeRejected();
  expect.soft(page.describe('x')).toBeRejected();
});

it('should reject arguments of a wrong type or count', () => {
  const page = untyped($);
  const locator = untyped($.locator('div'));
  expect.soft(page.getByText()).toBeRejected();
  expect.soft(page.getByText(1)).toBeRejected();
  expect.soft(page.getByText('a', 'b')).toBeRejected();
  expect.soft(page.getByText('x', { name: 'y' })).toBeRejected();
  expect.soft(page.getByText('x', { exact: 'true' })).toBeRejected();
  expect.soft(page.getByRole()).toBeRejected();
  expect.soft(page.getByRole('button', { name: 1 })).toBeRejected();
  expect.soft(page.getByRole('button', { level: '2' })).toBeRejected();
  expect.soft(page.getByRole('button', { checked: 'true' })).toBeRejected();
  expect.soft(page.getByRole('button', { includeHidden: 1 })).toBeRejected();
  expect.soft(page.getByRole('button', { name: $.getByText('x') })).toBeRejected();
  expect.soft(page.getByRole('button', { nme: 'x' })).toBeRejected();
  expect.soft(page.getByTestId()).toBeRejected();
  expect.soft(page.getByTestId('x', { exact: true })).toBeRejected();
  expect.soft(page.getByRef()).toBeRejected();
  expect.soft(page.getByRef(/e1/)).toBeRejected();
  expect.soft(page.getByRef('e1', 'e2')).toBeRejected();
  expect.soft(page.locator()).toBeRejected();
  expect.soft(page.locator(1)).toBeRejected();
  expect.soft(page.locator('div', 'span')).toBeRejected();
  expect.soft(page.locator('div', { exact: true })).toBeRejected();
  expect.soft(page.locator('div', { visible: true })).toBeRejected();
  expect.soft(page.frameLocator($.locator('iframe'))).toBeRejected();
  expect.soft(page.frameLocator('a', 'b')).toBeRejected();
  expect.soft(locator.filter('div')).toBeRejected();
  expect.soft(locator.filter({ has: 'div' })).toBeRejected();
  expect.soft(locator.filter({ hasNot: 'div' })).toBeRejected();
  expect.soft(locator.filter({ hasText: $.getByText('x') })).toBeRejected();
  expect.soft(locator.filter({ visible: 'true' })).toBeRejected();
  expect.soft(locator.filter({ text: 'x' })).toBeRejected();
  expect.soft(locator.nth()).toBeRejected();
  expect.soft(locator.nth('1')).toBeRejected();
  expect.soft(locator.nth(1, 2)).toBeRejected();
  expect.soft(locator.first(1)).toBeRejected();
  expect.soft(locator.and('span')).toBeRejected();
  expect.soft(locator.and()).toBeRejected();
  expect.soft(locator.or($.locator('a'), $.locator('b'))).toBeRejected();
  expect.soft(locator.within('span')).toBeRejected();
  expect.soft(locator.and($.frameLocator('iframe'))).toBeRejected();
  expect.soft(locator.within($.frameLocator('iframe'))).toBeRejected();
  expect.soft(locator.filter({ has: $.frameLocator('iframe') })).toBeRejected();
  expect.soft(locator.describe()).toBeRejected();
  expect.soft(locator.describe(1)).toBeRejected();
  expect.soft(locator.contentFrame('iframe')).toBeRejected();
});

// Allows calls that the typed API does not have.
function untyped(value: Page | Built): Record<string, (...args: any[]) => Built> {
  return value as any;
}

function parse(lang: Language, code: string, testIdAttributeName = 'data-testid'): string {
  try {
    return unsafeLocatorOrSelectorAsSelector(lang, code, testIdAttributeName);
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

// The selector that the API builds for a recorded locator.
function selectorOf(built: Built): string {
  const result = replay(built);
  if (result instanceof client.Locator)
    return canonicalSelector(result._selector);
  const frameSelector = result._frameSelector;
  if (frameSelector === kAnyFrameSelector)
    return frameSelector;
  return canonicalSelector(frameSelector + ' >> internal:control=enter-frame');
}

function replay(value: any): any {
  if (recordedCalls.has(value)) {
    const [{ method, args }, ...calls] = recordedCalls.get(value)!;
    let result: any = startChain(method, args.map(replay));
    for (const { method, args } of calls)
      result = result[method](...args.map(replay));
    return result;
  }
  if (isOptions(value))
    return Object.fromEntries(Object.entries(value).map(([name, option]) => [name, replay(option)]));
  return value;
}

function startChain(method: string, args: any[]): Built {
  if (method === 'frameLocator')
    return new client.FrameLocator(null, args[0] ?? kAnyFrameSelector);
  if (method === 'locator')
    return new client.Locator(null, args[0], args[1]);
  return new client.Locator(null, kPageSelectors[method](...args));
}

// The parser normalizes selector strings, e.g. "css=div" into "div", including nested selectors.
function canonicalSelector(selector: string): string {
  const parsed = parseSelector(selector);
  return stringifySelector({
    ...parsed,
    parts: parsed.parts.map(part => typeof part.body === 'object' && 'parsed' in part.body ? { ...part, source: JSON.stringify(canonicalSelector(JSON.parse(part.source))) } : part),
  });
}

function isOptions(value: any): boolean {
  return typeof value === 'object' && !(value instanceof RegExp) && !recordedCalls.has(value);
}

function render(lang: Language, built: Built, style: Style): string {
  let receiver: Receiver = 'Page';
  const calls: string[] = [];
  for (const call of recordedCalls.get(built)!) {
    calls.push(renderCall(lang, receiver, call, style));
    receiver = returnType(receiver, call.method);
  }
  return calls.join(style.multiline ? '\n    .' : '.');
}

function returnType(receiver: Receiver, method: string): Receiver {
  if (method === 'frameLocator' || method === 'contentFrame')
    return 'FrameLocator';
  if (receiver === 'FrameLocator' && ['first', 'last', 'nth'].includes(method))
    return 'FrameLocator';
  return 'Locator';
}

function renderCall(lang: Language, receiver: Receiver, { method, args }: Call, style: Style): string {
  const name = methodName(lang, method);
  // Python and C# expose methods without arguments as properties, e.g. `.first` and `.First`.
  if (!args.length && (lang === 'python' || lang === 'csharp') && ['first', 'last', 'contentFrame', 'owner', 'visible'].includes(method))
    return name;
  const items = args.flatMap((arg, index) => {
    if (method === 'getByRole' && index === 0)
      return [renderRole(lang, arg, style)];
    if (isOptions(arg))
      return renderOptions(lang, receiver, method, arg, style);
    return [renderValue(lang, arg, style)];
  });
  return `${name}(${renderList(items, style, style.trailingCommas && (lang === 'javascript' || lang === 'python'), '        ', '    ')})`;
}

function methodName(lang: Language, method: string): string {
  if (lang === 'python')
    return method === 'and' || method === 'or' ? method + '_' : method.replace(/[A-Z]/g, char => '_' + char.toLowerCase());
  if (lang === 'csharp')
    return upperFirst(method);
  return method;
}

function renderOptions(lang: Language, receiver: Receiver, method: string, options: object, style: Style): string[] {
  const entries = Object.entries(options);
  if (lang === 'python')
    return entries.map(([name, value]) => `${name.replace(/[A-Z]/g, char => '_' + char.toLowerCase())}=${renderValue(lang, value, style)}`);
  if (lang === 'java') {
    const setters = entries.map(([name, value]) => `.set${upperFirst(name)}(${renderValue(lang, value, style)})`);
    return [`new ${receiver}.${upperFirst(method)}Options()${setters.join(style.multiline ? '\n            ' : '')}`];
  }
  const separator = style.compact ? (lang === 'csharp' ? '=' : ':') : (lang === 'csharp' ? ' = ' : ': ');
  const properties = entries.map(([name, value]) => {
    // C# has a separate property for regular expressions, e.g. `NameRegex`.
    const property = lang === 'csharp' ? upperFirst(name) + (value instanceof RegExp ? 'Regex' : '') : name;
    return property + separator + renderValue(lang, value, style);
  });
  const body = properties.length ? renderBag(properties, style) : '{}';
  if (lang === 'javascript')
    return [body];
  const type = style.optionsType ? ` ${receiver}${upperFirst(method)}Options${style.optionsType === 'typed()' ? '()' : ''}` : '()';
  return [`new${type}${style.compact ? '' : ' '}${body}`];
}

function renderBag(properties: string[], style: Style): string {
  const trailingComma = style.trailingCommas ? ',' : '';
  if (style.multiline)
    return `{\n            ${properties.join(',\n            ')}${trailingComma}\n        }`;
  if (style.compact)
    return `{${properties.join(',')}${trailingComma}}`;
  return `{ ${properties.join(', ')}${trailingComma} }`;
}

function renderList(items: string[], style: Style, trailingComma: boolean, indent: string, closingIndent: string): string {
  if (!items.length)
    return '';
  const comma = trailingComma ? ',' : '';
  if (style.multiline)
    return `\n${indent}${items.join(`,\n${indent}`)}${comma}\n${closingIndent}`;
  return items.join(style.compact ? ',' : ', ') + comma;
}

function renderRole(lang: Language, role: string, style: Style): string {
  if (lang === 'java')
    return `AriaRole.${role.toUpperCase()}`;
  if (lang === 'csharp')
    return `AriaRole.${upperFirst(role)}`;
  return quote(role, style.quote);
}

function renderValue(lang: Language, value: any, style: Style): string {
  if (recordedCalls.has(value))
    return render(lang, value, style);
  if (value instanceof RegExp)
    return renderRegex(lang, value, style);
  if (typeof value === 'string')
    return quote(value, style.quote);
  if (typeof value === 'boolean' && lang === 'python')
    return value ? 'True' : 'False';
  return String(value);
}

function renderRegex(lang: Language, regex: RegExp, style: Style): string {
  if (lang === 'javascript')
    return String(regex);
  const flagNames = {
    python: style.regexFlagAliases ? { i: 're.I', m: 're.M', s: 're.S' } : { i: 're.IGNORECASE', m: 're.MULTILINE', s: 're.DOTALL' },
    java: { i: 'Pattern.CASE_INSENSITIVE', m: 'Pattern.MULTILINE', s: 'Pattern.DOTALL' },
    csharp: { i: 'RegexOptions.IgnoreCase', m: 'RegexOptions.Multiline', s: 'RegexOptions.Singleline' },
  }[lang];
  const flags = [...regex.flags].map(flag => {
    if (!flagNames[flag])
      throw new Error(`Regular expression flag "${flag}" cannot be expressed in ${lang}`);
    return flagNames[flag];
  });
  let source = quote(regex.source, style.quote);
  if (lang === 'python' && style.rawRegex)
    source = 'r' + style.quote + regex.source.replaceAll(style.quote, '\\' + style.quote) + style.quote;
  if (lang === 'csharp' && style.verbatimRegex)
    source = '@"' + regex.source.replaceAll('"', '""') + '"';
  const args = [source, ...(flags.length ? [flags.join(' | ')] : [])].join(', ');
  if (lang === 'python')
    return `re.compile(${args})`;
  if (lang === 'java')
    return `Pattern.compile(${args})`;
  return `new Regex(${args})`;
}

function quote(text: string, quoteChar: string): string {
  let result = '';
  for (const char of text) {
    if (char === '\\' || char === quoteChar || (quoteChar === '`' && char === '$'))
      result += '\\' + char;
    else if (char === '\n')
      result += '\\n';
    else if (char === '\r')
      result += '\\r';
    else if (char === '\t')
      result += '\\t';
    else
      result += char;
  }
  return quoteChar + result + quoteChar;
}

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.substring(1);
}
