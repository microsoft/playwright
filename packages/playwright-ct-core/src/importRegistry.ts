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

import type { ImportRef } from '../types/component';

export class ImportRegistry {
  private _registry = new Map<string, () => Promise<any>>();

  initialize(components: Record<string, () => Promise<any>>) {
    for (const [name, value] of Object.entries(components))
      this._registry.set(name, value);
  }

  async resolveImports(value: any): Promise<any> {
    if (value === null || typeof value !== 'object')
      return value;
    if (this._isImportRef(value)) {
      const importFunction = this._registry.get(value.id);
      if (!importFunction)
        throw new Error(`Unregistered component: ${value.id}. Following components are registered: ${[...this._registry.keys()]}`);
      let importedObject = await importFunction();
      if (!importedObject)
        throw new Error(`Could not resolve component: ${value.id}.`);
      if (value.property) {
        importedObject = importedObject[value.property];
        if (!importedObject)
          throw new Error(`Could not instantiate component: ${value.id}.${value.property}.`);
      }
      return importedObject;
    }
    if (Array.isArray(value)) {
      const result = [];
      for (const item of value)
        result.push(await this.resolveImports(item));
      return result;
    }
    const result: any = {};
    for (const [key, prop] of Object.entries(value))
      result[key] = await this.resolveImports(prop);
    return result;
  }

  private _isImportRef(value: any): value is ImportRef {
    return typeof value === 'object' && value && value.__pw_type === 'importRef';
  }
}
