/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Expect } from './expectType';
import expectLibrary from 'expect';
import { currentTestInfo } from './globals';
import { compare } from './golden';

export const expect: Expect = expectLibrary;

const snapshotOrdinalSymbol = Symbol('snapshotOrdinalSymbol');

function toMatchSnapshot(received: Buffer | string, nameOrOptions?: string | { name?: string, threshold?: number }, optOptions: { threshold?: number } = {}) {
  let options: { name?: string, threshold?: number };
  const testInfo = currentTestInfo();
  if (typeof nameOrOptions === 'string')
    options = { name: nameOrOptions, ...optOptions };
  else
    options = { ...nameOrOptions };

  let name = options.name;
  if (!name) {
    const ordinal = (testInfo as any)[snapshotOrdinalSymbol] || 0;
    (testInfo as any)[snapshotOrdinalSymbol] = ordinal + 1;
    let extension: string;
    if (typeof received === 'string')
      extension = '.txt';
    else if (received[0] === 0x89 && received[1] === 0x50 && received[2] === 0x4E && received[3] === 0x47)
      extension = '.png';
    else if (received[0] === 0xFF && received[1] === 0xD8 && received[2] === 0xFF)
      extension = '.jpeg';
    else
      extension = '.dat';
    name = 'snapshot' + (ordinal ? '_' + ordinal : '') + extension;
  }
  const { pass, message } = compare(received, name, testInfo.snapshotPath, testInfo.outputPath, testInfo.config.updateSnapshots, options);
  return { pass, message: () => message };
}

expectLibrary.extend({ toMatchSnapshot });
