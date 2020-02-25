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

import * as types from './types';

/**
 * Represents an in-page JavaScript object, obtained from various `evaluateHandle` methods.
 * {@link https://github.com/microsoft/playwright/docs/api.md#class-jshandle | API reference}
 */
export interface JSHandle<T = any> {
  /**
   * Evaluates a function in the page. If the function returns a Promise, then evaluate would wait
   * for the promise to resolve and return its value.
   * @param pageFunction Function to be evaluated in the page, which takes the handle's object as a first parameter.
   * @param args Additional arguments for the page function - either Serializable
   */
  evaluate<Args extends any[], R>(pageFunction: types.PageFunctionOn<T, Args, R>, ...args: types.Boxed<Args>): Promise<R>;

  /**
   * Evaluates a function in the page and returns a handle. If the function returns a Promise, then evaluate would wait
   * for the promise to resolve and return its value.
   * @param pageFunction Function to be evaluated in the page, which takes the handle's object as a first parameter.
   * @param args Additional arguments for the page function - either Serializable
   */
  evaluateHandle<Args extends any[], R>(pageFunction: types.PageFunctionOn<T, Args, R>, ...args: types.Boxed<Args>): Promise<types.SmartHandle<R>>;

  /**
   * Fetches a single property from the referenced object.
   * @param propertyName
   */
  getProperty(propertyName: string): Promise<JSHandle | null>;

  /**
   * Fetches all properties from the referenced object.
   * Returns a map with property names as keys and JSHandle instances for the property values.
   */
  getProperties(): Promise<Map<string, JSHandle>>;

  /**
   * Returns a JSON representation of the object. Does not call `toJSON` functions.
   * Returns undefined if the referenced object is not stringifiable.
   * @throws Throws if the object has circular references.
   */
  jsonValue(): Promise<T>;

  /**
   * Returns either `null` or the object handle itself, if the object handle is an instance of `ElementHandle`.
   */
  asElement<E extends Node = HTMLElement>(): ElementHandle<E> | null;

  /**
   * Stops referencing the object and allows it to be garbage-collected.
   */
  dispose(): Promise<void>;
}

/**
 * Represents an in-page DOM element, obtained from various `evaluateHandle` and `$` methods.
 * {@link https://github.com/microsoft/playwright/docs/api.md#class-elementhandle | API reference}
 */
export interface ElementHandle<T extends Node = HTMLElement> extends JSHandle<T> {
}
