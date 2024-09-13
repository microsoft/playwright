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

import os from 'os';
import { test as it, expect } from './pageTest';
import { chromiumVersionLessThan } from '../config/utils';

it('should work @smoke', async ({ page, browserName }) => {
  await page.setContent(`
  <head>
    <title>Accessibility Test</title>
  </head>
  <body>
    <h1>Inputs</h1>
    <input placeholder="Empty input" autofocus />
    <input placeholder="readonly input" readonly />
    <input placeholder="disabled input" disabled />
    <input aria-label="Input with whitespace" value="  " />
    <input value="value only" />
    <input aria-placeholder="placeholder" value="and a value" />
    <div aria-hidden="true" id="desc">This is a description!</div>
    <input aria-placeholder="placeholder" value="and a value" aria-describedby="desc" />
  </body>`);
  // autofocus happens after a delay in chrome these days
  await page.waitForFunction(() => document.activeElement.hasAttribute('autofocus'));

  const golden = (browserName === 'firefox') ? {
    role: 'document',
    name: 'Accessibility Test',
    children: [
      { role: 'heading', name: 'Inputs', level: 1 },
      { role: 'textbox', name: 'Empty input', focused: true },
      { role: 'textbox', name: 'readonly input', readonly: true },
      { role: 'textbox', name: 'disabled input', disabled: true },
      { role: 'textbox', name: 'Input with whitespace', value: '  ' },
      { role: 'textbox', name: '', value: 'value only' },
      { role: 'textbox', name: '', value: 'and a value' }, // firefox doesn't use aria-placeholder for the name
      { role: 'textbox', name: '', value: 'and a value', description: 'This is a description!' }, // and here
    ]
  } : (browserName === 'chromium') ? {
    role: 'WebArea',
    name: 'Accessibility Test',
    children: [
      { role: 'heading', name: 'Inputs', level: 1 },
      { role: 'textbox', name: 'Empty input', focused: true },
      { role: 'textbox', name: 'readonly input', readonly: true },
      { role: 'textbox', name: 'disabled input', disabled: true },
      { role: 'textbox', name: 'Input with whitespace', value: '  ' },
      { role: 'textbox', name: '', value: 'value only' },
      { role: 'textbox', name: 'placeholder', value: 'and a value' },
      { role: 'textbox', name: 'placeholder', value: 'and a value', description: 'This is a description!' },
    ]
  } : {
    role: 'WebArea',
    name: 'Accessibility Test',
    children: [
      { role: 'heading', name: 'Inputs', level: 1 },
      { role: 'textbox', name: 'Empty input', focused: true },
      { role: 'textbox', name: 'readonly input', readonly: true },
      { role: 'textbox', name: 'disabled input', disabled: true },
      { role: 'textbox', name: 'Input with whitespace', value: '  ' },
      { role: 'textbox', name: '', value: 'value only' },
      { role: 'textbox', name: 'placeholder', value: 'and a value' },
      // due to frozen WebKit on macOS 11 we have the if/else here
      { role: 'textbox', name: parseInt(os.release(), 10) >= 21 ? 'placeholder' : 'This is a description!', value: 'and a value' }, // webkit uses the description over placeholder for the name
    ]
  };
  expect(await page.accessibility.snapshot()).toEqual(golden);
});

it('should work with regular text', async ({ page, browserName }) => {
  await page.setContent(`<div>Hello World</div>`);
  const snapshot = await page.accessibility.snapshot();
  expect(snapshot.children[0]).toEqual({
    role: browserName === 'firefox' ? 'text leaf' : 'text',
    name: 'Hello World',
  });
});

it('roledescription', async ({ page }) => {
  await page.setContent('<p tabIndex=-1 aria-roledescription="foo">Hi</p>');
  const snapshot = await page.accessibility.snapshot();
  expect(snapshot.children[0].roledescription).toEqual('foo');
});

it('orientation', async ({ page }) => {
  await page.setContent('<a href="" role="slider" aria-orientation="vertical">11</a>');
  const snapshot = await page.accessibility.snapshot();
  expect(snapshot.children[0].orientation).toEqual('vertical');
});

it('autocomplete', async ({ page }) => {
  await page.setContent('<div role="textbox" aria-autocomplete="list" aria-haspopup="menu">hi</div>');
  const snapshot = await page.accessibility.snapshot();
  expect(snapshot.children[0].autocomplete).toEqual('list');
  expect(snapshot.children[0].haspopup).toEqual('menu');
});

