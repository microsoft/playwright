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

export async function queryObjectCount(type: Function): Promise<number> {
  globalThis.typeForQueryObjects = type;
  const session: import('inspector').Session = new (require('node:inspector').Session)();
  session.connect();
  try {
    await new Promise(f => session.post('Runtime.enable', f));
    const { result: constructorFunction } = await new Promise(f => session.post('Runtime.evaluate', {
      expression: `globalThis.typeForQueryObjects.prototype`,
      includeCommandLineAPI: true,
    }, (_, result) => f(result))) as any;

    const { objects: instanceArray } = await new Promise(f => session.post('Runtime.queryObjects', {
      prototypeObjectId: constructorFunction.objectId
    }, (_, result) => f(result))) as any;

    const { result: { value } } = await new Promise<any>(f => session.post('Runtime.callFunctionOn', {
      functionDeclaration: 'function (arr) { return this.length; }',
      objectId: instanceArray.objectId,
      arguments: [{ objectId: instanceArray.objectId }],
    }, (_, result) => f(result as any)));

    return value;
  } finally {
    session.disconnect();
  }
}
