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

test('EventEmitter functionality', () => {
  const myEE = new EventEmitter();
  let m = 0;
  // This one comes last.
  myEE.on('foo', () => {
    expect(m).toEqual(2);
  });

  // This one comes second.
  myEE.prependListener('foo', () => {
    expect(m++).toEqual(1);
  });

  // This one comes first.
  myEE.prependOnceListener('foo', () => {
    expect(m++).toEqual(0);
  });

  myEE.emit('foo');
});

test('Verify that the listener must be a function', () => {
  expect(() => {
    const ee = new EventEmitter();
    ee.prependOnceListener('foo', null);
  }).toThrow(TypeError);
});
