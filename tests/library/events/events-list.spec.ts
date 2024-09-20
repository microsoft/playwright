// Copyright Joyent, Inc. and other Node contributors.
// Modifications copyright (c) by Microsoft Corporation
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

import { EventEmitter } from '../../../packages/playwright-core/lib/client/eventEmitter';
import { test, expect } from '@playwright/test';

test.describe('EventEmitter', () => {
  test('should maintain event names correctly', () => {
    const e = new EventEmitter();
    const m = () => {};
    e.on('foo', function() {});
    expect(e.eventNames().length).toBe(1);
    expect(e.eventNames()[0]).toBe('foo');

    e.on('bar', m);
    expect(e.eventNames().length).toBe(2);
    expect(e.eventNames()[0]).toBe('foo');
    expect(e.eventNames()[1]).toBe('bar');

    e.removeListener('bar', m);
    expect(e.eventNames().length).toBe(1);
    expect(e.eventNames()[0]).toBe('foo');

    if (typeof Symbol !== 'undefined') {
      const s = Symbol('s');
      e.on(s, m);
      expect(e.eventNames().length).toBe(2);
      expect(e.eventNames()[0]).toBe('foo');
      expect(e.eventNames()[1]).toBe(s);

      e.removeListener(s, m);
      expect(e.eventNames().length).toBe(1);
      expect(e.eventNames()[0]).toBe('foo');
    }
  });
});
