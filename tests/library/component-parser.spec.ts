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

import { playwrightTest as it, expect } from '../config/browserTest';
import type { AttributeSelector } from '../../packages/playwright-core/src/utils/isomorphic/selectorParser';
import { parseAttributeSelector } from '../../packages/playwright-core/lib/utils/isomorphic/selectorParser';

const parse = (selector: string) => parseAttributeSelector(selector, false);
const serialize = (parsed: AttributeSelector) => {
  return parsed.name + parsed.attributes.map(attr => {
    const path = attr.jsonPath.map(token => /^[a-zA-Z0-9]+$/i.test(token) ? token : JSON.stringify(token)).join('.');
    if (attr.op === '<truthy>')
      return '[' + path + ']';
    const value = attr.value instanceof RegExp ? attr.value.toString() : JSON.stringify(attr.value);
    return '[' + path + ' ' + attr.op + ' ' + value + (attr.caseSensitive ? ']' : ' i]');
  }).join('');
};

function expectError(selector: string) {
  let error = { message: '' };
  try {
    parse(selector);
  } catch (e) {
    error = e;
  }
  expect(error.message).toContain(`while parsing selector \`${selector}\``);
}

it('should parse', async () => {
  expect(serialize(parse('[foo="]"]'))).toBe('[foo = "]"]');
  expect(serialize(parse('[foo="10"s]'))).toBe('[foo = "10"]');
  expect(serialize(parse('[foo="10" s]'))).toBe('[foo = "10"]');
  expect(serialize(parse('[foo="true"]'))).toBe('[foo = "true"]');
  expect(serialize(parse('[foo=""]'))).toBe('[foo = ""]');
  expect(serialize(parse('[foo="=="]'))).toBe('[foo = "=="]');
});

it('should parse short attributes', async () => {
  expect(serialize(parse(`BookItem [  name ]`))).toBe('BookItem[name]');
  expect(serialize(parse(`BookItem ['name' ] [ foo."bar".baz ]`))).toBe('BookItem[name][foo.bar.baz]');
  expect(serialize(parse(`BookItem ['na  me' ]`))).toBe('BookItem["na  me"]');
});

it('should parse all operators', async () => {
  expect(serialize(parse(`BookItem[name = 10]`))).toBe('BookItem[name = 10]');
  expect(serialize(parse(`BookItem[name = 'foo']`))).toBe(`BookItem[name = "foo"]`);
  expect(serialize(parse(`BookItem[name *= 'foo']`))).toBe(`BookItem[name *= "foo"]`);
  expect(serialize(parse(`BookItem[name ^= 'foo']`))).toBe(`BookItem[name ^= "foo"]`);
  expect(serialize(parse(`BookItem[name $= 'foo']`))).toBe(`BookItem[name $= "foo"]`);
  expect(serialize(parse(`BookItem[name ~= 'foo']`))).toBe(`BookItem[name ~= "foo"]`);
  expect(serialize(parse(`BookItem[name |= 'foo']`))).toBe(`BookItem[name |= "foo"]`);
});

it('should tolerate spacing', async () => {
  expect(serialize(parse(` BookItem[ name = "Foo "  ]`))).toBe('BookItem[name = "Foo "]');
  expect(serialize(parse(`  BookItem  [  name = "Foo"  ]   `))).toBe('BookItem[name = "Foo"]');
  expect(serialize(parse(`  [    name = "Foo"]`))).toBe('[name = "Foo"]');
  expect(serialize(parse(`  BookItem  ["name" = "Foo" i]   `))).toBe('BookItem[name = "Foo" i]');
  expect(serialize(parse(`BookItem  [   'name' = 'Foo'i ]   `))).toBe('BookItem[name = "Foo" i]');
});

it('should escape', async () => {
  expect(serialize(parse(`BookItem['jake\\'s' = 10]`))).toBe(`BookItem["jake's" = 10]`);
  expect(serialize(parse(`BookItem['jake"s' = 10]`))).toBe(`BookItem["jake\\"s" = 10]`);
  expect(serialize(parse(`BookItem["jake\\"s" = 10]`))).toBe(`BookItem["jake\\"s" = 10]`);
  expect(serialize(parse(`BookItem[name = 'foo\\'bar']`))).toBe(`BookItem[name = "foo'bar"]`);
  expect(serialize(parse(`BookItem[name = "foo'bar"]`))).toBe(`BookItem[name = "foo'bar"]`);
  expect(serialize(parse(`BookItem[name = "foo\\"bar"]`))).toBe(`BookItem[name = "foo\\"bar"]`);
});

