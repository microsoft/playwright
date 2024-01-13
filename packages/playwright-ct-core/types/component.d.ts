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

import type { ImportRegistry } from '../src/importRegistry';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
type JsonArray = JsonValue[];
export type JsonObject = { [Key in string]?: JsonValue };

export type ImportRef = {
  __pw_type: 'importRef',
  id: string,
  property?: string,
};

export type JsxComponent = {
  __pw_type: 'jsx',
  type: any,
  props: Record<string, any>,
};

export type MountOptions = {
  hooksConfig?: any,
};

export type ObjectComponentOptions = {
  props?: Record<string, any>;
  slots?: Record<string, string | string[]>;
  on?: Record<string, Function>;
};

export type ObjectComponent = ObjectComponentOptions & {
  __pw_type: 'object-component',
  type: any,
};

export type Component = JsxComponent | ObjectComponent;

declare global {
  interface Window {
    playwrightMount(component: Component, rootElement: Element, hooksConfig?: any): Promise<void>;
    playwrightUnmount(rootElement: Element): Promise<void>;
    playwrightUpdate(rootElement: Element, component: Component): Promise<void>;
    __pw_hooks_before_mount?: (<HooksConfig extends JsonObject = JsonObject>(
      params: { hooksConfig?: HooksConfig; [key: string]: any }
    ) => Promise<any>)[];
    __pw_hooks_after_mount?: (<HooksConfig extends JsonObject = JsonObject>(
      params: { hooksConfig?: HooksConfig; [key: string]: any }
    ) => Promise<void>)[];
    __pwRegistry: ImportRegistry;
  }
}
