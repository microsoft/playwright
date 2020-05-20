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

export default class UtilityScript {
  evaluate(functionText: string, ...args: any[]) {
    const argCount = args[0] as number;
    const handleCount = args[argCount + 1] as number;
    const handles = { __proto__: null } as any;
    for (let i = 0; i < handleCount; i++)
      handles[args[argCount + 2 + i]] = args[argCount + 2 + handleCount + i];
    const visit = (arg: any) => {
      if ((typeof arg === 'string') && (arg in handles))
        return handles[arg];
      if (arg && (typeof arg === 'object')) {
        for (const name of Object.keys(arg))
          arg[name] = visit(arg[name]);
      }
      return arg;
    };
    const processedArgs  = [];
    for (let i = 0; i < argCount; i++)
      processedArgs[i] = visit(args[i + 1]);
    const func = global.eval('(' + functionText + ')');
    return func(...processedArgs);
  }
}
