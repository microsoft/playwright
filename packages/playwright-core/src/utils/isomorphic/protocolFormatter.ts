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

import { methodMetainfo } from './protocolMetainfo';

export function formatProtocolParam(params: Record<string, string> | undefined, alternatives: string): string | undefined {
  if (!params)
    return undefined;

  for (const name of alternatives.split('|')) {
    if (name === 'url') {
      try {
        const urlObject = new URL(params[name]);
        if (urlObject.protocol === 'data:')
          return urlObject.protocol;
        if (urlObject.protocol === 'about:')
          return params[name];
        return urlObject.pathname + urlObject.search;
      } catch (error) {
        if (params[name] !== undefined)
          return params[name];
      }
    }
    if (name === 'timeNumber' && params[name] !== undefined) {
      // eslint-disable-next-line no-restricted-globals
      return new Date(params[name]).toString();
    }

    const value = deepParam(params, name);
    if (value !== undefined)
      return value;
  }
}

function deepParam(params: Record<string, any>, name: string): string | undefined {
  const tokens = name.split('.');
  let current = params;
  for (const token of tokens) {
    if (typeof current !== 'object' || current === null)
      return undefined;
    current = current[token];
  }
  if (current === undefined)
    return undefined;
  return String(current);
}

export function renderTitleForCall(metadata: { title?: string, type: string, method: string, params: Record<string, string> | undefined }) {
  const titleFormat = metadata.title ?? methodMetainfo.get(metadata.type + '.' + metadata.method)?.title ?? metadata.method;
  return titleFormat.replace(/\{([^}]+)\}/g, (fullMatch, p1) => {
    return formatProtocolParam(metadata.params, p1) ?? fullMatch;
  });
}

export type ActionGroup = 'configuration' | 'route' | 'getter';

export function getActionGroup(metadata: { type: string, method: string }) {
  return methodMetainfo.get(metadata.type + '.' + metadata.method)?.group as undefined | ActionGroup;
}
