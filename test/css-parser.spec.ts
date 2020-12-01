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

import { it, expect } from './fixtures';
import * as path from 'path';

const { parseCSS, serializeSelector: serialize } =
    require(path.join(__dirname, '..', 'lib', 'server', 'common', 'cssParser'));

it('should parse css', async () => {
  expect(serialize(parseCSS('div'))).toBe('div');
  expect(serialize(parseCSS('div.class'))).toBe('div.class');
  expect(serialize(parseCSS('.class'))).toBe('.class');
  expect(serialize(parseCSS('#id'))).toBe('#id');
  expect(serialize(parseCSS('.class#id'))).toBe('.class#id');
  expect(serialize(parseCSS('div#id.class'))).toBe('div#id.class');
  expect(serialize(parseCSS('*'))).toBe('*');
  expect(serialize(parseCSS('*div'))).toBe('*div');
  expect(serialize(parseCSS('div[attr *= foo i]'))).toBe('div[attr *= foo i]');
  expect(serialize(parseCSS('div[attr~="Bar baz"  ]'))).toBe('div[attr~="Bar baz" ]');
  expect(serialize(parseCSS(`div    [ foo = 'bar'  s]`))).toBe(`div [ foo = "bar" s]`);

  expect(serialize(parseCSS(':hover'))).toBe(':hover');
  expect(serialize(parseCSS('div:hover'))).toBe('div:hover');
  expect(serialize(parseCSS('#id:active:hover'))).toBe('#id:active:hover');
  expect(serialize(parseCSS(':dir(ltr)'))).toBe(':dir(ltr)');
  expect(serialize(parseCSS('#foo-bar.cls:nth-child(3n + 10)'))).toBe('#foo-bar.cls:nth-child(3n + 10)');
  expect(serialize(parseCSS(':lang(en)'))).toBe(':lang(en)');
  expect(serialize(parseCSS('*:hover'))).toBe('*:hover');

  expect(serialize(parseCSS('div span'))).toBe('div span');
  expect(serialize(parseCSS('div>span'))).toBe('div > span');
  expect(serialize(parseCSS('div +span'))).toBe('div + span');
  expect(serialize(parseCSS('div~ span'))).toBe('div ~ span');
  expect(serialize(parseCSS('div   >.class #id+ span'))).toBe('div > .class #id + span');
  expect(serialize(parseCSS('div>span+.class'))).toBe('div > span + .class');

  expect(serialize(parseCSS('div:not(span)'))).toBe('div:not(span)');
  expect(serialize(parseCSS(':not(span)#id'))).toBe('#id:not(span)');
  expect(serialize(parseCSS('div:not(span):hover'))).toBe('div:hover:not(span)');
  expect(serialize(parseCSS('div:has(span):hover'))).toBe('div:hover:has(span)');
  expect(serialize(parseCSS('div:right-of(span):hover'))).toBe('div:hover:right-of(span)');
  expect(serialize(parseCSS(':right-of(span):react(foobar)'))).toBe(':right-of(span):react(foobar)');
  expect(serialize(parseCSS('div:is(span):hover'))).toBe('div:hover:is(span)');
  expect(serialize(parseCSS('div:scope:hover'))).toBe('div:hover:scope()');

  expect(serialize(parseCSS(':text("foo")'))).toBe(':text(foo)');
  expect(serialize(parseCSS(':text("*")'))).toBe(':text(*)');
  expect(serialize(parseCSS(':text(*)'))).toBe(':text(*)');
  expect(serialize(parseCSS(':text("foo", normalize-space)'))).toBe(':text(foo, normalize-space)');
  expect(serialize(parseCSS(':index(3, div    span)'))).toBe(':index(3, div span)');
  expect(serialize(parseCSS(':is(foo, bar>baz.cls+:not(qux))'))).toBe(':is(foo, bar > baz.cls + :not(qux))');
  // expect(serialize(parseCSS(':right-of(div, bar=50)'))).toBe(':right-of(div, bar=50)');
});

it('should throw on malformed css', async () => {
  function expectError(selector: string) {
    let error = { message: '' };
    try {
      parseCSS(selector);
    } catch (e) {
      error = e;
    }
    expect(error.message).toContain(`while parsing selector "${selector}"`);
  }

  expectError('');
  expectError('.');
  expectError('#');
  expectError('..');
  expectError('#.');
  expectError('.#');
  expectError('[attr=');
  expectError(':not(div');
  expectError('div)');
  expectError('()');
  expectError(':not(##)');
  expectError(':not()');
  expectError(':not(.)');
  expectError('div,');
  expectError(',div');
  expectError('div,,span');
  expectError('div > > span');
  expectError('div > > > > span');
  expectError('div >');
});
