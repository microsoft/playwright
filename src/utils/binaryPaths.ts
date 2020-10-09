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

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export function printDepsWindowsExecutable(): string | undefined {
  return pathToExecutable(['bin', 'PrintDeps.exe']);
}

export function ffmpegExecutable(): string | undefined {
  let ffmpegName;
  if (process.platform === 'win32')
    ffmpegName = os.arch() === 'x64' ? 'ffmpeg-win64.exe' : 'ffmpeg-win32.exe';
  else if (process.platform === 'darwin')
    ffmpegName = 'ffmpeg-mac';
  else
    ffmpegName = 'ffmpeg-linux';
  return pathToExecutable(['third_party', 'ffmpeg', ffmpegName]);
}

function pathToExecutable(relative: string[]): string | undefined {
  const defaultPath = path.join(__dirname, '..', '..', ...relative);
  const localPath = path.join(path.dirname(process.argv[0]), relative[relative.length - 1]);
  try {
    if (fs.existsSync(defaultPath))
      return defaultPath;
  } catch (e) {
  }

  try {
    if (fs.existsSync(localPath))
      return localPath;
  } catch (e) {
  }
}