it('multiselectable', async ({ page }) => {
  await page.setContent('<div role="grid" tabIndex=-1 aria-multiselectable=true>hey</div>');
  const snapshot = await page.accessibility.snapshot();
  expect(snapshot.children[0].multiselectable).toEqual(true);
});

it('keyshortcuts', async ({ page }) => {
  await page.setContent('<div role="grid" tabIndex=-1 aria-keyshortcuts="foo">hey</div>');
  const snapshot = await page.accessibility.snapshot();
  expect(snapshot.children[0].keyshortcuts).toEqual('foo');
});

it('should not report text nodes inside controls', async function({ page, browserName }) {
  await page.setContent(`
  <div role="tablist">
    <div role="tab" aria-selected="true"><b>Tab1</b></div>
    <div role="tab">Tab2</div>
  </div>`);
  const golden = {
    role: browserName === 'firefox' ? 'document' : 'WebArea',
    name: '',
    children: [{
      role: 'tab',
      name: 'Tab1',
      selected: true
    }, {
      role: 'tab',
      name: 'Tab2'
    }]
  };
  expect(await page.accessibility.snapshot()).toEqual(golden);
});

it('rich text editable fields should have children', async function({ page, browserName, browserVersion, isWebView2 }) {
  it.skip(browserName === 'webkit', 'WebKit rich text accessibility is iffy');
  it.skip(isWebView2, 'WebView2 is missing a Chromium fix');

  await page.setContent(`
  <div contenteditable="true">
    Edit this image: <img src="fakeimage.png" alt="my fake image">
  </div>`);
  const golden = browserName === 'firefox' ? {
    role: 'section',
    name: '',
    children: [{
      role: 'text leaf',
      name: 'Edit this image: '
    }, {
      role: 'text',
      name: 'my fake image'
    }]
  } : {
    role: 'generic',
    name: '',
    value: 'Edit this image: ',
    children: [{
      role: 'text',
      name: chromiumVersionLessThan(browserVersion, '108.0.5325.0') ? 'Edit this image:' : 'Edit this image: '
    }, {
      role: chromiumVersionLessThan(browserVersion, '117.0.5927.0') ? 'img' : 'image',
      name: 'my fake image'
    }]
  };
  const snapshot = await page.accessibility.snapshot();
  expect(snapshot.children[0]).toEqual(golden);
});

it('rich text editable fields with role should have children', async function({ page, browserName, browserVersion, isWebView2 }) {
  it.skip(browserName === 'webkit', 'WebKit rich text accessibility is iffy');
  it.skip(isWebView2, 'WebView2 is missing a Chromium fix');

  await page.setContent(`
  <div contenteditable="true" role='textbox'>
    Edit this image: <img src="fakeimage.png" alt="my fake image">
  </div>`);
  const golden = browserName === 'firefox' ? {
    role: 'textbox',
    name: '',
    value: 'Edit this image: my fake image',
    children: [{
      role: 'text',
      name: 'my fake image'
    }]
  } : {
    role: 'textbox',
    name: '',
    multiline: (browserName === 'chromium') ? true : undefined,
    value: 'Edit this image: ',
    children: (chromiumVersionLessThan(browserVersion, '104.0.1293.1') && browserName === 'chromium') ? [{
      role: 'text',
      name: 'Edit this image:'
    }, {
      role: 'img',
      name: 'my fake image'
    }] : [{
      role: 'text',
      name: chromiumVersionLessThan(browserVersion, '108.0.5325.0') ? 'Edit this image:' : 'Edit this image: '
    }]
  };
  const snapshot = await page.accessibility.snapshot();
  expect(snapshot.children[0]).toEqual(golden);
});

it('non editable textbox with role and tabIndex and label should not have children', async function({ page, browserName }) {
  await page.setContent(`
  <div role="textbox" tabIndex=0 aria-checked="true" aria-label="my favorite textbox">
    this is the inner content
    <img alt="yo" src="fakeimg.png">
  </div>`);
  const golden = (browserName === 'firefox') ? {
    role: 'textbox',
    name: 'my favorite textbox',
    value: 'this is the inner content yo'
  } : (browserName === 'chromium') ? {
    role: 'textbox',
    name: 'my favorite textbox',
    value: 'this is the inner content '
  } : {
    role: 'textbox',
    name: 'my favorite textbox',
    value: 'this is the inner content  ',
  };
  const snapshot = await page.accessibility.snapshot();
  expect(snapshot.children[0]).toEqual(golden);
});

