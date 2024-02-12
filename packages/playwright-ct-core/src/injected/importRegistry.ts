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

export type ImportRef = {
  __pw_type: 'importRef',
  id: string,
  property?: string,
};

export function isImportRef(value: any): value is ImportRef {
  return typeof value === 'object' && value && value.__pw_type === 'importRef';
}

export class ImportRegistry {
  private _registry = new Map<string, () => Promise<any>>();

  initialize(components: Record<string, () => Promise<any>>) {
    for (const [name, value] of Object.entries(components))
      this._registry.set(name, value);
  }

  async resolveImportRef(importRef: ImportRef): Promise<any> {
    const importFunction = this._registry.get(importRef.id);
    if (!importFunction)
      throw new Error(`Unregistered component: ${importRef.id}. Following components are registered: ${[...this._registry.keys()]}`);
    let importedObject = await importFunction();
    if (!importedObject)
      throw new Error(`Could not resolve component: ${importRef.id}.`);
    if (importRef.property) {
      importedObject = importedObject[importRef.property];
      if (!importedObject)
        throw new Error(`Could not instantiate component: ${importRef.id}.${importRef.property}.`);
    }
    return importedObject;
  }
}

declare global {
  interface Window {
    __pwRegistry: ImportRegistry;
  }
}
