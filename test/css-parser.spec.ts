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
  expect(serialize(parseCSS('div').selector)).toBe('div');
  expect(serialize(parseCSS('div.class').selector)).toBe('div.class');
  expect(serialize(parseCSS('.class').selector)).toBe('.class');
  expect(serialize(parseCSS('#id').selector)).toBe('#id');
  expect(serialize(parseCSS('.class#id').selector)).toBe('.class#id');
  expect(serialize(parseCSS('div#id.class').selector)).toBe('div#id.class');
  expect(serialize(parseCSS('*').selector)).toBe('*');
  expect(serialize(parseCSS('*div').selector)).toBe('*div');
  expect(serialize(parseCSS('div[attr *= foo i]').selector)).toBe('div[attr *= foo i]');
  expect(serialize(parseCSS('div[attr~="Bar baz"  ]').selector)).toBe('div[attr~="Bar baz" ]');
  expect(serialize(parseCSS(`div    [ foo = 'bar'  s]`).selector)).toBe(`div [ foo = "bar" s]`);

  expect(serialize(parseCSS(':hover').selector)).toBe(':hover');
  expect(serialize(parseCSS('div:hover').selector)).toBe('div:hover');
  expect(serialize(parseCSS('#id:active:hover').selector)).toBe('#id:active:hover');
  expect(serialize(parseCSS(':dir(ltr)').selector)).toBe(':dir(ltr)');
  expect(serialize(parseCSS('#foo-bar.cls:nth-child(3n + 10)').selector)).toBe('#foo-bar.cls:nth-child(3n + 10)');
  expect(serialize(parseCSS(':lang(en)').selector)).toBe(':lang(en)');
  expect(serialize(parseCSS('*:hover').selector)).toBe('*:hover');

  expect(serialize(parseCSS('div span').selector)).toBe('div span');
  expect(serialize(parseCSS('div>span').selector)).toBe('div > span');
  expect(serialize(parseCSS('div +span').selector)).toBe('div + span');
  expect(serialize(parseCSS('div~ span').selector)).toBe('div ~ span');
  expect(serialize(parseCSS('div   >.class #id+ span').selector)).toBe('div > .class #id + span');
  expect(serialize(parseCSS('div>span+.class').selector)).toBe('div > span + .class');

  expect(serialize(parseCSS('div:not(span)').selector)).toBe('div:not(span)');
  expect(serialize(parseCSS(':not(span)#id').selector)).toBe('#id:not(span)');
  expect(serialize(parseCSS('div:not(span):hover').selector)).toBe('div:hover:not(span)');
  expect(serialize(parseCSS('div:has(span):hover').selector)).toBe('div:hover:has(span)');
  expect(serialize(parseCSS('div:right-of(span):hover').selector)).toBe('div:hover:right-of(span)');
  expect(serialize(parseCSS(':right-of(span):react(foobar)').selector)).toBe(':right-of(span):react(foobar)');
  expect(serialize(parseCSS('div:is(span):hover').selector)).toBe('div:hover:is(span)');
  expect(serialize(parseCSS('div:scope:hover').selector)).toBe('div:hover:scope()');
  expect(serialize(parseCSS('div:sCOpe:HOVER').selector)).toBe('div:HOVER:scope()');
  expect(serialize(parseCSS('div:NOT(span):hoVER').selector)).toBe('div:hoVER:not(span)');

  expect(serialize(parseCSS(':text("foo")').selector)).toBe(':text("foo")');
  expect(serialize(parseCSS(':text("*")').selector)).toBe(':text("*")');
  expect(serialize(parseCSS(':text(*)').selector)).toBe(':text(*)');
  expect(serialize(parseCSS(':text("foo", normalize-space)').selector)).toBe(':text("foo", normalize-space)');
  expect(serialize(parseCSS(':index(3, div    span)').selector)).toBe(':index(3, div span)');
  expect(serialize(parseCSS(':is(foo, bar>baz.cls+:not(qux))').selector)).toBe(':is(foo, bar > baz.cls + :not(qux))');
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
  expectError('"foo"');
  expectError('23');
  expectError('span, div>"foo"');
});
