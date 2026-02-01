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

export function getFromENV(name: string): string | undefined {
  let value = process.env[name];
  value = value === undefined ? process.env[`npm_config_${name.toLowerCase()}`] : value;
  value = value === undefined ?  process.env[`npm_package_config_${name.toLowerCase()}`] : value;
  return value;
}

export function getAsBooleanFromENV(name: string, defaultValue?: boolean | undefined): boolean {
  const value = getFromENV(name);
  if (value === 'false' || value === '0')
    return false;
  if (value)
    return true;
  return !!defaultValue;
}

export function getPackageManager() {
  const env = process.env.npm_config_user_agent || '';
  if (env.includes('yarn'))
    return 'yarn';
  if (env.includes('pnpm'))
    return 'pnpm';
  return 'npm';
}

export function getPackageManagerExecCommand() {
  const packageManager = getPackageManager();
  if (packageManager === 'yarn')
    return 'yarn';
  if (packageManager === 'pnpm')
    return 'pnpm exec';
  return 'npx';
}

export function isLikelyNpxGlobal() {
  return process.argv.length >= 2 && process.argv[1].includes('_npx');
}

// https://github.com/firebase/firebase-tools/blob/fbaa1af6fd7a6b1bdb8c21ace7d3ec4f0959c989/src/env.ts#L16C1-L25C2
export function isCodingAgent() {
  if (process.env.ANTIGRAVITY_CLI_ALIAS)
    return 'antigravity';
  if (process.env.CLAUDECODE)
    return 'claude_code';
  if (process.env.CLINE_ACTIVE)
    return 'cline';
  if (process.env.CODEX_SANDBOX)
    return 'codex_cli';
  if (process.env.CURSOR_AGENT)
    return 'cursor';
  if (process.env.GEMINI_CLI)
    return 'gemini_cli';
  if (process.env.OPENCODE)
    return 'open_code';
}

// Indicate that this and child processes are running under Playwright Test.
export function setPlaywrightTestProcessEnv() {
  return process.env['PLAYWRIGHT_TEST'] = '1';
}
