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

import type { Expect } from './types';
import expectLibrary from 'expect';
import { currentTestInfo } from './globals';
import { compare } from './golden';

export const expect: Expect = expectLibrary;

function toMatchSnapshot(received: Buffer | string, nameOrOptions: string | { name: string, threshold?: number }, optOptions: { threshold?: number } = {}) {
  let options: { name: string, threshold?: number };
  const testInfo = currentTestInfo();
  if (!testInfo)
    throw new Error(`toMatchSnapshot() must be called during the test`);
  if (typeof nameOrOptions === 'string')
    options = { name: nameOrOptions, ...optOptions };
  else
    options = { ...nameOrOptions };
  if (!options.name)
    throw new Error(`toMatchSnapshot() requires a "name" parameter`);

  const projectThreshold = testInfo.project.expect?.toMatchSnapshot?.threshold;
  if (options.threshold === undefined && projectThreshold !== undefined)
    options.threshold = projectThreshold;

  const { pass, message } = compare(received, options.name, testInfo.snapshotPath, testInfo.outputPath, testInfo.config.updateSnapshots, options);
  return { pass, message: () => message };
}

expectLibrary.extend({ toMatchSnapshot });
