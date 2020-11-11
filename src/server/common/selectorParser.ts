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

// This file can't have dependencies, it is a part of the utility script.

export type ParsedSelector = any;

export function parseSelector(selector: string): { parsed: ParsedSelector, names: string[] } {
  let index = 0;
  let quote: string | undefined;
  let start = 0;

  const parts: string[] = [];
  let captureIndex: number | undefined;
  const names = new Set<string>();

  const append = () => {
    let part = selector.substring(start, index).trim();
    let eqIndex = part.indexOf('=');
    if (eqIndex !== -1 && part.substring(0, eqIndex).trim().match(/^[a-zA-Z_0-9-+:*]+$/)) {
      if (part[0] === '*' && part.substring(0, eqIndex).trim() !== '*') {
        if (captureIndex !== undefined)
          throw new Error(`Only one of the selectors can capture using * modifier`);
        captureIndex = parts.length;
        part = part.substring(1);
        eqIndex--;
      }
      names.add(part.substring(0, eqIndex).trim());
    }
    parts.push(part);
  };

  while (index < selector.length) {
    const c = selector[index];
    if (c === '\\' && index + 1 < selector.length) {
      index += 2;
    } else if (c === quote) {
      quote = undefined;
      index++;
    } else if (!quote && (c === '"' || c === '\'' || c === '`')) {
      quote = c;
      index++;
    } else if (!quote && c === '>' && selector[index + 1] === '>') {
      append();
      index += 2;
      start = index;
    } else {
      index++;
    }
  }
  append();

  let result: ParsedSelector = parts[0];
  const actualCaptureIndex = captureIndex === undefined ? parts.length - 1 : captureIndex;
  for (let i = 1; i <= actualCaptureIndex; i++)
    result = ['$', result, parts[i]];
  if (actualCaptureIndex + 1 < parts.length) {
    let has: ParsedSelector = parts[actualCaptureIndex + 1];
    for (let i = actualCaptureIndex + 2; i < parts.length; i++)
      has = ['$', has, parts[i]];
    result = ['has', result, has];
  }
  return { parsed: result, names: Array.from(names) };
}
