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

import type {
  TestType,
  PlaywrightTestArgs,
  PlaywrightTestConfig as BasePlaywrightTestConfig,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  Locator,
} from "@playwright/test";
import type { InlineConfig } from "vite";
import type {
  FunctionalComponent,
  ComponentPublicInstance,
  ComponentOptionsWithObjectProps,
  ComponentOptionsWithArrayProps,
  ComponentOptionsWithoutProps,
  ExtractPropTypes,
  VNodeProps,
  ComponentOptionsMixin,
  DefineComponent,
  MethodOptions,
  AllowedComponentProps,
  ComponentCustomProps,
  ExtractDefaultPropTypes,
  EmitsOptions,
  ComputedOptions,
  ComponentPropsOptions,
  Prop,
} from "vue";

export type PlaywrightTestConfig = Omit<BasePlaywrightTestConfig, "use"> & {
  use?: BasePlaywrightTestConfig["use"] & {
    ctPort?: number;
    ctTemplateDir?: string;
    ctCacheDir?: string;
    ctViteConfig?: InlineConfig;
  };
};

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
type JsonArray = JsonValue[];
type JsonObject = { [Key in string]?: JsonValue };

type Slot = string | string[];

interface MountOptions<Props> {
  props?: (RawProps & Props) | ({} extends Props ? null : never);
  slots?: Record<string, Slot> & { default?: Slot };
  on?: Record<string, Function>,
  hooksConfig?: JsonObject,
}

interface MountResult<Props> extends Locator {
  unmount(): Promise<void>;
  rerender(options: {
    props: (RawProps & Props) | ({} extends Props ? null : never);
  }): Promise<void>;
}

type RawProps = VNodeProps & {
  __v_isVNode?: never;
  [Symbol.iterator]?: never;
} & Record<string, any>;

type PublicProps = VNodeProps & AllowedComponentProps & ComponentCustomProps;

type ComponentMountingOptions<T> = T extends DefineComponent<
  infer PropsOrPropOptions,
  any,
  infer D,
  any,
  any
>
  ? MountOptions<
      Partial<ExtractDefaultPropTypes<PropsOrPropOptions>> &
        Omit<
          Readonly<ExtractPropTypes<PropsOrPropOptions>> & PublicProps,
          keyof ExtractDefaultPropTypes<PropsOrPropOptions>
        >
    > &
      Record<string, any>
  : MountOptions<any>;

export interface ComponentFixtures {
  // Jsx component
  mount(component: JSX.Element, options?: { hooksConfig?: any }): Promise<MountResult>;
  
  // Class component (without vue-class-component) - no props
  mount<V>(
    component: {
      new (...args: any[]): V;
      __vccOpts: any;
    },
    options?: MountOptions<any> & Record<string, any>
  ): Promise<MountResult<any> & Record<string, any>>;
  
  // Class component (without vue-class-component) - props
  mount<V, P>(
    component: {
      new (...args: any[]): V;
      __vccOpts: any;
      defaultProps?: Record<string, Prop<any>> | string[];
    },
    options?: MountOptions<P & PublicProps> & Record<string, any>
  ): Promise<MountResult<P & PublicProps> & Record<string, any>>;

  // Class component - no props
  mount<V>(
    component: {
      new (...args: any[]): V;
      registerHooks(keys: string[]): void;
    },
    options?: MountOptions<any> & Record<string, any>
  ): Promise<MountResult<any> & Record<string, any>>;

  // Class component - props
  mount<V, P>(
    component: {
      new (...args: any[]): V;
      props(Props: P): any;
      registerHooks(keys: string[]): void;
    },
    options?: MountOptions<P & PublicProps> & Record<string, any>
  ): Promise<MountResult<P & PublicProps> & Record<string, any>>;

  // Functional component with emits
  mount<Props, E extends EmitsOptions = {}>(
    component: FunctionalComponent<Props, E>,
    options?: MountOptions<Props & PublicProps> & Record<string, any>
  ): Promise<MountResult<Props & PublicProps> & Record<string, any>>;

  // Component declared with defineComponent
  mount<
    PropsOrPropOptions = {},
    RawBindings = {},
    D = {},
    C extends ComputedOptions = ComputedOptions,
    M extends MethodOptions = MethodOptions,
    Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
    Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
    E extends EmitsOptions = Record<string, any>,
    EE extends string = string,
    PP = PublicProps,
    Props = Readonly<ExtractPropTypes<PropsOrPropOptions>>,
    Defaults = ExtractDefaultPropTypes<PropsOrPropOptions>
  >(
    component: DefineComponent<PropsOrPropOptions, RawBindings, D, C, M, Mixin, Extends, E, EE, PP, Props, Defaults>,
    options?: MountOptions<Partial<Defaults> & Omit<Props & PublicProps, keyof Defaults>> & Record<string, any>
  ): Promise<MountResult<Partial<Defaults> & Omit<Props & PublicProps, keyof Defaults>> & Record<string, any>>;

  // Component declared by vue-tsc ScriptSetup
  mount<T extends DefineComponent<any, any, any, any>>(
    component: T,
    options?: ComponentMountingOptions<T>
  ): Promise<MountResult<T>>;

  // Component declared with no props
  mount<
    Props = {},
    RawBindings = {},
    D = {},
    C extends ComputedOptions = {},
    M extends Record<string, Function> = {},
    E extends EmitsOptions = Record<string, any>,
    Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
    Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
    EE extends string = string
  >(
    component: ComponentOptionsWithoutProps<Props, RawBindings, D, C, M, E, Mixin, Extends, EE>,
    options?: MountOptions<Props & PublicProps>
  ): Promise<MountResult<Props & PublicProps>>;

  // Component declared with { props: [] }
  mount<
    PropNames extends string,
    RawBindings,
    D,
    C extends ComputedOptions = {},
    M extends Record<string, Function> = {},
    E extends EmitsOptions = Record<string, any>,
    Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
    Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
    EE extends string = string,
    Props extends Readonly<{ [key in PropNames]?: any }> = Readonly<{ [key in PropNames]?: any }>
  >(
    component: ComponentOptionsWithArrayProps< PropNames, RawBindings, D, C, M, E, Mixin, Extends, EE, Props>,
    options?: MountOptions<Props & PublicProps>
  ): Promise<MountResult<Props & PublicProps>>;

  // Component declared with { props: { ... } }
  mount<
    PropsOptions extends Readonly<ComponentPropsOptions>,
    RawBindings,
    D,
    C extends ComputedOptions = {},
    M extends Record<string, Function> = {},
    E extends EmitsOptions = Record<string, any>,
    Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
    Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
    EE extends string = string
  >(
    component: ComponentOptionsWithObjectProps< PropsOptions, RawBindings, D, C, M, E, Mixin, Extends, EE>,
    options?: MountOptions<ExtractPropTypes<PropsOptions> & PublicProps>
  ): Promise<MountResult<ExtractPropTypes<PropsOptions> & PublicProps>>;
}

export const test: TestType<
  PlaywrightTestArgs & PlaywrightTestOptions & ComponentFixtures,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions
>;

export { expect, devices } from "@playwright/test";
