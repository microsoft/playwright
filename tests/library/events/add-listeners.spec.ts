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

test.describe('EventEmitter tests', () => {
  test('should work', () => {
    const events_new_listener_emitted = [];
    const listeners_new_listener_emitted = [];

    const ee = new EventEmitter();

    ee.on('newListener', function(event, listener) {
      if (event !== 'newListener') {
        events_new_listener_emitted.push(event);
        listeners_new_listener_emitted.push(listener);
      }
    });

    const hello = (a, b) => {
      expect(a).toEqual('a');
      expect(b).toEqual('b');
    };

    ee.once('newListener', (name, listener) => {
      expect(name).toEqual('hello');
      expect(listener).toEqual(hello);

      const listeners = ee.listeners('hello');
      expect(Array.isArray(listeners)).toBeTruthy();
      expect(listeners).toHaveLength(0);
    });

    ee.on('hello', hello);
    ee.once('foo', () => { throw new Error('foo error'); });

    expect(Array.isArray(events_new_listener_emitted)).toBeTruthy();
    expect(events_new_listener_emitted).toHaveLength(2);
    expect(events_new_listener_emitted[0]).toEqual('hello');
    expect(events_new_listener_emitted[1]).toEqual('foo');

    expect(Array.isArray(listeners_new_listener_emitted)).toBeTruthy();
    expect(listeners_new_listener_emitted).toHaveLength(2);
    expect(listeners_new_listener_emitted[0]).toEqual(hello);
    expect(listeners_new_listener_emitted[1]).toThrow();

    ee.emit('hello', 'a', 'b');
  });

  test('set max listeners test', () => {
    const f = new EventEmitter();
    f.setMaxListeners(0);
  });

  test('Listener order', () => {
    const listen1 = function() {};
    const listen2 = function() {};
    const ee = new EventEmitter();

    ee.once('newListener', function() {
      const listeners = ee.listeners('hello');
      expect(Array.isArray(listeners)).toBeTruthy();
      expect(listeners).toHaveLength(0);
      ee.once('newListener', function() {
        const listeners = ee.listeners('hello');
        expect(Array.isArray(listeners)).toBeTruthy();
        expect(listeners).toHaveLength(0);
      });
      ee.on('hello', listen2);
    });
    ee.on('hello', listen1);
    const listeners = ee.listeners('hello');
    expect(Array.isArray(listeners)).toBeTruthy();
    expect(listeners).toHaveLength(2);
    expect(listeners[0]).toEqual(listen2);
    expect(listeners[1]).toEqual(listen1);
  });

  test('listener type check', () => {
    const ee = new EventEmitter();
    expect(() => ee.on('foo', null)).toThrow('The "listener" argument must be of type Function. Received type object');
  });
});
