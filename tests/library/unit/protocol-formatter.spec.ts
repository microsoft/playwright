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

import { test as it, expect } from '@playwright/test';
import { iso as _iso } from '../../../packages/playwright-core/lib/coreBundle';

const { renderFullTitleForCall } = _iso;

const goto = (url: string) => ({ type: 'Frame', method: 'goto', params: { url } });

it('should hide the origin of same-origin urls', () => {
  expect(renderFullTitleForCall(goto('https://example.com/foo?bar=1'), 'javascript', 'https://example.com')).toBe('Navigate /foo?bar=1');
  expect(renderFullTitleForCall(goto('https://example.com/foo?bar=1'), 'javascript', 'https://example.com/base/path')).toBe('Navigate /foo?bar=1');
});

it('should print the whole url when the origin differs from the base url', () => {
  expect(renderFullTitleForCall(goto('https://another.com/foo?bar=1'), 'javascript', 'https://example.com')).toBe('Navigate https://another.com/foo?bar=1');
  // Different port and different scheme are different origins as well.
  expect(renderFullTitleForCall(goto('https://example.com:8443/foo'), 'javascript', 'https://example.com')).toBe('Navigate https://example.com:8443/foo');
  expect(renderFullTitleForCall(goto('http://example.com/foo'), 'javascript', 'https://example.com')).toBe('Navigate http://example.com/foo');
});

it('should hide the origin when there is no base url to compare against', () => {
  expect(renderFullTitleForCall(goto('https://example.com/foo?bar=1'), 'javascript')).toBe('Navigate /foo?bar=1');
  expect(renderFullTitleForCall(goto('https://example.com/foo?bar=1'), 'javascript', 'not a url')).toBe('Navigate /foo?bar=1');
});

it('should not affect non-http urls', () => {
  expect(renderFullTitleForCall(goto('data:text/html,<div>hi</div>'), 'javascript', 'https://example.com')).toBe('Navigate data:');
  expect(renderFullTitleForCall(goto('about:blank'), 'javascript', 'https://example.com')).toBe('Navigate about:blank');
  expect(renderFullTitleForCall(goto('not a url'), 'javascript', 'https://example.com')).toBe('Navigate not a url');
});
