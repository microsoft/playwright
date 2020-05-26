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

import * as sourceMap from './sourceMap';
import { getFromENV } from '../helper';

let debugMode: boolean | undefined;
export function isDebugMode(): boolean {
  if (debugMode === undefined)
    debugMode = !!getFromENV('PLAYWRIGHT_DEBUG_UI');
  return debugMode;
}

let sourceUrlCounter = 0;
const playwrightSourceUrlPrefix = '__playwright_evaluation_script__';
const sourceUrlRegex = /^[\040\t]*\/\/[@#] sourceURL=\s*(\S*?)\s*$/m;
export function generateSourceUrl(): string {
  return `\n//# sourceURL=${playwrightSourceUrlPrefix}${sourceUrlCounter++}\n`;
}

export function isPlaywrightSourceUrl(s: string): boolean {
  return s.startsWith(playwrightSourceUrlPrefix);
}

export function ensureSourceUrl(expression: string): string {
  return sourceUrlRegex.test(expression) ? expression : expression + generateSourceUrl();
}

export async function generateSourceMapUrl(functionText: string, generatedText: string): Promise<string> {
  if (!isDebugMode())
    return generateSourceUrl();
  const sourceMapUrl = await sourceMap.generateSourceMapUrl(functionText, generatedText);
  return sourceMapUrl || generateSourceUrl();
}
