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

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
type JsonArray = JsonValue[];
export type JsonObject = { [Key in string]?: JsonValue };

// JsxComponentChild can be anything, consider cases like: <>{1}</>, <>{null}</>
export type JsxComponentChild = JsxComponent | string | number | boolean | null;
export type JsxComponent = {
  __pw_component_marker: true,
  kind: 'jsx',
  type: string,
  props: Record<string, any>,
  children?: JsxComponentChild[],
};

export type MountOptions = {
  props?: Record<string, any>,
  slots?: Record<string, string | string[]>,
  on?: Record<string, Function>,
  hooksConfig?: any,
};

export type ObjectComponent = {
  __pw_component_marker: true,
  kind: 'object',
  type: string,
  options?: MountOptions
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
  }
}
