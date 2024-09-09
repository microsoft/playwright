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

test('listeners empty check', () => {
  const e = new EventEmitter();
  let fl;  // foo listeners

  fl = e.listeners('foo');

  expect(Array.isArray(fl)).toBeTruthy();
  expect(fl).toHaveLength(0);
  expect(e._events instanceof Object).toBeFalsy();
  expect(Object.keys(e._events)).toHaveLength(0);

  const fail = () => expect(true).toBe(false);
  e.on('foo', fail);
  fl = e.listeners('foo');

  expect(e._events.foo).toBe(fail);
  expect(Array.isArray(fl)).toBeTruthy();
  expect(fl).toHaveLength(1);
  expect(fl[0]).toBe(fail);

  e.listeners('bar');

  const pass = () => expect(true).toBe(true);
  e.on('foo', pass);
  fl = e.listeners('foo');

  expect(Array.isArray(e._events.foo)).toBeTruthy();
  expect(e._events.foo).toHaveLength(2);
  expect(e._events.foo[0]).toBe(fail);
  expect(e._events.foo[1]).toBe(pass);

  expect(Array.isArray(fl)).toBeTruthy();
  expect(fl).toHaveLength(2);
  expect(fl[0]).toBe(fail);
  expect(fl[1]).toBe(pass);
});
