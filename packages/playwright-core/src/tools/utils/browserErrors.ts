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

export function throwIfExecutableMissing(error: unknown, browserName: string, skillMode?: boolean): void {
  // The prefix is shared by managed binaries. Keep the path so version mismatches are diagnosable.
  if (!(error instanceof Error) || !error.message.includes(`Executable doesn't exist`))
    return;
  const target = error.message.includes('ffmpeg') ? 'ffmpeg' : browserName;
  const label = target === 'ffmpeg' ? 'FFmpeg' : `Browser "${target}"`;
  const command = skillMode ? `playwright-cli install-browser ${target}` : `npx @playwright/mcp install-browser ${target}`;
  const match = error.message.match(/Executable doesn't exist at ([^\r\n]+)/);
  const location = match ? `; expected executable at ${match[1].trim()}` : '';
  throw new Error(`${label} is not installed${location}. Run \`${command}\` to install`);
}
