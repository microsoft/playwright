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

import fs from 'fs';
import path from 'path';

const profileDir = process.env.PWTEST_PROFILE_DIR || '';

let session: import('inspector').Session;

export async function startProfiling() {
  if (!profileDir)
    return;

  session = new (require('inspector').Session)();
  session.connect();
  await new Promise<void>(f => {
    session.post('Profiler.enable', () => {
      session.post('Profiler.start', f);
    });
  });
}

export async function stopProfiling(profileName: string) {
  if (!profileDir)
    return;

  await new Promise<void>(f => session.post('Profiler.stop', (err, { profile }) => {
    if (!err) {
      fs.mkdirSync(profileDir, { recursive: true });
      fs.writeFileSync(path.join(profileDir, profileName + '.json'), JSON.stringify(profile));
    }
    f();
  }));
}
