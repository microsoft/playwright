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

import { test, expect } from '@playwright/test';
import { EventEmitter } from '../../../packages/playwright-core/lib/client/eventEmitter';
import * as common from './utils';

test('should work', () => {
  const e = new EventEmitter();

  e.once('hello', common.mustCall());

  e.emit('hello', 'a', 'b');
  e.emit('hello', 'a', 'b');
  e.emit('hello', 'a', 'b');
  e.emit('hello', 'a', 'b');

  const remove = () => {
    expect(false).toBe(true);
  };

  e.once('foo', remove);
  e.removeListener('foo', remove);
  e.emit('foo');

  e.once('e', common.mustCall(() => {
    e.emit('e');
  }));

  e.once('e', common.mustCall());

  e.emit('e');

  // Verify that the listener must be a function
  expect(() => {
    const ee = new EventEmitter();

    ee.once('foo', null);
  }).toThrow(TypeError);
});

test('once() has different code paths based on the number of arguments being emitted', () => {
  // Verify that all of the cases are covered.
  const maxArgs = 4;

  for (let i = 0; i <= maxArgs; i++) {
    const ee = new EventEmitter();
    const args: any[] = ['foo'];

    for (let j = 0; j < i; j++)
      args.push(j);

    ee.once('foo', common.mustCall((...params) => {
      const restArgs = args.slice(1);
      expect(Array.isArray(params)).toBeTruthy();
      expect(params).toHaveLength(restArgs.length);
      for (let index = 0; index < params.length; index++) {
        const param = params[index];
        expect(param).toEqual(restArgs[index]);
      }
    }));

    EventEmitter.prototype.emit.apply(ee, args);
  }
});
