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

test('should work', () => {
  const e = new EventEmitter();
  const num_args_emitted = [];

  e.on('numArgs', (...args) => {
    const numArgs = args.length;
    num_args_emitted.push(numArgs);
  });

  e.on('foo', function() {
    num_args_emitted.push(arguments.length);
  });

  e.on('foo', function() {
    num_args_emitted.push(arguments.length);
  });

  e.emit('numArgs');
  e.emit('numArgs', null);
  e.emit('numArgs', null, null);
  e.emit('numArgs', null, null, null);
  e.emit('numArgs', null, null, null, null);
  e.emit('numArgs', null, null, null, null, null);

  e.emit('foo', null, null, null, null);

  expect(Array.isArray(num_args_emitted)).toBeTruthy();
  expect(num_args_emitted).toHaveLength(8);
  expect(num_args_emitted[0]).toEqual(0);
  expect(num_args_emitted[1]).toEqual(1);
  expect(num_args_emitted[2]).toEqual(2);
  expect(num_args_emitted[3]).toEqual(3);
  expect(num_args_emitted[4]).toEqual(4);
  expect(num_args_emitted[5]).toEqual(5);
  expect(num_args_emitted[6]).toEqual(4);
  expect(num_args_emitted[6]).toEqual(4);
});
