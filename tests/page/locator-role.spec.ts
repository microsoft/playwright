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

// https://www.w3.org/TR/wai-aria-1.2/#role_definitions
const workingRoles = [
  'alert',
  'alertdialog',
  'application',
  'article',
  'banner',
  'blockquote',
  'button',
  'caption',
  'cell',
  'checkbox',
  'code',
  'columnheader',
  'combobox',
  // 'command',
  'complementary',
  // 'composite',
  'contentinfo',
  'definition',
  'deletion',
  'dialog',
  'directory',
  // 'document',
  'emphasis',
  'feed',
  'figure',
  'form',
  'generic',
  'grid',
  'gridcell',
  'group',
  'heading',
  'img',
  // 'input',
  'insertion',
  // 'landmark',
  'link',
  'list',
  'listbox',
  'listitem',
  'log',
  'main',
  'marquee',
  'math',
  'meter',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'navigation',
  // 'none',
  'note',
  'option',
  'paragraph',
  // 'presentation',
  'progressbar',
  'radio',
  'radiogroup',
  // 'range',
  'region',
  // 'roletype',
  'row',
  'rowgroup',
  'rowheader',
  'scrollbar',
  'search',
  'searchbox',
  // 'section',
  // 'sectionhead',
  // 'select',
  'separator',
  'slider',
  'spinbutton',
  'status',
  'strong',
  // 'structure',
  'subscript',
  'superscript',
  'switch',
  'tab',
  'table',
  'tablist',
  'tabpanel',
  'term',
  'textbox',
  'time',
  'timer',
  'toolbar',
  'tooltip',
  'tree',
  'treegrid',
  'treeitem',
  // 'widget',
  // 'window',
];

const failingRoles = [
  'command',
  'composite',
  'document',
  'input',
  'landmark',
  'none',
  'presentation',
  'range',
  'roletype',
  'section',
  'sectionhead',
  'select',
  'structure',
  'widget',
  'window',
];

it.describe.only('getByRole', () => {
  workingRoles.forEach(role => {
    it(`${role}`, async ({ page }) => {
      await page.setContent(`<div role=${role}>Foo</div>`);
      await expect(page.getByRole(`${role}`)).toHaveText('Foo');
    });
  });

  failingRoles.forEach(role => {
    it.fail(`${role}`, async ({ page }) => {
      await page.setContent(`<div role=${role}>Foo</div>`);
      await expect(page.getByRole(`${role}`)).toHaveText('Foo');
    });
  });
});
