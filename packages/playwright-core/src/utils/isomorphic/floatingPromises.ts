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

import type { ChannelOwner } from '../../client/channelOwner';
import type { Location } from '../../../../playwright/types/test';

/**
 * Enables a promise API call to be tracked by the test, alerting if unawaited.
 *
 * **NOTE:** Returning from an async function wraps the result in a promise, regardless of whether the return value is a promise. This will automatically mark the promise as awaited. Avoid this.
 */
export const wrapPromiseAPIResult = <T>(promise: Promise<T>, location: Location | undefined, register: (promise: Promise<T>, location: Location | undefined) => void, unregister: (promise: Promise<T>) => void): Promise<T> => {
  // eslint-disable-next-line no-restricted-globals
  if (process.env.PW_DISABLE_FLOATING_PROMISES_WARNING)
    return promise;

  const promiseProxy = new Proxy(promise, {
    get: (target, prop, receiver) => {
      if (prop === 'then') {
        return (...args: any[]) => {
          unregister(promise);

          const originalThen = Reflect.get(target, prop, receiver) as Promise<T>['then'];
          return originalThen.call(target, ...args);
        };
      } else {
        return Reflect.get(target, prop, receiver);
      }
    }
  });

  register(promise, location);

  return promiseProxy;
};

export const wrapPromiseAPIClass = <T extends new (...args: any[]) => ChannelOwner<any>>(APIClass: T): T => {
  return new Proxy(APIClass, {
    construct: (target, args: ConstructorParameters<T>, newTarget) => {
      const api = Reflect.construct(target, args, newTarget) as ChannelOwner<any>;
      // Proxy the actual implementation
      const proxiedApi = new Proxy(api, {
        get: (target, prop, receiver) => {
          const member = Reflect.get(target, prop, receiver);
          if (typeof member === 'function') {
            return (...args: any[]) => {
              const result = Reflect.apply(member, receiver, args) as any;
              // Specifically check for thenables, not Promises
              return result && typeof result.then === 'function'
                // TODO: Insert location
                ? wrapPromiseAPIResult(result, undefined, api._instrumentation.onRegisterApiPromise, api._instrumentation.onUnregisterApiPromise)
                : result;
            };
          }
          return member;
        }
      });
      // TODO: This is a workaround for channels retaining a reference to the original class
      api._channel._object = proxiedApi;
      return proxiedApi;
    },
  });
};
