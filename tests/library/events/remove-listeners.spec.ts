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
import * as common from './utils';

const listener1 = () => {};
const listener2 = () => {};

test.beforeEach(() => common.beforeEach());
test.afterEach(() => common.afterEach());

test('First test', () => {
  const ee = new EventEmitter();
  ee.on('hello', listener1);
  ee.on('removeListener', common.mustCall((name, cb) => {
    expect(name).toEqual('hello');
    expect(cb).toEqual(listener1);
  }));
  ee.removeListener('hello', listener1);
  const listeners = ee.listeners('hello');
  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners).toHaveLength(0);
});

test('Second test', () => {
  const ee = new EventEmitter();
  ee.on('hello', listener1);
  ee.on('removeListener', common.mustNotCall());
  ee.removeListener('hello', listener2);

  const listeners = ee.listeners('hello');
  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners.length).toEqual(1);
  expect(listeners[0]).toEqual(listener1);
});

test('Third test', () => {
  const ee = new EventEmitter();
  ee.on('hello', listener1);
  ee.on('hello', listener2);

  let listeners;
  ee.once('removeListener', common.mustCall((name, cb) => {
    expect(name).toEqual('hello');
    expect(cb).toEqual(listener1);
    listeners = ee.listeners('hello');
    expect(Array.isArray(listeners)).toBeTruthy();
    expect(listeners.length).toEqual(1);
    expect(listeners[0]).toEqual(listener2);
  }));
  ee.removeListener('hello', listener1);
  listeners = ee.listeners('hello');
  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners.length).toEqual(1);
  expect(listeners[0]).toEqual(listener2);
  ee.once('removeListener', common.mustCall((name, cb) => {
    expect(name).toEqual('hello');
    expect(cb).toEqual(listener2);
    listeners = ee.listeners('hello');
    expect(Array.isArray(listeners)).toBeTruthy();
    expect(listeners.length).toEqual(0);
  }));
  ee.removeListener('hello', listener2);
  listeners = ee.listeners('hello');
  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners.length).toEqual(0);
});

test('Fourth test', () => {
  const ee = new EventEmitter();

  const remove1 = () => {
    throw new Error('remove1 should not have been called');
  };

  const remove2 = () => {
    throw new Error('remove2 should not have been called');
  };

  ee.on('removeListener', common.mustCall((name, cb) => {
    if (cb !== remove1)
      return;
    ee.removeListener('quux', remove2);
    ee.emit('quux');
  }, 2));
  ee.on('quux', remove1);
  ee.on('quux', remove2);
  ee.removeListener('quux', remove1);
});

test('Fifth test', () => {
  const ee = new EventEmitter();
  const listener3 = common.mustCall(() => {
    ee.removeListener('hello', listener4);
  }, 2);
  const listener4 = common.mustCall();

  ee.on('hello', listener3);
  ee.on('hello', listener4);

  // listener4 will still be called although it is removed by listener 3.
  ee.emit('hello');
  // This is so because the interal listener array at time of emit
  // was [listener3,listener4]

  // Interal listener array [listener3]
  ee.emit('hello');
});

test('Sixth test', () => {
  const ee = new EventEmitter();

  ee.once('hello', listener1);
  ee.on('removeListener', common.mustCall((eventName, listener) => {
    expect(eventName).toEqual('hello');
    expect(listener).toEqual(listener1);
  }));
  ee.emit('hello');
});

test('Seventh test', () => {
  const ee = new EventEmitter();

  expect(ee).toEqual(ee.removeListener('foo', () => {}));
});

// Verify that the removed listener must be a function
test('Eighth test', () => {
  expect(() => {
    const ee = new EventEmitter();

    ee.removeListener('foo', null);
  }).toThrow(/^The "listener" argument must be of type Function\. Received type object$/);
});

test('Ninth test', () => {
  const ee = new EventEmitter();
  const listener = () => {};
  ee._events = undefined;
  const e = ee.removeListener('foo', listener);
  expect(e).toEqual(ee);
});

test('Tenth test', () => {
  const ee = new EventEmitter();

  ee.on('foo', listener1);
  ee.on('foo', listener2);
  let listeners = ee.listeners('foo');
  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners.length).toEqual(2);
  expect(listeners[0]).toEqual(listener1);
  expect(listeners[1]).toEqual(listener2);

  ee.removeListener('foo', listener1);
  expect(ee._events.foo).toEqual(listener2);

  ee.on('foo', listener1);
  listeners = ee.listeners('foo');
  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners.length).toEqual(2);
  expect(listeners[0]).toEqual(listener2);
  expect(listeners[1]).toEqual(listener1);

  ee.removeListener('foo', listener1);
  expect(ee._events.foo).toEqual(listener2);
});
