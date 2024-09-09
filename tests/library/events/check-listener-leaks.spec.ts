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

import events from 'events';
import { EventEmitter } from '../../../packages/playwright-core/lib/client/eventEmitter';
import { setUnderTest } from '../../../packages/playwright-core/lib/utils/debug';
import { test, expect } from '@playwright/test';
import * as common from './utils';

setUnderTest();

test('defaultMaxListeners', () => {
  const e = new EventEmitter();

  for (let i = 0; i < 10; i++)
    e.on('default', common.mustNotCall());


  expect(e._events['default']).not.toHaveProperty('warned');
  e.on('default', common.mustNotCall());
  expect(e._events['default'].hasOwnProperty('warned')).toBeTruthy();

  e.setMaxListeners(5);
  for (let i = 0; i < 5; i++)
    e.on('specific', common.mustNotCall());

  expect(e._events['specific']).not.toHaveProperty('warned');
  e.on('specific', common.mustNotCall());
  expect(e._events['specific'].hasOwnProperty('warned')).toBeTruthy();

  // only one
  e.setMaxListeners(1);
  e.on('only one', common.mustNotCall());
  expect(e._events['only one']).not.toHaveProperty('warned');
  e.on('only one', common.mustNotCall());
  expect(e._events['only one'].hasOwnProperty('warned')).toBeTruthy();

  // unlimited
  e.setMaxListeners(0);
  for (let i = 0; i < 1000; i++)
    e.on('unlimited', common.mustNotCall());

  expect(e._events['unlimited']).not.toHaveProperty('warned');
});

test('process-wide', () => {
  events.EventEmitter.defaultMaxListeners = 42;
  const e = new EventEmitter();

  for (let i = 0; i < 42; ++i)
    e.on('fortytwo', common.mustNotCall());

  expect(e._events['fortytwo']).not.toHaveProperty('warned');
  e.on('fortytwo', common.mustNotCall());
  expect(e._events['fortytwo'].hasOwnProperty('warned')).toBeTruthy();
  delete e._events['fortytwo'].warned;

  events.EventEmitter.defaultMaxListeners = 44;
  e.on('fortytwo', common.mustNotCall());
  expect(e._events['fortytwo']).not.toHaveProperty('warned');
  e.on('fortytwo', common.mustNotCall());
  expect(e._events['fortytwo'].hasOwnProperty('warned')).toBeTruthy();
});

test('_maxListeners still has precedence over defaultMaxListeners', () => {
  events.EventEmitter.defaultMaxListeners = 42;
  const e = new EventEmitter();
  e.setMaxListeners(1);
  e.on('uno', common.mustNotCall());
  expect(e._events['uno']).not.toHaveProperty('warned');
  e.on('uno', common.mustNotCall());
  expect(e._events['uno'].hasOwnProperty('warned')).toBeTruthy();
});
