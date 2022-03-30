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

import path from 'path';
import { electronTest as test, expect } from './electronTest';

test('should print errors to stderr', async ({ playwright }) => {
  let stderr=''
  const originalWrite = process.stderr.write.bind(process.stderr)
  process.stderr.write = (buffer,)=>{
    stderr += buffer
    return true
  }
  await playwright._electron.launch({
    args: [path.join(__dirname, 'electron-app-error.js')],
    stdio: 'inherit',
    executablePath:''

  });
  expect(stderr).toContain('TypeError: Cannot read properties of undefined (reading \'close\')')
  process.stderr.write = originalWrite
});