it('checkbox with and tabIndex and label should not have children', async function({ page }) {
  await page.setContent(`
  <div role="checkbox" tabIndex=0 aria-checked="true" aria-label="my favorite checkbox">
    this is the inner content
    <img alt="yo" src="fakeimg.png">
  </div>`);
  const golden = {
    role: 'checkbox',
    name: 'my favorite checkbox',
    checked: true
  };
  const snapshot = await page.accessibility.snapshot();
  expect(snapshot.children[0]).toEqual(golden);
});

it('checkbox without label should not have children', async ({ page, browserName }) => {
  await page.setContent(`
  <div role="checkbox" aria-checked="true">
    this is the inner content
    <img alt="yo" src="fakeimg.png">
  </div>`);
  const golden = browserName === 'firefox' ? {
    role: 'checkbox',
    name: 'this is the inner content yo',
    checked: true
  } : {
    role: 'checkbox',
    name: 'this is the inner content yo',
    checked: true
  };
  const snapshot = await page.accessibility.snapshot();
  expect(snapshot.children[0]).toEqual(golden);
});

it('should work a button', async ({ page }) => {
  await page.setContent(`<button>My Button</button>`);

  const button = await page.$('button');
  expect(await page.accessibility.snapshot({ root: button })).toEqual({
    role: 'button',
    name: 'My Button'
  });
});

it('should work an input', async ({ page }) => {
  await page.setContent(`<input title="My Input" value="My Value">`);

  const input = await page.$('input');
  expect(await page.accessibility.snapshot({ root: input })).toEqual({
    role: 'textbox',
    name: 'My Input',
    value: 'My Value'
  });
});

it('should work on a menu', async ({ page, browserName, browserVersion }) => {
  await page.setContent(`
    <div role="menu" title="My Menu">
      <div role="menuitem">First Item</div>
      <div role="menuitem">Second Item</div>
      <div role="menuitem">Third Item</div>
    </div>
  `);

  const menu = await page.$('div[role="menu"]');
  expect(await page.accessibility.snapshot({ root: menu })).toEqual({
    role: 'menu',
    name: 'My Menu',
    children:
    [{ role: 'menuitem', name: 'First Item' },
      { role: 'menuitem', name: 'Second Item' },
      { role: 'menuitem', name: 'Third Item' }],
    orientation: (browserName === 'webkit' || (browserName === 'chromium' && !chromiumVersionLessThan(browserVersion, '98.0.1089'))) ? 'vertical' : undefined
  });
});

it('should return null when the element is no longer in DOM', async ({ page }) => {
  await page.setContent(`<button>My Button</button>`);
  const button = await page.$('button');
  await page.$eval('button', button => button.remove());
  expect(await page.accessibility.snapshot({ root: button })).toEqual(null);
});

it('should show uninteresting nodes', async ({ page }) => {
  await page.setContent(`
    <div id="root" role="textbox">
      <div>
        hello
        <div>
          world
        </div>
      </div>
    </div>
  `);

  const root = await page.$('#root');
  const snapshot = await page.accessibility.snapshot({ root, interestingOnly: false });
  expect(snapshot.role).toBe('textbox');
  expect(snapshot.value).toContain('hello');
  expect(snapshot.value).toContain('world');
  expect(!!snapshot.children).toBe(true);
});

it('should work when there is a title ', async ({ page }) => {
  await page.setContent(`
    <title>This is the title</title>
    <div>This is the content</div>
  `);
  const snapshot = await page.accessibility.snapshot();
  expect(snapshot.name).toBe('This is the title');
  expect(snapshot.children[0].name).toBe('This is the content');
});

it('should work with aria-invalid accessibility tree', async ({ page, browserName, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<a href="/hi" aria-invalid="true">WHO WE ARE</a>`);
  expect(await page.accessibility.snapshot()).toEqual({
    'role': browserName === 'firefox' ? 'document' : 'WebArea',
    'name': '',
    'children': [
      {
        'role': 'link',
        'name': 'WHO WE ARE',
        'invalid': 'true',
        'value': browserName === 'firefox' ?  `${server.PREFIX}/hi` : undefined
      }
    ]
  });
});
