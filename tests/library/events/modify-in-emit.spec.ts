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

let callbacks_called = [];
const e = new EventEmitter();

const callback1 = () => {
  callbacks_called.push('callback1');
  e.on('foo', callback2);
  e.on('foo', callback3);
  e.removeListener('foo', callback1);
};

const callback2 = () => {
  callbacks_called.push('callback2');
  e.removeListener('foo', callback2);
};

const callback3 = () => {
  callbacks_called.push('callback3');
  e.removeListener('foo', callback3);
};

test('add and remove listeners', () => {
  e.on('foo', callback1);
  expect(e.listeners('foo')).toHaveLength(1);

  e.emit('foo');
  expect(e.listeners('foo')).toHaveLength(2);
  expect(Array.isArray(callbacks_called)).toBeTruthy();
  expect(callbacks_called).toHaveLength(1);
  expect(callbacks_called[0]).toEqual('callback1');

  e.emit('foo');
  expect(e.listeners('foo')).toHaveLength(0);
  expect(Array.isArray(callbacks_called)).toBeTruthy();
  expect(callbacks_called).toHaveLength(3);
  expect(callbacks_called[0]).toEqual('callback1');
  expect(callbacks_called[1]).toEqual('callback2');
  expect(callbacks_called[2]).toEqual('callback3');

  e.emit('foo');
  expect(e.listeners('foo')).toHaveLength(0);
  expect(Array.isArray(callbacks_called)).toBeTruthy();
  expect(callbacks_called).toHaveLength(3);
  expect(callbacks_called[0]).toEqual('callback1');
  expect(callbacks_called[1]).toEqual('callback2');
  expect(callbacks_called[2]).toEqual('callback3');

  e.on('foo', callback1);
  e.on('foo', callback2);
  expect(e.listeners('foo')).toHaveLength(2);
  void e.removeAllListeners('foo');
  expect(e.listeners('foo')).toHaveLength(0);
});

test('removing callbacks in emit', () => {
  // Verify that removing callbacks while in emit allows emits to propagate to
  // all listeners
  callbacks_called = [];

  e.on('foo', callback2);
  e.on('foo', callback3);
  expect(e.listeners('foo')).toHaveLength(2);
  e.emit('foo');
  expect(Array.isArray(callbacks_called)).toBeTruthy();
  expect(callbacks_called).toHaveLength(2);
  expect(callbacks_called[0]).toEqual('callback2');
  expect(callbacks_called[1]).toEqual('callback3');
  expect(e.listeners('foo')).toHaveLength(0);
});
