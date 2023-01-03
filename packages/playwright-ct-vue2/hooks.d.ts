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

import { ComponentOptions } from 'vue';
import { CombinedVueInstance, Vue, VueConstructor } from 'vue/types/vue';
 
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
type JsonArray = JsonValue[];
type JsonObject = { [Key in string]?: JsonValue };

export declare function beforeMount<HooksConfig extends JsonObject>(
  callback: (params: { 
    hooksConfig: HooksConfig, 
    Vue: VueConstructor<Vue>, 
  }) => Promise<void | ComponentOptions<Vue> & Record<string, unknown>>
): void;
export declare function afterMount<HooksConfig extends JsonObject>(
  callback: (params: {
    hooksConfig: HooksConfig;
    instance: CombinedVueInstance<
      Vue,
      object,
      object,
      object,
      Record<never, any>
    >;
  }) => Promise<void>
): void;
