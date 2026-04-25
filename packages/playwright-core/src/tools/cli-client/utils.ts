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

export function guessClientName(): string {
  if (process.env.CLAUDECODE)
    return 'Claude Code';
  if (process.env.COPILOT_CLI)
    return 'GitHub Copilot';
  return 'playwright-cli';
}

export function isCodingAgent(): boolean {
  return !!process.env.CLAUDECODE || !!process.env.COPILOT_CLI;
}
