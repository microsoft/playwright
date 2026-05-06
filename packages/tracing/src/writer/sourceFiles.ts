/**
 * Copyright (c) Microsoft Corporation.
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

import { calculateSha1 } from '@utils/crypto';

import type { NameValue } from '@isomorphic/types';

// Trace zips embed source files at `resources/src@<pathSha1>.txt`, where
// pathSha1 is the sha1 of the absolute file path string (not the file
// contents). The trace reader recomputes the sha1 from each event's stack
// frame to look the source up.
export function sourceFileEntry(filePath: string): NameValue {
  return {
    name: 'resources/src@' + calculateSha1(filePath) + '.txt',
    value: filePath,
  };
}
