/**
 * Copyright 2020 Microsoft Corporation. All rights reserved.
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

import { folio } from './android.fixtures';
const { it, expect } = folio;

if (process.env.PW_ANDROID_TESTS) {
  it('should run ADB shell commands', async function({ device }) {
    const output = await device.shell('echo 123');
    expect(output.toString()).toBe('123\n');
  });

  it('should open a ADB socket', async function({ device }) {
    const socket = await device.open('/bin/cat');
    await socket.write(Buffer.from('321\n'));
    const output = await new Promise(resolve => socket.on('data', resolve));
    expect(output.toString()).toBe('321\n');
  });
}
