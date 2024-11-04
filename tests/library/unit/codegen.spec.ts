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
import { getAPIRequestCodeGen } from '../../../packages/trace-viewer/src/ui/codegen';

test.describe('javascript', () => {
  const impl = getAPIRequestCodeGen('javascript');

  test('generatePlaywrightRequestCall', () => {

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

  test('generatePlaywrightRequestCall with POST method and no body', () => {
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

  test('generatePlaywrightRequestCall with PUT method and JSON body', () => {
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

  test('generatePlaywrightRequestCall with PATCH method and form data', () => {
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

  test('generatePlaywrightRequestCall with DELETE method and custom header', () => {
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

  test('generatePlaywrightRequestCall with HEAD method', () => {
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

  test('generatePlaywrightRequestCall with complex query parameters', () => {
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

  test('generatePlaywrightRequestCall with multiple headers', () => {
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

});