it('should parse int values', async () => {
  expect(serialize(parse(`ColorButton[value = 10]`))).toBe('ColorButton[value = 10]');
  expect(serialize(parse(`ColorButton[value = +10]`))).toBe('ColorButton[value = 10]');
  expect(serialize(parse(`ColorButton[value = -10]`))).toBe('ColorButton[value = -10]');
  expect(serialize(parse(`ColorButton  [ "nested". "index" = 0 ]   `))).toBe('ColorButton[nested.index = 0]');
});

it('should parse float values', async () => {
  expect(serialize(parse(`ColorButton[value = -12.3]`))).toBe('ColorButton[value = -12.3]');
  expect(serialize(parse(`ColorButton  ['nested'.value = 4.1]`))).toBe('ColorButton[nested.value = 4.1]');
  expect(serialize(parse(`ColorButton  [    'nested' .value =4.1]`))).toBe('ColorButton[nested.value = 4.1]');
});

it('should parse bool', async () => {
  expect(serialize(parse(`ColorButton[enabled= false] `))).toBe('ColorButton[enabled = false]');
  expect(serialize(parse(`ColorButton[enabled  =true] `))).toBe('ColorButton[enabled = true]');
  expect(serialize(parse(`ColorButton[enabled  =true][ color = "red"]`))).toBe('ColorButton[enabled = true][color = "red"]');
  expect(serialize(parse(`ColorButton[ enabled  =true][ color = "red"i][nested.index =  6]`))).toBe('ColorButton[enabled = true][color = "red" i][nested.index = 6]');
});

it('should parse regex', async () => {
  expect(serialize(parse(`ColorButton[color =  /red$/]`))).toBe('ColorButton[color = /red$/]');
  expect(serialize(parse(`ColorButton[color=/red/ig]`))).toBe('ColorButton[color = /red/gi]');
  expect(serialize(parse(`ColorButton[color=  / \\/ [/]/  ]`))).toBe('ColorButton[color = / \\/ [/]/]');
  expect(serialize(parse(`ColorButton[color=/[\\]/][[/]/]`))).toBe('ColorButton[color = /[\\]/][[/]/]');
});

it('should parse identifiers', async () => {
  expect(serialize(parse('[привет=true]'))).toBe('["привет" = true]');
  expect(serialize(parse('[__-__=true]'))).toBe('["__-__" = true]');
  expect(serialize(parse('[😀=true]'))).toBe('["😀" = true]');
});

it('should parse unquoted string', async () => {
  expect(serialize(parseAttributeSelector('[hey=foo]', true))).toBe('[hey = "foo"]');
  expect(serialize(parseAttributeSelector('[yay=and😀more]', true))).toBe('[yay = "and😀more"]');
  expect(serialize(parseAttributeSelector('[yay= trims  ]', true))).toBe('[yay = "trims"]');
});

it('should throw on malformed selector', async () => {
  expectError('foo[');
  expectError('foo[');
  expectError('foo["asd');
  expectError('foo["asd"');
  expectError('foo["asd"');

  expectError('foo[.bar=10]');
  expectError('foo[bar **= 10]');
  expectError('foo[bar == 10]');
  expectError('foo[bar = 10 [baz=20]');
  expectError('foo[bar = 10 i[baz=20]');

  expectError('foo[bar *= #%s]');
  expectError('foo[bar *= 10]');
  expectError('');

  expectError('[foo=10 s]');
  expectError('[foo=10 p]');
  expectError('foo.bar');
  expectError('foo[]');
  expectError('["a\"b"=foo]');
  expectError('[foo=10"bar"]');
  expectError('[foo= ==]');
  expectError('[foo===]');
  expectError('[foo="\"]"[]');
  expectError('[foo=abc S]');
  expectError('[foo=abc \s]');
  expectError('[foo=abc"\s"]');
  expectError('[foo="\\"]');
  expectError('[foo s]');
  expectError('[foo*=/bar/]');
  expectError('[foo=/bar/ s]');
  expectError('[foo=/bar//]');
  expectError('[foo=/bar/pt]');
  expectError('[foo=/[\\]/');
});
