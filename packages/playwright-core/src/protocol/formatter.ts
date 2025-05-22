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

export function formatProtocolParam(params: Record<string, string> | undefined, name: string): string {
  if (!params)
    return '';
  if (name === 'url') {
    try {
      const urlObject = new URL(params[name]);
      if (urlObject.protocol === 'data:')
        return urlObject.protocol;
      if (urlObject.protocol === 'about:')
        return params[name];
      return urlObject.pathname + urlObject.search;
    } catch (error) {
      return params[name];
    }
  }
  if (name === 'timeNumber')
    return new Date(params[name]).toString();
  return deepParam(params, name);
}

function deepParam(params: Record<string, any>, name: string): string {
  const tokens = name.split('.');
  let current = params;
  for (const token of tokens) {
    if (typeof current !== 'object' || current === null)
      return '';
    current = current[token];
  }
  if (current === undefined)
    return '';
  return String(current);
}
