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

export type JsxComponent = {
  kind: 'jsx',
  type: string,
  props: Record<string, any>,
  children: (Component | string)[],
};

export type MountOptions = {
  props?: Record<string, any>,
  slots?: Record<string, any>,
  on?: { [key: string]: Function },
  hooksConfig?: any,
};

export type ObjectComponent = {
  kind: 'object',
  type: string,
  options?: MountOptions
};

export type Component = JsxComponent | ObjectComponent;

declare global {
  interface Window {
    playwrightMount(component: Component, rootElement: Element, hooksConfig: any): Promise<void>;
    playwrightUnmount(rootElement: Element): Promise<void>;
    playwrightRerender(rootElement: Element, optionsOrComponent: Omit<MountOptions, 'hooksConfig'> | Component): Promise<void>;
  }
}
