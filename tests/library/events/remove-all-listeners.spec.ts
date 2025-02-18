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

import { EventEmitter } from './utils';
import { test, expect } from '@playwright/test';
import * as common from './utils';

let wrappers: any[];

const expectWrapper = expected => {
  const entry: any = { expected };
  wrappers.push(entry);
  return name => {
    entry.actual = entry.actual || [];
    entry.actual.push(name);
  };
};

test.beforeEach(() => {
  wrappers = [];
});

test.afterEach(() => {
  for (const wrapper of wrappers) {
    const sortedActual = wrapper.actual.sort();
    const sortedExpected = wrapper.expected.sort();
    expect(sortedActual).toEqual(sortedExpected);
  }
});

test('listeners', () => {
  const ee = new EventEmitter();
  const noop = () => { };
  ee.on('foo', noop);
  ee.on('bar', noop);
  ee.on('baz', noop);
  ee.on('baz', noop);
  const fooListeners = ee.listeners('foo');
  const barListeners = ee.listeners('bar');
  const bazListeners = ee.listeners('baz');
  ee.on('removeListener', expectWrapper(['bar', 'baz', 'baz']));
  void ee.removeAllListeners('bar');
  void ee.removeAllListeners('baz');

  let listeners = ee.listeners('foo');
  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners).toHaveLength(1);
  expect(listeners[0]).toEqual(noop);

  listeners = ee.listeners('bar');
  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners).toHaveLength(0);
  listeners = ee.listeners('baz');
  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners).toHaveLength(0);

  expect(fooListeners.length).toEqual(1);
  expect(fooListeners[0]).toEqual(noop);
  expect(barListeners.length).toEqual(1);
  expect(barListeners[0]).toEqual(noop);
  expect(bazListeners.length).toEqual(2);
  expect(bazListeners[0]).toEqual(noop);
  expect(bazListeners[1]).toEqual(noop);

  expect(ee.listeners('bar')).not.toEqual(barListeners);
  expect(ee.listeners('baz')).not.toEqual(bazListeners);
});

test('removeAllListeners removes all listeners', () => {
  const ee = new EventEmitter();
  ee.on('foo', () => { });
  ee.on('bar', () => { });
  ee.on('removeListener', expectWrapper(['foo', 'bar', 'removeListener']));
  ee.on('removeListener', expectWrapper(['foo', 'bar']));
  void ee.removeAllListeners();

  let listeners = ee.listeners('foo');
  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners).toHaveLength(0);
  listeners = ee.listeners('bar');
  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners).toHaveLength(0);
});

test('removeAllListeners with no event type', () => {
  const ee = new EventEmitter();
  ee.on('removeListener', common.mustNotCall());
  // Check for regression where removeAllListeners() throws when
  // there exists a 'removeListener' listener, but there exists
  // no listeners for the provided event type.
  (ee as any).removeAllListeners(ee, 'foo');
});

test('listener count after removeAllListeners', () => {
  const ee = new EventEmitter();
  let expectLength = 2;
  ee.on('removeListener', () => {
    expect(expectLength--).toEqual(ee.listeners('baz').length);
  });
  ee.on('baz', () => { });
  ee.on('baz', () => { });
  ee.on('baz', () => { });
  expect(ee.listeners('baz').length).toEqual(expectLength + 1);
  void ee.removeAllListeners('baz');
  expect(ee.listeners('baz').length).toEqual(0);
});

test('removeAllListeners returns EventEmitter', () => {
  const ee = new EventEmitter();
  expect(ee).toEqual(ee.removeAllListeners());
});

test('removeAllListeners on undefined _events', () => {
  const ee = new EventEmitter();
  ee._events = undefined;
  expect(ee).toEqual(ee.removeAllListeners());
});
