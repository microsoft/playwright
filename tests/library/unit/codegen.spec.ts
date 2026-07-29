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

import { test, expect } from '@playwright/test';
import { CSharpLanguageGenerator } from '../../../packages/isomorphic/codegen/csharp';
import { JavaLanguageGenerator } from '../../../packages/isomorphic/codegen/java';
import { PythonLanguageGenerator } from '../../../packages/isomorphic/codegen/python';
import { getAPIRequestCodeGen } from '../../../packages/trace-viewer/src/ui/codegen';

test('CG-192 should generate maximized viewport context options', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/1086' } }, () => {
  const cases = [
    { generator: new PythonLanguageGenerator(false, false), expected: 'browser.new_context(viewport="maximized")' },
    { generator: new JavaLanguageGenerator('library'), expected: '.setViewportSize(ViewportSize.MAXIMIZED)' },
    { generator: new CSharpLanguageGenerator('library'), expected: 'ViewportSize = ViewportSize.Maximized,' },
  ];
  for (const { generator, expected } of cases) {
    const header = generator.generateHeader({
      browserName: 'chromium',
      launchOptions: { headless: false },
      contextOptions: { viewport: 'maximized' },
    });
    expect(header, generator.id).toContain(expected);
  }
});

test.describe('javascript', () => {
  const impl = getAPIRequestCodeGen('javascript');

  test('CG-164 generatePlaywrightRequestCall', () => {

    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo?bar=baz',
      method: 'GET',
      headers: [{ name: 'User-Agent', value: 'Mozilla/5.0' }, { name: 'Date', value: '2021-01-01' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, 'foo')).toEqual(`
await page.request.get('http://example.com/foo', {
  params: {
    bar: 'baz'
  },
  data: 'foo',
  headers: {
    'User-Agent': 'Mozilla/5.0',
    Date: '2021-01-01'
  }
});`.trim());

    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo?bar=baz',
      method: 'OPTIONS',
      headers: [],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
await page.request.fetch('http://example.com/foo', {
  method: 'options',
  params: {
    bar: 'baz'
  }
});`.trim());
  });

  test('CG-165 generatePlaywrightRequestCall with POST method and no body', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'POST',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
await page.request.post('http://example.com/foo', {
  headers: {
    'Content-Type': 'application/json'
  }
});`.trim());
  });

  test('CG-166 generatePlaywrightRequestCall with PUT method and JSON body', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'PUT',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, '{"key":"value"}')).toEqual(`
await page.request.put('http://example.com/foo', {
  data: '{"key":"value"}',
  headers: {
    'Content-Type': 'application/json'
  }
});`.trim());
  });

  test('CG-167 generatePlaywrightRequestCall with PATCH method and form data', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'PATCH',
      headers: [{ name: 'Content-Type', value: 'application/x-www-form-urlencoded' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, 'key=value')).toEqual(`
await page.request.patch('http://example.com/foo', {
  data: 'key=value',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
});`.trim());
  });

  test('CG-168 generatePlaywrightRequestCall with DELETE method and custom header', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'DELETE',
      headers: [{ name: 'Authorization', value: 'Bearer token' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
await page.request.delete('http://example.com/foo', {
  headers: {
    Authorization: 'Bearer token'
  }
});`.trim());
  });

  test('CG-169 generatePlaywrightRequestCall with HEAD method', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'HEAD',
      headers: [],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
await page.request.head('http://example.com/foo');`.trim());
  });

  test('CG-170 generatePlaywrightRequestCall with complex query parameters', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo?bar=baz&qux=quux',
      method: 'GET',
      headers: [],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
await page.request.get('http://example.com/foo', {
  params: {
    bar: 'baz',
    qux: 'quux'
  }
});`.trim());
  });

  test('CG-171 generatePlaywrightRequestCall with multiple headers', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'GET',
      headers: [
        { name: 'User-Agent', value: 'Mozilla/5.0' },
        { name: 'Accept', value: 'application/json' },
        { name: 'Authorization', value: 'Bearer token' }
      ],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
await page.request.get('http://example.com/foo', {
  headers: {
    'User-Agent': 'Mozilla/5.0',
    Accept: 'application/json',
    Authorization: 'Bearer token'
  }
});`.trim());
  });

  test('CG-172 escape sequences', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'GET',
      headers: [
        { name: 'F\\o', value: 'B\\r' },
      ],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
await page.request.get('http://example.com/foo', {
  headers: {
    'F\\\\o': 'B\\\\r'
  }
});`.trim());
  });

});

test.describe('python', () => {
  const impl = getAPIRequestCodeGen('python');

  test('CG-173 generatePlaywrightRequestCall', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo?bar=baz',
      method: 'GET',
      headers: [{ name: 'User-Agent', value: 'Mozilla/5.0' }, { name: 'Date', value: '2021-01-01' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, 'foo')).toEqual(`
await page.request.get(
  "http://example.com/foo",
  params={
    "bar": "baz"
  },
  data="foo",
  headers={
    "User-Agent": "Mozilla/5.0",
    "Date": "2021-01-01"
  }
)`.trim());

    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo?bar=baz',
      method: 'OPTIONS',
      headers: [],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
await page.request.fetch(
  "http://example.com/foo",
  method="options",
  params={
    "bar": "baz"
  }
)`.trim());
  });

  test('CG-174 generatePlaywrightRequestCall with POST method and no body', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'POST',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
await page.request.post(
  "http://example.com/foo",
  headers={
    "Content-Type": "application/json"
  }
)`.trim());
  });

  test('CG-175 generatePlaywrightRequestCall with PUT method and JSON body', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'PUT',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, '{"key":"value"}')).toEqual(`
await page.request.put(
  "http://example.com/foo",
  data="{\\"key\\":\\"value\\"}",
  headers={
    "Content-Type": "application/json"
  }
)`.trim());
  });

  test('CG-176 generatePlaywrightRequestCall with PATCH method and form data', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'PATCH',
      headers: [{ name: 'Content-Type', value: 'application/x-www-form-urlencoded' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, 'key=value')).toEqual(`
await page.request.patch(
  "http://example.com/foo",
  data="key=value",
  headers={
    "Content-Type": "application/x-www-form-urlencoded"
  }
)`.trim());
  });

  test('CG-177 generatePlaywrightRequestCall with DELETE method and custom header', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'DELETE',
      headers: [{ name: 'Authorization', value: 'Bearer token' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
await page.request.delete(
  "http://example.com/foo",
  headers={
    "Authorization": "Bearer token"
  }
)`.trim());
  });

  test('CG-178 generatePlaywrightRequestCall with HEAD method', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'HEAD',
      headers: [],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
await page.request.head("http://example.com/foo")`.trim());
  });

  test('CG-179 generatePlaywrightRequestCall with complex query parameters', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo?bar=baz&qux=quux',
      method: 'GET',
      headers: [],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
await page.request.get(
  "http://example.com/foo",
  params={
    "bar": "baz",
    "qux": "quux"
  }
)`.trim());
  });

  test('CG-180 generatePlaywrightRequestCall with multiple headers', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'GET',
      headers: [
        { name: 'User-Agent', value: 'Mozilla/5.0' },
        { name: 'Accept', value: 'application/json' },
        { name: 'Authorization', value: 'Bearer token' }
      ],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
await page.request.get(
  "http://example.com/foo",
  headers={
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
    "Authorization": "Bearer token"
  }
)`.trim());
  });

  test('CG-181 escape sequences', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'GET',
      headers: [
        { name: 'F\\o', value: 'B\\r' },
      ],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
await page.request.get(
  "http://example.com/foo",
  headers={
    "F\\\\o": "B\\\\r"
  }
)`.trim());
  });

});

