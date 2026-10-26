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

import vm from 'vm';

import { test, expect } from '@playwright/test';
import { ListenerErrorScope } from '../../../packages/isomorphic/listenerErrorScope';
import { EventEmitter } from '../../../packages/playwright-core/src/client/eventEmitter';

test('EE-057 scoped callback errors preserve listener identity, ordering, once and removal', () => {
  const errors: unknown[] = [];
  const scope = new ListenerErrorScope(error => errors.push(error));
  const realm = vm.createContext({});
  scope.register(vm.runInContext('Function.prototype', realm));
  const listener = vm.runInContext('() => { throw new Error("scoped listener"); }', realm);
  const emitter = new EventEmitter();
  let normalCalls = 0;
  const normal = () => ++normalCalls;
  try {
    emitter.on('event', listener);
    emitter.once('event', listener);
    emitter.on('event', normal);
    expect(emitter.listeners('event')).toEqual([listener, listener, normal]);
    emitter.emit('event');
    expect(errors.map(String)).toEqual(['Error: scoped listener', 'Error: scoped listener']);
    expect(normalCalls).toBe(1);
    expect(emitter.listeners('event')).toEqual([listener, normal]);
    emitter.off('event', listener);
    emitter.emit('event');
    expect(errors).toHaveLength(2);
    expect(normalCalls).toBe(2);
    emitter.removeAllListeners();
    expect(emitter.listenerCount('event')).toBe(0);
  } finally {
    scope.dispose();
  }
});

test('EE-058 scoped callback handling excludes host errors and stops after disposal', () => {
  const scope = new ListenerErrorScope(() => {});
  const realm = vm.createContext({});
  scope.register(vm.runInContext('Function.prototype', realm));
  const emitter = new EventEmitter();
  const hostError = new Error('unrelated host error');
  emitter.on('host', () => { throw hostError; });
  expect(() => emitter.emit('host')).toThrow(hostError);
  emitter.once('once', vm.runInContext('() => {}', realm));
  emitter.on('removeListener', () => { throw hostError; });
  expect(() => emitter.emit('once')).toThrow(hostError);
  emitter.on('scoped', vm.runInContext('() => { throw new Error("disposed scope"); }', realm));
  scope.dispose();
  expect(() => emitter.emit('scoped')).toThrow('disposed scope');
});
