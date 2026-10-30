/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { spawnSync } from 'child_process';
import vm from 'vm';
import { test, expect } from '@playwright/test';
import { EventEmitter } from './utils';

test('EE-057 should report synchronous listener errors and continue dispatch', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43770' },
}, () => {
  const ee = new EventEmitter();
  const error = new Error('listener failed');
  ee.on('throw', () => { throw error; });
  expect(() => ee.emit('throw')).toThrow(error);

  const errors = [];
  ee.on('error', error => errors.push(error));
  ee.on('throw', () => errors.push('next listener'));
  expect(ee.emit('throw')).toBe(true);
  expect(errors).toEqual([error, 'next listener']);

  ee.removeAllListeners('error');
  expect(() => ee.emit('throw')).toThrow(error);
  ee.on('error', () => { throw new Error('error listener failed'); });
  expect(() => ee.emit('throw')).toThrow('error listener failed');
});

test('EE-058 should capture rejections from promises and thenables', async () => {
  const ee = new EventEmitter();
  const error = new Error('listener failed');
  const event = Symbol('event');
  const errors = [];
  ee.on('error', function(this: EventEmitter, value) {
    expect(this).toBe(ee);
    errors.push(value);
  });
  ee.once(event, async function(this: EventEmitter, ...args) {
    expect(this).toBe(ee);
    expect(args).toEqual([1, 2]);
    throw error;
  });
  ee.on(event, () => errors.push('next listener'));
  expect(ee.emit(event, 1, 2)).toBe(true);
  expect(errors).toEqual(['next listener']);
  await expect.poll(() => errors).toEqual(['next listener', error]);
  ee.emit(event);
  expect(errors).toEqual(['next listener', error, 'next listener']);

  ee.on('vm', () => vm.runInNewContext('Promise.reject("vm rejection")'));
  ee.emit('vm');
  await expect.poll(() => errors.at(-1)).toBe('vm rejection');

  const thenable = {
    then(resolve, reject) {
      expect(this).toBe(thenable);
      reject(error);
    },
  };
  ee.on('thenable', () => thenable);
  ee.emit('thenable');
  await expect.poll(() => errors.at(-1)).toBe(error);
});

test('EE-059 should read then only once and handle errors while inspecting thenables', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43770' },
}, async () => {
  const ee = new EventEmitter();
  const errors = [];
  ee.on('error', error => errors.push(error));
  const error = new Error('then getter failed');
  ee.on('getter', () => ({
    get then() {
      throw error;
    },
  }));
  expect(ee.emit('getter')).toBe(true);
  expect(errors).toEqual([error]);

  let reads = 0;
  ee.on('thenable', () => ({
    get then() {
      expect(++reads).toBe(1);
      return () => { throw new Error('then call failed'); };
    },
  }));
  ee.emit('thenable');
  await expect.poll(() => errors.length).toBe(2);
  expect(errors[1].message).toBe('then call failed');
  expect(reads).toBe(1);
});

test('EE-060 should not swallow unhandled rejections or recurse on error listener failures', () => {
  for (const errorListener of [
    '',
    `ee.on('error', () => { throw new Error('error listener failed'); });`,
    `ee.on('error', async () => { throw new Error('error listener failed'); });`,
  ]) {
    const result = spawnSync(process.execPath, ['--unhandled-rejections=strict', '-e', `
      const { clientEventEmitter: EventEmitter } = require(${JSON.stringify(require.resolve('../../../packages/playwright-core/lib/coreBundle'))});
      const ee = new EventEmitter();
      ${errorListener}
      ee.on('event', async () => { throw new Error('listener failed'); });
      ee.emit('event');
    `], { encoding: 'utf-8', timeout: 10000 });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(errorListener ? 'Error: error listener failed' : 'Error: listener failed');
  }
});