test.describe('csharp', () => {
  const impl = getAPIRequestCodeGen('csharp');

  test('CG-182 generatePlaywrightRequestCall', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo?bar=baz',
      method: 'GET',
      headers: [{ name: 'User-Agent', value: 'Mozilla/5.0' }, { name: 'Date', value: '2021-01-01' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, 'foo')).toEqual(`
await request.GetAsync("http://example.com/foo", new() {
  Params = new() {
    ["bar"] = "baz"
  },
  Data = "foo",
  Headers = new() {
    ["User-Agent"] = "Mozilla/5.0",
    ["Date"] = "2021-01-01"
  }
});`.trim());

    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo?bar=baz',
      method: 'OPTIONS',
      headers: [],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
await request.FetchAsync("http://example.com/foo", new() {
  Method = "options",
  Params = new() {
    ["bar"] = "baz"
  }
});`.trim());
  });

  test('CG-183 generatePlaywrightRequestCall with POST method and no body', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'POST',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
await request.PostAsync("http://example.com/foo", new() {
  Headers = new() {
    ["Content-Type"] = "application/json"
  }
});`.trim());
  });

  test('CG-184 generatePlaywrightRequestCall with PUT method and JSON body', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'PUT',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, '{"key":"value"}')).toEqual(`
await request.PutAsync("http://example.com/foo", new() {
  Data = "{\\"key\\":\\"value\\"}",
  Headers = new() {
    ["Content-Type"] = "application/json"
  }
});`.trim());
  });

  test('CG-185 escape sequences', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'GET',
      headers: [
        { name: 'F\\o', value: 'B\\r' },
      ],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
await request.GetAsync("http://example.com/foo", new() {
  Headers = new() {
    ["F\\\\o"] = "B\\\\r"
  }
});`.trim());
  });
});

test.describe('java', () => {
  const impl = getAPIRequestCodeGen('java');

  test('CG-186 generatePlaywrightRequestCall', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo?bar=baz',
      method: 'GET',
      headers: [{ name: 'User-Agent', value: 'Mozilla/5.0' }, { name: 'Date', value: '2021-01-01' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, 'foo')).toEqual(`
request.get("http://example.com/foo", RequestOptions.create()
  .setQueryParam("bar", "baz")
  .setData("foo")
  .setHeader("User-Agent", "Mozilla/5.0")
  .setHeader("Date", "2021-01-01")
);`.trim());

    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo?bar=baz',
      method: 'OPTIONS',
      headers: [],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
request.fetch("http://example.com/foo", RequestOptions.create()
  .setMethod("options")
  .setQueryParam("bar", "baz")
);`.trim());
  });

  test('CG-187 generatePlaywrightRequestCall with POST method and no body', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'POST',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
request.post("http://example.com/foo", RequestOptions.create()
  .setHeader("Content-Type", "application/json")
);`.trim());
  });

  test('CG-188 generatePlaywrightRequestCall with PUT method and JSON body', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'PUT',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, '{"key":"value"}')).toEqual(`
request.put("http://example.com/foo", RequestOptions.create()
  .setData("{\\"key\\":\\"value\\"}")
  .setHeader("Content-Type", "application/json")
);`.trim());
  });

  test('CG-189 generatePlaywrightRequestCall with PATCH method and form data', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'PATCH',
      headers: [{ name: 'Content-Type', value: 'application/x-www-form-urlencoded' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, 'key=value')).toEqual(`
request.patch("http://example.com/foo", RequestOptions.create()
  .setData("key=value")
  .setHeader("Content-Type", "application/x-www-form-urlencoded")
);`.trim());
  });

  test('CG-190 generatePlaywrightRequestCall with DELETE method and custom header', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'DELETE',
      headers: [{ name: 'Authorization', value: 'Bearer token' }],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
request.delete("http://example.com/foo", RequestOptions.create()
  .setHeader("Authorization", "Bearer token")
);`.trim());
  });

  test('CG-191 escape sequences', () => {
    expect(impl.generatePlaywrightRequestCall({
      url: 'http://example.com/foo',
      method: 'GET',
      headers: [
        { name: 'F\\o', value: 'B\\r' },
      ],
      httpVersion: '1.1',
      cookies: [],
      queryString: [],
      headersSize: 0,
      bodySize: 0,
      comment: '',
    }, undefined)).toEqual(`
request.get(\"http://example.com/foo\", RequestOptions.create()
  .setHeader(\"F\\\\o\", \"B\\\\r\")
);`.trim());
  });
});
