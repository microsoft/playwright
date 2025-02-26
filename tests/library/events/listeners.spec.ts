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

const listener = () => {};
const listener2 = () => {};
const listener3 = () => { return 0; };
const listener4 = () => { return 1; };

class TestStream extends EventEmitter {}

test('EventEmitter listeners with one listener', () => {
  const ee = new EventEmitter();
  ee.on('foo', listener);
  const fooListeners = ee.listeners('foo');

  const listeners = ee.listeners('foo');
  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners).toHaveLength(1);
  expect(listeners[0]).toEqual(listener);

  void ee.removeAllListeners('foo');
  expect<Array<any>>(ee.listeners('foo')).toHaveLength(0);

  expect(Array.isArray(fooListeners)).toBeTruthy();
  expect(fooListeners).toHaveLength(1);
  expect(fooListeners[0]).toEqual(listener);
});

test('Array copy modification does not modify orig', () => {
  const ee = new EventEmitter();
  ee.on('foo', listener);

  const eeListenersCopy = ee.listeners('foo');
  expect(Array.isArray(eeListenersCopy)).toBeTruthy();
  expect(eeListenersCopy).toHaveLength(1);
  expect(eeListenersCopy[0]).toEqual(listener);

  eeListenersCopy.push(listener2);
  const listeners = ee.listeners('foo');

  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners).toHaveLength(1);
  expect(listeners[0]).toEqual(listener);

  expect(eeListenersCopy).toHaveLength(2);
  expect(eeListenersCopy[0]).toEqual(listener);
  expect(eeListenersCopy[1]).toEqual(listener2);
});

test('Modify array copy after multiple adds', () => {
  const ee = new EventEmitter();
  ee.on('foo', listener);
  const eeListenersCopy = ee.listeners('foo');
  ee.on('foo', listener2);

  const listeners = ee.listeners('foo');
  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners).toHaveLength(2);
  expect(listeners[0]).toEqual(listener);
  expect(listeners[1]).toEqual(listener2);

  expect(Array.isArray(eeListenersCopy)).toBeTruthy();
  expect(eeListenersCopy).toHaveLength(1);
  expect(eeListenersCopy[0]).toEqual(listener);
});

test('listeners and once', () => {
  const ee = new EventEmitter();
  ee.once('foo', listener);
  const listeners = ee.listeners('foo');
  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners).toHaveLength(1);
  expect(listeners[0]).toEqual(listener);
});

test('listeners with conflicting types', () => {
  const ee = new EventEmitter();
  ee.on('foo', listener);
  ee.once('foo', listener2);

  const listeners = ee.listeners('foo');
  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners).toHaveLength(2);
  expect(listeners[0]).toEqual(listener);
  expect(listeners[1]).toEqual(listener2);
});

test('EventEmitter with no members', () => {
  const ee = new EventEmitter();
  ee._events = undefined;
  const listeners = ee.listeners('foo');
  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners).toHaveLength(0);
});

test('listeners on prototype', () => {
  const s = new TestStream();
  const listeners = s.listeners('foo');
  expect(Array.isArray(listeners)).toBeTruthy();
  expect(listeners).toHaveLength(0);
});

test('raw listeners', () => {
  const ee = new EventEmitter();
  ee.on('foo', listener);
  const wrappedListener = ee.rawListeners('foo');
  expect(wrappedListener).toHaveLength(1);
  expect(wrappedListener[0]).toEqual(listener);

  ee.once('foo', listener);
  const wrappedListeners = ee.rawListeners('foo');
  expect(wrappedListeners).toHaveLength(2);
  expect(wrappedListeners[0]).toEqual(listener);
  expect(wrappedListeners[1].listener).toEqual(listener);

  ee.emit('foo');
  expect(wrappedListeners).toHaveLength(2);
  expect(wrappedListeners[1].listener).toEqual(listener);
});

test('raw listeners order', () => {
  const ee = new EventEmitter();
  ee.once('foo', listener3);
  ee.on('foo', listener4);
  const rawListeners = ee.rawListeners('foo');
  expect(rawListeners).toHaveLength(2);
  expect(rawListeners[0]()).toEqual(0);

  const rawListener = ee.rawListeners('foo');
  expect(rawListener).toHaveLength(1);
  expect(rawListener[0]()).toEqual(1);
});
